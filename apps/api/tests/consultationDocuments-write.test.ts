import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const DOC_TMP = await fs.mkdtemp(path.join(os.tmpdir(), 'anuva-consult-docs-'));

type ConsultationDocumentsModule = typeof import('../src/consultationDocuments.js');

let mod: ConsultationDocumentsModule;

beforeAll(async () => {
  process.env.CONSULTATION_DOC_DIR = DOC_TMP;
  vi.resetModules();
  mod = await import('../src/consultationDocuments.js');
});

afterAll(async () => {
  await fs.rm(DOC_TMP, { recursive: true, force: true });
});

function jpegBuffer(): Buffer {
  // Minimal SOI + padding so sniff would pass if called; write path trusts mimeType arg.
  return Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(12, 0)]);
}

function pngBuffer(): Buffer {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([sig, Buffer.alloc(8, 0)]);
}

function runUpload(
  mimeType: string,
  content: Buffer,
  filename = 'upload.bin',
): Promise<{ err: unknown; file: Express.Multer.File | undefined }> {
  const boundary = '----AnuvaTestBoundary';
  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
        `Content-Type: ${mimeType}\r\n\r\n`,
    ),
    content,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);

  const req = Readable.from([body]) as Readable & {
    headers: Record<string, string>;
    method: string;
    file?: Express.Multer.File;
  };
  req.headers = {
    'content-type': `multipart/form-data; boundary=${boundary}`,
    'content-length': String(body.length),
  };
  req.method = 'POST';

  const res = {} as unknown as import('express').Response;

  return new Promise((resolve) => {
    mod.uploadConsultationDocument(req as never, res, (err?: unknown) => {
      resolve({ err: err ?? null, file: req.file });
    });
  });
}

describe('writeConsultationDocument', () => {
  it('writes JPEG under the consultationId folder and returns a relative path', async () => {
    const consultationId = 'consult-abc-123';
    const buffer = jpegBuffer();

    const relative = await mod.writeConsultationDocument({
      consultationId,
      mimeType: 'image/jpeg',
      buffer,
    });

    expect(relative.startsWith(`${consultationId}/`)).toBe(true);
    expect(relative.endsWith('.jpg')).toBe(true);

    const absolute = path.join(DOC_TMP, relative);
    expect(absolute.startsWith(path.resolve(DOC_TMP) + path.sep)).toBe(true);

    const written = await fs.readFile(absolute);
    expect(written.equals(buffer)).toBe(true);
  });

  it('writes PNG and uses .png extension', async () => {
    const relative = await mod.writeConsultationDocument({
      consultationId: 'consult-png',
      mimeType: 'image/png',
      buffer: pngBuffer(),
    });

    expect(relative).toMatch(/^consult-png\/.+\.png$/);
    await expect(fs.access(path.join(DOC_TMP, relative))).resolves.toBeUndefined();
  });

  it('sanitizes weird consultation ids before nesting the file', async () => {
    const weirdId = '../../evil@id!/../escape';
    const relative = await mod.writeConsultationDocument({
      consultationId: weirdId,
      mimeType: 'image/jpeg',
      buffer: jpegBuffer(),
    });

    // sanitizeIdSegment: each non [a-zA-Z0-9_-] char → '_'
    // '../../evil@id!/../escape' → '______evil_id_____escape'
    const folder = relative.split('/')[0]!;
    expect(folder).toBe('______evil_id_____escape');
    expect(folder).not.toContain('..');
    expect(folder).not.toContain('@');
    expect(folder).not.toMatch(/[^a-zA-Z0-9_-]/);

    const absolute = path.resolve(DOC_TMP, relative);
    expect(absolute.startsWith(path.resolve(DOC_TMP) + path.sep)).toBe(true);
    await expect(fs.access(absolute)).resolves.toBeUndefined();
  });

  it('falls back to .bin for unknown mime types', async () => {
    const relative = await mod.writeConsultationDocument({
      consultationId: 'consult-bin',
      mimeType: 'application/octet-stream',
      buffer: Buffer.from('not-an-image-but-long-enough'),
    });

    expect(relative).toMatch(/^consult-bin\/.+\.bin$/);
    await expect(fs.access(path.join(DOC_TMP, relative))).resolves.toBeUndefined();
  });
});

describe('uploadConsultationDocument fileFilter', () => {
  it('accepts an allowed mime type', async () => {
    const { err, file } = await runUpload('image/jpeg', jpegBuffer(), 'scan.jpg');
    expect(err).toBeNull();
    expect(file).toBeDefined();
    expect(file!.mimetype).toBe('image/jpeg');
  });

  it('rejects a disallowed mime type via UnsupportedDocumentTypeError', async () => {
    const { err, file } = await runUpload('text/html', Buffer.from('<html></html>'), 'x.html');
    expect(err).toBeInstanceOf(mod.UnsupportedDocumentTypeError);
    expect((err as Error).message).toContain('text/html');
    expect(file).toBeUndefined();
  });
});
