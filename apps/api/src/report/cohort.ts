import type { ReportRingKey } from '@anuva/shared';

/**
 * Reference ("cohort median") values for the weekly report rings.
 *
 * NOT SERVED. Parked until clinical sign-off.
 *
 * These values were shown on the rings as the "typical" dot until the tracker
 * review of Aug 2026. They are derived from prevalence figures rather than
 * measured on Anuva's scales, which the ring UI could not honestly convey in
 * the space available — the dot read as a validated norm. The summary now
 * compares a user only against her own previous period; see
 * `reportReferenceSchema` in @anuva/shared. Restore this as a *second*,
 * separately labelled mark once the numbers are signed off, or replace it
 * outright with in-app percentiles per the note below.
 *
 * No published dataset reports the median of Anuva's composite 0-100 scales, so
 * each value is derived from symptom prevalence + severity in the literature:
 *
 *     median ~= p(affected) * score_affected + p(unaffected) * score_unaffected
 *
 * Anuva's users are India-first, so Indian cohorts are preferred over SWAN
 * wherever both exist (they disagree substantially on vasomotor symptoms:
 * ~37.6% in India vs 60-80% in SWAN).
 *
 * CAVEAT: these describe the *general* population of women 42-50, not app
 * users. Women who install a perimenopause app are more symptomatic than
 * average, so most users will sit below these lines. The UI must label the
 * comparison as general-population and never imply "you vs your peers".
 * Replace with in-app percentiles once ~200 users have 7+ logged days.
 *
 * Values are pending clinical sign-off.
 */

export interface CohortReference {
  /** 0-100 on the same scale as the ring, higher is better. */
  value: number;
  confidence: 'high' | 'medium';
  /** Underlying figures the value was derived from. */
  basis: string;
  source: string;
}

export const COHORT_REFERENCES: Record<ReportRingKey, CohortReference> = {
  sleep: {
    value: 62,
    confidence: 'high',
    basis: '61.2% of Indian women 40-60 report sleep problems (MRS); 38% in SWAN US 40-55',
    source: 'IJABMR 2020 (Haryana, MRS); SWAN sleep 2008',
  },
  energy: {
    value: 56,
    confidence: 'high',
    basis: '71.5% physical/mental exhaustion (Haryana MRS), 62% fatigue (urban India), 69% US early perimenopause',
    source: 'IJABMR 2020; J Midlife Health 2014 (urban India)',
  },
  stress: {
    value: 60,
    confidence: 'medium',
    basis: 'PSS-10 US female normative mean 16/40 -> 100 * (1 - 0.40). Not perimenopause-specific.',
    source: 'Cohen PSS-10 US probability samples 2006/2009',
  },
  mood: {
    value: 62,
    confidence: 'medium',
    basis: '~40% report perimenopausal mood symptoms (ACOG); 60.7% irritability (Haryana MRS)',
    source: 'ACOG; IJABMR 2020',
  },
  focus: {
    value: 68,
    confidence: 'medium',
    basis: 'Forgetfulness complaints 41% in perimenopause vs 31% premenopause (SWAN)',
    source: 'SWAN cognition fact sheet',
  },
  hotFlashes: {
    value: 80,
    confidence: 'high',
    basis: 'India: 37.6% any hot flashes (24.7% mild / 10.8% moderate / 2.2% severe)',
    source: 'J Midlife Health 2025 (India, clinico-demographic)',
  },
};

export const COHORT_LABEL = 'Indian women 42–50, general population';
