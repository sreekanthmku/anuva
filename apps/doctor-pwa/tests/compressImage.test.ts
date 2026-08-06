import { afterEach, describe, expect, it, vi } from 'vitest';
import { compressImageForUpload } from '../src/features/bookings/compressImage';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('compressImageForUpload', () => {
  it('returns non-image files untouched (PDF passthrough)', async () => {
    const pdf = new File(['%PDF-1.4'], 'rx.pdf', { type: 'application/pdf' });
    const result = await compressImageForUpload(pdf);
    expect(result).toBe(pdf);
  });

  it('returns non-image files untouched when type is empty', async () => {
    const file = new File(['bytes'], 'notes.bin', { type: '' });
    const result = await compressImageForUpload(file);
    expect(result).toBe(file);
  });

  it('returns the original image when createImageBitmap fails (e.g. HEIC)', async () => {
    const heic = new File(['fake'], 'photo.heic', { type: 'image/heic' });
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => {
        throw new Error('decode failed');
      }),
    );

    const result = await compressImageForUpload(heic);
    expect(result).toBe(heic);
  });

  it('returns an already-small JPEG without resizing', async () => {
    const jpeg = new File([new Uint8Array([0xff, 0xd8, 0xff])], 'shot.jpg', {
      type: 'image/jpeg',
    });
    const close = vi.fn();
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => ({
        width: 800,
        height: 600,
        close,
      })),
    );

    const result = await compressImageForUpload(jpeg);
    expect(result).toBe(jpeg);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('returns an already-small PNG without resizing', async () => {
    const png = new File([new Uint8Array([0x89, 0x50])], 'shot.png', { type: 'image/png' });
    const close = vi.fn();
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => ({
        width: 1200,
        height: 900,
        close,
      })),
    );

    const result = await compressImageForUpload(png);
    expect(result).toBe(png);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('returns the original when canvas 2d context is unavailable', async () => {
    // Oversized WebP forces the resize path (scale < 1 or non jpeg/png).
    const webp = new File([new Uint8Array(100)], 'big.webp', { type: 'image/webp' });
    const close = vi.fn();
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => ({
        width: 4000,
        height: 3000,
        close,
      })),
    );
    vi.stubGlobal('document', {
      createElement: vi.fn(() => ({
        width: 0,
        height: 0,
        getContext: () => null,
        toBlob: vi.fn(),
      })),
    });

    const result = await compressImageForUpload(webp);
    expect(result).toBe(webp);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('returns a compressed JPEG when canvas resize yields a smaller blob', async () => {
    const originalBytes = new Uint8Array(5000).fill(7);
    const webp = new File([originalBytes], 'clinic-photo.webp', {
      type: 'image/webp',
      lastModified: 1_700_000_000_000,
    });
    const close = vi.fn();
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => ({
        width: 4000,
        height: 3000,
        close,
      })),
    );

    const smallerBlob = new Blob([new Uint8Array(200)], { type: 'image/jpeg' });
    const drawImage = vi.fn();
    vi.stubGlobal('document', {
      createElement: vi.fn(() => ({
        width: 0,
        height: 0,
        getContext: () => ({ drawImage }),
        toBlob: (cb: BlobCallback) => {
          cb(smallerBlob);
        },
      })),
    });

    const result = await compressImageForUpload(webp);
    expect(result).not.toBe(webp);
    expect(result.type).toBe('image/jpeg');
    expect(result.name).toBe('clinic-photo.jpg');
    expect(result.lastModified).toBe(1_700_000_000_000);
    expect(result.size).toBe(200);
    expect(drawImage).toHaveBeenCalled();
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('keeps the original when the compressed blob is not smaller', async () => {
    const originalBytes = new Uint8Array(100).fill(1);
    const webp = new File([originalBytes], 'tiny.webp', { type: 'image/webp' });
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => ({
        width: 3000,
        height: 2000,
        close: vi.fn(),
      })),
    );

    const largerBlob = new Blob([new Uint8Array(500)], { type: 'image/jpeg' });
    vi.stubGlobal('document', {
      createElement: vi.fn(() => ({
        width: 0,
        height: 0,
        getContext: () => ({ drawImage: vi.fn() }),
        toBlob: (cb: BlobCallback) => {
          cb(largerBlob);
        },
      })),
    });

    const result = await compressImageForUpload(webp);
    expect(result).toBe(webp);
  });

  it('keeps the original when toBlob returns null', async () => {
    const webp = new File([new Uint8Array(200)], 'fail.webp', { type: 'image/webp' });
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => ({
        width: 3000,
        height: 2000,
        close: vi.fn(),
      })),
    );
    vi.stubGlobal('document', {
      createElement: vi.fn(() => ({
        width: 0,
        height: 0,
        getContext: () => ({ drawImage: vi.fn() }),
        toBlob: (cb: BlobCallback) => {
          cb(null);
        },
      })),
    });

    const result = await compressImageForUpload(webp);
    expect(result).toBe(webp);
  });

  /*
   * Note: the real browser canvas.encode path (document.createElement('canvas') + toBlob)
   * is covered above with mocks. A live browser canvas path is skipped here — Node/vitest
   * has no reliable ImageBitmap decoder for real camera JPEGs without a DOM polyfill pack.
   */
});
