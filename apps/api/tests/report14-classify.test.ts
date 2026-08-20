/**
 * 14-Day Assessment Report — classifier tests.
 *
 * Golden fixtures over the pure classification functions. Twelve report buckets
 * reachable by a few dozen input paths is exactly the surface where a silent
 * mis-classification ships the wrong medical document, so every stage rule and
 * every domain-selection branch has a case here.
 *
 * The three "worked example" tests mirror the scenarios documented in
 * feature-docs/14dayreports/REPORT14_LOGIC.md — if those numbers drift, either
 * the code or the document is wrong.
 */

import { describe, expect, it } from 'vitest';
import { classifyStage } from '../src/report14/classify/stage.js';
import { classifyDomain } from '../src/report14/classify/domain.js';
import { resolveOverlays } from '../src/report14/classify/overlays.js';
import { resolveWindow } from '../src/report14/classify/window.js';
import { buildDocument } from '../src/report14/content/index.js';
import { renderReportHtml } from '../src/report14/render/html.js';
import { REPORT14_CONFIG as CFG } from '../src/report14/config.js';
import type { LogDay } from '../src/report14/data/load.js';
import type { Classification } from '../src/report14/types.js';

const NOW = new Date('2026-08-20T10:00:00+05:30');

function answers(entries: Record<string, string>): Map<string, string> {
  return new Map(Object.entries(entries));
}

function day(iso: string, over: Partial<LogDay> = {}): LogDay {
  return {
    day: iso,
    hotFlashCategory: null,
    hotFlashCount: null,
    hotFlashTaps: 0,
    nightSweat: false,
    sleepCategory: null,
    moodMorning: null,
    moodShift: null,
    stressCategory: null,
    brainFogCategory: null,
    anxietyTaps: 0,
    irritabilityTaps: 0,
    ...over,
  };
}

/** Fill every item of a domain with one severity label. */
function uniform(keys: string[], value: string): Record<string, string> {
  return Object.fromEntries(keys.map((k) => [k, value]));
}

const A_ITEMS = ['hot-flashes', 'night-sweats', 'flushing', 'heart-palpitations'];
const B_ITEMS = [
  'irritability', 'mood-swings', 'anxiety', 'depression', 'memory-problems',
  'difficulty-concentrating', 'brain-fog', 'loss-of-motivation', 'feeling-overwhelmed',
];
const C_ITEMS = [
  'vaginal-dryness', 'painful-intercourse', 'decreased-libido', 'urinary-urgency',
  'urinary-incontinence', 'joint-muscle-pain', 'headaches', 'breast-tenderness',
  'dry-skin', 'hair-thinning',
];

// ─────────────────────────────────────────────
// Stage
// ─────────────────────────────────────────────

