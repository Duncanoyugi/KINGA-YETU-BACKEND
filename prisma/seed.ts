import { PrismaClient, ReportType, ReportFormat, ReportFrequency } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  await prisma.report.create({
    data: {
      title: 'Immunization Coverage Report',
      type: ReportType.COVERAGE,
      description: 'Seeded coverage report for dashboard',
      parameters: '{}',
      data: '{}',
      format: ReportFormat.PDF,
      frequency: ReportFrequency.ON_DEMAND,
      isPublic: true,
      generatedById: 'cmm1zaqyu000kekb9em3p072m', // Admin user ID
    },
  });
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
