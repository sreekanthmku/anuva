import { describe, expect, it } from 'vitest';
import { smoothPath, type CurvePoint } from '../src/features/core/chartCurve';

/** Pull the cubic segments back out of the path string. */
function segments(path: string) {
  const start = path.match(/^M([-\d.]+) ([-\d.]+)/);
  if (!start) return [];
  let from: CurvePoint = { x: Number(start[1]), y: Number(start[2]) };
  const out: { from: CurvePoint; c1: CurvePoint; c2: CurvePoint; to: CurvePoint }[] = [];

  for (const m of path.matchAll(
    /C([-\d.]+) ([-\d.]+), ([-\d.]+) ([-\d.]+), ([-\d.]+) ([-\d.]+)/g
  )) {
    const [, c1x, c1y, c2x, c2y, tox, toy] = m.map(Number) as unknown as number[];
    const to = { x: tox!, y: toy! };
    out.push({ from, c1: { x: c1x!, y: c1y! }, c2: { x: c2x!, y: c2y! }, to });
    from = to;
  }
  return out;
}

function cubicY(seg: ReturnType<typeof segments>[number], t: number): number {
  const u = 1 - t;
  return (
    u * u * u * seg.from.y +
    3 * u * u * t * seg.c1.y +
    3 * u * t * t * seg.c2.y +
    t * t * t * seg.to.y
  );
}

const points = (ys: number[]): CurvePoint[] => ys.map((y, i) => ({ x: i * 10, y }));

describe('smoothPath', () => {
  it('draws nothing from fewer than two points', () => {
    expect(smoothPath([])).toBe('');
    expect(smoothPath([{ x: 0, y: 50 }])).toBe('');
  });

  it('passes exactly through every point it is given', () => {
    const ys = [120, 40, 90, 30, 70];
    const segs = segments(smoothPath(points(ys)));

    expect(segs).toHaveLength(ys.length - 1);
    segs.forEach((seg, i) => {
      expect(cubicY(seg, 0)).toBeCloseTo(ys[i]!, 5);
      expect(cubicY(seg, 1)).toBeCloseTo(ys[i + 1]!, 5);
    });
  });

  it('never overshoots a segment — a peak cannot bulge into the band above it', () => {
    // A sharp spike is what makes an unconstrained spline overshoot.
    const ys = [130, 130, 5, 130, 130, 60, 61];
    const segs = segments(smoothPath(points(ys)));

    segs.forEach((seg, i) => {
      const lo = Math.min(ys[i]!, ys[i + 1]!);
      const hi = Math.max(ys[i]!, ys[i + 1]!);
      for (let t = 0; t <= 1.0001; t += 0.02) {
        const y = cubicY(seg, t);
        expect(y).toBeGreaterThanOrEqual(lo - 1e-6);
        expect(y).toBeLessThanOrEqual(hi + 1e-6);
      }
    });
  });

  it('is actually curved, not a polyline in disguise', () => {
    const seg = segments(smoothPath(points([100, 20, 100])))[0]!;
    // A straight segment would put its controls on the chord; a curve does not.
    const chordAt = (t: number) => seg.from.y + (seg.to.y - seg.from.y) * t;
    const midpoint = cubicY(seg, 0.5);

    expect(Math.abs(midpoint - chordAt(0.5))).toBeGreaterThan(0.5);
  });

  it('keeps a flat run flat', () => {
    const segs = segments(smoothPath(points([70, 70, 70])));
    for (const seg of segs) {
      for (let t = 0; t <= 1.0001; t += 0.1) expect(cubicY(seg, t)).toBeCloseTo(70, 6);
    }
  });
});
