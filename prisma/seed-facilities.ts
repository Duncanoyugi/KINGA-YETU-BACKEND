import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const tharakaNithiFacilities = [
  { name: 'Chuka Referral Hospital', code: 'THR-CHK-001', subCounty: 'Chuka', type: 'HOSPITAL' as const },
  { name: 'Chuka Dispensary', code: 'THR-CHK-002', subCounty: 'Chuka', type: 'DISPENSARY' as const },
  { name: 'Mitungati Dispensary', code: 'THR-MTG-001', subCounty: 'Mitungati', type: 'DISPENSARY' as const },
  { name: 'Kajuki Dispensary', code: 'THR-KJK-001', subCounty: 'Chuka', type: 'DISPENSARY' as const },
  { name: 'Marima Dispensary', code: 'THR-MRM-001', subCounty: 'Marima', type: 'DISPENSARY' as const },
  { name: 'Kathwana Health Center', code: 'THR-KTH-001', subCounty: 'Chuka', type: 'HEALTH_CENTER' as const },
  { name: 'Chiakariga Dispensary', code: 'THR-CHR-001', subCounty: 'Chuka', type: 'DISPENSARY' as const },
  { name: 'Gatugura Dispensary', code: 'THR-GTG-001', subCounty: 'Mitungati', type: 'DISPENSARY' as const },
];

async function seedTharakaNithiFacilities() {
  // Check if facilities already exist
  const existing = await prisma.healthFacility.findMany({
    where: { county: 'Tharaka-Nithi' }
  });
  
  if (existing.length > 0) {
    console.log(`Tharaka-Nithi facilities already exist: ${existing.length}`);
    existing.forEach(f => console.log(`  - ${f.name}`));
    return;
  }

  console.log('Creating Tharaka-Nithi facilities...');
  
  for (const f of tharakaNithiFacilities) {
    await prisma.healthFacility.create({
      data: {
        name: f.name,
        code: f.code,
        county: 'Tharaka-Nithi',
        subCounty: f.subCounty,
        type: f.type,
        isActive: true,
      }
    });
    console.log(`  Created: ${f.name}`);
  }
  
  const count = await prisma.healthFacility.count({ where: { county: 'Tharaka-Nithi' } });
  console.log(`\nTotal Tharaka-Nithi facilities: ${count}`);
}

seedTharakaNithiFacilities()
  .catch(console.error)
  .finally(() => prisma.$disconnect().then(() => pool.end()));