describe('classifyStage', () => {
  it('S0 blocks when there is no menstrual history and no cycle logs', () => {
    const r = classifyStage({ answers: answers({}), periods: [], recentBleed: false, now: NOW });
    expect(r.rule).toBe('S0');
    expect(r.flags).toContain('stageAmbiguous');
  });

  it('S1 sends oophorectomy to stage 3 as surgical menopause', () => {
    const r = classifyStage({
      answers: answers({ 'ovary-removal': 'Yes', 'periods-regular': 'No' }),
      periods: [], recentBleed: false, now: NOW,
    });
    expect(r.stage).toBe(3);
    expect(r.rule).toBe('S1');
    expect(r.flags).toContain('surgicalMenopause');
  });

  it('S2 sends hysterectomy with ovaries retained to stage 2, not stage 3', () => {
    const r = classifyStage({
      answers: answers({ hysterectomy: 'Yes', 'ovary-removal': 'No' }),
      periods: [], recentBleed: false, now: NOW,
    });
    // STRAW+10: these women cannot be staged by bleeding criteria. Stage 2's
    // flags are the safest superset.
    expect(r.stage).toBe(2);
    expect(r.flags).toContain('cannotStageByBleeding');
  });

  it('S4 sends 10 months of amenorrhoea to stage 3', () => {
    const r = classifyStage({
      answers: answers({
        'last-menstrual-period': '2025-10-15',
        'periods-regular': 'No',
        'skip-periods': 'Yes',
      }),
      periods: [], recentBleed: false, now: NOW,
    });
    expect(r.stage).toBe(3);
    expect(r.rule).toBe('S4');
    expect(r.flags).not.toContain('beyondTemplateRange');
  });

  it('S4 flags beyond-template past 12 months but still delivers stage 3', () => {
    const r = classifyStage({
      answers: answers({ 'last-menstrual-period': '2025-01-10', 'periods-regular': 'No' }),
      periods: [], recentBleed: false, now: NOW,
    });
    expect(r.stage).toBe(3);
    expect(r.flags).toContain('beyondTemplateRange');
  });

  it('S3 vetoes stage 3 when a bleed was logged inside the lookback', () => {
    const r = classifyStage({
      answers: answers({
        'last-menstrual-period': '2025-10-15',
        'periods-regular': 'No',
        'skip-periods': 'Yes',
      }),
      periods: [], recentBleed: true, now: NOW,
    });
    expect(r.stage).toBe(2);
    expect(r.flags).toContain('bleedVetoApplied');
  });

  it('resolves the regular/skip conflict to the more advanced stage', () => {
    const r = classifyStage({
      answers: answers({ 'periods-regular': 'Yes', 'skip-periods': 'Yes' }),
      periods: [], recentBleed: false, now: NOW,
    });
    expect(r.stage).toBe(2);
    expect(r.rule).toBe('S5');
    expect(r.flags).toContain('regularSkipConflict');
  });

  it('S5 reads a 60-day gap between logged periods as stage 2', () => {
    const r = classifyStage({
      answers: answers({ 'periods-regular': 'Yes', 'skip-periods': 'No' }),
      periods: [
        { startDate: new Date('2026-08-01'), endDate: new Date('2026-08-05') },
        { startDate: new Date('2026-05-20'), endDate: new Date('2026-05-25') },
      ],
      recentBleed: false, now: NOW,
    });
    expect(r.stage).toBe(2);
    expect(r.reason).toMatch(/gap between logged periods/);
  });

  it('S6 keeps regular cycles at stage 1 even with short-cycle variability', () => {
    const r = classifyStage({
      answers: answers({
        'periods-regular': 'Yes', 'skip-periods': 'No', 'cycles-shorter': 'Yes',
      }),
      periods: [], recentBleed: false, now: NOW,
    });
    expect(r.stage).toBe(1);
    expect(r.rule).toBe('S6');
  });

  it('records contraception as a flag without changing the stage', () => {
    const r = classifyStage({
      answers: answers({
        'periods-regular': 'Yes', 'skip-periods': 'No', 'using-birth-control': 'Yes',
      }),
      periods: [], recentBleed: false, now: NOW,
    });
    expect(r.stage).toBe(1);
    expect(r.flags).toContain('contraceptionMayMaskCycle');
  });
});

// ─────────────────────────────────────────────
// Domain
// ─────────────────────────────────────────────

