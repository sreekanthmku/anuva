import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CONSULTATION_DOC_DIR,
  resolveConsultationDocumentPath,
  safeDownloadName,
  sniffDocumentMimeType,
  UnsupportedDocumentTypeError,
} from '../src/consultationDocuments.js';

/** Pad to ≥12 bytes so length checks pass while keeping a known signature prefix. */
function padded(signature: Buffer, total = 16): Buffer {
  if (signature.length >= total) return signature.subarray(0, total);
  return Buffer.concat([signature, Buffer.alloc(total - signature.length, 0)]);
}

describe('sniffDocumentMimeType', () => {
  it('detects JPEG from SOI marker', () => {
    expect(sniffDocumentMimeType(padded(Buffer.from([0xff, 0xd8, 0xff, 0xe0])))).toBe('image/jpeg');
  });

  it('detects PNG from magic bytes', () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(sniffDocumentMimeType(padded(png))).toBe('image/png');
  });

  it('detects PDF from %PDF header', () => {
    expect(sniffDocumentMimeType(padded(Buffer.from('%PDF-1.7')))).toBe('application/pdf');
  });

  it('detects WebP from RIFF....WEBP', () => {
    const webp = Buffer.alloc(12);
    webp.write('RIFF', 0);
    webp.writeUInt32LE(0, 4);
    webp.write('WEBP', 8);
    expect(sniffDocumentMimeType(webp)).toBe('image/webp');
  });

  it('detects HEIC brands as image/heic', () => {
    const heic = Buffer.alloc(12);
    heic.write('ftyp', 4);
    heic.write('heic', 8);
    expect(sniffDocumentMimeType(heic)).toBe('image/heic');

    const heix = Buffer.alloc(12);
    heix.write('ftyp', 4);
    heix.write('heix', 8);
    expect(sniffDocumentMimeType(heix)).toBe('image/heic');
  });

  it('detects HEIF brands mif1/msf1 as image/heif', () => {
    const mif1 = Buffer.alloc(12);
    mif1.write('ftyp', 4);
    mif1.write('mif1', 8);
    expect(sniffDocumentMimeType(mif1)).toBe('image/heif');

    const msf1 = Buffer.alloc(12);
    msf1.write('ftyp', 4);
    msf1.write('msf1', 8);
    expect(sniffDocumentMimeType(msf1)).toBe('image/heif');
  });

  it('returns null when buffer is too short', () => {
    expect(sniffDocumentMimeType(Buffer.from([0xff, 0xd8, 0xff]))).toBeNull();
    expect(sniffDocumentMimeType(Buffer.alloc(11))).toBeNull();
    expect(sniffDocumentMimeType(Buffer.alloc(0))).toBeNull();
  });

  it('returns null for unknown signatures', () => {
    expect(sniffDocumentMimeType(Buffer.alloc(16, 0x41))).toBeNull();
    expect(sniffDocumentMimeType(padded(Buffer.from('GIF89a')))).toBeNull();

    const badBrand = Buffer.alloc(12);
    badBrand.write('ftyp', 4);
    badBrand.write('isom', 8);
    expect(sniffDocumentMimeType(badBrand)).toBeNull();
  });
});

describe('resolveConsultationDocumentPath', () => {
  it('resolves a safe relative path under the document root', () => {
    const relative = path.posix.join('consult-abc', 'file-uuid.jpg');
    const resolved = resolveConsultationDocumentPath(relative);

    expect(resolved).not.toBeNull();
    expect(resolved).toBe(path.resolve(CONSULTATION_DOC_DIR, relative));
    expect(resolved!.startsWith(path.resolve(CONSULTATION_DOC_DIR) + path.sep)).toBe(true);
  });

  it('returns null for path traversal attempts', () => {
    expect(resolveConsultationDocumentPath('../outside.txt')).toBeNull();
    expect(resolveConsultationDocumentPath('../../etc/passwd')).toBeNull();
    expect(resolveConsultationDocumentPath('../../../etc/passwd')).toBeNull();
    expect(resolveConsultationDocumentPath(path.join('ok', '..', '..', 'escape.pdf'))).toBeNull();
  });
});

describe('safeDownloadName', () => {
  it('uses basename, strips unsafe chars, and maps mime to extension', () => {
    expect(safeDownloadName('Rx Scan.JPEG', 'image/jpeg')).toBe('Rx Scan.jpg');
    expect(safeDownloadName('/tmp/evil/../plan.pdf', 'application/pdf')).toBe('plan.pdf');
    expect(safeDownloadName('diet@plan#1!.png', 'image/png')).toBe('dietplan1.png');
    expect(safeDownloadName('photo.heic', 'image/webp')).toBe('photo.webp');
  });

  it('falls back to document.bin when name empties and mime is unknown', () => {
    expect(safeDownloadName('!!!', 'application/octet-stream')).toBe('document.bin');
    expect(safeDownloadName('', 'image/heic')).toBe('document.heic');
  });

  it('truncates long basenames to 60 characters before the extension', () => {
    const long = `${'a'.repeat(80)}.pdf`;
    const name = safeDownloadName(long, 'application/pdf');
    expect(name).toBe(`${'a'.repeat(60)}.pdf`);
  });
});

describe('UnsupportedDocumentTypeError', () => {
  it('names the rejected mime type in the message', () => {
    const err = new UnsupportedDocumentTypeError('text/html');
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toContain('text/html');
    expect(err.message).toMatch(/JPEG|PNG|WebP|HEIC|PDF/i);
  });

  it('uses a generic subject when mime type is empty', () => {
    const err = new UnsupportedDocumentTypeError('');
    expect(err.message).toContain('That file type');
  });
});

// writeConsultationDocument intentionally skipped: would write under CONSULTATION_DOC_DIR
// (module-load env). Prefer pure helpers only per Part 4 constraints.
