// Where note recordings and photos live, and how their bytes are checked.
//
// Same rules as consultation documents: uploads are held in memory until the route has decided to
// keep them, the type is read from the bytes rather than taken from the browser, the path is
// generated here, and a file is only ever served through an ownership-checked route.

import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import multer from 'multer';
import { HEALTH_NOTE_AUDIO_MAX_BYTES, HEALTH_NOTE_IMAGE_MAX_BYTES } from '@anuva/shared';
import { logger } from '../logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const log = logger.child({ module: 'health-notes-storage' });

/**
 * Read lazily so tests can point it at a temp directory. Production should set HEALTH_NOTE_DIR to
 * the same backed-up volume as CONSULTATION_DOC_DIR: a shared note's photo is part of a medical record.
 */
export function healthNoteDir(): string {
  return (
    process.env.HEALTH_NOTE_DIR?.trim() || path.join(__dirname, '../../../../.data/health-notes')
  );
}

const EXTENSION_BY_MIME: Record<string, string> = {
  'audio/webm': 'webm',
  'audio/mp4': 'm4a',
  'audio/ogg': 'ogg',
  'audio/wav': 'wav',
  'audio/mpeg': 'mp3',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export function extensionFor(mimeType: string): string {
  return EXTENSION_BY_MIME[mimeType] ?? 'bin';
}

/** The type is checked from the bytes after upload, so multer only enforces size and count. */
export const uploadNoteAudio = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: HEALTH_NOTE_AUDIO_MAX_BYTES, files: 1 },
}).single('file');

export const uploadNoteImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: HEALTH_NOTE_IMAGE_MAX_BYTES, files: 1 },
}).single('file');

/**
 * Reads the container from the leading bytes. Safari records `audio/mp4`; Chrome and Android record
 * `audio/webm`. An MP4 is told apart from a HEIC photo by its brand, which is why this is not shared
 * with the image sniffer.
 */
export function sniffAudioMimeType(buffer: Buffer): string | null {
  if (buffer.length < 12) return null;

  if (buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3) {
    return 'audio/webm';
  }
  if (buffer.subarray(4, 8).toString('ascii') === 'ftyp') {
    const brand = buffer.subarray(8, 12).toString('ascii');
    if (/^(M4A |M4B |mp41|mp42|isom|iso[2-9]|dash|3gp\d|3g2\w|avc1|MSNV)$/.test(brand)) {
      return 'audio/mp4';
    }
    return null;
  }
  if (buffer.subarray(0, 4).toString('ascii') === 'OggS') return 'audio/ogg';
  if (
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WAVE'
  ) {
    return 'audio/wav';
  }
  if (buffer.subarray(0, 3).toString('ascii') === 'ID3') return 'audio/mpeg';
  // A bare MPEG audio frame: 11 sync bits.
  if (buffer[0] === 0xff && ((buffer[1] ?? 0) & 0xe0) === 0xe0) return 'audio/mpeg';

  return null;
}

/** Only what OpenAI's vision input reads. HEIC is refused here and converted on the phone. */
export function sniffImageMimeType(buffer: Buffer): string | null {
  if (buffer.length < 12) return null;

  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'image/png';
  }
  if (
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
}

/** Writes the bytes under her own folder and returns the relative path to store on the row. */
export async function writeNoteFile(args: {
  userId: string;
  mimeType: string;
  buffer: Buffer;
}): Promise<string> {
  const relativePath = path.posix.join(
    args.userId.replace(/[^a-zA-Z0-9_-]/g, '_'),
    `${crypto.randomUUID()}.${extensionFor(args.mimeType)}`,
  );
  const absolutePath = resolveNoteFilePath(relativePath);
  if (!absolutePath) {
    throw new Error(`Refusing to write outside the note root: ${relativePath}`);
  }

  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, args.buffer, { mode: 0o600 });
  return relativePath;
}

/** Null if a stored path would land outside the root — defence in depth against a tampered row. */
export function resolveNoteFilePath(storagePath: string): string | null {
  const root = path.resolve(healthNoteDir());
  const resolved = path.resolve(root, storagePath);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    return null;
  }
  return resolved;
}

/** A file already gone is not an error: a previous run may have stopped between unlink and commit. */
export async function unlinkNoteFile(storagePath: string): Promise<void> {
  const absolute = resolveNoteFilePath(storagePath);
  if (!absolute) return;
  try {
    await fs.unlink(absolute);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      log.error({ err: error }, 'Failed to unlink note file');
    }
  }
}
