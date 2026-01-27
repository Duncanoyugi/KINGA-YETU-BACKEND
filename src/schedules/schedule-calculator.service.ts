import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { KenyaScheduleService } from '../vaccines/keni-schedule.service';
import { ImmunizationStatus } from '@prisma/client';

@Injectable()
export class ScheduleCalculatorService {
  private readonly logger = new Logger(ScheduleCalculatorService.name);

  constructor(
    private prisma: PrismaService,
    private kenyaScheduleService: KenyaScheduleService,
  ) {}

  async generateScheduleForChild(
    childId: string,
    dateOfBirth: Date,
    includeCatchup: boolean = true,
  ): Promise<{ created: number; updated: number; skipped: number }> {
    const child = await this.prisma.child.findUnique({
      where: { id: childId },
      include: {
        immunizations: {
          select: {
            vaccineId: true,
            status: true,
          },
        },
        schedules: {
          select: {
            vaccineId: true,
            status: true,
          },
        },
      },
    });

    if (!child) {
      throw new Error(`Child with ID ${childId} not found`);
    }

    const administeredVaccineIds = child.immunizations
      .filter(imm => imm.status === 'ADMINISTERED')
      .map(imm => imm.vaccineId);

    const existingScheduleVaccineIds = child.schedules.map(schedule => schedule.vaccineId);

    const kepiSchedule = await this.kenyaScheduleService.getVaccineSchedule();
    const today = new Date();
    const childAgeDays = this.calculateAgeInDays(dateOfBirth, today);

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const vaccineData of kepiSchedule) {
      try {
        // Check if vaccine exists in database
        let vaccine = await this.prisma.vaccine.findUnique({
          where: { code: vaccineData.code },
        });

        if (!vaccine) {
          // Create vaccine if it doesn't exist
          vaccine = await this.prisma.vaccine.create({
            data: {
              code: vaccineData.code,
              name: vaccineData.name,
              description: vaccineData.description,
              recommendedAgeDays: vaccineData.recommendedAgeDays,
              minAgeDays: vaccineData.minAgeDays,
              maxAgeDays: vaccineData.maxAgeDays,
              isBirthDose: vaccineData.isBirthDose,
              isBooster: vaccineData.isBooster,
              vaccineType: vaccineData.vaccineType,
              administrationRoute: vaccineData.administrationRoute,
              administrationSite: vaccineData.administrationSite,
              dosage: vaccineData.dosage,
              dosesRequired: vaccineData.dosesRequired,
              diseasePrevented: vaccineData.diseasePrevented,
              manufacturer: vaccineData.manufacturer,
              storageRequirements: vaccineData.storageRequirements,
              sideEffects: vaccineData.sideEffects,
              contraindications: vaccineData.contraindications,
              isActive: true,
            },
          });
        }

        // Skip if already administered
        if (administeredVaccineIds.includes(vaccine.id)) {
          skipped++;
          continue;
        }

        // Calculate due date
        const dueDate = new Date(dateOfBirth);
        dueDate.setDate(dueDate.getDate() + vaccineData.recommendedAgeDays);

        // Determine status
        let status: ImmunizationStatus = ImmunizationStatus.SCHEDULED;
        const isOverdue = dueDate < today;
        const isMissed = childAgeDays > (vaccineData.maxAgeDays || Infinity);

        if (isMissed) {
          status = ImmunizationStatus.MISSED;
        } else if (isOverdue) {
          status = ImmunizationStatus.SCHEDULED; // Keep as scheduled for catchup
        }

        // Check if schedule already exists
        const existingSchedule = await this.prisma.vaccinationSchedule.findFirst({
          where: {
            childId,
            vaccineId: vaccine.id,
          },
        });

        if (existingSchedule) {
          // Update existing schedule
          await this.prisma.vaccinationSchedule.update({
            where: { id: existingSchedule.id },
            data: {
              dueDate,
              status,
            },
          });
          updated++;
        } else {
          // Create new schedule
          await this.prisma.vaccinationSchedule.create({
            data: {
              childId,
              vaccineId: vaccine.id,
              dueDate,
              status,
            },
          });
          created++;
        }
      } catch (error) {
        skipped++;
        this.logger.error(`Failed to process vaccine ${vaccineData.code} for child ${childId}: ${error.message}`);
      }
    }

