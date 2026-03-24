import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ChildrenService } from './children.service';
import { CreateChildDto } from './dto/create-child.dto';
import { ChildResponseDto } from './dto/child-response.dto';

@Injectable()
export class VaccineSchedulerService {
  // Kenya Expanded Programme on Immunization (KEPI) Schedule
  private readonly KEPI_SCHEDULE = [
    // Birth
    { vaccineCode: 'BCG', ageDays: 0, name: 'BCG', description: 'Tuberculosis vaccine' },
    { vaccineCode: 'OPV0', ageDays: 0, name: 'OPV 0', description: 'Oral Polio Vaccine at birth' },
    { vaccineCode: 'HEPB0', ageDays: 0, name: 'Hepatitis B 0', description: 'Hepatitis B birth dose' },
    
    // 6 weeks
    { vaccineCode: 'OPV1', ageDays: 42, name: 'OPV 1', description: 'Oral Polio Vaccine 1' },
    { vaccineCode: 'DPT1', ageDays: 42, name: 'DPT-HepB-Hib 1', description: 'Pentavalent 1' },
    { vaccineCode: 'PCV1', ageDays: 42, name: 'Pneumococcal 1', description: 'Pneumococcal Conjugate Vaccine 1' },
    { vaccineCode: 'ROTA1', ageDays: 42, name: 'Rotavirus 1', description: 'Rotavirus Vaccine 1' },
    
    // 10 weeks
    { vaccineCode: 'OPV2', ageDays: 70, name: 'OPV 2', description: 'Oral Polio Vaccine 2' },
    { vaccineCode: 'DPT2', ageDays: 70, name: 'DPT-HepB-Hib 2', description: 'Pentavalent 2' },
    { vaccineCode: 'PCV2', ageDays: 70, name: 'Pneumococcal 2', description: 'Pneumococcal Conjugate Vaccine 2' },
    { vaccineCode: 'ROTA2', ageDays: 70, name: 'Rotavirus 2', description: 'Rotavirus Vaccine 2' },
    
    // 14 weeks
    { vaccineCode: 'OPV3', ageDays: 98, name: 'OPV 3', description: 'Oral Polio Vaccine 3' },
    { vaccineCode: 'DPT3', ageDays: 98, name: 'DPT-HepB-Hib 3', description: 'Pentavalent 3' },
    { vaccineCode: 'PCV3', ageDays: 98, name: 'Pneumococcal 3', description: 'Pneumococcal Conjugate Vaccine 3' },
    
    // 6 months
    { vaccineCode: 'VITA', ageDays: 180, name: 'Vitamin A', description: 'Vitamin A Supplement' },
    
    // 9 months
    { vaccineCode: 'MEASLES', ageDays: 270, name: 'Measles', description: 'Measles Vaccine' },
    { vaccineCode: 'YELLOW', ageDays: 270, name: 'Yellow Fever', description: 'Yellow Fever Vaccine' },
    { vaccineCode: 'VITA9', ageDays: 270, name: 'Vitamin A 9M', description: 'Vitamin A at 9 months' },
    
    // 18 months
    { vaccineCode: 'MEASLES2', ageDays: 540, name: 'Measles 2', description: 'Measles Second Dose' },
    { vaccineCode: 'VITA18', ageDays: 540, name: 'Vitamin A 18M', description: 'Vitamin A at 18 months' },
    
    // 2 years
    { vaccineCode: 'VITA2', ageDays: 730, name: 'Vitamin A 2Y', description: 'Vitamin A every 6 months from 2 years' },
  ];

  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => ChildrenService))
    private childrenService: ChildrenService,
  ) {}

  async createChildWithSchedule(createChildDto: CreateChildDto, userId: string): Promise<{
    child: ChildResponseDto;
    schedules: any[];
  }> {
    // Create the child
    const child = await this.childrenService.create(createChildDto, userId);
    
    // Generate vaccination schedules
    const schedules = await this.generateVaccinationSchedules(child.id, child.parentId, new Date(createChildDto.dateOfBirth));
    
    return {
      child,
      schedules,
    };
  }

  async generateVaccinationSchedules(childId: string, parentId: string, dateOfBirth: Date): Promise<any[]> {
    const schedules: any[] = [];
    
    for (const vaccineSchedule of this.KEPI_SCHEDULE) {
      // Calculate due date
      const dueDate = new Date(dateOfBirth);
      dueDate.setDate(dueDate.getDate() + vaccineSchedule.ageDays);
      
      // Find or create vaccine
      let vaccine = await this.prisma.vaccine.findUnique({
        where: { code: vaccineSchedule.vaccineCode },
      });
      
      if (!vaccine) {
        vaccine = await this.prisma.vaccine.create({
          data: {
            code: vaccineSchedule.vaccineCode,
            name: vaccineSchedule.name,
            description: vaccineSchedule.description,
            recommendedAgeDays: vaccineSchedule.ageDays,
            minAgeDays: Math.max(0, vaccineSchedule.ageDays - 14), // 2 weeks window before
            maxAgeDays: vaccineSchedule.ageDays + 30, // 1 month window after
            isBirthDose: vaccineSchedule.ageDays === 0,
            isBooster: vaccineSchedule.ageDays > 180, // After 6 months are boosters
          },
        });
      }
      
      // Create schedule
      const schedule = await this.prisma.vaccinationSchedule.create({
        data: {
          childId,
          parentId,
          vaccineId: vaccine.id,
          dueDate,
          status: 'SCHEDULED',
        },
        include: {
          vaccine: {
            select: {
              id: true,
              name: true,
              code: true,
              description: true,
            },
          },
        },
      });
      
      schedules.push(schedule);
    }
    
    return schedules;
  }

  async getUpcomingVaccinations(childId: string, daysAhead: number = 30): Promise<any[]> {
    const today = new Date();
    const futureDate = new Date();
    futureDate.setDate(today.getDate() + daysAhead);
    
    return this.prisma.vaccinationSchedule.findMany({
      where: {
        childId,
        dueDate: {
          gte: today,
          lte: futureDate,
        },
        status: 'SCHEDULED',
      },
      include: {
        vaccine: {
          select: {
            id: true,
            name: true,
            code: true,
            description: true,
            recommendedAgeDays: true,
          },
        },
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
                    fullName: true,
                    email: true,
                    phoneNumber: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { dueDate: 'asc' },
    });
  }

  async getMissedVaccinations(childId: string): Promise<any[]> {
    const today = new Date();
    
    return this.prisma.vaccinationSchedule.findMany({
      where: {
        childId,
        dueDate: { lt: today },
        status: 'SCHEDULED',
      },
      include: {
        vaccine: {
          select: {
            id: true,
            name: true,
            code: true,
            description: true,
            recommendedAgeDays: true,
          },
        },
      },
      orderBy: { dueDate: 'asc' },
    });
  }

  async calculateCatchupSchedule(childId: string, dateOfBirth: Date): Promise<any[]> {
    const child = await this.prisma.child.findUnique({
      where: { id: childId },
      include: {
        immunizations: {
          select: { vaccineId: true },
        },
      },
    });
    
    if (!child) {
      throw new Error('Child not found');
    }
    
    const administeredVaccineIds = child.immunizations.map(imm => imm.vaccineId);
    const today = new Date();
    const childAgeDays = Math.floor((today.getTime() - dateOfBirth.getTime()) / (1000 * 60 * 60 * 24));
    
    const catchupSchedules: any[] = [];
    
    for (const vaccineSchedule of this.KEPI_SCHEDULE) {
      // Skip if already administered
      const vaccine = await this.prisma.vaccine.findUnique({
        where: { code: vaccineSchedule.vaccineCode },
      });
      
      if (vaccine && administeredVaccineIds.includes(vaccine.id)) {
        continue;
      }
      
      // Check if child is within age range for this vaccine
      const maxAgeDays = vaccineSchedule.ageDays + 30; // 1 month grace period
      
      if (childAgeDays <= maxAgeDays) {
        // Calculate due date (immediate for catchup)
        const dueDate = new Date();
        
        // For vaccines that should have been given earlier, schedule immediately
        if (childAgeDays > vaccineSchedule.ageDays) {
          dueDate.setDate(dueDate.getDate() + 7); // Schedule within 1 week
        } else {
          dueDate.setDate(dateOfBirth.getDate() + vaccineSchedule.ageDays);
        }
        
        catchupSchedules.push({
          vaccineCode: vaccineSchedule.vaccineCode,
          name: vaccineSchedule.name,
          recommendedAge: vaccineSchedule.ageDays,
          childCurrentAge: childAgeDays,
          dueDate,
          isCatchup: childAgeDays > vaccineSchedule.ageDays,
          priority: childAgeDays > vaccineSchedule.ageDays ? 'HIGH' : 'NORMAL',
        });
      }
    }
    
    // Sort by priority and recommended age
    return catchupSchedules.sort((a, b) => {
      if (a.priority === 'HIGH' && b.priority !== 'HIGH') return -1;
      if (a.priority !== 'HIGH' && b.priority === 'HIGH') return 1;
      return a.recommendedAge - b.recommendedAge;
    });
  }

  async getImmunizationStatus(childId: string): Promise<{
    totalVaccines: number;
    administered: number;
    pending: number;
    overdue: number;
    upcoming: number;
    coverage: number;
  }> {
    const child = await this.prisma.child.findUnique({
      where: { id: childId },
      include: {
        immunizations: {
          where: { status: 'ADMINISTERED' },
        },
        schedules: true,
      },
    });
    
    if (!child) {
      throw new Error('Child not found');
    }
    
    const today = new Date();
    const administered = child.immunizations.length;
    const totalSchedules = child.schedules.length;
    
    const overdue = child.schedules.filter(schedule => 
      schedule.dueDate < today && schedule.status === 'SCHEDULED'
    ).length;
    
    const upcoming = child.schedules.filter(schedule => 
      schedule.dueDate >= today && schedule.status === 'SCHEDULED'
    ).length;
    
    const pending = totalSchedules - administered;
    const coverage = totalSchedules > 0 ? (administered / totalSchedules) * 100 : 0;
    
    return {
      totalVaccines: totalSchedules,
      administered,
      pending,
      overdue,
      upcoming,
      coverage: Math.round(coverage * 100) / 100,
    };
  }
}