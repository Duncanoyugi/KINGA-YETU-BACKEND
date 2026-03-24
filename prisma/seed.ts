import { PrismaClient, ReportType } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // Note: Reports now require userId - skipping seed for now
  console.log('Seeding completed (reports skipped - require valid userId)');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
