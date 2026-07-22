// The 40 symptoms in the Q&A bank, and the follow-up questions that belong to
// each of them.
//
// Generated from `Anuva_ANU_AI_Perimenopause_QA_Bank_Reworked_V1.xlsx`
// (`Symptom Map`, and the `User Question` column of the Follow-up rows).
//
// Every symptom in the bank carries the same five-stage arc — verified across
// all 40 rows, one identical intent sequence, no deviations — and the four
// follow-up questions are the same sentences with the symptom name slotted in.
// So the chips do not need to be written by a model: once we know which symptom
// is being discussed, they are a lookup.
//
// That is also what keeps them safe. A generated chip once came back as
// "Could it be my thyroid?", which reads as ANU suspecting thyroid disease and
// invites a self-diagnosis the differential does not support. Chips built from
// this file cannot name a condition at all.

export type AnuSymptom = { key: string; label: string };

export const ANU_SYMPTOMS: AnuSymptom[] = [
  { key: 'S01', label: "Irregular periods" },
  { key: 'S02', label: "Heavy periods" },
  { key: 'S03', label: "Spotting or bleeding between periods" },
  { key: 'S04', label: "Hot flashes" },
  { key: 'S05', label: "Night sweats" },
  { key: 'S06', label: "Sleep disturbance / insomnia" },
  { key: 'S07', label: "Fatigue and low energy" },
  { key: 'S08', label: "Mood swings" },
  { key: 'S09', label: "Irritability / anger bursts" },
  { key: 'S10', label: "Anxiety / panic feeling" },
  { key: 'S11', label: "Low mood / depression" },
  { key: 'S12', label: "Brain fog" },
  { key: 'S13', label: "Memory lapses / word recall" },
  { key: 'S14', label: "Headaches / migraines" },
  { key: 'S15', label: "Weight gain / belly fat" },
  { key: 'S16', label: "Bloating" },
  { key: 'S17', label: "Constipation / bowel changes" },
  { key: 'S18', label: "Breast tenderness" },
  { key: 'S19', label: "Low libido" },
  { key: 'S20', label: "Vaginal dryness / itching" },
  { key: 'S21', label: "Pain during sex" },
  { key: 'S22', label: "Urinary urgency / frequent urination" },
  { key: 'S23', label: "Recurrent UTIs" },
  { key: 'S24', label: "Urinary leakage / incontinence" },
  { key: 'S25', label: "Heart palpitations" },
  { key: 'S26', label: "Dizziness / vertigo" },
  { key: 'S27', label: "Joint pain" },
  { key: 'S28', label: "Muscle aches / cramps" },
  { key: 'S29', label: "Tingling / numbness" },
  { key: 'S30', label: "Skin dryness / itching" },
  { key: 'S31', label: "Acne / skin changes" },
  { key: 'S32', label: "Hair thinning / hair loss" },
  { key: 'S33', label: "Brittle nails" },
  { key: 'S34', label: "Dry eyes" },
  { key: 'S35', label: "Mouth burning / dry mouth" },
  { key: 'S36', label: "Sensitive teeth / bleeding gums" },
  { key: 'S37', label: "Tinnitus / ringing in ears" },
  { key: 'S38', label: "Changes in taste or smell" },
  { key: 'S39', label: "Cold flashes / chills" },
  { key: 'S40', label: "Body odour / increased sweating" }
];

/// Wording taken from the bank's Follow-up 1-4 `User Question` cells.
/// The last two drop the symptom name — in the bank they read "What can I do
/// today to manage {symptom}?", which is too long to sit in a chip once the
/// label is something like "Spotting or bleeding between periods".
const FOLLOW_UP_TEMPLATES: ((symptom: string) => string)[] = [
  (s) => `Why does ${s} happen?`,
  (s) => `What triggers or worsens ${s}?`,
  () => 'What can I do today?',
  () => 'When should I see a doctor?',
];

const BY_LABEL = new Map(ANU_SYMPTOMS.map((s) => [s.label.toLowerCase(), s]));

export function findSymptom(label: string | null | undefined): AnuSymptom | null {
  if (!label) return null;
  return BY_LABEL.get(label.trim().toLowerCase()) ?? null;
}

/// The chips to offer next, skipping anything she has already asked.
///
/// `asked` is matched loosely because a tapped chip comes back as the exact
/// string, but a typed question will not.
export function followUpChips(symptom: AnuSymptom, asked: string[]): string[] {
  const seen = asked.map((a) => a.trim().toLowerCase());
  return FOLLOW_UP_TEMPLATES.map((t) => t(symptom.label.toLowerCase()))
    .filter((chip) => !seen.includes(chip.toLowerCase()))
    .slice(0, 3);
}

/// Offered on the turn a symptom is first raised — the bank's own CTA for it.
export function logChip(symptom: AnuSymptom): string {
  return `Log ${symptom.label.toLowerCase()}`;
}