describe('classifyDomain', () => {
  it('normalises against each domain\'s own MRS severe threshold', () => {
    // All-Moderate across every domain. Raw burden is identical at 2/3, but the
    // published severe thresholds differ, so the indices must diverge.
    const r = classifyDomain({
      answers: answers({
        ...uniform(A_ITEMS, 'Moderate'),
        ...uniform(B_ITEMS, 'Moderate'),
        ...uniform(C_ITEMS, 'Moderate'),
      }),
      logDays: [],
    });
    expect(r.assessment.A.burden).toBeCloseTo(0.5, 5);
    expect(r.assessment.B.burden).toBeCloseTo(0.5, 5);
    expect(r.assessment.C.burden).toBeCloseTo(0.5, 5);

    expect(r.assessment.A.index).toBeCloseTo(1.0, 3);
    expect(r.assessment.B.index).toBeCloseTo(1.143, 3);
    expect(r.assessment.C.index).toBeCloseTo(1.5, 3);
    // C is the most severe presentation despite an identical raw burden.
    expect(r.domain).toBe('D');
  });

  it('scales against answered items only, so a part-filled section is not half-severity', () => {
    const r = classifyDomain({
      answers: answers({ 'hot-flashes': 'Severe', 'night-sweats': 'Severe' }),
      logDays: [],
    });
    expect(r.assessment.A.answered).toBe(2);
    // Two items x the MRS item maximum of 4.
    expect(r.assessment.A.max).toBe(8);
    // All-Severe is 3 of 4 per item: Anuva has no "very severe" step.
    expect(r.assessment.A.burden).toBe(0.75);
  });

  it('picks the single dominant domain when the others are quiet', () => {
    const r = classifyDomain({
      answers: answers({
        'hot-flashes': 'Severe', 'night-sweats': 'Severe',
        'flushing': 'Moderate', 'heart-palpitations': 'Mild',
        ...uniform(B_ITEMS, 'Mild'),
        ...uniform(C_ITEMS, 'None'),
      }),
      logDays: [],
    });
    expect(r.domain).toBe('A');
    // (3+3+2+1) / (4x4) = 0.5625 burden, / 0.500 = 1.125
    expect(r.final.A).toBeCloseTo(1.125, 3);
  });

  it('does not choose Mixed when only one domain is severe', () => {
    const r = classifyDomain({
      answers: answers({
        ...uniform(A_ITEMS, 'Severe'),
        // Uniform Mild lands at 0.571 (B) and 0.750 (C) — background burden,
        // not a multi-domain presentation.
        ...uniform(B_ITEMS, 'Mild'),
        ...uniform(C_ITEMS, 'Mild'),
      }),
      logDays: [],
    });
    expect(r.domain).toBe('A');
    expect(r.final.B).toBeLessThan(1.0);
    expect(r.final.C).toBeLessThan(1.0);
  });

  it('regression: uniform Mild must not reach domain C\'s severe threshold', () => {
    // MRS items run 0-4; Anuva's run 0-3. Dividing by 3 rather than 4 put
    // "every C symptom present but mild" at exactly 1.0 and dragged
    // unremarkable profiles into the Mixed report.
    const r = classifyDomain({
      answers: answers({
        ...uniform(A_ITEMS, 'Mild'),
        ...uniform(B_ITEMS, 'Mild'),
        ...uniform(C_ITEMS, 'Mild'),
      }),
      logDays: [],
    });
    expect(r.assessment.C.index).toBeCloseTo(0.75, 3);
    expect(r.domain).not.toBe('D');
  });

  it('flags low symptom burden but still returns a domain', () => {
    const r = classifyDomain({
      answers: answers({
        ...uniform(A_ITEMS, 'None'),
        ...uniform(B_ITEMS, 'None'),
        ...uniform(C_ITEMS, 'None'),
      }),
      logDays: [],
    });
    expect(r.flags).toContain('lowSymptomBurden');
    expect(['A', 'B', 'C']).toContain(r.domain);
  });

  // A at 4x Moderate is index 1.000; C at raw 13 of 40 is index 0.975. The
  // 0.025 gap is inside the tie margin, so these two fixtures pin the tie-break
  // rather than the primary ranking.
  const TIED_A_AND_C = {
    ...uniform(A_ITEMS, 'Moderate'),
    ...uniform(B_ITEMS, 'None'),
    'vaginal-dryness': 'Severe', 'painful-intercourse': 'Severe',
    'decreased-libido': 'Moderate', 'urinary-urgency': 'Moderate',
    'urinary-incontinence': 'Mild', 'joint-muscle-pain': 'None',
    'headaches': 'None', 'breast-tenderness': 'None',
    'dry-skin': 'Mild', 'hair-thinning': 'Mild',
  };

  it('breaks a tie on quality-of-life impact', () => {
    const r = classifyDomain({
      answers: answers({
        ...TIED_A_AND_C,
        // Vasomotor not interfering; GSM affecting her severely.
        'symptoms-interfere-sleep': 'No',
        'symptoms-interfere-activities': 'No',
        'qol-sexual-relationships': 'Severely',
        'qol-physical-activities': 'Severely',
      }),
      logDays: [],
    });
    expect(Math.abs(r.final.A - r.final.C)).toBeLessThanOrEqual(CFG.tieMargin);
    expect(r.tieBreakUsed).toBe('qol');
    expect(r.domain).toBe('C');
  });

  it('falls back to clinical priority when quality-of-life impact also ties', () => {
    const r = classifyDomain({
      // No QoL answers at all, so both domains score 0 impact.
      answers: answers(TIED_A_AND_C),
      logDays: [],
    });
    expect(r.tieBreakUsed).toBe('priority');
    // Priority is B > A > C, so between A and C, A takes it.
    expect(r.domain).toBe('A');
  });

  it('leaves domain C untouched under the relative blend', () => {
    const answerSet = answers({
      ...uniform(A_ITEMS, 'Moderate'),
      ...uniform(B_ITEMS, 'Moderate'),
      ...uniform(C_ITEMS, 'Moderate'),
    });
    const logDays = Array.from({ length: 14 }, (_, i) =>
      day(`2026-08-${String(i + 1).padStart(2, '0')}`, {
        // Logs say hot flashes are worse than mood.
        hotFlashCategory: 'More than 5',
        moodMorning: 'Calm',
        stressCategory: 'Low stress',
      }),
    );

    const withLogs = classifyDomain({ answers: answerSet, logDays });
    const withoutLogs = classifyDomain({ answers: answerSet, logDays: [] });

    expect(withLogs.blendApplied).toBe(true);
    // A rose, B fell, C did not move at all.
    expect(withLogs.final.A).toBeGreaterThan(withoutLogs.final.A);
    expect(withLogs.final.B).toBeLessThan(withoutLogs.final.B);
    expect(withLogs.final.C).toBeCloseTo(withoutLogs.final.C, 10);
    // Zero-sum: the covered block's mean is preserved exactly.
    expect(withLogs.final.A + withLogs.final.B).toBeCloseTo(
      withoutLogs.final.A + withoutLogs.final.B,
      10,
    );
  });

  it('reports no logs available when the window is empty', () => {
    const r = classifyDomain({
      answers: answers(uniform(A_ITEMS, 'Moderate')),
      logDays: [],
    });
    expect(r.flags).toContain('noLogsAvailable');
    expect(r.blendApplied).toBe(false);
  });

  it('never derives a log index for domain C', () => {
    const r = classifyDomain({
      answers: answers(uniform(C_ITEMS, 'Severe')),
      logDays: [day('2026-08-01', { hotFlashCategory: '3–5', moodMorning: 'Sad' })],
    });
    expect(r.logs.C).toBeUndefined();
  });

  it('takes the worse of the evening bucket and the tap count for hot flashes', () => {
    const under = classifyDomain({
      answers: answers(uniform(A_ITEMS, 'Mild')),
      logDays: Array.from({ length: 5 }, (_, i) =>
        day(`2026-08-0${i + 1}`, { hotFlashCategory: '1–2', hotFlashTaps: 8, moodMorning: 'Calm' }),
      ),
    });
    const honest = classifyDomain({
      answers: answers(uniform(A_ITEMS, 'Mild')),
      logDays: Array.from({ length: 5 }, (_, i) =>
        day(`2026-08-0${i + 1}`, { hotFlashCategory: '1–2', hotFlashTaps: 0, moodMorning: 'Calm' }),
      ),
    });
    // Eight taps outrank a remembered "1-2".
    expect(under.logs.A?.index).toBeGreaterThan(honest.logs.A?.index ?? 0);
  });

  it('ignores uncertain answers rather than scoring them as good days', () => {
    const r = classifyDomain({
      answers: answers(uniform(A_ITEMS, 'Moderate')),
      logDays: [day('2026-08-01', { hotFlashCategory: 'Not sure' })],
    });
    expect(r.logs.A).toBeUndefined();
  });
});

