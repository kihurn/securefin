import * as faceapi from '@vladmandic/face-api';

let modelsLoaded = false;

const LOCAL_MODEL_PATH = `${window.location.origin}/models`;
const CDN_MODEL_PATH = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model';

/**
 * Ensures all required face-api.js models are loaded.
 * Swapped out the SSD Mobilenet v1 model for the highly stable and fast Tiny Face Detector.
 */
export async function ensureModelsLoaded(): Promise<void> {
  if (modelsLoaded) return;
  
  // Try to set tfjs backend to 'cpu' for absolute reliability on Apple Silicon Mac Chrome
  try {
    console.log('[Biometrics] Original tfjs backend:', (faceapi.tf as any).getBackend());
    await (faceapi.tf as any).setBackend('cpu');
    console.log('[Biometrics] Enforced tfjs CPU backend for high reliability and to prevent macOS WebGL crashes.');
  } catch (backendError) {
    console.warn('[Biometrics] Could not set tfjs backend to CPU, using default:', backendError);
  }

  // Try loading locally first
  try {
    console.log(`[Biometrics] Attempting to load models locally from: ${LOCAL_MODEL_PATH}`);
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(LOCAL_MODEL_PATH), // Swapped to Tiny Face Detector
      faceapi.nets.faceLandmark68Net.loadFromUri(LOCAL_MODEL_PATH),
      faceapi.nets.faceRecognitionNet.loadFromUri(LOCAL_MODEL_PATH)
    ]);
    modelsLoaded = true;
    console.log('[Biometrics] Models loaded locally.');
    return;
  } catch (error) {
    console.warn('[Biometrics] Local model load failed, trying CDN fallback...', error);
  }

  // Fallback to stable CDN
  try {
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(CDN_MODEL_PATH), // Swapped to Tiny Face Detector
      faceapi.nets.faceLandmark68Net.loadFromUri(CDN_MODEL_PATH),
      faceapi.nets.faceRecognitionNet.loadFromUri(CDN_MODEL_PATH)
    ]);
    modelsLoaded = true;
    console.log('[Biometrics] Models loaded from CDN.');
  } catch (error) {
    console.error('[Biometrics] Critical: Model loading failed:', error);
    throw error;
  }
}

/**
 * Ensures a HTMLVideoElement is fully loaded, playing, and has valid non-zero dimensions
 * before face-api.js processes it, preventing Box.constructor/null-dimension errors.
 */
export async function awaitVideoReady(video: HTMLVideoElement, timeoutMs = 5000): Promise<boolean> {
  if (!video) return false;
  
  if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
    return true;
  }

  // Attempt to call play() in case it was paused or autoplay was blocked
  try {
    if (video.paused) {
      await video.play();
    }
  } catch (err) {
    console.warn('awaitVideoReady: play() failed or was blocked:', err);
  }

  if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
    return true;
  }

  return new Promise((resolve) => {
    let completed = false;
    
    const done = (success: boolean) => {
      if (completed) return;
      completed = true;
      video.removeEventListener('loadedmetadata', onLoaded);
      video.removeEventListener('canplay', onLoaded);
      video.removeEventListener('playing', onLoaded);
      clearTimeout(timeout);
      resolve(success);
    };

    const onLoaded = () => {
      if (video.videoWidth > 0 && video.videoHeight > 0 && video.readyState >= 2) {
        done(true);
      }
    };

    video.addEventListener('loadedmetadata', onLoaded);
    video.addEventListener('canplay', onLoaded);
    video.addEventListener('playing', onLoaded);

    const timeout = setTimeout(() => {
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        done(true);
      } else {
        done(false);
      }
    }, timeoutMs);
  });
}

// Mutex-lock for serializing face-api.js inferences to guarantee thread-safety
// and completely eliminate WebGL/WASM tensor race conditions on overlapping scans.
let inferenceLock = Promise.resolve();

async function runInferenceSecure<T>(fn: () => Promise<T>): Promise<T> {
  const currentLock = inferenceLock;
  let resolveLock: () => void;
  inferenceLock = new Promise((resolve) => {
    resolveLock = resolve;
  });
  
  await currentLock;
  try {
    return await fn();
  } finally {
    resolveLock!();
  }
}

