/**
 * Overlay content blocks.
 *
 * Verbatim from Anuva_Report_Copy_Brief_v2_14_Blocks (AW-CB-002 v1.1). Fixed
 * copy: do not edit without the medical advisor's sign-off.
 *
 * The brief declares six overlays (Risk, QoL, Lifestyle, Treatment Preference,
 * Gut Health, Family Support) but supplies copy for only two. The other four are
 * absent here because they do not exist yet, not because they were skipped —
 * adding them is data, not code.
 *
 * Order is source-section order: GUT (questionnaire section 8) before FAMILY
 * (section 14). A report's section order should not shift between versions.
 */

import type { OverlayId } from '../types.js';
import type { RecommendationBlock } from './domains.js';

export interface OverlayBlock {
  id: OverlayId;
  title: string;
  lens: string;
  source: string;
  intro: string;
  recommendations: RecommendationBlock[];
  anuNote: string;
}

export const OVERLAY_BLOCKS: Record<OverlayId, OverlayBlock> = {
  GUT: {
    id: 'GUT',
    title: 'Gut Health',
    lens: 'Dietician + Menopause Coach lens',
    source: 'Section 8 — Digestive & Gut Health',
    intro:
      'Your responses indicate digestive symptoms that are worth addressing as part of your perimenopause care plan. Gut health is closely connected to hormonal balance — the gut microbiome plays a direct role in oestrogen metabolism through a mechanism called the estrobolome. Changes in perimenopause often disrupt gut flora, worsening digestive symptoms and amplifying hormonal effects.',
    recommendations: [
      {
        title: 'Understanding your gut-hormone connection',
        bullets: [
          'Declining oestrogen alters gut motility — this is why bloating, constipation, and reflux often worsen in perimenopause',
          'The estrobolome (gut bacteria involved in oestrogen processing) directly influences circulating oestrogen levels',
          'Addressing gut health is not separate from managing perimenopause symptoms — it is part of it',
          'Keep a 7-day food and symptom diary to identify your personal digestive triggers before making changes',
        ],
      },
      {
        title: 'Dietary adjustments for gut health',
        bullets: [
          'Increase dietary fibre gradually to 25–30g per day — wholegrains, legumes, vegetables, and flaxseed',
          'Reduce ultra-processed foods, refined sugars, and artificial sweeteners — all disrupt gut microbiome diversity',
          'If bloating is significant, trial a low-FODMAP approach for 2–4 weeks with guidance from a dietician',
          'Identify and eliminate confirmed intolerances (gluten, dairy, FODMAPs) one at a time — not simultaneously',
          'Stay well-hydrated — 2–2.5 litres of water daily supports bowel regularity and reduces bloating',
        ],
      },
      {
        title: 'Microbiome and supplement support',
        bullets: [
          'Probiotic strains with evidence for perimenopausal gut health: Lactobacillus rhamnosus, L. acidophilus, Bifidobacterium longum',
          'Prebiotic foods feed beneficial bacteria: garlic, onion, banana, oats, asparagus — introduce slowly if bloating is present',
          'If antibiotics were taken in the last 12 months, microbiome restoration should be a priority — discuss with your dietician',
          'Digestive enzymes may support symptoms of bloating and incomplete digestion — particularly useful around meals',
          'Discuss magnesium supplementation with your doctor if constipation is persistent — it supports both gut motility and sleep',
        ],
      },
    ],
    anuNote:
      'ANU will prompt you to log digestive symptoms alongside your main symptom tracking. After 14 days, your pattern report will correlate gut symptoms with your cycle phase, diet entries, and stress levels — revealing whether your gut symptoms are hormonally timed or food-driven. This distinction shapes your treatment direction significantly.',
  },

  FAMILY: {
    id: 'FAMILY',
    title: 'Family & Relationship Support',
    lens: 'Menopause Coach + Psychologist lens',
    source: 'Section 14 — Family & Relationship Context',
    intro:
      "Your responses suggest that perimenopause is affecting your relationships and home environment. This is one of the most underacknowledged dimensions of the transition — and one of the most important. When partners and family members don't understand what is happening, women feel more isolated, symptoms feel more overwhelming, and recovery takes longer. Anuva's family-inclusive model addresses this directly.",
    recommendations: [
      {
        title: 'For you — navigating relationships during perimenopause',
        bullets: [
          "Name what is happening: telling your partner 'this is a hormonal transition, not a personality change' reframes the dynamic",
          'Choose calm moments — not the middle of a symptom — to have the conversation about what you are experiencing',
          "Be specific about what you need: 'I need you to understand this', 'I need more patience on difficult days', 'I need you to read this guide'",
          'Reduce the invisible load where possible — perimenopausal fatigue is real and is worsened by carrying everything alone',
          'Give yourself permission to say no to social commitments when symptoms are high — this is not weakness, it is management',
        ],
      },
      {
        title: 'For your partner — what to understand',
        bullets: [
          'Perimenopause is a biological transition affecting the brain, body, and nervous system simultaneously — it is not mood or attitude',
          'Irritability, withdrawal, fatigue, and emotional sensitivity are symptoms, not character — they will not last permanently',
          'The most helpful thing a partner can do is listen without trying to fix, and show up with patience rather than solutions',
          'Physical intimacy may change during this time — vaginal dryness, low libido, and body image changes are real and treatable',
          'Download the Anuva Family Guide for a structured conversation starter you can use together',
        ],
      },
      {
        title: 'For your family — creating a supportive home',
        bullets: [
          'Children (especially teenagers) can sense when something has changed — naming it age-appropriately reduces anxiety for them',
          'Reduce sources of household conflict during high-symptom periods — communicate needs clearly and early',
          'Enlist family support for practical load (meals, logistics) during difficult weeks — asking is not a burden, it is communication',
          'Consider a Anuva family session or couples coaching session — many families find a structured conversation more effective than ad hoc discussion',
          'Community matters: connecting with other women going through the same experience normalises the journey and reduces isolation',
        ],
      },
    ],
    anuNote:
      "ANU includes a Family Awareness module that generates a personalised explainer you can share with your partner and family — written for people who are not going through perimenopause themselves. It translates your specific symptom profile into plain language, reducing the gap between what you are experiencing and what your family can understand. Access it from your ANU home screen under 'Share with Family.'",
  },
};

/** Source-section order. Used for both resolution and rendering. */
export const OVERLAY_ORDER: OverlayId[] = ['GUT', 'FAMILY'];
