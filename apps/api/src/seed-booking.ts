import { prisma } from '@anuva/database';
import { ensureBookingCatalog } from './bookingCatalog.js';

async function main() {
  await ensureBookingCatalog(prisma);
  console.log('booking seed complete');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