/**
 * Converts a live HTMLVideoElement frame into an off-screen HTMLCanvasElement.
 * Guarantees stable, non-zero dimensions before running detection.
 */
function captureVideoFrameToCanvas(videoElement: HTMLVideoElement): HTMLCanvasElement | null {
  if (
    !videoElement || 
    videoElement.readyState < 2 || // HAVE_CURRENT_DATA
    videoElement.currentTime === 0 || // Ensure at least one physical frame has been decoded
    videoElement.videoWidth === 0 || 
    videoElement.videoHeight === 0
  ) {
    console.warn('[Biometrics] Video stream is warming up. Skipping empty frame.');
    return null;
  }

  const canvas = document.createElement('canvas');
  
  // Scale down resolution to max 320px width/height for high-performance lightweight processing
  const maxDim = 320;
  let width = videoElement.videoWidth;
  let height = videoElement.videoHeight;
  if (width > maxDim || height > maxDim) {
    if (width > height) {
      height = Math.round((height * maxDim) / width);
      width = maxDim;
    } else {
      width = Math.round((width * maxDim) / height);
      height = maxDim;
    }
  }
  
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  
  if (!ctx) return null;
  
  // Draw the current video frame onto the off-screen canvas
  ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export interface FaceDetectionResult {
  multipleDetected: boolean;
  descriptor: Float32Array | null;
}

/**
 * Unified single-pass face detection.
 * Executes face detection, landmark identification, and biometric descriptor computation 
 * in ONE single pass using the fast Tiny Face Detector.
 */
export async function detectFacesFull(videoElement: HTMLVideoElement): Promise<FaceDetectionResult> {
  await ensureModelsLoaded();
  
  return runInferenceSecure(async () => {
    try {
      const isReady = await awaitVideoReady(videoElement);
      if (!isReady) {
        console.warn('detectFacesFull: Video element not ready.');
        return { multipleDetected: false, descriptor: null };
      }

      const canvas = captureVideoFrameToCanvas(videoElement);
      if (!canvas) {
        return { multipleDetected: false, descriptor: null };
      }

      const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.4 });
      
      try {
        const detections = await faceapi.detectAllFaces(canvas, options)
          .withFaceLandmarks()
          .withFaceDescriptors();

        if (detections.length === 0) {
          console.log("No face detected in this frame.");
          return { multipleDetected: false, descriptor: null };
        }

        const multipleDetected = detections.length > 1;
        const descriptor = detections[0].descriptor;

        return {
          multipleDetected,
          descriptor
        };
      } catch (innerError: any) {
        // Intercept any internal face-api.js Box.constructor exceptions gracefully
        if (
          innerError instanceof Error &&
          (innerError.message.includes('Box.constructor') || innerError.message.includes('expected box to be'))
        ) {
          console.log("No face detected in this frame. (Intercepted Box.constructor crash)");
          return { multipleDetected: false, descriptor: null };
        }
        throw innerError;
      }
    } catch (error) {
      console.error('Error in detectFacesFull unified pass:', error);
      throw error;
    }
  });
}

/**
 * Captures a frame and extracts the 128-float face descriptor array.
 * Uses the fast, low-footprint Tiny Face Detector.
 */
export async function generateFaceDescriptor(videoElement: HTMLVideoElement): Promise<Float32Array | null> {
  await ensureModelsLoaded();

  return runInferenceSecure(async () => {
    const canvas = captureVideoFrameToCanvas(videoElement);
    if (!canvas) {
      return null;
    }
    
    try {
      // Configure Tiny Face Detector Options
      const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.4 });
      
      // Run detection on the canvas instead of the active video stream
      const detection = await faceapi.detectSingleFace(canvas, options)
        .withFaceLandmarks()
        .withFaceDescriptor();
        
      if (!detection) {
        return null;
      }
      
      // Returns the Float32Array containing 128 points
      return detection.descriptor;
    } catch (error: any) {
      // Intercept any internal face-api.js Box.constructor exceptions gracefully
      if (
        error instanceof Error &&
        (error.message.includes('Box.constructor') || error.message.includes('expected box to be'))
      ) {
        console.log("No face detected in this frame. (Intercepted Box.constructor crash)");
        return null;
      }
      console.error('Error in generateFaceDescriptor:', error);
      return null;
    }
  });
}

