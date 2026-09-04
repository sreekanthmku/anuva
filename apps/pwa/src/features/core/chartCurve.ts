/**
 * Curve geometry for the summary charts.
 *
 * Its own module rather than a helper inside the chart component: the
 * no-overshoot property below is the reason the summary can put a five-band
 * y-axis behind a rounded line at all, and a property like that wants a test of
 * its own.
 */

export type CurvePoint = { x: number; y: number };

/**
 * A smooth line through the points, using monotone cubic interpolation
 * (Fritsch–Carlson).
 *
 * Monotone rather than a plain Catmull-Rom spline, which is the usual way to
 * round a chart off and the wrong one here: an unconstrained curve overshoots
 * past its own data between two points, so a week that peaked at "Good" would
 * bulge into the "Great" band it never reached — on a chart whose y-axis is
 * five labelled bands, that reads as a claim about the data. This construction
 * cannot exceed the values it passes through: control-point slopes are zeroed
 * at every local extreme and clamped to three times the neighbouring secant.
 */
export function smoothPath(points: CurvePoint[]): string {
  if (points.length < 2) return '';

  const n = points.length;
  const secants: number[] = [];
  for (let i = 0; i < n - 1; i += 1) {
    const dx = points[i + 1]!.x - points[i]!.x;
    secants.push(dx === 0 ? 0 : (points[i + 1]!.y - points[i]!.y) / dx);
  }

  const slopes: number[] = new Array(n);
  slopes[0] = secants[0]!;
  slopes[n - 1] = secants[n - 2]!;
  for (let i = 1; i < n - 1; i += 1) {
    const prev = secants[i - 1]!;
    const next = secants[i]!;
    // A turning point gets a flat tangent — that is what stops the overshoot.
    if (prev * next <= 0) {
      slopes[i] = 0;
      continue;
    }
    const average = (prev + next) / 2;
    const limit = Math.min(Math.abs(3 * prev), Math.abs(3 * next), Math.abs(average));
    slopes[i] = Math.sign(average) * limit;
  }

  let path = `M${points[0]!.x.toFixed(2)} ${points[0]!.y.toFixed(2)}`;
  for (let i = 0; i < n - 1; i += 1) {
    const from = points[i]!;
    const to = points[i + 1]!;
    const third = (to.x - from.x) / 3;
    const c1 = { x: from.x + third, y: from.y + slopes[i]! * third };
    const c2 = { x: to.x - third, y: to.y - slopes[i + 1]! * third };
    path += ` C${c1.x.toFixed(2)} ${c1.y.toFixed(2)}, ${c2.x.toFixed(2)} ${c2.y.toFixed(2)}, ${to.x.toFixed(2)} ${to.y.toFixed(2)}`;
  }

  return path;
}
