import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import multer from 'multer';
import {
  CONSULTATION_DOCUMENT_MAX_BYTES,
  CONSULTATION_DOCUMENT_MIME_TYPES,
} from '@anuva/shared';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Where prescription / diet-plan files land. Defaults to a repo-local directory so the feature
 * works on a fresh checkout; production should point this at the mounted volume that is backed up,
 * because these are medical records.
 */
export const CONSULTATION_DOC_DIR =
  process.env.CONSULTATION_DOC_DIR?.trim() ||
  path.join(__dirname, '../../../.data/consultation-documents');

const EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'application/pdf': 'pdf',
};

const ALLOWED_MIME_TYPES = new Set<string>(CONSULTATION_DOCUMENT_MIME_TYPES);

/**
 * Files are buffered in memory, not streamed to disk, so nothing is written until the route has
 * confirmed the caller owns the consultation. The 10MB cap is what keeps that safe.
 */
export const uploadConsultationDocument = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: CONSULTATION_DOCUMENT_MAX_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(new UnsupportedDocumentTypeError(file.mimetype));
      return;
    }
    cb(null, true);
  },
}).single('file');

export class UnsupportedDocumentTypeError extends Error {
  constructor(mimeType: string) {
    super(
      `${mimeType || 'That file type'} is not accepted. Upload a JPEG, PNG, WebP, HEIC, or PDF.`,
    );
  }
}

/**
 * The browser's Content-Type is a claim, not a fact. Sniffing the leading bytes stops a script or
 * an HTML page arriving labelled as a JPEG and later being served back with an image content type.
 */
export function sniffDocumentMimeType(buffer: Buffer): string | null {
  if (buffer.length < 12) {
    return null;
  }

  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }

  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'image/png';
  }

  if (buffer.subarray(0, 4).toString('ascii') === '%PDF') {
    return 'application/pdf';
  }

  if (
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }

  // HEIC/HEIF are ISO-BMFF: a `ftyp` box whose brand names the flavour. iPhone photos land here.
  if (buffer.subarray(4, 8).toString('ascii') === 'ftyp') {
    const brand = buffer.subarray(8, 12).toString('ascii');
    if (/^(heic|heix|hevc|heim|heis|hevm|hevs|mif1|msf1)$/.test(brand)) {
      return brand === 'mif1' || brand === 'msf1' ? 'image/heif' : 'image/heic';
    }
  }

  return null;
}

/**
 * Writes the uploaded bytes and returns the path to store on the row. The name is generated here —
 * the doctor's filename is only ever kept as display text, so a crafted name cannot escape the
 * directory or collide with another consultation's file.
 */
export async function writeConsultationDocument(args: {
  consultationId: string;
  mimeType: string;
  buffer: Buffer;
}): Promise<string> {
  const extension = EXTENSION_BY_MIME[args.mimeType] ?? 'bin';
  const relativePath = path.posix.join(
    sanitizeIdSegment(args.consultationId),
    `${crypto.randomUUID()}.${extension}`,
  );
  const absolutePath = resolveConsultationDocumentPath(relativePath);

  if (!absolutePath) {
    throw new Error(`Refusing to write outside the document root: ${relativePath}`);
  }

  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, args.buffer);

  return relativePath;
}

/**
 * Maps a stored relative path back to disk, returning null if it would resolve outside the root.
 * Paths are generated server-side, so this is defence in depth against a tampered DB row.
 */
export function resolveConsultationDocumentPath(storagePath: string): string | null {
  const root = path.resolve(CONSULTATION_DOC_DIR);
  const resolved = path.resolve(root, storagePath);

  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    return null;
  }

  return resolved;
}

function sanitizeIdSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '_');
}

/** Never trusted for a filesystem path — this is only for the Content-Disposition header. */
export function safeDownloadName(originalName: string, mimeType: string): string {
  const extension = EXTENSION_BY_MIME[mimeType] ?? 'bin';
  const base = path
    .basename(originalName)
    .replace(/\.[^.]*$/, '')
    .replace(/[^a-zA-Z0-9 _-]/g, '')
    .trim()
    .slice(0, 60);

  return `${base || 'document'}.${extension}`;
}
