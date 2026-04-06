import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function debug() {
  // Get health worker
  const hw = await prisma.healthWorker.findFirst({
    where: { user: { email: 'max@gmail.com' } },
    include: { facility: true }
  });
  console.log('Health Worker:', hw?.facilityId, hw?.facility?.name);

  // Get children at facility
  if (hw?.facilityId) {
    const kids = await prisma.child.findMany({
      where: { birthFacilityId: hw.facilityId },
      select: { id: true, firstName: true }
    });
    console.log('Children at facility:', kids.length, kids.map(k => k.firstName));

    // Get immunizations at facility
    const imms = await prisma.immunization.findMany({
      where: { facilityId: hw.facilityId }
    });
    console.log('Immunizations at facility:', imms.length);

    // Get children with immunizations
    const kidsWithImms = await prisma.child.count({
      where: {
        birthFacilityId: hw.facilityId,
        immunizations: { some: {} }
      }
    });
    console.log('Children with immunizations:', kidsWithImms);
  }
}

debug()
  .catch(console.error)
  .finally(() => prisma.$disconnect().then(() => pool.end()));