import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ScheduleCalculatorService } from './schedule-calculator.service';
import { ScheduleResponseDto, PaginatedSchedulesResponseDto, ScheduleStatsDto } from './dto/schedule-response.dto';
import { UpcomingVaccinesResponseDto, FacilityUpcomingVaccinesDto } from './dto/upcoming-vaccines.dto';
import { GenerateScheduleDto, RegenerateScheduleDto } from './dto/generate-schedule.dto';
import { ImmunizationStatus } from '@prisma/client';

@Injectable()
export class SchedulesService {
  constructor(
    private prisma: PrismaService,
    private scheduleCalculator: ScheduleCalculatorService,
  ) {}

  private mapToScheduleResponseDto(schedule: any): ScheduleResponseDto {
    const today = new Date();
    const dueDate = new Date(schedule.dueDate);
    const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    return {
      id: schedule.id,
      childId: schedule.childId,
      child: {
        id: schedule.child.id,
        firstName: schedule.child.firstName,
        lastName: schedule.child.lastName,
        dateOfBirth: schedule.child.dateOfBirth,
        fullName: `${schedule.child.firstName} ${schedule.child.lastName}`,
      },
      vaccineId: schedule.vaccineId,
      vaccine: {
        id: schedule.vaccine.id,
        code: schedule.vaccine.code,
        name: schedule.vaccine.name,
        recommendedAgeDays: schedule.vaccine.recommendedAgeDays,
        description: schedule.vaccine.description || undefined,
        minAgeDays: schedule.vaccine.minAgeDays || undefined,
        maxAgeDays: schedule.vaccine.maxAgeDays || undefined,
        isBirthDose: schedule.vaccine.isBirthDose,
        isBooster: schedule.vaccine.isBooster,
      },
      dueDate: schedule.dueDate,
      status: schedule.status,
      ageDescription: this.getAgeDescription(schedule.vaccine.recommendedAgeDays),
      daysUntilDue,
      isOverdue: daysUntilDue < 0,
      isUpcoming: daysUntilDue >= 0 && daysUntilDue <= 30,
      isEligible: this.isVaccineEligible(schedule.child.dateOfBirth, schedule.vaccine),
      createdAt: schedule.createdAt,
      updatedAt: schedule.updatedAt,
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

  private isVaccineEligible(childDOB: Date, vaccine: any): boolean {
    const today = new Date();
    const childAgeDays = Math.floor((today.getTime() - childDOB.getTime()) / (1000 * 60 * 60 * 24));
    
    const minAge = vaccine.minAgeDays || 0;
    const maxAge = vaccine.maxAgeDays || Infinity;
    
    return childAgeDays >= minAge && childAgeDays <= maxAge;
  }

  async generateSchedule(generateScheduleDto: GenerateScheduleDto): Promise<{
    message: string;
    created: number;
    updated: number;
    skipped: number;
  }> {
    const { childId, dateOfBirth, includeCatchup, generateReminders, reminderDaysBefore } = generateScheduleDto;

    // Check if child exists
    const child = await this.prisma.child.findUnique({
      where: { id: childId },
    });

    if (!child) {
      throw new NotFoundException(`Child with ID ${childId} not found`);
    }

    // Check if schedule already exists
    const existingSchedules = await this.prisma.vaccinationSchedule.count({
      where: { childId },
    });

    if (existingSchedules > 0) {
      throw new ConflictException(`Schedule already exists for child ${childId}. Use regenerate instead.`);
    }

    // Generate schedule
    const result = await this.scheduleCalculator.generateScheduleForChild(
      childId,
      new Date(dateOfBirth),
      includeCatchup,
    );

    // Generate reminders if requested
    let remindersCreated = 0;
    if (generateReminders) {
      remindersCreated = await this.generateRemindersForChild(
        childId,
        reminderDaysBefore || 7,
      );
    }

    return {
      message: `Schedule generated successfully. ${remindersCreated} reminders created.`,
      ...result,
    };
  }

  async regenerateSchedule(regenerateScheduleDto: RegenerateScheduleDto): Promise<{
    message: string;
    created: number;
    updated: number;
    skipped: number;
  }> {
    const { childId, force, updateReminders } = regenerateScheduleDto;

    // Check if child exists
    const child = await this.prisma.child.findUnique({
      where: { id: childId },
    });

    if (!child) {
      throw new NotFoundException(`Child with ID ${childId} not found`);
    }

    // Check if schedule exists
    const existingSchedules = await this.prisma.vaccinationSchedule.count({
      where: { childId },
    });

    if (existingSchedules === 0 && !force) {
      throw new BadRequestException(`No schedule found for child ${childId}. Use generate instead.`);
    }

    // Delete existing schedules if forcing
    if (force && existingSchedules > 0) {
      await this.prisma.vaccinationSchedule.deleteMany({
        where: { childId },
      });
    }

    // Regenerate schedule
    const result = await this.scheduleCalculator.generateScheduleForChild(
      childId,
      child.dateOfBirth,
      true, // Always include catchup for regeneration
    );

    // Update reminders if requested
    let remindersUpdated = 0;
    if (updateReminders) {
      // Delete existing reminders
      await this.prisma.reminder.deleteMany({
        where: { childId },
      });

      // Generate new reminders
      remindersUpdated = await this.generateRemindersForChild(childId, 7);
    }

    return {
      message: `Schedule regenerated successfully. ${remindersUpdated} reminders updated.`,
      ...result,
    };
  }

  private async generateRemindersForChild(childId: string, daysBefore: number): Promise<number> {
    const schedules = await this.prisma.vaccinationSchedule.findMany({
      where: {
        childId,
        status: 'SCHEDULED',
      },
      include: {
        child: {
          include: {
            parent: true,
          },
        },
        vaccine: true,
      },
    });

    let created = 0;
    const today = new Date();

    for (const schedule of schedules) {
      try {
        // Calculate reminder dates (7 days and 1 day before)
        const dueDate = new Date(schedule.dueDate);
        
        // 7-day reminder
        const reminder7Days = new Date(dueDate);
        reminder7Days.setDate(reminder7Days.getDate() - 7);
        
        if (reminder7Days >= today) {
          await this.prisma.reminder.create({
            data: {
              childId,
              parentId: schedule.child.parentId,
              vaccineId: schedule.vaccineId,
              type: 'EMAIL',
              message: `Reminder: ${schedule.child.firstName} is due for ${schedule.vaccine.name} in 7 days`,
              scheduledFor: reminder7Days,
              status: 'PENDING',
            },
          });
          created++;
        }

        // 1-day reminder
        const reminder1Day = new Date(dueDate);
        reminder1Day.setDate(reminder1Day.getDate() - 1);
        
        if (reminder1Day >= today) {
          await this.prisma.reminder.create({
            data: {
              childId,
              parentId: schedule.child.parentId,
              vaccineId: schedule.vaccineId,
              type: 'SMS',
              message: `Reminder: ${schedule.child.firstName} is due for ${schedule.vaccine.name} tomorrow`,
              scheduledFor: reminder1Day,
              status: 'PENDING',
            },
          });
          created++;
        }
      } catch (error) {
        console.error(`Failed to create reminder for schedule ${schedule.id}:`, error.message);
      }
    }

    return created;
  }

  async findAll(
    page: number = 1,
    limit: number = 10,
    childId?: string,
    vaccineId?: string,
    status?: ImmunizationStatus,
    overdue?: boolean,
    upcoming?: boolean,
    startDate?: string,
    endDate?: string,
    search?: string,
  ): Promise<PaginatedSchedulesResponseDto> {
    const skip = (page - 1) * limit;
    const today = new Date();

    const where: any = {};

    if (childId) where.childId = childId;
    if (vaccineId) where.vaccineId = vaccineId;
    if (status) where.status = status;

    // Date range filter
    if (startDate || endDate) {
      where.dueDate = {};
      if (startDate) where.dueDate.gte = new Date(startDate);
      if (endDate) where.dueDate.lte = new Date(endDate);
    }

    // Overdue filter
    if (overdue === true) {
      where.dueDate = { ...where.dueDate, lt: today };
      where.status = 'SCHEDULED';
    }

    // Upcoming filter
    if (upcoming === true) {
      const futureDate = new Date(today);
      futureDate.setDate(futureDate.getDate() + 30);
      where.dueDate = { ...where.dueDate, gte: today, lte: futureDate };
      where.status = 'SCHEDULED';
    }

    // Search filter
    if (search) {
      where.OR = [
        {
          child: {
            OR: [
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName: { contains: search, mode: 'insensitive' } },
              { birthCertificateNo: { contains: search, mode: 'insensitive' } },
            ],
          },
        },
        {
          vaccine: {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { code: { contains: search, mode: 'insensitive' } },
            ],
          },
        },
      ];
    }

    const [total, schedules] = await Promise.all([
      this.prisma.vaccinationSchedule.count({ where }),
      this.prisma.vaccinationSchedule.findMany({
        skip,
        take: limit,
        where,
        include: {
          child: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              dateOfBirth: true,
            },
          },
          vaccine: {
            select: {
              id: true,
              code: true,
              name: true,
              description: true,
              recommendedAgeDays: true,
              minAgeDays: true,
              maxAgeDays: true,
              isBirthDose: true,
              isBooster: true,
            },
          },
        },
        orderBy: { dueDate: 'asc' },
      }),
    ]);

    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      data: schedules.map(schedule => this.mapToScheduleResponseDto(schedule)),
    };
  }

  async findOne(id: string): Promise<ScheduleResponseDto> {
    const schedule = await this.prisma.vaccinationSchedule.findUnique({
      where: { id },
      include: {
        child: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            dateOfBirth: true,
            parent: {
              select: {
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
            description: true,
            recommendedAgeDays: true,
            minAgeDays: true,
            maxAgeDays: true,
            isBirthDose: true,
            isBooster: true,
            vaccineType: true,
            administrationRoute: true,
            dosage: true,
            diseasePrevented: true,
          },
        },
      },
    });

    if (!schedule) {
      throw new NotFoundException(`Schedule with ID ${id} not found`);
    }

    return this.mapToScheduleResponseDto(schedule);
  }

  async findByChildId(childId: string): Promise<ScheduleResponseDto[]> {
    const schedules = await this.prisma.vaccinationSchedule.findMany({
      where: { childId },
      include: {
        child: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            dateOfBirth: true,
          },
        },
        vaccine: {
          select: {
            id: true,
            code: true,
            name: true,
            description: true,
            recommendedAgeDays: true,
            minAgeDays: true,
            maxAgeDays: true,
            isBirthDose: true,
            isBooster: true,
          },
        },
      },
      orderBy: { dueDate: 'asc' },
    });

    return schedules.map(schedule => this.mapToScheduleResponseDto(schedule));
  }

  async getUpcomingVaccines(
    daysAhead: number = 30,
    facilityId?: string,
    childId?: string,
  ): Promise<UpcomingVaccinesResponseDto> {
    const schedules = await this.scheduleCalculator.getUpcomingSchedules(
      daysAhead,
      facilityId,
      childId,
    );

    const today = new Date();
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);
    
    const nextMonth = new Date(today);
    nextMonth.setDate(nextMonth.getDate() + 30);

    const thisWeek = schedules.filter(s => {
      const dueDate = new Date(s.dueDate);
      return dueDate <= nextWeek;
    });

    const nextWeekSchedules = schedules.filter(s => {
      const dueDate = new Date(s.dueDate);
      return dueDate > nextWeek && dueDate <= nextMonth;
    });

    const thisMonth = schedules.filter(s => {
      const dueDate = new Date(s.dueDate);
      return dueDate <= nextMonth;
    });

    return {
      total: schedules.length,
      thisWeek: thisWeek.length,
      nextWeek: nextWeekSchedules.length,
      thisMonth: thisMonth.length,
      vaccines: schedules.map(schedule => ({
        scheduleId: schedule.id,
        vaccineCode: schedule.vaccineCode,
        vaccineName: schedule.vaccineName,
        dueDate: schedule.dueDate,
        daysUntilDue: schedule.daysUntilDue,
        childName: schedule.childName,
        childId: schedule.childId,
        childDateOfBirth: schedule.childDateOfBirth,
        recommendedAge: this.getAgeDescription(schedule.daysUntilDue),
        parentName: schedule.parentName,
        parentEmail: schedule.parentEmail,
        parentPhone: schedule.parentPhone,
      })),
    };
  }

  async getOverdueVaccines(daysOverdue: number = 30, childId?: string): Promise<any[]> {
    return this.scheduleCalculator.getOverdueSchedules(daysOverdue, childId);
  }

  async getStats(facilityId?: string, startDate?: string, endDate?: string): Promise<ScheduleStatsDto> {
    const where: any = {};

    if (facilityId) {
      where.child = {
        birthFacilityId: facilityId,
      };
    }

    // Date range filter for schedules
    if (startDate || endDate) {
      where.dueDate = {};
      if (startDate) where.dueDate.gte = new Date(startDate);
      if (endDate) where.dueDate.lte = new Date(endDate);
    }

    const [
      totalSchedules,
      scheduled,
      administered,
      missed,
      contraindicated,
      overdue,
      upcoming,
    ] = await Promise.all([
      this.prisma.vaccinationSchedule.count({ where }),
      this.prisma.vaccinationSchedule.count({ 
        where: { ...where, status: 'SCHEDULED' } 
      }),
      this.prisma.vaccinationSchedule.count({ 
        where: { ...where, status: 'ADMINISTERED' } 
      }),
      this.prisma.vaccinationSchedule.count({ 
        where: { ...where, status: 'MISSED' } 
      }),
      this.prisma.vaccinationSchedule.count({ 
        where: { ...where, status: 'CONTRAINDICATED' } 
      }),
      this.prisma.vaccinationSchedule.count({
        where: {
          ...where,
          status: 'SCHEDULED',
          dueDate: { lt: new Date() },
        },
      }),
      this.prisma.vaccinationSchedule.count({
        where: {
          ...where,
          status: 'SCHEDULED',
          dueDate: {
            gte: new Date(),
            lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
        },
      }),
    ]);

    // Calculate timeliness
    const timelyImmunizations = await this.prisma.$queryRaw`
      SELECT COUNT(*) as count
      FROM immunizations i
      JOIN vaccines v ON i."vaccineId" = v.id
      JOIN children c ON i."childId" = c.id
      WHERE i.status = 'ADMINISTERED'
      AND ABS(i."ageAtDays" - v."recommendedAgeDays") <= 7
      ${facilityId ? `AND c."birthFacilityId" = ${facilityId}` : ''}
      ${startDate ? `AND i."dateAdministered" >= ${new Date(startDate)}` : ''}
      ${endDate ? `AND i."dateAdministered" <= ${new Date(endDate)}` : ''}
    `;

    const totalImmunizations = await this.prisma.immunization.count({
      where: {
        status: 'ADMINISTERED',
        ...(facilityId && {
          child: {
            birthFacilityId: facilityId,
          },
        }),
        ...(startDate && { dateAdministered: { gte: new Date(startDate) } }),
        ...(endDate && { dateAdministered: { lte: new Date(endDate) } }),
      },
    });

    const timelinessPercentage = totalImmunizations > 0
      ? (((timelyImmunizations as any)[0]?.count || 0) / totalImmunizations) * 100
      : 0;

    return {
      totalSchedules,
      scheduled,
      administered,
      missed,
      contraindicated,
      overdue,
      upcoming,
      timelinessPercentage: Math.round(timelinessPercentage * 100) / 100,
    };
  }

  async getChildScheduleStats(childId: string) {
    return this.scheduleCalculator.calculateChildScheduleStats(childId);
  }

  async reschedule(
    scheduleId: string,
    newDate: Date,
    reason?: string,
    userId?: string,
  ): Promise<ScheduleResponseDto> {
    const updatedSchedule = await this.scheduleCalculator.rescheduleVaccine(
      scheduleId,
      newDate,
      reason,
    );

    // Update audit log with user ID
    if (userId) {
      await this.prisma.auditLog.updateMany({
        where: {
          entityType: 'VaccinationSchedule',
          entityId: scheduleId,
          action: 'UPDATE',
        },
        data: {
          userId,
        },
      });
    }

    return this.mapToScheduleResponseDto(updatedSchedule);
  }

  async markAsContraindicated(
    scheduleId: string,
    reason: string,
    healthWorkerId: string,
  ): Promise<ScheduleResponseDto> {
    const updatedSchedule = await this.scheduleCalculator.markAsContraindicated(
      scheduleId,
      reason,
      healthWorkerId,
    );

    return this.mapToScheduleResponseDto(updatedSchedule);
  }

  async getScheduleForPrint(childId: string): Promise<any> {
    return this.scheduleCalculator.getScheduleForPrint(childId);
  }

  async getFacilityUpcomingVaccines(facilityId: string): Promise<FacilityUpcomingVaccinesDto> {
    const facility = await this.prisma.healthFacility.findUnique({
      where: { id: facilityId },
      select: {
        id: true,
        name: true,
        code: true,
      },
    });

    if (!facility) {
      throw new NotFoundException(`Facility with ID ${facilityId} not found`);
    }

    const schedules = await this.scheduleCalculator.getUpcomingSchedules(30, facilityId);

    return {
      facilityId: facility.id,
      facilityName: facility.name,
      totalUpcoming: schedules.length,
      vaccines: schedules.map(schedule => ({
        scheduleId: schedule.id,
        vaccineCode: schedule.vaccineCode,
        vaccineName: schedule.vaccineName,
        dueDate: schedule.dueDate,
        daysUntilDue: schedule.daysUntilDue,
        childName: schedule.childName,
        childId: schedule.childId,
        childDateOfBirth: schedule.childDateOfBirth,
        recommendedAge: this.getAgeDescription(schedule.daysUntilDue),
        parentName: schedule.parentName,
        parentEmail: schedule.parentEmail,
        parentPhone: schedule.parentPhone,
      })),
    };
  }

  async searchSchedules(searchTerm: string) {
    const schedules = await this.prisma.vaccinationSchedule.findMany({
      where: {
        OR: [
          {
            child: {
              OR: [
                { firstName: { contains: searchTerm, mode: 'insensitive' } },
                { lastName: { contains: searchTerm, mode: 'insensitive' } },
                { birthCertificateNo: { contains: searchTerm, mode: 'insensitive' } },
              ],
            },
          },
          {
            vaccine: {
              OR: [
                { name: { contains: searchTerm, mode: 'insensitive' } },
                { code: { contains: searchTerm, mode: 'insensitive' } },
              ],
            },
          },
        ],
      },
      take: 20,
      include: {
        child: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            dateOfBirth: true,
          },
        },
        vaccine: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
      orderBy: { dueDate: 'asc' },
    });

    const today = new Date();

    return schedules.map(schedule => ({
      id: schedule.id,
      childId: schedule.child.id,
      childName: `${schedule.child.firstName} ${schedule.child.lastName}`,
      vaccineName: schedule.vaccine.name,
      vaccineCode: schedule.vaccine.code,
      dueDate: schedule.dueDate,
      status: schedule.status,
      daysUntilDue: Math.ceil((schedule.dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)),
      isOverdue: schedule.dueDate < today && schedule.status === 'SCHEDULED',
    }));
  }

  async remove(id: string): Promise<void> {
    const schedule = await this.prisma.vaccinationSchedule.findUnique({
      where: { id },
    });

    if (!schedule) {
      throw new NotFoundException(`Schedule with ID ${id} not found`);
    }

    // Check if immunization already recorded
    const immunization = await this.prisma.immunization.findFirst({
      where: {
        childId: schedule.childId,
        vaccineId: schedule.vaccineId,
        status: 'ADMINISTERED',
      },
    });

    if (immunization) {
      throw new BadRequestException('Cannot delete schedule for an administered vaccine');
    }

    await this.prisma.vaccinationSchedule.delete({
      where: { id },
    });
  }
}