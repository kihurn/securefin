import * as faceapi from '@vladmandic/face-api';

let modelsLoaded = false;

/**
 * Ensures all required lightweight face-api.js models are loaded.
 * Pointed to '/models' directory where pre-trained weight files are statically served.
 */
export async function ensureModelsLoaded(): Promise<void> {
  if (modelsLoaded) return;
  
  try {
    // Load Tiny Face Detector, 68-Point Landmarks, and Face Recognition models
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
      faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
      faceapi.nets.faceRecognitionNet.loadFromUri('/models')
    ]);
    modelsLoaded = true;
    console.log('Face Recognition models loaded successfully.');
  } catch (error) {
    console.error('Failed to load face-api.js models from /models:', error);
    throw error;
  }
}

/**
 * Captures a frame from the webcam <video> element and extracts the 128-float face descriptor array.
 * Uses the lightweight TinyFaceDetector for fast browser execution.
 * 
 * @param videoElement The HTMLVideoElement stream from the webcam
 * @returns 128-float face descriptor array, or null if no face is detected
 */
export async function generateFaceDescriptor(videoElement: HTMLVideoElement): Promise<Float32Array | null> {
  await ensureModelsLoaded();
  
  try {
    // TinyFaceDetector options configured for optimal speed and reliability
    const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 });
    
    const detection = await faceapi.detectSingleFace(videoElement, options)
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
  
  try {
    const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.4 });
    const detections = await faceapi.detectAllFaces(videoElement, options);
    return detections.length > 1;
  } catch (error) {
    console.error('Error in detectMultipleFaces:', error);
    return false;
  }
}

/**
 * Calculates the Euclidean distance between two face descriptors (128-float arrays).
 * A distance threshold of < 0.6 indicates that the faces match.
 * 
 * @param descriptor1 First Float32Array descriptor
 * @param descriptor2 Second Float32Array descriptor
 * @returns boolean indicating whether the descriptors represent the same face
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
