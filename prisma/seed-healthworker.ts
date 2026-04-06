import 'dotenv/config';
import { PrismaClient, Gender, ImmunizationStatus, ScheduleStatus, ReportType } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
  adapter,
  log: ['error'],
});

async function seedHealthWorkerData() {
  console.log('Seeding test data for health worker dashboard...');

  // Get or create facility
  let facility = await prisma.healthFacility.findFirst({
    where: { name: { contains: 'chuka', mode: 'insensitive' } }
  });

  if (!facility) {
    facility = await prisma.healthFacility.create({
      data: {
        name: 'Chuka Dispensary',
        code: 'CHUKA001',
        county: 'Tharaka-Nithi',
        subCounty: 'Chuka',
        type: 'DISPENSARY',
        isActive: true,
      }
    });
    console.log(`Created facility: ${facility.id}`);
  }

  console.log(`Using facility: ${facility.name} (${facility.id})`);

  // Get or create a test user for parent
  let testUser = await prisma.user.findFirst({
    where: { email: 'testparent@example.com' }
  });

  if (!testUser) {
    testUser = await prisma.user.create({
      data: {
        email: 'testparent@example.com',
        password: 'hashedpassword123',
        fullName: 'Test Parent',
        phoneNumber: '+254700000001',
        role: 'PARENT',
        isActive: true,
      }
    });
    console.log(`Created test user: ${testUser.id}`);
  }

  // Get or create parent profile
  let parent = await prisma.parent.findUnique({
    where: { userId: testUser.id }
  });

  if (!parent) {
    parent = await prisma.parent.create({
      data: {
        userId: testUser.id,
      }
    });
    console.log(`Created parent: ${parent.id}`);
  }

  // Get a vaccine
  const vaccine = await prisma.vaccine.findFirst();
  if (!vaccine) {
    console.log('No vaccine found! Run KEPI seed first.');
    return;
  }
  console.log(`Using vaccine: ${vaccine.name}`);

  // Create children with immunizations
  const childrenData = [
    { firstName: 'Alice', lastName: 'Wanjiku', dob: new Date('2024-01-15') },
    { firstName: 'Bob', lastName: 'Kariuki', dob: new Date('2024-06-20') },
    { firstName: 'Carol', lastName: 'Njoroge', dob: new Date('2023-08-10') },
  ];

  for (const childData of childrenData) {
    // Check if child exists
    let child = await prisma.child.findFirst({
      where: { 
        firstName: childData.firstName,
        parentId: parent.id
      }
    });

    if (!child) {
      child = await prisma.child.create({
        data: {
          firstName: childData.firstName,
          lastName: childData.lastName,
          dateOfBirth: childData.dob,
          gender: Gender.FEMALE,
          parentId: parent.id,
          birthFacilityId: facility.id,
        }
      });
      console.log(`Created child: ${child.firstName} ${child.lastName}`);

      // Create vaccination schedule
      const dueDate = new Date(child.dateOfBirth);
      dueDate.setDate(dueDate.getDate() + 42); // 6 weeks after birth

      await prisma.vaccinationSchedule.create({
        data: {
          childId: child.id,
          parentId: parent.id,
          vaccineId: vaccine.id,
          dueDate: dueDate,
          status: ScheduleStatus.PENDING,
        }
      });
    }

    // Create immunization record for this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    const endOfMonth = new Date();
    endOfMonth.setMonth(endOfMonth.getMonth() + 1, 0);

    const existingImmunization = await prisma.immunization.findFirst({
      where: {
        childId: child.id,
        dateAdministered: { gte: startOfMonth, lte: endOfMonth }
      }
    });

    if (!existingImmunization) {
      await prisma.immunization.create({
        data: {
          childId: child.id,
          vaccineId: vaccine.id,
          facilityId: facility.id,
          dateAdministered: new Date(),
          status: ImmunizationStatus.ADMINISTERED,
          ageAtDays: 60,
        }
      });
      console.log(`Created immunization for ${child.firstName}`);
    }
  }

  // Create a test report
  const healthWorker = await prisma.healthWorker.findFirst({
    where: { facilityId: facility.id }
  });

  if (healthWorker) {
    const existingReport = await prisma.report.findFirst({
      where: { 
        userId: healthWorker.userId,
        title: 'Test Coverage Report'
      }
    });

    if (!existingReport) {
      await prisma.report.create({
        data: {
          userId: healthWorker.userId,
          title: 'Test Coverage Report',
          type: ReportType.COVERAGE,
        }
      });
      console.log('Created test report');
    }
  } else {
    // Create report with test user if no health worker
    const existingReport = await prisma.report.findFirst({
      where: { 
        userId: testUser.id,
        title: 'Test Coverage Report'
      }
    });

    if (!existingReport) {
      await prisma.report.create({
        data: {
          userId: testUser.id,
          title: 'Test Coverage Report',
          type: ReportType.COVERAGE,
        }
      });
      console.log('Created test report (with test user)');
    }
  }

  // Count summary
  const childCount = await prisma.child.count({ where: { birthFacilityId: facility.id } });
  const immunizationCount = await prisma.immunization.count({ where: { facilityId: facility.id } });
  const reportCount = await prisma.report.count();

  console.log('\n✅ Seed completed!');
  console.log(`Facility: ${facility.name}`);
  console.log(`Total Children at facility: ${childCount}`);
  console.log(`Total Immunizations: ${immunizationCount}`);
  console.log(`Total Reports: ${reportCount}`);
}

seedHealthWorkerData()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });