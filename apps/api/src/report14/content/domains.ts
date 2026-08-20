/**
 * Domain content blocks — 4 of them (A vasomotor, B psychological,
 * C physical/GSM, D mixed).
 *
 * Verbatim from Anuva_Report_Copy_Brief_v2_14_Blocks (AW-CB-002 v1.1). Fixed
 * copy: do not edit without the medical advisor's sign-off.
 *
 * This copy is identical across all three stages in the source document, which
 * is why it is stored once here rather than twelve times.
 */

import type { Domain } from '../types.js';

export interface RecommendationBlock {
  title: string;
  bullets: string[];
}

export interface DomainBlock {
  label: string;
  dominantDomain: string;
  trackerFocus: string;
  /** Second half of the report introduction; the stage block supplies the lead. */
  introTail: string;
  recommendations: RecommendationBlock[];
  anuNote: string;
}

export const DOMAIN_BLOCKS: Record<Domain, DomainBlock> = {
  A: {
    label: 'Vasomotor Module',
    dominantDomain: 'Hot flashes, night sweats, flushing, heart palpitations',
    trackerFocus:
      'Log hot flash frequency, duration, and time of day. Note triggers — food, stress, temperature, alcohol.',
    introTail:
      'Your most significant symptoms are vasomotor in nature. Hot flashes, night sweats, and related episodes are common in perimenopause and directly linked to fluctuating oestrogen. The good news: this domain responds well to both lifestyle and clinical interventions.',
    recommendations: [
      {
        title: 'Immediate symptom relief',
        bullets: [
          'Keep sleep environment cool — 18–19°C is the evidence-backed optimal range',
          'Wear layered, breathable cotton or bamboo fabrics; dress for easy temperature adjustment',
          "Carry a small handheld fan for daytime episodes; cold water at onset (sip, don't gulp)",
          'A cold pack on the back of the neck can abort or shorten a flash episode',
        ],
      },
      {
        title: 'Lifestyle interventions',
        bullets: [
          'Identify and reduce personal triggers: spicy food, alcohol, caffeine, and hot drinks are the most common',
          'Regular moderate exercise reduces hot flash frequency within 8–12 weeks of consistent practice',
          'Stress management is non-negotiable — cortisol amplifies vasomotor symptoms significantly',
          'Maintain a healthy weight; adipose tissue produces oestrone, and body weight affects symptom severity',
        ],
      },
      {
        title: 'Clinical options to discuss with your doctor',
        bullets: [
          'If symptoms are moderate to severe and disrupting daily life, ask your doctor about HRT eligibility',
          'Non-hormonal options: low-dose SSRIs, SNRIs (venlafaxine), or gabapentin have evidence for vasomotor relief',
          'Phytoestrogens (soy isoflavones, red clover) — evidence is moderate; worth discussing with your doctor',
          'Stellate ganglion block: an emerging clinical option for severe, treatment-resistant hot flashes',
        ],
      },
    ],
    anuNote:
      'ANU will prompt you to log hot flash episodes in real time. After 14 days, your pattern report will show peak times, average duration, and likely triggers. Many women are surprised to discover their triggers — the data often reveals what memory misses.',
  },

  B: {
    label: 'Psychological Module',
    dominantDomain:
      'Irritability, mood swings, anxiety, depression, brain fog, memory difficulties',
    trackerFocus:
      'Log mood (1–10), anxiety episodes, brain fog days, and sleep quality every evening.',
    introTail:
      "Your most significant symptoms are in the psychological and cognitive domain. Mood changes, anxiety, and brain fog during perimenopause are neurological — driven by oestrogen's direct effect on serotonin, dopamine, and brain chemistry. This is not 'just stress.' It is real, it is hormonal, and it is addressable.",
    recommendations: [
      {
        title: 'Mood and emotional regulation',
        bullets: [
          'Identify mood triggers — hormonal dips often follow cycle patterns even when cycles are irregular',
          'Mindfulness and breathwork: just 10 minutes daily has measurable, peer-reviewed effect on perimenopausal anxiety',
          'Reduce alcohol significantly — it is a central nervous system depressant and worsens perimenopausal mood',
          'Communicate your experience to your partner or family; isolation amplifies mood symptoms',
        ],
      },
      {
        title: 'Cognitive support (brain fog and memory)',
        bullets: [
          'Physical exercise is the single most evidence-based intervention for perimenopausal brain fog',
          'Sleep quality is non-negotiable — cognitive symptoms worsen sharply and rapidly with poor sleep',
          'Omega-3 supplementation (EPA/DHA 1–2g/day) shows moderate benefit for mood and cognition',
          'Reduce cognitive load: write things down, use structured reminders, give yourself more recovery time',
        ],
      },
      {
        title: 'When to seek professional support',
        bullets: [
          'Persistent low mood lasting 2 or more weeks warrants a direct conversation with your GP',
          'Distinguish hormonal mood changes from clinical depression — both can co-exist and both need treatment',
          'CBT (Cognitive Behavioural Therapy) has strong evidence specifically for perimenopausal anxiety and mood disruption',
          'HRT has documented benefit for mood symptoms linked to oestrogen deficiency — ask your doctor if this applies to you',
        ],
      },
    ],
    anuNote:
      'ANU will check in on your mood and anxiety levels every evening. After 14 days, your pattern report will reveal mood cycles, sleep correlations, and your statistically highest-risk days for mood dips. This data makes conversations with your doctor far more productive.',
  },

  C: {
    label: 'Physical / GSM Module',
    dominantDomain:
      'Vaginal dryness, painful intercourse, urinary symptoms, joint pain, weight changes, skin and hair',
    trackerFocus:
      'Log physical discomfort levels, urinary frequency, and joint pain. Note week-to-week changes.',
    introTail:
      'Your most significant symptoms are physical — particularly in the genitourinary and musculoskeletal systems. GSM (Genitourinary Syndrome of Menopause) is underreported and undertreated. Joint pain, weight changes, and skin and hair changes are also common and often under-acknowledged. All of these are hormone-related and all are addressable.',
    recommendations: [
      {
        title: 'Genitourinary health (GSM)',
        bullets: [
          'Non-prescription vaginal moisturisers (non-hormonal): use regularly 2–3 times per week, not only during discomfort',
          'Topical vaginal oestrogen is highly effective, has minimal systemic absorption, and is safe for most women — ask your doctor',
          'Stay well-hydrated and reduce caffeine and alcohol, which both worsen urinary urgency and frequency',
          'Pelvic floor exercises (Kegels): 3 sets of 10 daily significantly improve urinary incontinence within 6–8 weeks',
        ],
      },
      {
        title: 'Musculoskeletal and weight management',
        bullets: [
          'Strength training 2–3 times per week is the most effective intervention for joint pain, bone density, and weight stability',
          'Anti-inflammatory diet: reduce refined carbohydrates and added sugars; increase omega-3, leafy greens, and turmeric',
          'Bone health protocol: calcium 1000–1200mg/day through food or supplement + Vitamin D3 1000–2000IU — discuss dosage with your doctor',
          'Reduce ultra-processed food; perimenopausal metabolic changes mean diet quality matters more than it did in your 30s',
        ],
      },
      {
        title: 'Skin and hair',
        bullets: [
          'Collagen-supporting nutrients: Vitamin C (500mg), zinc, and biotin have evidence for skin and hair quality',
          'Gentle scalp massage and reduced heat styling help slow hair thinning; avoid harsh chemical treatments',
          'Topical retinoids (low-strength) for skin texture and tone — seek dermatologist guidance before starting',
          'Sun protection is more important than ever; oestrogen loss increases UV sensitivity and skin thinning',
        ],
      },
    ],
    anuNote:
      'ANU will track your physical symptom patterns across the month. GSM and urinary symptoms often have hormonal timing — they tend to worsen in the days following an oestrogen drop. Your 14-day report will surface this pattern and help your doctor understand the hormonal driver.',
  },

  D: {
    label: 'Mixed / Complex Module',
    dominantDomain:
      'Multiple domains at moderate to severe: vasomotor + psychological + physical presenting simultaneously',
    trackerFocus:
      'Track all symptom domains daily. Primary goal: identify which domain is disrupting daily function most.',
    introTail:
      'Your symptom profile spans multiple domains simultaneously. This is more common than most women are told, and it reflects the systemic nature of hormonal change — oestrogen receptors exist throughout the body and brain. A multi-domain profile requires a structured approach: triage, foundation habits, and specialist consultation.',
    recommendations: [
      {
        title: 'Triage your symptoms first',
        bullets: [
          'Identify your 2 most disruptive symptoms — not the most frequent, the most disruptive to daily function',
          'Do not attempt to address everything simultaneously; overwhelm worsens outcomes and reduces adherence',
          'Use your ANU daily log for 14 days before making changes — let the data reveal your highest-impact symptom cluster',
          'Share your full symptom map (not just the most visible symptom) with your doctor at your next visit',
        ],
      },
      {
        title: 'Foundation interventions (benefit all domains simultaneously)',
        bullets: [
          'Sleep quality is the single lever that affects all symptom domains — prioritise this above all other interventions',
          'Regular exercise: aerobic + strength combined reduces vasomotor, psychological, and physical symptoms in parallel',
          'Stress reduction: elevated cortisol dysregulates the HPA axis and worsens all three symptom clusters',
          'Nutrition audit: reduce alcohol, refined sugar, and ultra-processed food — each worsens symptoms across domains',
        ],
      },
      {
        title: 'Clinical priority for complex symptom profiles',
        bullets: [
          'A multi-domain presentation warrants a dedicated menopause specialist consultation, not a general GP visit',
          'Request a comprehensive panel: FSH, LH, oestradiol, thyroid (TSH/FT4), Vitamin D, CBC, fasting lipids',
          'A structured care plan — rather than individual symptom treatments — produces significantly better outcomes',
          'HRT is most impactful for multi-domain perimenopause; discuss risk-benefit with a specialist, not just a general practitioner',
        ],
      },
    ],
    anuNote:
      'Because your symptoms span multiple domains, ANU will use a daily wellness score rather than single-symptom tracking. After 14 days, your pattern report will rank your symptom domains by daily life impact and suggest a prioritised intervention sequence — so you and your doctor can focus on what matters most first.',
  },
};
