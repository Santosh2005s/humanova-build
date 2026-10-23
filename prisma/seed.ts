import { prisma } from '../server/db';
import { seedDatabase } from '../server/seed';

seedDatabase()
  .then(() => console.log('Seeded sample inventory and volunteer profiles. No requests or assignments were fabricated.'))
  .catch((error) => {
    console.error('Database seeding failed:', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
