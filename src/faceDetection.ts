import * as faceapi from '@vladmandic/face-api';

let modelsLoaded = false;

const LOCAL_MODEL_PATH = `${window.location.origin}/models`;
const CDN_MODEL_PATH = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model';

/**
 * Ensures all required lightweight face-api.js models are loaded.
 * Attempts to load locally first, then falls back to the public CDN if local files are blocked.
 */
export async function ensureModelsLoaded(): Promise<void> {
  if (modelsLoaded) return;

  // Try loading locally first
  try {
    console.log(`[Biometrics] Attempting to load models locally from: ${LOCAL_MODEL_PATH}`);
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(LOCAL_MODEL_PATH),
      faceapi.nets.faceLandmark68Net.loadFromUri(LOCAL_MODEL_PATH),
      faceapi.nets.faceRecognitionNet.loadFromUri(LOCAL_MODEL_PATH)
    ]);
    modelsLoaded = true;
    console.log('[Biometrics] Models loaded locally.');
    return;
  } catch (error) {
    console.warn('[Biometrics] Local model load failed, trying CDN...', error);
  }

  // Fallback to stable CDN
  try {
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(CDN_MODEL_PATH),
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
 * Converts a live HTMLVideoElement frame into an off-screen HTMLCanvasElement.
 * This guarantees stable, non-zero dimensions and prevents the browser or TFJS 
 * from processing uninitialized, blank, or partially loaded video frames,
 * resolving the "Box.constructor" null error.
 */
function captureVideoFrameToCanvas(videoElement: HTMLVideoElement): HTMLCanvasElement | null {
  if (
    !videoElement ||
    videoElement.readyState < 2 || // HAVE_CURRENT_DATA (ensures frame data is available)
    videoElement.videoWidth === 0 ||
    videoElement.videoHeight === 0
  ) {
    console.warn('[Biometrics] Video stream is not fully ready or rendering active frames.');
    return null;
  }

  const canvas = document.createElement('canvas');
  canvas.width = videoElement.videoWidth;
  canvas.height = videoElement.videoHeight;
  const ctx = canvas.getContext('2d');

  if (!ctx) return null;

  // Draw the current video frame onto the off-screen canvas
  ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/**
 * Captures a frame from the webcam and extracts the 128-float face descriptor array.
 * Uses the stable off-screen canvas to guarantee valid bounding boxes.
 * 
 * @param videoElement The HTMLVideoElement stream from the webcam
 * @returns 128-float face descriptor array, or null if no face is detected
 */
export async function generateFaceDescriptor(videoElement: HTMLVideoElement): Promise<Float32Array | null> {
  await ensureModelsLoaded();

  // Convert live frame to a stable, off-screen static canvas
  const canvas = captureVideoFrameToCanvas(videoElement);
  if (!canvas) {
    return null;
  }

  try {
    // TinyFaceDetector options configured for optimal speed and reliability
    const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 });

    // Run detection on the canvas instead of the active video stream
    const detection = await faceapi.detectSingleFace(canvas, options)
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!detection) {
      return null;
    }

    // Returns the Float32Array containing 128 points
    return detection.descriptor;
  } catch (error) {
    console.error('Error in generateFaceDescriptor:', error);
    return null;
  }
}

/**
 * Checks if multiple faces are present in the video stream to trigger privacy warnings.
 * 
 * @param videoElement The HTMLVideoElement stream from the webcam
 * @returns true if more than one face is detected, false otherwise
 */
export async function detectMultipleFaces(videoElement: HTMLVideoElement): Promise<boolean> {
  await ensureModelsLoaded();

  const canvas = captureVideoFrameToCanvas(videoElement);
  if (!canvas) {
    return false;
  }

  try {
    const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.4 });
    const detections = await faceapi.detectAllFaces(canvas, options);
    return detections.length > 1;
  } catch (error) {
    console.error('Error in detectMultipleFaces:', error);
    return false;
  }
}

/**
 * Calculates the Euclidean distance between two face descriptors (128-float arrays).
 * A distance threshold of < 0.6 indicates that the faces match.
 */
export function compareFaces(descriptor1: Float32Array, descriptor2: Float32Array): boolean {
  if (descriptor1.length !== descriptor2.length) {
    console.warn('Descriptor length mismatch. Cannot compare.');
    return false;
  }

  let sumSquareDiff = 0;
  for (let i = 0; i < descriptor1.length; i++) {
    const diff = descriptor1[i] - descriptor2[i];
    sumSquareDiff += diff * diff;
  }

  const distance = Math.sqrt(sumSquareDiff);
  console.log(`Face match distance calculated: ${distance.toFixed(4)} (Threshold: < 0.6)`);

  return distance < 0.6;
}