// ─────────────────────────────────────────────
// Overlays
// ─────────────────────────────────────────────

describe('resolveOverlays', () => {
  it('fires GUT on two symptoms at Mild or above', () => {
    const r = resolveOverlays({
      answers: answers({ 'gut-bloating': 'Mild', 'acid-reflux': 'Moderate' }),
      familyFeatureOptOut: false,
    });
    expect(r.overlays).toContain('GUT');
  });

  it('does not fire GUT on a single mild symptom', () => {
    const r = resolveOverlays({
      answers: answers({ 'gut-bloating': 'Mild' }),
      familyFeatureOptOut: false,
    });
    expect(r.overlays).not.toContain('GUT');
  });

  it('fires GUT on a bare digestive-change Yes', () => {
    const r = resolveOverlays({
      answers: answers({ 'digestive-change-1-2-years': 'Yes' }),
      familyFeatureOptOut: false,
    });
    expect(r.overlays).toContain('GUT');
  });

  it('fires FAMILY when the partner does not understand', () => {
    const r = resolveOverlays({
      answers: answers({ 'partner-understands-menopause': 'No' }),
      familyFeatureOptOut: false,
    });
    expect(r.overlays).toContain('FAMILY');
  });

  it('suppresses FAMILY when family features are opted out, even if triggered', () => {
    const r = resolveOverlays({
      answers: answers({
        'partner-understands-menopause': 'No',
        'symptoms-affect-partner': 'Yes',
      }),
      familyFeatureOptOut: true,
    });
    expect(r.overlays).not.toContain('FAMILY');
    expect(r.reasons.FAMILY).toMatch(/suppressed/);
  });

  it('does not treat mood-affects-relationships as a FAMILY trigger', () => {
    const r = resolveOverlays({
      answers: answers({ 'mood-affects-relationships': 'Yes' }),
      familyFeatureOptOut: false,
    });
    expect(r.overlays).not.toContain('FAMILY');
  });

  it('emits overlays in source-section order', () => {
    const r = resolveOverlays({
      answers: answers({
        'social-life-reduced': 'Yes',
        'gut-bloating': 'Moderate',
        'constipation': 'Mild',
      }),
      familyFeatureOptOut: false,
    });
    expect(r.overlays).toEqual(['GUT', 'FAMILY']);
  });
});

