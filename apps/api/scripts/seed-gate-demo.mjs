/** Dev-only: a signed-in, subscribed account whose family gate is armed. Prints a session token. */
import crypto from 'node:crypto';
import { config } from 'dotenv';
config({ path: new URL('../../../.env', import.meta.url).pathname });
const { prisma } = await import('@anuva/database');

const PHONE = '+910000000009';
await prisma.user.deleteMany({ where: { phone: PHONE } });

const user = await prisma.user.create({
  data: {
    phone: PHONE,
    name: 'Meera Iyer',
    onboardingCompleted: true,
    phoneVerifiedAt: new Date(),
    subscription: { create: { plan: 'monthly', status: 'active', startedAt: new Date() } },
  },
});

const token = crypto.randomBytes(32).toString('hex');
await prisma.session.create({
  data: {
    tokenHash: crypto.createHash('sha256').update(token).digest('hex'),
    userId: user.id,
    expiresAt: new Date(Date.now() + 7 * 86_400_000),
  },
});

console.log(token);
await prisma.$disconnect();
