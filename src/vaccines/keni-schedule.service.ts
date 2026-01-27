import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class KenyaScheduleService {
  private readonly logger = new Logger(KenyaScheduleService.name);

  // Kenya Expanded Programme on Immunization (KEPI) Schedule
  private readonly KEPI_SCHEDULE = [
    // Birth
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
    },

    // 6 weeks
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
    },

    // 10 weeks
    {
      code: 'OPV2',
      name: 'Oral Polio Vaccine 2',
      description: 'Polio vaccine at 10 weeks',
      recommendedAgeDays: 70,
      minAgeDays: 56,
      maxAgeDays: 84,
      isBirthDose: false,
      isBooster: false,
      vaccineType: 'Live attenuated',
      administrationRoute: 'Oral',
      administrationSite: 'Oral',
      dosage: '2 drops',
      dosesRequired: 'Third of 4 doses',
      diseasePrevented: 'Polio',
    },
    {
      code: 'PENTA2',
      name: 'Pentavalent 2',
      description: 'DPT-HepB-Hib vaccine at 10 weeks',
      recommendedAgeDays: 70,
      minAgeDays: 56,
      maxAgeDays: 84,
      isBirthDose: false,
      isBooster: false,
      vaccineType: 'Combination',
      administrationRoute: 'Intramuscular',
      administrationSite: 'Antero-lateral thigh',
      dosage: '0.5ml',
      dosesRequired: 'Second of 3 doses',
      diseasePrevented: 'Diphtheria, Pertussis, Tetanus, Hepatitis B, Haemophilus influenzae type b',
    },
    {
      code: 'PCV2',
      name: 'Pneumococcal Conjugate Vaccine 2',
      description: 'Pneumonia vaccine at 10 weeks',
      recommendedAgeDays: 70,
      minAgeDays: 56,
      maxAgeDays: 84,
      isBirthDose: false,
      isBooster: false,
      vaccineType: 'Conjugate',
      administrationRoute: 'Intramuscular',
      administrationSite: 'Antero-lateral thigh',
      dosage: '0.5ml',
      dosesRequired: 'Second of 3 doses',
      diseasePrevented: 'Pneumococcal disease',
    },
    {
      code: 'ROTA2',
      name: 'Rotavirus Vaccine 2',
      description: 'Rotavirus vaccine at 10 weeks',
      recommendedAgeDays: 70,
      minAgeDays: 56,
      maxAgeDays: 84,
      isBirthDose: false,
      isBooster: false,
      vaccineType: 'Live attenuated',
      administrationRoute: 'Oral',
      administrationSite: 'Oral',
      dosage: '1.5ml',
      dosesRequired: 'Second of 2 doses',
      diseasePrevented: 'Rotavirus gastroenteritis',
    },

    // 14 weeks
    {
      code: 'OPV3',
      name: 'Oral Polio Vaccine 3',
      description: 'Polio vaccine at 14 weeks',
      recommendedAgeDays: 98,
      minAgeDays: 84,
      maxAgeDays: 112,
      isBirthDose: false,
      isBooster: false,
      vaccineType: 'Live attenuated',
      administrationRoute: 'Oral',
      administrationSite: 'Oral',
      dosage: '2 drops',
      dosesRequired: 'Fourth of 4 doses',
      diseasePrevented: 'Polio',
    },
    {
      code: 'PENTA3',
      name: 'Pentavalent 3',
      description: 'DPT-HepB-Hib vaccine at 14 weeks',
      recommendedAgeDays: 98,
      minAgeDays: 84,
      maxAgeDays: 112,
      isBirthDose: false,
      isBooster: false,
      vaccineType: 'Combination',
      administrationRoute: 'Intramuscular',
      administrationSite: 'Antero-lateral thigh',
      dosage: '0.5ml',
      dosesRequired: 'Third of 3 doses',
      diseasePrevented: 'Diphtheria, Pertussis, Tetanus, Hepatitis B, Haemophilus influenzae type b',
    },
    {
      code: 'PCV3',
      name: 'Pneumococcal Conjugate Vaccine 3',
      description: 'Pneumonia vaccine at 14 weeks',
      recommendedAgeDays: 98,
      minAgeDays: 84,
      maxAgeDays: 112,
      isBirthDose: false,
      isBooster: false,
      vaccineType: 'Conjugate',
      administrationRoute: 'Intramuscular',
      administrationSite: 'Antero-lateral thigh',
      dosage: '0.5ml',
      dosesRequired: 'Third of 3 doses',
      diseasePrevented: 'Pneumococcal disease',
    },

    // 6 months
    {
      code: 'VITA6',
      name: 'Vitamin A at 6 Months',
      description: 'Vitamin A supplementation',
      recommendedAgeDays: 180,
      minAgeDays: 168,
      maxAgeDays: 192,
      isBirthDose: false,
      isBooster: false,
      vaccineType: 'Supplement',
      administrationRoute: 'Oral',
      administrationSite: 'Oral',
      dosage: '100,000 IU',
      dosesRequired: 'Every 6 months',
      diseasePrevented: 'Vitamin A deficiency',
    },

    // 9 months
    {
      code: 'MEASLES1',
      name: 'Measles-Rubella 1',
      description: 'Measles and Rubella vaccine',
      recommendedAgeDays: 270,
      minAgeDays: 252,
      maxAgeDays: 288,
      isBirthDose: false,
      isBooster: false,
      vaccineType: 'Live attenuated',
      administrationRoute: 'Subcutaneous',
      administrationSite: 'Right upper arm',
      dosage: '0.5ml',
      dosesRequired: 'First of 2 doses',
      diseasePrevented: 'Measles and Rubella',
    },
    {
      code: 'YELLOW',
      name: 'Yellow Fever Vaccine',
      description: 'Yellow fever vaccine',
      recommendedAgeDays: 270,
      minAgeDays: 252,
      maxAgeDays: 288,
      isBirthDose: false,
      isBooster: false,
      vaccineType: 'Live attenuated',
      administrationRoute: 'Subcutaneous',
      administrationSite: 'Left upper arm',
      dosage: '0.5ml',
      dosesRequired: 'Single dose',
      diseasePrevented: 'Yellow fever',
    },

    // 18 months
    {
      code: 'MEASLES2',
      name: 'Measles-Rubella 2',
      description: 'Measles and Rubella second dose',
      recommendedAgeDays: 540,
      minAgeDays: 522,
      maxAgeDays: 558,
      isBirthDose: false,
      isBooster: true,
      vaccineType: 'Live attenuated',
      administrationRoute: 'Subcutaneous',
      administrationSite: 'Right upper arm',
      dosage: '0.5ml',
      dosesRequired: 'Second of 2 doses',
      diseasePrevented: 'Measles and Rubella',
    },

    // 2 years
    {
      code: 'VITA2',
      name: 'Vitamin A Every 6 Months',
      description: 'Vitamin A supplementation every 6 months from 2 years',
      recommendedAgeDays: 730,
      minAgeDays: 700,
      maxAgeDays: 760,
      isBirthDose: false,
      isBooster: false,
      vaccineType: 'Supplement',
      administrationRoute: 'Oral',
      administrationSite: 'Oral',
      dosage: '200,000 IU',
      dosesRequired: 'Every 6 months',
      diseasePrevented: 'Vitamin A deficiency',
    },
  ];

  constructor(private prisma: PrismaService) {}

  async seedKepiVaccines(): Promise<{ created: number; updated: number; skipped: number }> {
    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const vaccineData of this.KEPI_SCHEDULE) {
      try {
        const existingVaccine = await this.prisma.vaccine.findUnique({
          where: { code: vaccineData.code },
        });

        if (existingVaccine) {
          // Update existing vaccine
          await this.prisma.vaccine.update({
            where: { code: vaccineData.code },
            data: {
              ...vaccineData,
              isActive: true,
            },
          });
          updated++;
          this.logger.log(`Updated vaccine: ${vaccineData.code} - ${vaccineData.name}`);
        } else {
          // Create new vaccine
          await this.prisma.vaccine.create({
            data: {
              ...vaccineData,
              isActive: true,
            },
          });
          created++;
          this.logger.log(`Created vaccine: ${vaccineData.code} - ${vaccineData.name}`);
        }
      } catch (error) {
        skipped++;
        this.logger.error(`Failed to process vaccine ${vaccineData.code}: ${error.message}`);
      }
    }

    return { created, updated, skipped };
  }

  async getVaccineSchedule(): Promise<any[]> {
    return this.KEPI_SCHEDULE.map(vaccine => ({
      ...vaccine,
      ageDescription: this.getAgeDescription(vaccine.recommendedAgeDays),
    }));
  }

  async getVaccineScheduleForChild(dateOfBirth: Date): Promise<any[]> {
    const today = new Date();
    const childAgeDays = Math.floor((today.getTime() - dateOfBirth.getTime()) / (1000 * 60 * 60 * 24));
    
    return this.KEPI_SCHEDULE.map(vaccine => {
      const dueDate = new Date(dateOfBirth);
      dueDate.setDate(dueDate.getDate() + vaccine.recommendedAgeDays);
      
      const isPastDue = dueDate < today;
      const isUpcoming = dueDate >= today && dueDate <= new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000); // Next 30 days
      const isEligible = childAgeDays >= (vaccine.minAgeDays || 0) && childAgeDays <= (vaccine.maxAgeDays || Infinity);
      
      return {
        ...vaccine,
        dueDate,
        ageDescription: this.getAgeDescription(vaccine.recommendedAgeDays),
        isPastDue,
        isUpcoming,
        isEligible,
        status: this.getVaccineStatus(dueDate, childAgeDays, vaccine),
      };
    }).sort((a, b) => a.recommendedAgeDays - b.recommendedAgeDays);
  }

  private getAgeDescription(ageDays: number): string {
    if (ageDays === 0) return 'At birth';
    if (ageDays < 30) return `${ageDays} day${ageDays !== 1 ? 's' : ''}`;
    
    const months = Math.floor(ageDays / 30);
    const remainingDays = ageDays % 30;
    
    if (months === 0) return `${remainingDays} day${remainingDays !== 1 ? 's' : ''}`;
    if (remainingDays === 0) return `${months} month${months !== 1 ? 's' : ''}`;
    
    return `${months} month${months !== 1 ? 's' : ''} ${remainingDays} day${remainingDays !== 1 ? 's' : ''}`;
  }

  private getVaccineStatus(dueDate: Date, childAgeDays: number, vaccine: any): string {
    const today = new Date();
    
    if (dueDate > today) {
      if (childAgeDays >= vaccine.recommendedAgeDays) {
        return 'DUE_NOW';
      }
      return 'FUTURE';
    } else {
      if (childAgeDays > (vaccine.maxAgeDays || Infinity)) {
        return 'MISSED';
      }
      return 'OVERDUE';
    }
  }

  async getRecommendedVaccinesForAge(ageDays: number): Promise<any[]> {
    return this.KEPI_SCHEDULE.filter(vaccine => {
      const minAge = vaccine.minAgeDays || 0;
      const maxAge = vaccine.maxAgeDays || Infinity;
      return ageDays >= minAge && ageDays <= maxAge;
    }).map(vaccine => ({
      ...vaccine,
      ageDescription: this.getAgeDescription(vaccine.recommendedAgeDays),
      isOnSchedule: Math.abs(ageDays - vaccine.recommendedAgeDays) <= 7, // Within 7 days of recommended age
    }));
  }

  async validateVaccineAdministration(
    vaccineCode: string,
    childAgeDays: number,
  ): Promise<{
    isValid: boolean;
    message?: string;
    vaccine?: any;
    recommendedAge?: number;
    ageDifference?: number;
  }> {
    const vaccine = this.KEPI_SCHEDULE.find(v => v.code === vaccineCode);
    
    if (!vaccine) {
      return {
        isValid: false,
        message: `Vaccine with code ${vaccineCode} not found in KEPI schedule`,
      };
    }

    const minAge = vaccine.minAgeDays || 0;
    const maxAge = vaccine.maxAgeDays || Infinity;
    const recommendedAge = vaccine.recommendedAgeDays;
    const ageDifference = childAgeDays - recommendedAge;

    if (childAgeDays < minAge) {
      return {
        isValid: false,
        message: `Child is too young for ${vaccine.name}. Minimum age: ${this.getAgeDescription(minAge)}`,
        vaccine,
        recommendedAge,
        ageDifference,
      };
    }

    if (childAgeDays > maxAge) {
      return {
        isValid: false,
        message: `Child is too old for ${vaccine.name}. Maximum age: ${this.getAgeDescription(maxAge)}`,
        vaccine,
        recommendedAge,
        ageDifference,
      };
    }

    // Check if significantly early or late (more than 14 days)
    if (Math.abs(ageDifference) > 14) {
      const status = ageDifference > 0 ? 'late' : 'early';
      return {
        isValid: true,
        message: `Vaccine is being administered ${Math.abs(ageDifference)} days ${status}. Recommended age: ${this.getAgeDescription(recommendedAge)}`,
        vaccine,
        recommendedAge,
        ageDifference,
      };
    }

    return {
      isValid: true,
      message: `Vaccine administration is within acceptable range.`,
      vaccine,
      recommendedAge,
      ageDifference,
    };
  }
}