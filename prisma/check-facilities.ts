import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function checkFacilities() {
  const facilities = await prisma.healthFacility.findMany({
    select: { id: true, name: true, county: true, subCounty: true, type: true }
  });
  
  console.log('All facilities in database:');
  facilities.forEach(f => {
    console.log(`  - ${f.name} (${f.county}, ${f.subCounty}, ${f.type})`);
  });
  
  console.log(`\nTotal: ${facilities.length} facilities`);
  
  // Group by county
  const byCounty: Record<string, number> = {};
  facilities.forEach(f => {
    byCounty[f.county || 'Unknown'] = (byCounty[f.county || 'Unknown'] || 0) + 1;
  });
  console.log('\nBy County:', byCounty);
}

checkFacilities()
  .catch(console.error)
  .finally(() => prisma.$disconnect().then(() => pool.end()));