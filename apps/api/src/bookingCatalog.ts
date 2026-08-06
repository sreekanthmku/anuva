import type { DetailedPractitioner } from '@anuva/shared';
import type { prisma as prismaClient } from '@anuva/database';

type SeedSpecialist = {
  key: string;
  name: string;
  subtitle: string;
  tag: string;
  role?: string;
  specialization?: string;
  summary?: string;
  experience?: string;
  imageUrl?: string;
  qualifications: string[];
  bookable: boolean;
};

export const BOOKABLE_DOCTOR_KEYS = new Set(['kekin-gala', 'rizwana-sayed']);

/**
 * Which detailed-assessment sections each specialist may read, by lens. This is an access-control
 * boundary, not a display hint: a specialist absent from this map reads nothing, so adding a
 * colleague to the catalog without a deliberate entry here denies rather than grants.
 *
 * Jigna Shah holds two lenses because she practises as both — the role is
 * "Menopause coach & Clinical Nutritionist (RD)".
 */
export const SPECIALIST_LENSES: Record<string, readonly DetailedPractitioner[]> = {
  'kekin-gala': ['gynaecologist'],
  'rizwana-sayed': ['gynaecologist'],
  'jai-bapat': ['psychologist'],
  'jigna-shah': ['dietician', 'coach'],
};

export function lensesForSpecialist(key: string | null): readonly DetailedPractitioner[] {
  if (!key) return [];
  return SPECIALIST_LENSES[key] ?? [];
}

const seedSpecialists: SeedSpecialist[] = [
  {
    key: 'kekin-gala',
    name: 'Dr. Kekin C. Gala',
    subtitle: 'Obstetrician · Gynecologist · Fertility Specialist · Laparoscopic Surgeon',
    tag: 'Clinical',
    role: 'Obstetrician | Gynecologist | Fertility Specialist | Laparoscopic Surgeon',
    specialization:
      'Highly experienced in advanced gynecological treatments and patient-focused care, with expertise in fertility treatment, high-risk pregnancy management, and laparoscopic surgeries.',
    summary:
      'Combines modern medical techniques with compassionate care to ensure personalized treatment and a high standard of healthcare. Also a speaker and faculty member at national and international gynecological conferences.',
    experience: 'Over a decade of medical experience',
    imageUrl: '/kekin.jpeg',
    qualifications: ['M.D.', 'F.C.P.S.', 'D.F.P.', 'D.G.O.', 'M.B.B.S.'],
    bookable: true,
  },
  {
    key: 'rizwana-sayed',
    name: 'Dr. Rizwana Sayed',
    subtitle: 'MD, DGO, DFP',
    tag: 'Gynecologist',
    role: 'Director of CARNATION Medical Centre, Juhu, Mumbai',
    specialization:
      'Practicing obstetrician and gynecologist for more than 18 years, with international experience and special interest in gynec endoscopy and sonology.',
    summary:
      'Organised cervical cancer awareness, adolescent health, and menopause care campaigns. She is also a keen academician, faculty at regional and national conferences, a consultant doctor on WIN TV Channel, and founder-trustee of Kidhmat Foundation.',
    experience: '18+ years',
    imageUrl: '/rizwana.jpeg',
    qualifications: ['MD', 'DGO', 'DFP'],
    bookable: true,
  },
  {
    key: 'jai-bapat',
    name: 'Jai Bapat',
    subtitle: 'Counseling Psychologist · 13y',
    tag: 'Therapy',
    role: 'Counseling Psychologist',
    specialization: 'Trained in RECBT Therapy from Albert Ellis Institute (NY).',
    summary:
      'Has been working in the field of mental health for the last 13 years and has helped individuals navigate emotions and function better.',
    experience: '13 years',
    imageUrl: '/jai-bapat.jpeg',
    qualifications: [],
    bookable: false,
  },
  {
    key: 'jigna-shah',
    name: 'Jigna Shah',
    subtitle: 'Menopause coach · Clinical Nutritionist (RD)',
    tag: 'Recommended',
    role: 'Menopause coach & Clinical Nutritionist (RD)',
    specialization: 'Specialized in Metabolic disorders (Diabetes, Cardiac, PCOD, Thyroid, Hypertension)',
    experience: '15 years',
    imageUrl: '/jigna-shah.jpg.jpeg',
    qualifications: [],
    bookable: false,
  },
];

let bookingCatalogReadyPromise: Promise<void> | null = null;

type PrismaClientLike = typeof prismaClient;

export function ensureBookingCatalog(prisma: PrismaClientLike): Promise<void> {
  if (!bookingCatalogReadyPromise) {
    bookingCatalogReadyPromise = seedBookingCatalog(prisma);
  }

  return bookingCatalogReadyPromise;
}

async function seedBookingCatalog(prisma: PrismaClientLike): Promise<void> {
  const specialistIdsByKey = new Map<string, string>();

  for (const specialist of seedSpecialists) {
    const upserted = await prisma.specialist.upsert({
      where: { key: specialist.key },
      create: {
        key: specialist.key,
        name: specialist.name,
        subtitle: specialist.subtitle,
        role: specialist.role,
        specialization: specialist.specialization,
        summary: specialist.summary,
        experience: specialist.experience,
        tag: specialist.tag,
        imageUrl: specialist.imageUrl,
        active: true,
      },
      update: {
        name: specialist.name,
        subtitle: specialist.subtitle,
        role: specialist.role,
        specialization: specialist.specialization,
        summary: specialist.summary,
        experience: specialist.experience,
        tag: specialist.tag,
        imageUrl: specialist.imageUrl,
        active: true,
      },
      select: { id: true },
    });

    specialistIdsByKey.set(specialist.key, upserted.id);

    await prisma.specialistQualification.deleteMany({
      where: { specialistId: upserted.id },
    });

    if (specialist.qualifications.length > 0) {
      await prisma.specialistQualification.createMany({
        data: specialist.qualifications.map((label) => ({
          specialistId: upserted.id,
          label,
        })),
      });
    }
  }

  const now = new Date();
  const slotRows: { specialistId: string; startsAt: Date; endsAt: Date }[] = [];

  for (const specialist of seedSpecialists) {
    if (!specialist.bookable) continue;

    const specialistId = specialistIdsByKey.get(specialist.key);
    if (!specialistId) continue;

    for (let dayOffset = 1; dayOffset <= 14; dayOffset += 1) {
      const date = new Date(now);
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() + dayOffset);

      const dayOfWeek = date.getDay();
      if (dayOfWeek === 0) continue;

      const times =
        specialist.key === 'kekin-gala'
          ? [
              { hour: 10, minute: 0 },
              { hour: 10, minute: 30 },
              { hour: 11, minute: 0 },
              { hour: 11, minute: 30 },
            ]
          : [
              { hour: 14, minute: 0 },
              { hour: 14, minute: 30 },
              { hour: 15, minute: 0 },
            ];

      for (const time of times) {
        const startsAt = new Date(date);
        startsAt.setHours(time.hour, time.minute, 0, 0);
        const endsAt = new Date(startsAt.getTime() + 30 * 60 * 1000);
        slotRows.push({ specialistId, startsAt, endsAt });
      }
    }
  }

  if (slotRows.length > 0) {
    await prisma.consultationSlot.createMany({
      data: slotRows,
      skipDuplicates: true,
    });
  }
}
