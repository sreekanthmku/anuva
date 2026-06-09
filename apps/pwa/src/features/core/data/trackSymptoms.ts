// Frontend-only taxonomy for the Track daily check-in.
// Move to @anuva/shared when the backend/persistence pass lands.

export const TRACK_DOMAINS = [
  {
    key: 'vasomotor',
    label: 'Vasomotor',
    items: [
      ['hot_flash', 'Hot flash'],
      ['night_sweat', 'Night sweat'],
      ['chills', 'Chills'],
    ],
  },
  {
    key: 'physical',
    label: 'Physical',
    items: [
      ['headache', 'Headache'],
      ['joint_aches', 'Joint aches'],
      ['muscle_aches', 'Muscle aches'],
      ['breast_tenderness', 'Breast tenderness'],
      ['bloating', 'Bloating'],
      ['palpitations', 'Palpitations'],
      ['dizziness', 'Dizziness'],
      ['nausea', 'Nausea'],
    ],
  },
  {
    key: 'cognitive',
    label: 'Cognitive',
    items: [
      ['brain_fog', 'Brain fog'],
      ['memory_lapse', 'Memory lapse'],
      ['poor_focus', 'Poor focus'],
    ],
  },
  {
    key: 'gsm',
    label: 'Intimate health',
    items: [
      ['vaginal_dryness', 'Vaginal dryness'],
      ['low_libido', 'Low libido'],
      ['painful_sex', 'Painful sex'],
      ['urinary_urgency', 'Urinary urgency'],
      ['urinary_leak', 'Leaks'],
    ],
  },
  {
    key: 'skin',
    label: 'Skin & Hair',
    items: [
      ['dry_skin', 'Dry skin'],
      ['itchy_skin', 'Itchy skin'],
      ['thinning_hair', 'Thinning hair'],
      ['acne', 'Acne'],
    ],
  },
] as const satisfies ReadonlyArray<{
  key: string;
  label: string;
  items: ReadonlyArray<readonly [string, string]>;
}>;