// ─────────────────────────────────────────────
// Window
// ─────────────────────────────────────────────

describe('resolveWindow', () => {
  it('anchors day 1 to the day after logged bleeding stops', () => {
    const r = resolveWindow({
      periods: [{ startDate: new Date('2026-08-01'), endDate: new Date('2026-08-05') }],
      periodLengthDays: 5,
      assessmentCompletedAt: new Date('2026-07-25'),
      firstLogAt: new Date('2026-08-02'),
      now: NOW,
    });
    expect(r.anchorMode).toBe('day_after_bleeding');
    expect(r.start?.getDate()).toBe(6);
    expect(r.end?.getDate()).toBe(19);
  });

  it('estimates the bleed end from the user\'s own period length when endDate is absent', () => {
    const r = resolveWindow({
      periods: [{ startDate: new Date('2026-08-01'), endDate: null }],
      periodLengthDays: 7,
      assessmentCompletedAt: new Date('2026-07-25'),
      firstLogAt: null,
      now: NOW,
    });
    // 1 Aug + (7 - 1) = 7 Aug is the last bleed day; window opens on the 8th.
    expect(r.start?.getDate()).toBe(8);
    expect(r.reason).toMatch(/estimated period end/);
  });

  it('falls back to the first log when there is no period to anchor to', () => {
    const r = resolveWindow({
      periods: [],
      periodLengthDays: null,
      assessmentCompletedAt: new Date('2026-08-01'),
      firstLogAt: new Date('2026-08-04T09:00:00'),
      now: NOW,
    });
    expect(r.anchorMode).toBe('first_log');
    expect(r.start?.getDate()).toBe(4);
    expect(r.reason).toMatch(/not directly comparable/);
  });

  it('reports no window at all when there is neither a cycle nor a log', () => {
    const r = resolveWindow({
      periods: [],
      periodLengthDays: null,
      assessmentCompletedAt: new Date('2026-08-01'),
      firstLogAt: null,
      now: NOW,
    });
    expect(r.anchorMode).toBe('assessment');
    expect(r.start).toBeNull();
    expect(r.daysCovered).toBe(0);
  });

  it('caps days covered at the window length once the window has closed', () => {
    const r = resolveWindow({
      periods: [{ startDate: new Date('2026-06-01'), endDate: new Date('2026-06-05') }],
      periodLengthDays: 5,
      assessmentCompletedAt: new Date('2026-05-20'),
      firstLogAt: new Date('2026-06-06'),
      now: NOW,
    });
    expect(r.daysCovered).toBe(CFG.windowDays);
  });
});

// ─────────────────────────────────────────────
// Document
// ─────────────────────────────────────────────

