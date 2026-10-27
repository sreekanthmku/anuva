/**
 * Send one user a slot's nudge now, however many she has already had today.
 *
 * Run inside the API container, which already has DATABASE_URL and the push keys:
 *
 *   node dist/nudge/sendToUser.js <user id | email | phone> [morning|afternoon|evening]
 *
 * Locally: pnpm --filter @anuva/api exec tsx src/nudge/sendToUser.ts <who> [slot]
 *
 * Trackers she has logged today are still left out, so if she has logged them all nothing is sent
 * and the result says SR-05. The send is recorded like any other. POST /nudge/dispatch/user does
 * the same over HTTP; both find her through `findNudgeUser`.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// The root .env when run from a checkout; in the container the variables are already set.
config({ path: path.join(__dirname, '../../../../.env') });

const { prisma } = await import('@anuva/database');
const { nudgeSlotSchema } = await import('@anuva/shared');
const { loadTranslationOverrides } = await import('../i18n/store.js');
const { dispatchSlotToUser, findNudgeUser } = await import('./scheduler.js');

async function main(argv: string[]): Promise<number> {
  const [who, slotArg = 'morning'] = argv;
  if (!who) {
    console.error('Usage: node dist/nudge/sendToUser.js <user id | email | phone> [morning|afternoon|evening]');
    return 2;
  }
  const slot = nudgeSlotSchema.safeParse(slotArg);
  if (!slot.success) {
    console.error(`Unknown slot "${slotArg}" — use morning, afternoon or evening.`);
    return 2;
  }

  const lookup = await findNudgeUser(who);
  if (!lookup.found) {
    console.error(`No user matches "${who}".`);
    return 1;
  }
  if (!lookup.reachable) {
    console.error(`User ${lookup.user.id} has no device registered for notifications.`);
    return 1;
  }

  // The same admin-panel wording corrections the server pushes with.
  await loadTranslationOverrides();
  const result = await dispatchSlotToUser(lookup.user, slot.data, new Date(), { ignoreDailyCap: true });
  console.log(JSON.stringify({ userId: lookup.user.id, slot: slot.data, ...result }, null, 2));
  return result.sent ? 0 : 1;
}

if (process.argv[1] && /sendToUser\.(js|ts)$/.test(process.argv[1])) {
  main(process.argv.slice(2))
    .then((code) => {
      process.exitCode = code;
    })
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    // Exit explicitly: an open push-service connection should not keep a one-off command alive.
    .finally(() => prisma.$disconnect().then(() => process.exit()));
}
