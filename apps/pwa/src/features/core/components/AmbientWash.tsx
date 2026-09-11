import type { CSSProperties } from 'react';

/**
 * The ambient warmth behind a screen, tinted by how her day is going.
 *
 * Two soft radial washes over the cream ground — one at the top where the
 * header sits, one low on the right. Borrowed from the family app
 * (`apps/family-pwa/src/index.css`), which puts the same pair on `body`.
 * That does not work here: every route's `<main>` is `bg-surface` and
 * `h-[100dvh]`, so an opaque cream sheet covers the body entirely. Hence a
 * layer inside `<main>` instead, which is why the parent needs `isolate` (see
 * below).
 *
 * Why it follows the band rather than sitting at one fixed colour: the wash
 * shares the screen with `WellnessHeadlineCard`, whose own gradient already
 * cools from warm peach at "Great" to lavender-grey at "Very hard". A fixed
 * rose wash would put a warm pink ground behind a deliberately cool card on
 * exactly the week that card is trying to be gentle. So the two move together.
 *
 * Everything here stays weaker than the family app's 0.16 — this screen is
 * opened daily, often at 3am, and an ambient layer that is noticeable on the
 * fiftieth visit has stopped being ambient.
 */

/** Top wash, then the low-right accent. Ordered warm to cool, like the card. */
const BAND_WASH: Record<string, [string, string]> = {
  Great: ['rgba(201, 126, 146, 0.13)', 'rgba(184, 146, 60, 0.09)'],
  Good: ['rgba(201, 126, 146, 0.11)', 'rgba(184, 146, 60, 0.08)'],
  Okay: ['rgba(201, 126, 146, 0.09)', 'rgba(184, 146, 60, 0.06)'],
  // Rose gives way to mauve, and the gold drops back: warmth without cheer.
  Hard: ['rgba(160, 124, 164, 0.09)', 'rgba(184, 146, 60, 0.04)'],
  // The card's own end of the ladder. Plum replaces gold entirely.
  'Very hard': ['rgba(141, 116, 168, 0.10)', 'rgba(94, 53, 102, 0.04)'],
};

/**
 * Before the summary loads, and through the first two weeks when there is no
 * band at all. Sits between Good and Okay, so the change when a band does
 * arrive is imperceptible for the three middle bands and a slow cool for the
 * bottom two.
 */
const NEUTRAL_WASH: [string, string] = ['rgba(201, 126, 146, 0.10)', 'rgba(184, 146, 60, 0.07)'];

/**
 * Drop in as the first child of a route's `<main>`, which must carry `isolate`.
 *
 * `-z-10` puts the layer above `main`'s own background but below its content,
 * and that only holds if `main` is a stacking context — without `isolation`
 * the negative index escapes to the root and the layer paints *behind* the
 * opaque cream, i.e. invisibly.
 *
 * `fixed` rather than `absolute` so the page scrolls over a still wash instead
 * of dragging it along. `background-attachment: fixed` would say the same thing
 * in one line but is unreliable on iOS Safari, and `main` is the scroller here.
 */
export function AmbientWash({ band }: { band?: string | null }) {
  const [top, corner] = (band && BAND_WASH[band]) || NEUTRAL_WASH;

  const style: CSSProperties = {
    backgroundImage: [
      `radial-gradient(88% 46% at 50% -8%, ${top}, rgba(0, 0, 0, 0) 70%)`,
      `radial-gradient(70% 40% at 100% 100%, ${corner}, rgba(0, 0, 0, 0) 70%)`,
    ].join(', '),
  };

  return <div aria-hidden className="pointer-events-none fixed inset-0 -z-10" style={style} />;
}
