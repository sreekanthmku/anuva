/**
 * Recording and photo helpers for notes. Both stay on the phone until she taps send.
 */

/** Chrome and Android record WebM/Opus; Safari only records MP4/AAC. Both are read by the API. */
const RECORDER_TYPES: { mimeType: string; extension: string }[] = [
  { mimeType: 'audio/webm;codecs=opus', extension: 'webm' },
  { mimeType: 'audio/webm', extension: 'webm' },
  { mimeType: 'audio/mp4', extension: 'm4a' },
];

export function canRecordAudio(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.MediaRecorder !== 'undefined' &&
    Boolean(navigator.mediaDevices?.getUserMedia)
  );
}

export function recorderType(): { mimeType: string; extension: string } | null {
  if (!canRecordAudio()) return null;
  return RECORDER_TYPES.find((type) => MediaRecorder.isTypeSupported(type.mimeType)) ?? null;
}

/** The longest side a note photo is sent at. Plenty to read handwriting; a fraction of the upload. */
const MAX_PHOTO_SIDE = 2000;

/**
 * Re-encodes the photo as a JPEG no larger than MAX_PHOTO_SIDE. This also turns an iPhone HEIC into
 * something the reader accepts, and drops the location and camera details stored in the original.
 */
export async function preparePhoto(file: File): Promise<Blob> {
  const bitmap = await loadImage(file);
  const scale = Math.min(1, MAX_PHOTO_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('No canvas');
  context.drawImage(bitmap, 0, 0, width, height);
  if ('close' in bitmap) bitmap.close();

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not encode photo'))), 'image/jpeg', 0.86);
  });
}

async function loadImage(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      // Honour the phone's rotation flag, so a portrait page is not read sideways.
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      // Older Safari: fall through to an <img>, which decodes HEIC on iOS.
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function formatSeconds(total: number): string {
  const minutes = Math.floor(total / 60);
  const seconds = Math.floor(total % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