/**
 * Checks if multiple faces are present in the video stream to trigger privacy warnings.
 */
export async function detectMultipleFaces(videoElement: HTMLVideoElement): Promise<boolean> {
  await ensureModelsLoaded();

  return runInferenceSecure(async () => {
    const canvas = captureVideoFrameToCanvas(videoElement);
    if (!canvas) {
      return false;
    }
    
    try {
      const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.4 });
      const detections = await faceapi.detectAllFaces(canvas, options);
      return detections.length > 1;
    } catch (error: any) {
      // Intercept any internal face-api.js Box.constructor exceptions gracefully
      if (
        error instanceof Error &&
        (error.message.includes('Box.constructor') || error.message.includes('expected box to be'))
      ) {
        console.log("No multiple faces detected. (Intercepted Box.constructor crash)");
        return false;
      }
      console.error('Error in detectMultipleFaces:', error);
      return false;
    }
  });
}

/**
 * Calculates Euclidean distance between two face descriptors.
 */
export function calculateDistance(descriptor1: Float32Array, descriptor2: Float32Array): number {
  if (descriptor1.length !== descriptor2.length) {
    console.warn('Descriptor length mismatch. Returning max default distance.');
    return 1.0;
  }
  
  let sumSquareDiff = 0;
  for (let i = 0; i < descriptor1.length; i++) {
    const diff = descriptor1[i] - descriptor2[i];
    sumSquareDiff += diff * diff;
  }
  
  return Math.sqrt(sumSquareDiff);
}

/**
 * Calculates a confidence score (percentage) based on Euclidean distance and match threshold.
 */
export function getConfidenceScore(distance: number, threshold = 0.48): number {
  if (distance < 0) return 100;
  if (distance <= threshold) {
    const ratio = distance / threshold;
    return Math.round(100 - ratio * 30); // 70% to 100% confidence for correct match
  } else {
    const ratio = Math.min(1.0, (distance - threshold) / threshold);
    return Math.round(70 - ratio * 70); // 0% to 70% confidence for mismatch
  }
}

/**
 * Calculates the Euclidean distance between two face descriptors and checks if they match.
 * Default strict threshold is set to 0.48.
 */
export function compareFaces(descriptor1: Float32Array, descriptor2: Float32Array, threshold = 0.48): boolean {
  const distance = calculateDistance(descriptor1, descriptor2);
  const score = getConfidenceScore(distance, threshold);
  const isMatch = distance <= threshold;
  console.log(`[Biometrics] Distance: ${distance.toFixed(4)}, Score: ${score}%, Match: ${isMatch} (Threshold: <= ${threshold})`);
  return isMatch;
}

/**
 * Robust face descriptor parser to handle multiple representations, JSON stringification,
 * double stringification, and object formats without generating NaN elements.
 */
export function safeParseFaceDescriptor(input: any): Float32Array | null {
  if (!input) return null;
  
  let parsed = input;
  if (parsed instanceof Float32Array) {
    return parsed;
  }
  
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch (e: any) {
      console.warn('[safeParseFaceDescriptor] Parse step 1 failed:', e.message);
      return null;
    }
  }
  
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch (e: any) {
      console.warn('[safeParseFaceDescriptor] Parse step 2 failed:', e.message);
      return null;
    }
  }
  
  if (Array.isArray(parsed)) {
    const numArr = parsed.map(v => typeof v === 'number' ? v : parseFloat(v));
    if (numArr.some(isNaN)) {
      console.error('[safeParseFaceDescriptor] Parsed array contains NaN elements');
      return null;
    }
    return new Float32Array(numArr);
  }
  
  if (parsed && typeof parsed === 'object') {
    const arr: number[] = [];
    let isKeyNumeric = true;
    for (let i = 0; i < 128; i++) {
      if (parsed[i] !== undefined) {
        arr.push(typeof parsed[i] === 'number' ? parsed[i] : parseFloat(parsed[i]));
      } else {
        isKeyNumeric = false;
        break;
      }
    }
    if (isKeyNumeric && arr.length === 128) {
      return new Float32Array(arr);
    }
  }
  
  console.error('[safeParseFaceDescriptor] Unknown descriptor format:', typeof parsed);
  return null;
}
