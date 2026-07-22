// Seeds a confirmed consultation with patient consent already recorded, so two `lk`
// participants can join and trigger the real track_published -> participant egress path.
import { prisma } from '@anuva/database';

const specialist = await prisma.specialist.findFirst({ where: { active: true } });
const user = await prisma.user.create({
  data: { phone: `+9198${String(Date.now()).slice(-8)}`, name: 'E2E Patient' },
});

const consultation = await prisma.consultation.create({
  data: {
    userId: user.id,
    specialistId: specialist.id,
    scheduledAt: new Date(),
    status: 'confirmed',
    isFree: true,
  },
});

console.log(
  JSON.stringify({
    consultationId: consultation.id,
    userId: user.id,
    roomName: `consultation_${consultation.id}`,
    doctorIdentity: `doctor:${consultation.id}`,
    patientIdentity: `patient:${user.id}:${consultation.id}`,
  }),
);

await prisma.$disconnect();
