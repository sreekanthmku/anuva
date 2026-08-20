/**
 * 14-Day Assessment Report — module configuration.
 *
 * Deliberately a plain TS object and NOT environment variables: these are
 * clinical tuning parameters, not deployment settings. A threshold that decides
 * which medical document a woman receives belongs in version control, where a
 * change is a reviewable diff with an author — not in an env var that can be
 * altered without review and leaves no trace of what produced a given report.
 *
 * Every value here is justified in feature-docs/14dayreports/READINESS_FINDINGS.md
 * (§7.10 and §8.7 list the ones awaiting the medical advisor's sign-off).
 */

export type LogBlendMode = 'relative' | 'absolute';
export type WindowAnchorMode = 'day_after_bleeding' | 'cycle_day_1' | 'first_log';

export interface Report14Config {
  /**
   * Master switch. When false the classification uses the detailed assessment
   * only; logs are still read and reported for transparency, but contribute
   * nothing to the outcome.
   */
  useTrackingData: boolean;

  /**
   * `relative` re-ranks the log-covered domains (A and B) against each other
   * while preserving their mean, so domain C — which has no daily tracker at
   * all — cannot be pushed up or down by a coverage gap it had no part in.
   * `absolute` blends each covered domain directly toward its log score; it is
   * the better mode, but only once C has daily signal.
   */
  logBlendMode: LogBlendMode;

  /**
   * Weight given to the 14-day logs, 0..1. The assessment covers months on a
   * validated instrument; the logs cover a standardised but phase-partial two
   * weeks. A third lets the daily data settle close calls without letting a
   * fortnight overturn a clear multi-month finding.
   */
  logBlendWeight: number;

  /**
   * Days of data a domain needs before its log signal counts. Set to 1 — use
   * whatever exists — per product. Raise it if log-driven misclassification
   * shows up in the stored indices.
   */
  minLogDays: number;

  /** Length of the tracking window in days. */
  windowDays: number;

  /**
   * `day_after_bleeding` anchors day 1 to the day after her period stops.
   * `cycle_day_1` anchors to the first day of bleeding. `first_log` ignores the
   * cycle and uses her earliest log.
   */
  windowAnchor: WindowAnchorMode;

  /** Extra days to shift the resolved anchor by. Normally 0. */
  anchorOffsetDays: number;

  /**
   * How long to wait for a period start before falling back to `first_log`.
   * The questionnaire defines a long cycle as >35 days, so 45 covers a
   * long-but-normal cycle with buffer. Beyond that, waiting serves nobody.
   */
  anchorWaitDays: number;

  /** Assumed bleed duration when a PeriodLog row has no endDate. */
  fallbackPeriodLengthDays: number;

  /** Months since the last menstrual period that places a user at stage 3. */
  lateStageAmenorrhoeaMonths: number;

  /** A bleed this recent vetoes stage 3. */
  bleedVetoLookbackDays: number;

  /** Gap between consecutive period starts that indicates stage 2 (STRAW -1). */
  skippedCycleGapDays: number;

  /**
   * Fraction of a domain's maximum severity at which the Menopause Rating Scale
   * calls that subscale severe. Published values — the reason the three domains
   * are comparable at all. See READINESS_FINDINGS §7.5.
   */
  severeFraction: { A: number; B: number; C: number };

  /**
   * Domain Index at or above which a domain counts as moderate-or-worse.
   * Reproduces all three published MRS moderate bands to within 0.025.
   */
  moderateIndex: number;

  /** Domain Index at or above which a domain counts as severe-equivalent. */
  severeIndex: number;

  /** Index gap below which the top two domains are treated as tied. */
  tieMargin: number;

  /**
   * Mixed (D) fires when every domain is at least moderate AND at least this
   * many are severe-equivalent. The D copy prescribes specialist referral and a
   * full lab panel — appropriate for genuine multi-domain severity, not for one
   * dominant domain with background burden.
   */
  mixedMinSevereDomains: number;

  /**
   * Tie-break of last resort, harm-weighted: untreated perimenopausal mood
   * disorder carries the gravest downside and the B module holds the safety
   * net; vasomotor carries the largest sleep and quality-of-life burden; GSM is
   * chronic but not acutely harmful. Only fires on an exact tie after the
   * quality-of-life comparison.
   */
  tiePriority: ReadonlyArray<'A' | 'B' | 'C'>;

  /** Gut symptoms at Mild or above needed to fire the GUT overlay. */
  gutOverlayMinSymptoms: number;

  /** Copy version stamped on every generated report. */
  templateVersion: string;
}

export const REPORT14_CONFIG: Report14Config = {
  useTrackingData: true,

  logBlendMode: 'relative',
  logBlendWeight: 0.35,
  minLogDays: 1,

  windowDays: 14,
  windowAnchor: 'day_after_bleeding',
  anchorOffsetDays: 0,
  anchorWaitDays: 45,
  fallbackPeriodLengthDays: 5,

  lateStageAmenorrhoeaMonths: 9,
  bleedVetoLookbackDays: 90,
  skippedCycleGapDays: 60,

  severeFraction: { A: 0.5, B: 0.4375, C: 1 / 3 },
  moderateIndex: 0.6,
  severeIndex: 1.0,
  tieMargin: 0.05,
  mixedMinSevereDomains: 2,
  tiePriority: ['B', 'A', 'C'],

  gutOverlayMinSymptoms: 2,

  templateVersion: 'AW-CB-002 v1.1',
};
