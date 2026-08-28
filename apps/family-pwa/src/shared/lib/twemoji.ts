/**
 * Same Twemoji CDN the patient app uses (`apps/pwa/src/shared/lib/twemoji.ts`), duplicated rather
 * than shared because the two apps have no common frontend package. Keep the two in step: a gift
 * rendered here and the same gift opened over there should be the same picture.
 *
 * Rendering emoji as images rather than glyphs is what makes 💐 and 🍫 look the same on her
 * Android as on his iPhone — the gesture is the picture, so it cannot be left to the platform font.
 */
export function twemojiUrl(emoji: string): string {
  const cp = [...emoji]
    .map((c) => c.codePointAt(0)!.toString(16))
    .filter((c) => c !== 'fe0f')
    .join('-');
  return `https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/${cp}.svg`;
}
