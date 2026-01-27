import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class VaccinesSeed {
  private readonly logger = new Logger(VaccinesSeed.name);

  constructor(private prisma: PrismaService) {}

  async seed() {
    this.logger.log('Starting vaccines seed...');

    const vaccines = [
      {
        code: 'BCG',
        name: 'Bacillus Calmette-Guérin',
        description: 'Tuberculosis vaccine',
        recommendedAgeDays: 0,
        minAgeDays: 0,
        maxAgeDays: 30,
        isBirthDose: true,
        isBooster: false,
        vaccineType: 'Live attenuated',
        administrationRoute: 'Intradermal',
        administrationSite: 'Left upper arm',
        dosage: '0.05ml',
        dosesRequired: 'Single dose',
        diseasePrevented: 'Tuberculosis',
        manufacturer: 'Serum Institute of India',
        storageRequirements: 'Store at 2-8°C',
        sideEffects: 'Mild fever, soreness at injection site, ulceration',
        contraindications: 'Severe immunodeficiency, HIV symptomatic',
        isActive: true,
      },
      {
        code: 'OPV0',
        name: 'Oral Polio Vaccine 0',
        description: 'Polio vaccine at birth',
        recommendedAgeDays: 0,
        minAgeDays: 0,
        maxAgeDays: 14,
        isBirthDose: true,
        isBooster: false,
        vaccineType: 'Live attenuated',
        administrationRoute: 'Oral',
        administrationSite: 'Oral',
        dosage: '2 drops',
        dosesRequired: 'First of 4 doses',
        diseasePrevented: 'Polio',
        manufacturer: 'Various',
        storageRequirements: 'Store at -20°C, transport at 2-8°C',
        sideEffects: 'None serious',
        contraindications: 'Severe immunodeficiency',
        isActive: true,
      },
      {
        code: 'HEPB0',
        name: 'Hepatitis B Birth Dose',
        description: 'Hepatitis B vaccine at birth',
        recommendedAgeDays: 0,
        minAgeDays: 0,
        maxAgeDays: 7,
        isBirthDose: true,
        isBooster: false,
        vaccineType: 'Recombinant',
        administrationRoute: 'Intramuscular',
        administrationSite: 'Antero-lateral thigh',
        dosage: '0.5ml',
        dosesRequired: 'First of 3 doses',
        diseasePrevented: 'Hepatitis B',
        manufacturer: 'Various',
        storageRequirements: 'Store at 2-8°C',
        sideEffects: 'Mild fever, soreness',
        contraindications: 'Severe allergic reaction to previous dose',
        isActive: true,
      },
      {
        code: 'OPV1',
        name: 'Oral Polio Vaccine 1',
        description: 'Polio vaccine at 6 weeks',
        recommendedAgeDays: 42,
        minAgeDays: 28,
        maxAgeDays: 56,
        isBirthDose: false,
        isBooster: false,
        vaccineType: 'Live attenuated',
        administrationRoute: 'Oral',
        administrationSite: 'Oral',
        dosage: '2 drops',
        dosesRequired: 'Second of 4 doses',
        diseasePrevented: 'Polio',
        isActive: true,
      },
      {
        code: 'PENTA1',
        name: 'Pentavalent 1',
        description: 'DPT-HepB-Hib vaccine at 6 weeks',
        recommendedAgeDays: 42,
        minAgeDays: 28,
        maxAgeDays: 56,
        isBirthDose: false,
        isBooster: false,
        vaccineType: 'Combination',
        administrationRoute: 'Intramuscular',
        administrationSite: 'Antero-lateral thigh',
        dosage: '0.5ml',
        dosesRequired: 'First of 3 doses',
        diseasePrevented: 'Diphtheria, Pertussis, Tetanus, Hepatitis B, Haemophilus influenzae type b',
        isActive: true,
      },
      {
        code: 'PCV1',
        name: 'Pneumococcal Conjugate Vaccine 1',
        description: 'Pneumonia vaccine at 6 weeks',
        recommendedAgeDays: 42,
        minAgeDays: 28,
        maxAgeDays: 56,
        isBirthDose: false,
        isBooster: false,
        vaccineType: 'Conjugate',
        administrationRoute: 'Intramuscular',
        administrationSite: 'Antero-lateral thigh',
        dosage: '0.5ml',
        dosesRequired: 'First of 3 doses',
        diseasePrevented: 'Pneumococcal disease',
        isActive: true,
      },
      {
        code: 'ROTA1',
        name: 'Rotavirus Vaccine 1',
        description: 'Rotavirus vaccine at 6 weeks',
        recommendedAgeDays: 42,
        minAgeDays: 28,
        maxAgeDays: 56,
        isBirthDose: false,
        isBooster: false,
        vaccineType: 'Live attenuated',
        administrationRoute: 'Oral',
        administrationSite: 'Oral',
        dosage: '1.5ml',
        dosesRequired: 'First of 2 doses',
        diseasePrevented: 'Rotavirus gastroenteritis',
        isActive: true,
      },
      // Add more vaccines as needed...
    ];

    let created = 0;
    let updated = 0;
    let errors = 0;

    for (const vaccineData of vaccines) {
      try {
        const existingVaccine = await this.prisma.vaccine.findUnique({
          where: { code: vaccineData.code },
        });

        if (existingVaccine) {
          await this.prisma.vaccine.update({
            where: { code: vaccineData.code },
            data: vaccineData,
          });
          updated++;
          this.logger.log(`Updated vaccine: ${vaccineData.code}`);
        } else {
          await this.prisma.vaccine.create({
            data: vaccineData,
          });
          created++;
          this.logger.log(`Created vaccine: ${vaccineData.code}`);
        }
      } catch (error) {
        errors++;
        this.logger.error(`Error processing vaccine ${vaccineData.code}: ${error.message}`);
      }
    }

    this.logger.log(`Vaccines seed completed: ${created} created, ${updated} updated, ${errors} errors`);

    return {
      created,
      updated,
      errors,
      total: created + updated,
    };
  }

  async clear() {
    this.logger.log('Clearing vaccines...');
    
    try {
      // First, delete related records
      await this.prisma.immunization.deleteMany({});
      await this.prisma.vaccinationSchedule.deleteMany({});
      await this.prisma.reminder.deleteMany({});
      
      // Then delete vaccines
      const deleted = await this.prisma.vaccine.deleteMany({});
      
      this.logger.log(`Cleared ${deleted.count} vaccines and related records`);
      return deleted.count;
    } catch (error) {
      this.logger.error(`Error clearing vaccines: ${error.message}`);
      throw error;
    }
  }
}