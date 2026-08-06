const MAX_EDGE = 2000;
const JPEG_QUALITY = 0.82;

/**
 * Shrinks a camera photo before upload. A modern phone shoots 8–12MB, which is well over the 10MB
 * server cap and pointless for a prescription — 2000px on the long edge stays legible while landing
 * around 400KB, so the upload finishes on clinic 4G.
 *
 * Anything that is not a canvas-decodable image (PDF, HEIC on browsers without a decoder) is
 * returned untouched; the server accepts those formats as they are.
 */
export async function compressImageForUpload(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) {
    return file;
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    // Safari before 17 cannot decode HEIC here. The original is within the cap often enough, and a
    // failed resize must not block the upload.
    return file;
  }

  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));

  // Already small and already a format the server serves back as-is: nothing to gain.
  if (scale === 1 && (file.type === 'image/jpeg' || file.type === 'image/png')) {
    bitmap.close();
    return file;
  }

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);

  const context = canvas.getContext('2d');
  if (!context) {
    bitmap.close();
    return file;
  }

  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY);
  });

  if (!blob || blob.size >= file.size) {
    return file;
  }

  const name = file.name.replace(/\.[^.]*$/, '') || 'photo';
  return new File([blob], `${name}.jpg`, { type: 'image/jpeg', lastModified: file.lastModified });
}