describe('buildDocument', () => {
  function classification(over: Partial<Classification> = {}): Classification {
    const domainDetail = classifyDomain({
      answers: answers(uniform(A_ITEMS, 'Severe')),
      logDays: [],
    });
    return {
      reportId: '2B',
      stage: 2,
      domain: 'B',
      overlays: [],
      window: {
        anchorMode: 'day_after_bleeding', start: null, end: null,
        daysCovered: 14, reason: '',
      },
      stageDetail: { stage: 2, rule: 'S5', reason: '', flags: [] },
      domainDetail,
      overlayDetail: { overlays: [], reasons: {} },
      flags: [],
      config: {
        useTrackingData: true, logBlendMode: 'relative',
        logBlendWeight: 0.35, templateVersion: CFG.templateVersion,
      },
      generatedAt: NOW,
      ...over,
    };
  }

  it('joins the stage lead and the domain tail into one introduction', () => {
    const doc = buildDocument(classification(), 'Priya');
    expect(doc.introduction).toMatch(/^You are in mid perimenopause/);
    expect(doc.introduction).toMatch(/psychological and cognitive domain/);
  });

  it('puts the name in the salutation and nowhere else', () => {
    const doc = buildDocument(classification(), 'Priya');
    expect(doc.salutation).toBe('Dear Priya,');

    const rendered = renderReportHtml(doc);
    const occurrences = rendered.split('Priya').length - 1;
    // The name appears exactly once in the whole document.
    expect(occurrences).toBe(1);
  });

  it('degrades gracefully when no name is stored', () => {
    const doc = buildDocument(classification(), null);
    expect(doc.salutation).toBe('Hello,');
    expect(doc.salutation).not.toMatch(/null|undefined/);
  });

  it('renders identical content for two users with the same classification', () => {
    const a = renderReportHtml(buildDocument(classification(), 'Asha'));
    const b = renderReportHtml(buildDocument(classification(), 'Asha'));
    expect(a).toBe(b);
  });

  it('appends overlay copy when overlays fired', () => {
    const doc = buildDocument(classification({ overlays: ['GUT', 'FAMILY'] }), 'Priya');
    expect(doc.overlays.map((o) => o.id)).toEqual(['GUT', 'FAMILY']);
    const html = renderReportHtml(doc);
    expect(html).toMatch(/estrobolome/);
    expect(html).toMatch(/Family &amp; Relationship Support|Family &amp; Relationship/);
  });

  it('escapes a name containing markup', () => {
    const doc = buildDocument(classification(), '<script>alert(1)</script>');
    const html = renderReportHtml(doc);
    expect(html).not.toMatch(/<script>alert/);
    expect(html).toMatch(/&lt;script&gt;/);
  });

  it('carries a disclaimer and the template version', () => {
    const doc = buildDocument(classification(), 'Priya');
    expect(doc.disclaimer).toMatch(/not a diagnosis/i);
    expect(doc.templateVersion).toBe(CFG.templateVersion);
  });

  it('covers all twelve report variants', () => {
    for (const stage of [1, 2, 3] as const) {
      for (const domain of ['A', 'B', 'C', 'D'] as const) {
        const doc = buildDocument(
          classification({ stage, domain, reportId: `${stage}${domain}` as never }),
          'Test',
        );
        expect(doc.introduction.length).toBeGreaterThan(100);
        expect(doc.medicalFlags.length).toBeGreaterThan(0);
        expect(doc.recommendations).toHaveLength(3);
        expect(doc.anuNote.length).toBeGreaterThan(50);
        // Every recommendation block must carry bullets — an empty block would
        // render as a bare heading in the PDF.
        for (const block of doc.recommendations) {
          expect(block.bullets.length).toBeGreaterThan(0);
        }
      }
    }
  });
});

// ─────────────────────────────────────────────
// Worked examples — mirror REPORT14_LOGIC.md
// ─────────────────────────────────────────────