    // Generate catchup schedule if requested
    if (includeCatchup) {
      const catchupResult = await this.generateCatchupSchedule(childId, dateOfBirth);
      created += catchupResult.created;
      updated += catchupResult.updated;
      skipped += catchupResult.skipped;
    }

    this.logger.log(`Generated schedule for child ${childId}: ${created} created, ${updated} updated, ${skipped} skipped`);

    return { created, updated, skipped };
  }

  async generateCatchupSchedule(
    childId: string,
    dateOfBirth: Date,
  ): Promise<{ created: number; updated: number; skipped: number }> {
    const child = await this.prisma.child.findUnique({
      where: { id: childId },
      include: {
        immunizations: {
          where: { status: 'ADMINISTERED' },
          select: { vaccineId: true },
        },
        schedules: {
          select: {
            vaccineId: true,
            status: true,
          },
        },
      },
    });

    if (!child) {
      throw new Error(`Child with ID ${childId} not found`);
    }

    const administeredVaccineIds = child.immunizations.map(imm => imm.vaccineId);
    const today = new Date();
    const childAgeDays = this.calculateAgeInDays(dateOfBirth, today);

    const kepiSchedule = await this.kenyaScheduleService.getVaccineSchedule();
    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const vaccineData of kepiSchedule) {
      try {
        const vaccine = await this.prisma.vaccine.findUnique({
          where: { code: vaccineData.code },
        });

        if (!vaccine || administeredVaccineIds.includes(vaccine.id)) {
          skipped++;
          continue;
        }

        // Check if child is within catchup window (max age + 30 days grace period)
        const maxAge = vaccineData.maxAgeDays || Infinity;
        const catchupWindow = maxAge + 30; // 30-day grace period for catchup

        if (childAgeDays > catchupWindow) {
          skipped++;
          continue;
        }

        // Calculate catchup due date (immediate for overdue, normal for future)
        let dueDate = new Date(dateOfBirth);
        dueDate.setDate(dueDate.getDate() + vaccineData.recommendedAgeDays);

        if (dueDate < today) {
          // Schedule catchup immediately (within 7 days)
          dueDate = new Date(today);
          dueDate.setDate(dueDate.getDate() + 7);
        }

        // Check if schedule exists
        const existingSchedule = await this.prisma.vaccinationSchedule.findFirst({
          where: {
            childId,
            vaccineId: vaccine.id,
          },
        });

        if (existingSchedule) {
          // Update to catchup schedule
          await this.prisma.vaccinationSchedule.update({
            where: { id: existingSchedule.id },
            data: {
              dueDate,
              status: ImmunizationStatus.SCHEDULED,
            },
          });
          updated++;
        } else {
          // Create catchup schedule
          await this.prisma.vaccinationSchedule.create({
            data: {
              childId,
              vaccineId: vaccine.id,
              dueDate,
              status: ImmunizationStatus.SCHEDULED,
            },
          });
          created++;
        }
      } catch (error) {
        skipped++;
        this.logger.error(`Failed to generate catchup for vaccine ${vaccineData.code}: ${error.message}`);
      }
    }

    return { created, updated, skipped };
  }

  async getUpcomingSchedules(
    daysAhead: number = 30,
    facilityId?: string,
    childId?: string,
  ): Promise<any[]> {
    const today = new Date();
    const futureDate = new Date(today);
    futureDate.setDate(futureDate.getDate() + daysAhead);

    const where: any = {
      dueDate: {
        gte: today,
        lte: futureDate,
      },
      status: 'SCHEDULED',
    };

    if (childId) {
      where.childId = childId;
    }

    const schedules = await this.prisma.vaccinationSchedule.findMany({
      where,
      include: {
        child: {
          include: {
            parent: {
              include: {
                user: {
                  select: {
                    id: true,
                    fullName: true,
                    email: true,
                    phoneNumber: true,
                    profile: {
                      select: {
                        county: true,
                        subCounty: true,
                        address: true,
                      },
                    },
                  },
                },
              },
            },
            birthFacility: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
          },
        },
        vaccine: {
          select: {
            id: true,
            code: true,
            name: true,
            recommendedAgeDays: true,
            description: true,
          },
        },
      },
      orderBy: { dueDate: 'asc' },
    });

    // Filter by facility if specified
    if (facilityId) {
      return schedules.filter(schedule => 
        schedule.child.birthFacility?.id === facilityId ||
        schedule.child.parent?.user.profile?.county?.includes(facilityId) // Fallback to county match
      );
    }

    return schedules.map(schedule => ({
      id: schedule.id,
      childId: schedule.child.id,
      childName: `${schedule.child.firstName} ${schedule.child.lastName}`,
      childDateOfBirth: schedule.child.dateOfBirth,
      vaccineId: schedule.vaccine.id,
      vaccineCode: schedule.vaccine.code,
      vaccineName: schedule.vaccine.name,
      dueDate: schedule.dueDate,
      daysUntilDue: Math.ceil((schedule.dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)),
      parentName: schedule.child.parent?.user.fullName,
      parentEmail: schedule.child.parent?.user.email,
      parentPhone: schedule.child.parent?.user.phoneNumber,
      county: schedule.child.parent?.user.profile?.county,
      subCounty: schedule.child.parent?.user.profile?.subCounty,
      birthFacility: schedule.child.birthFacility?.name,
    }));
  }

  async getOverdueSchedules(daysOverdue: number = 30, childId?: string): Promise<any[]> {
    const today = new Date();
    const pastDate = new Date(today);
    pastDate.setDate(pastDate.getDate() - daysOverdue);

    const where: any = {
      dueDate: {
        gte: pastDate,
        lt: today,
      },
      status: 'SCHEDULED',
    };

    if (childId) {
      where.childId = childId;
    }

    const schedules = await this.prisma.vaccinationSchedule.findMany({
      where,
      include: {
        child: {
          include: {
            parent: {
              include: {
                user: {
                  select: {
                    id: true,
                    fullName: true,
                    email: true,
                    phoneNumber: true,
                  },
                },
              },
            },
          },
        },
        vaccine: {
          select: {
            id: true,
            code: true,
            name: true,
            recommendedAgeDays: true,
          },
        },
      },
      orderBy: { dueDate: 'asc' },
    });

    return schedules.map(schedule => ({
      id: schedule.id,
      childId: schedule.child.id,
      childName: `${schedule.child.firstName} ${schedule.child.lastName}`,
      childDateOfBirth: schedule.child.dateOfBirth,
      vaccineId: schedule.vaccine.id,
      vaccineCode: schedule.vaccine.code,
      vaccineName: schedule.vaccine.name,
      dueDate: schedule.dueDate,
      daysOverdue: Math.ceil((today.getTime() - schedule.dueDate.getTime()) / (1000 * 60 * 60 * 24)),
      parentName: schedule.child.parent?.user.fullName,
      parentEmail: schedule.child.parent?.user.email,
      parentPhone: schedule.child.parent?.user.phoneNumber,
    }));
  }

  async calculateChildScheduleStats(childId: string): Promise<{
    total: number;
    scheduled: number;
    administered: number;
    missed: number;
    overdue: number;
    upcoming: number;
    timeliness: number;
  }> {
    const [schedules, immunizations] = await Promise.all([
      this.prisma.vaccinationSchedule.findMany({
        where: { childId },
      }),
      this.prisma.immunization.findMany({
        where: { childId, status: 'ADMINISTERED' },
        select: {
          vaccineId: true,
          dateAdministered: true,
          ageAtDays: true,
        },
      }),
    ]);

    const today = new Date();
    const child = await this.prisma.child.findUnique({
      where: { id: childId },
      select: { dateOfBirth: true },
    });

    if (!child) {
      throw new Error(`Child with ID ${childId} not found`);
    }

    const administeredVaccineIds = immunizations.map(imm => imm.vaccineId);
    const administeredSchedules = schedules.filter(schedule => 
      administeredVaccineIds.includes(schedule.vaccineId)
    );

    const scheduledSchedules = schedules.filter(schedule => 
      schedule.status === 'SCHEDULED' && !administeredVaccineIds.includes(schedule.vaccineId)
    );

    const missedSchedules = schedules.filter(schedule => 
      schedule.status === 'MISSED' || 
      (schedule.status === 'SCHEDULED' && schedule.dueDate < today && !administeredVaccineIds.includes(schedule.vaccineId))
    );

    const overdueSchedules = scheduledSchedules.filter(schedule => schedule.dueDate < today);
    const upcomingSchedules = scheduledSchedules.filter(schedule => 
      schedule.dueDate >= today && schedule.dueDate <= new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)
    );

    // Calculate timeliness (administered on time ± 7 days)
    let timelyCount = 0;
    for (const immunization of immunizations) {
      const schedule = schedules.find(s => s.vaccineId === immunization.vaccineId);
      if (schedule) {
        const recommendedDate = new Date(child.dateOfBirth);
        recommendedDate.setDate(recommendedDate.getDate() + immunization.ageAtDays);
        
        const daysDiff = Math.abs(
          (immunization.dateAdministered.getTime() - recommendedDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        
        if (daysDiff <= 7) {
          timelyCount++;
        }
      }
    }

    const timeliness = immunizations.length > 0 ? (timelyCount / immunizations.length) * 100 : 0;

    return {
      total: schedules.length,
      scheduled: scheduledSchedules.length,
      administered: administeredSchedules.length,
      missed: missedSchedules.length,
      overdue: overdueSchedules.length,
      upcoming: upcomingSchedules.length,
      timeliness: Math.round(timeliness * 100) / 100,
    };
  }

  async rescheduleVaccine(
    scheduleId: string,
    newDate: Date,
    reason?: string,
  ): Promise<any> {
    const schedule = await this.prisma.vaccinationSchedule.findUnique({
      where: { id: scheduleId },
      include: {
        child: true,
        vaccine: true,
      },
    });

    if (!schedule) {
      throw new Error(`Schedule with ID ${scheduleId} not found`);
    }

    // Validate new date is not in the past (except for catchup)
    const today = new Date();
    if (newDate < today) {
      throw new Error('Cannot reschedule to a past date');
    }

    // Validate age appropriateness
    const childAgeDays = this.calculateAgeInDays(schedule.child.dateOfBirth, newDate);
    const validation = await this.kenyaScheduleService.validateVaccineAdministration(
      schedule.vaccine.code,
      childAgeDays,
    );

    if (!validation.isValid) {
      throw new Error(`Invalid reschedule: ${validation.message}`);
    }

    const updatedSchedule = await this.prisma.vaccinationSchedule.update({
      where: { id: scheduleId },
      data: {
        dueDate: newDate,
        status: 'SCHEDULED',
      },
      include: {
        child: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        vaccine: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    // Log reschedule activity
    await this.prisma.auditLog.create({
      data: {
        action: 'UPDATE',
        entityType: 'VaccinationSchedule',
        entityId: scheduleId,
        newData: JSON.stringify({
          oldDueDate: schedule.dueDate,
          newDueDate: newDate,
          reason,
          validated: validation,
        }),
      },
    });

    return updatedSchedule;
  }

  async markAsContraindicated(
    scheduleId: string,
    reason: string,
    healthWorkerId: string,
  ): Promise<any> {
    const schedule = await this.prisma.vaccinationSchedule.findUnique({
      where: { id: scheduleId },
    });

    if (!schedule) {
      throw new Error(`Schedule with ID ${scheduleId} not found`);
    }

    const updatedSchedule = await this.prisma.vaccinationSchedule.update({
      where: { id: scheduleId },
      data: {
        status: 'CONTRAINDICATED',
      },
    });

    // Also update any existing immunization record
    await this.prisma.immunization.updateMany({
      where: {
        childId: schedule.childId,
        vaccineId: schedule.vaccineId,
      },
      data: {
        status: 'CONTRAINDICATED',
        notes: reason ? `Contraindicated: ${reason}` : undefined,
      },
    });

    // Log contraindication
    await this.prisma.auditLog.create({
      data: {
        userId: healthWorkerId,
        action: 'UPDATE',
        entityType: 'VaccinationSchedule',
        entityId: scheduleId,
        newData: JSON.stringify({
          status: 'CONTRAINDICATED',
          reason,
          healthWorkerId,
        }),
      },
    });

    return updatedSchedule;
  }

  private calculateAgeInDays(birthDate: Date, currentDate: Date): number {
    const diffTime = Math.abs(currentDate.getTime() - birthDate.getTime());
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  }

  async getScheduleForPrint(childId: string): Promise<any> {
    const schedules = await this.prisma.vaccinationSchedule.findMany({
      where: { childId },
      include: {
        child: {
          include: {
            parent: {
              include: {
                user: {
                  select: {
                    fullName: true,
                    email: true,
                    phoneNumber: true,
                    profile: {
                      select: {
                        address: true,
                        county: true,
                        subCounty: true,
                      },
                    },
                  },
                },
              },
            },
            birthFacility: {
              select: {
                name: true,
                code: true,
                address: true,
              },
            },
          },
        },
        vaccine: {
          select: {
            code: true,
            name: true,
            recommendedAgeDays: true,
            description: true,
            diseasePrevented: true,
          },
        },
      },
      orderBy: { dueDate: 'asc' },
    });

    const immunizations = await this.prisma.immunization.findMany({
      where: { childId },
      include: {
        vaccine: {
          select: {
            code: true,
            name: true,
          },
        },
        facility: {
          select: {
            name: true,
            code: true,
          },
        },
        healthWorker: {
          include: {
            user: {
              select: {
                fullName: true,
              },
            },
          },
        },
      },
      orderBy: { dateAdministered: 'asc' },
    });

    const child = await this.prisma.child.findUnique({
      where: { id: childId },
      select: {
        firstName: true,
        lastName: true,
        dateOfBirth: true,
        gender: true,
        birthCertificateNo: true,
        uniqueIdentifier: true,
      },
    });

    if (!child) {
      throw new Error(`Child with ID ${childId} not found`);
    }

    const today = new Date();
    const childAgeMonths = Math.floor(
      (today.getTime() - child.dateOfBirth.getTime()) / (1000 * 60 * 60 * 24 * 30.44)
    );

    return {
      child: {
        ...child,
        ageMonths: childAgeMonths,
        fullName: `${child.firstName} ${child.lastName}`,
      },
      schedules: schedules.map(schedule => ({
        vaccineCode: schedule.vaccine.code,
        vaccineName: schedule.vaccine.name,
        dueDate: schedule.dueDate,
        status: schedule.status,
        recommendedAge: this.getAgeDescription(schedule.vaccine.recommendedAgeDays),
        diseasePrevented: schedule.vaccine.diseasePrevented,
        isOverdue: schedule.dueDate < today && schedule.status === 'SCHEDULED',
        isUpcoming: schedule.dueDate >= today && schedule.dueDate <= new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000),
      })),
      immunizations: immunizations.map(imm => ({
        vaccineCode: imm.vaccine.code,
        vaccineName: imm.vaccine.name,
        dateAdministered: imm.dateAdministered,
        facility: imm.facility.name,
        healthWorker: imm.healthWorker.user.fullName,
        batchNumber: imm.batchNumber,
        ageAtDays: imm.ageAtDays,
      })),
      generatedAt: today,
      coverage: await this.calculateCoveragePercentage(childId),
    };
  }

  private getAgeDescription(ageDays: number): string {
    if (ageDays === 0) return 'At birth';
    if (ageDays < 30) return `${ageDays} day${ageDays !== 1 ? 's' : ''}`;
    
    const months = Math.floor(ageDays / 30);
    const weeks = Math.floor((ageDays % 30) / 7);
    
    if (months === 0) return `${weeks} week${weeks !== 1 ? 's' : ''}`;
    if (weeks === 0) return `${months} month${months !== 1 ? 's' : ''}`;
    
    return `${months} month${months !== 1 ? 's' : ''} ${weeks} week${weeks !== 1 ? 's' : ''}`;
  }

  async calculateCoveragePercentage(childId: string): Promise<number> {
    const [schedules, immunizations] = await Promise.all([
      this.prisma.vaccinationSchedule.count({
        where: { childId },
      }),
      this.prisma.immunization.count({
        where: { 
          childId,
          status: 'ADMINISTERED',
        },
      }),
    ]);

    return schedules > 0 ? (immunizations / schedules) * 100 : 0;
  }
}