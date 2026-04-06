import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function fixData() {
  // Get health worker's facility
  const hw = await prisma.healthWorker.findFirst({
    where: { user: { email: 'max@gmail.com' } },
    include: { facility: true }
  });
  
  if (!hw?.facilityId) {
    console.log('No health worker found!');
    return;
  }

  console.log('Health worker facility:', hw.facilityId, hw.facility?.name);

  // Get existing children (any facility)
  const children = await prisma.child.findMany({
    take: 10,
    select: { id: true, firstName: true, birthFacilityId: true }
  });
  console.log('All children before:', children.length);

  // Update children to health worker's facility
  for (const child of children) {
    await prisma.child.update({
      where: { id: child.id },
      data: { birthFacilityId: hw.facilityId }
    });
  }
  console.log('Updated all children to health worker facility');

  // Verify
  const kidsNow = await prisma.child.count({
    where: { birthFacilityId: hw.facilityId }
  });
  console.log('Children at health worker facility now:', kidsNow);

  const kidsWithImms = await prisma.child.count({
    where: {
      birthFacilityId: hw.facilityId,
      immunizations: { some: {} }
    }
  });
  console.log('Children with immunizations:', kidsWithImms);
}

fixData()
  .catch(console.error)
  .finally(() => prisma.$disconnect().then(() => pool.end()));