describe('worked examples', () => {
  it('example 1 resolves to 1A with both overlays', () => {
    const a = answers({
      'periods-regular': 'Yes', 'skip-periods': 'No',
      'hot-flashes': 'Severe', 'night-sweats': 'Severe',
      'flushing': 'Moderate', 'heart-palpitations': 'Mild',
      ...uniform(B_ITEMS, 'Mild'),
      ...uniform(C_ITEMS, 'None'),
      'vaginal-dryness': 'Mild', 'joint-muscle-pain': 'Mild',
      'gut-bloating': 'Mild', 'acid-reflux': 'Mild',
      'partner-understands-menopause': 'No',
    });

    const stage = classifyStage({ answers: a, periods: [], recentBleed: false, now: NOW });
    const domain = classifyDomain({ answers: a, logDays: [] });
    const overlays = resolveOverlays({ answers: a, familyFeatureOptOut: false });

    expect(stage.stage).toBe(1);
    // (3+3+2+1) / (4 x 4) = 0.5625 burden, / 0.500 = 1.125
    expect(domain.final.A).toBeCloseTo(1.125, 2);
    expect(domain.domain).toBe('A');
    expect(`${stage.stage}${domain.domain}`).toBe('1A');
    expect(overlays.overlays).toEqual(['GUT', 'FAMILY']);
  });

  it('example 2 resolves to 2D with FAMILY suppressed by opt-out', () => {
    const a = answers({
      'periods-regular': 'Yes', 'skip-periods': 'Yes',
      // Moderate, not Mild: "Mixed" requires every domain to actually be
      // involved, and uniform Mild sits at 0.50 — below the moderate cut-off.
      ...uniform(A_ITEMS, 'Moderate'),
      'anxiety': 'Severe', 'irritability': 'Severe', 'feeling-overwhelmed': 'Severe',
      'mood-swings': 'Moderate', 'depression': 'Moderate', 'memory-problems': 'Moderate',
      'difficulty-concentrating': 'Moderate', 'brain-fog': 'Moderate',
      'loss-of-motivation': 'Moderate',
      ...uniform(C_ITEMS, 'Moderate'),
      'social-life-reduced': 'Yes',
    });

    const stage = classifyStage({ answers: a, periods: [], recentBleed: false, now: NOW });
    const domain = classifyDomain({ answers: a, logDays: [] });
    const overlays = resolveOverlays({ answers: a, familyFeatureOptOut: true });

    expect(stage.stage).toBe(2);
    expect(stage.flags).toContain('regularSkipConflict');
    // A 1.000, B 1.333, C 1.500 — all moderate-or-worse, all severe-equivalent.
    // Note C outranks B despite a LOWER raw burden (0.500 vs 0.583): that is
    // the MRS normalisation doing its job.
    expect(domain.final.C).toBeGreaterThan(domain.final.B);
    expect(domain.assessment.C.burden).toBeLessThan(domain.assessment.B.burden);
    expect(domain.domain).toBe('D');
    expect(`${stage.stage}${domain.domain}`).toBe('2D');
    expect(overlays.overlays).not.toContain('FAMILY');
  });

  it('example 3 resolves to 3C from the assessment alone, with zero logs', () => {
    const a = answers({
      'ovary-removal': 'Yes',
      ...uniform(A_ITEMS, 'Moderate'),
      ...uniform(B_ITEMS, 'Mild'),
      'vaginal-dryness': 'Severe', 'painful-intercourse': 'Severe',
      'urinary-urgency': 'Moderate', 'joint-muscle-pain': 'Moderate',
      'decreased-libido': 'Mild', 'urinary-incontinence': 'None',
      'headaches': 'None', 'breast-tenderness': 'None',
      'dry-skin': 'Mild', 'hair-thinning': 'Mild',
      // A 1.000 vs C 0.975 is inside the 0.05 tie margin, so functional impact
      // decides it: vasomotor symptoms are present but not interfering, while
      // GSM is affecting her severely.
      'symptoms-interfere-sleep': 'No',
      'symptoms-interfere-activities': 'No',
      'qol-sexual-relationships': 'Severely',
      'qol-physical-activities': 'Significantly',
    });

    const stage = classifyStage({ answers: a, periods: [], recentBleed: false, now: NOW });
    const domain = classifyDomain({ answers: a, logDays: [] });

    expect(stage.stage).toBe(3);
    expect(stage.flags).toContain('surgicalMenopause');
    expect(domain.tieBreakUsed).toBe('qol');
    expect(domain.domain).toBe('C');
    expect(`${stage.stage}${domain.domain}`).toBe('3C');
    expect(domain.flags).toContain('noLogsAvailable');
  });
});
