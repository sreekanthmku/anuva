export type SpecialistId = 'gynec' | 'psych' | 'nutri' | 'riz';

export type SpecialistOption = {
  id: SpecialistId;
  title: string;
  sub: string;
  imageSrc?: string;
  imageAlt?: string;
  tag?: string;
  role?: string;
  specialization?: string;
  experience?: string;
  summary?: string;
  qualifications?: string[];
};

export const specialists: SpecialistOption[] = [
  {
    id: 'gynec',
    title: 'Jigna Shah',
    sub: 'Menopause coach · Clinical Nutritionist (RD)',
    imageSrc: '/jigna-shah.jpg.jpeg',
    imageAlt: 'Jigna Shah',
    tag: 'Recommended',
    role: 'Menopause coach & Clinical Nutritionist (RD)',
    specialization: 'Specialized in Metabolic disorders (Diabetes, Cardiac, PCOD, Thyroid, Hypertension)',
    experience: '15 years',
  },
  {
    id: 'psych',
    title: 'Dr. Kekin C. Gala',
    sub: 'Obstetrician · Gynecologist · Fertility Specialist · Laparoscopic Surgeon',
    imageSrc: '/kekin.jpeg',
    imageAlt: 'Dr. Kekin C. Gala',
    tag: 'Clinical',
    role: 'Obstetrician | Gynecologist | Fertility Specialist | Laparoscopic Surgeon',
    specialization:
      'Highly experienced in advanced gynecological treatments and patient-focused care, with expertise in fertility treatment, high-risk pregnancy management, and laparoscopic surgeries.',
    summary:
      'Combines modern medical techniques with compassionate care to ensure personalized treatment and a high standard of healthcare. Also a speaker and faculty member at national and international gynecological conferences.',
    experience: 'Over a decade of medical experience',
    qualifications: ['M.D.', 'F.C.P.S.', 'D.F.P.', 'D.G.O.', 'M.B.B.S.'],
  },
  {
    id: 'nutri',
    title: 'Jai Bapat',
    sub: 'Counseling Psychologist · 13y',
    imageSrc: '/jai-bapat.jpeg',
    imageAlt: 'Jai Bapat',
    tag: 'Therapy',
    role: 'Counseling Psychologist',
    specialization: 'Trained in RECBT Therapy from Albert Ellis Institute (NY).',
    summary: 'Has been working in the field of mental health for the last 13 years and has helped individuals navigate emotions and function better.',
    experience: '13 years',
  },
  {
    id: 'riz',
    title: 'Dr. Rizwana Sayed',
    sub: 'MD, DGO, DFP',
    imageSrc: '/rizwana.jpeg',
    imageAlt: 'Dr. Rizwana Sayed',
    tag: 'Gynecologist',
    role: 'Director of CARNATION Medical Centre, Juhu, Mumbai',
    specialization:
      'Practicing obstetrician and gynecologist for more than 18 years, with international experience and special interest in gynec endoscopy and sonology.',
    summary:
      'Organised cervical cancer awareness, adolescent health, and menopause care campaigns. She is also a keen academician, faculty at regional and national conferences, a consultant doctor on WIN TV Channel, and founder-trustee of Kidhmat Foundation.',
    experience: '18+ years',
    qualifications: ['MD', 'DGO', 'DFP'],
  },
];
