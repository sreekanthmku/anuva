/**
 * Library artwork is authored at hero width. A 56px card thumbnail does not need 1200px of it, so
 * the width parameter is rewritten per use — the CDN resizes on the fly, and each size is cached
 * separately.
 */
export function libraryImage(url: string, width: number): string {
  try {
    const parsed = new URL(url);
    parsed.searchParams.set('w', String(width));
    return parsed.toString();
  } catch {
    // Not a URL we can rewrite (a local path, say) — serve it as authored.
    return url;
  }
}
