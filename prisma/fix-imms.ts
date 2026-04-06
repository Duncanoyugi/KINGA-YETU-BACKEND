import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function fixImmunizations() {
  // Get health worker's facility
  const hw = await prisma.healthWorker.findFirst({
    where: { user: { email: 'max@gmail.com' } },
    include: { facility: true }
  });
  
  if (!hw?.facilityId) {
    console.log('No health worker found!');
    return;
  }

  // Update immunizations to health worker's facility
  const result = await prisma.immunization.updateMany({
    where: { facilityId: { not: hw.facilityId } },
    data: { facilityId: hw.facilityId }
  });
  console.log('Updated immunizations:', result.count);

  // Verify stats
  const immsThisMonth = await prisma.immunization.count({
    where: {
      facilityId: hw.facilityId,
      dateAdministered: {
        gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        lte: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0)
      }
    }
  });
  console.log('Immunizations this month:', immsThisMonth);
}

fixImmunizations()
  .catch(console.error)
  .finally(() => prisma.$disconnect().then(() => pool.end()));