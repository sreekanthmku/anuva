/**
 * Filename recovery for files pulled from an authenticated route as a blob.
 *
 * `fetch` + `Blob` throws away every response header, and `URL.createObjectURL` produces a
 * `blob:` URL with no path — so a document handed to WhatsApp or a download that way arrives
 * nameless ("unknown"). Rebuilding the name here lets the caller wrap the blob in a real `File`.
 */

const EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'application/pdf': 'pdf',
};

/** RFC 5987 `filename*` wins over `filename` — it is the one that survives non-ASCII names. */
function filenameFromDisposition(header: string | null | undefined): string | null {
  if (!header) return null;

  const encoded = /filename\*\s*=\s*(?:UTF-8|utf-8)''([^;]+)/.exec(header);
  if (encoded?.[1]) {
    try {
      const decoded = decodeURIComponent(encoded[1].trim());
      if (decoded) return decoded;
    } catch {
      // Malformed percent-encoding — fall through to the plain form.
    }
  }

  // Quoted form first: a name may legitimately contain the `;` the unquoted branch stops at.
  // `filename=""` reads as absent rather than as a name made of quote characters.
  const quoted = /filename\s*=\s*"([^"]*)"/.exec(header);
  if (quoted) {
    return (quoted[1] ?? '').trim() || null;
  }

  const token = /filename\s*=\s*([^;]+)/.exec(header);
  return token?.[1]?.trim() || null;
}

/**
 * A name a receiving app can act on: never empty, and always carrying an extension. WhatsApp and
 * iOS Files pick their preview from the extension, not the mime type, so a `.pdf`-less PDF shows
 * up as an unidentified attachment.
 */
export function consultationDocumentFileName(args: {
  /** The response's `Content-Disposition`, when the header was readable. */
  dispositionHeader?: string | null;
  /** Name the uploader gave the file, as stored on the document record. */
  originalName?: string | null;
  mimeType: string;
}): string {
  const extension = EXTENSION_BY_MIME[args.mimeType] ?? 'bin';

  const candidate = (filenameFromDisposition(args.dispositionHeader) ?? args.originalName ?? '')
    // Any directory part is display text here, never a path.
    .replace(/^.*[/\\]/, '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim();

  const base = candidate || `document.${extension}`;

  // An extension the file already has is left alone — a `.jpeg` upload should not become
  // `.jpeg.jpg`. Only a name with no extension at all gets one from the mime type.
  return /\.[a-z0-9]{1,5}$/i.test(base) ? base : `${base}.${extension}`;
}
