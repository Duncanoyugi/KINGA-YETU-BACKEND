import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { VaccinesService } from '../vaccines/vaccines.service';
import { ChildrenService } from '../children/children.service';
import { RecordImmunizationDto } from './dto/record-immunization.dto';
import { UpdateImmunizationDto } from './dto/update-immunization.dto';
import { ImmunizationResponseDto, PaginatedImmunizationsResponseDto, ImmunizationStatsDto } from './dto/immunization-response.dto';
import { ImmunizationStatus } from '@prisma/client';

@Injectable()
export class ImmunizationsService {
  constructor(
    private prisma: PrismaService,
    private vaccinesService: VaccinesService,
    private childrenService: ChildrenService,
  ) {}

  private mapToImmunizationResponseDto(immunization: any): ImmunizationResponseDto {
    return {
      id: immunization.id,
      childId: immunization.childId,
      child: {
        id: immunization.child.id,
        firstName: immunization.child.firstName,
        lastName: immunization.child.lastName,
        dateOfBirth: immunization.child.dateOfBirth,
      },
      vaccineId: immunization.vaccineId,
      vaccine: {
        id: immunization.vaccine.id,
        code: immunization.vaccine.code,
        name: immunization.vaccine.name,
      },
      facilityId: immunization.facilityId,
      facility: {
        id: immunization.facility.id,
        name: immunization.facility.name,
        code: immunization.facility.code,
      },
      healthWorkerId: immunization.healthWorkerId,
      healthWorker: {
        id: immunization.healthWorker.user.id,
        fullName: immunization.healthWorker.user.fullName,
        licenseNumber: immunization.healthWorker.licenseNumber || undefined,
      },
      dateAdministered: immunization.dateAdministered,
      ageAtDays: immunization.ageAtDays,
      status: immunization.status,
      batchNumber: immunization.batchNumber || undefined,
      expirationDate: immunization.expirationDate || undefined,
      manufacturer: immunization.manufacturer || undefined,
      administrationSite: immunization.administrationSite || undefined,
      dosage: immunization.dosage || undefined,
      notes: immunization.notes || undefined,
      hadAdverseReaction: immunization.hadAdverseReaction,
      adverseReactionDetails: immunization.adverseReactionDetails || undefined,
      contraindications: immunization.contraindications || undefined,
      administeredBy: immunization.administeredBy || undefined,
      createdAt: immunization.createdAt,
      updatedAt: immunization.updatedAt,
    };
  }

  private calculateAgeInMonths(dateOfBirth: Date): number {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    
    let months = (today.getFullYear() - birthDate.getFullYear()) * 12;
    months -= birthDate.getMonth();
    months += today.getMonth();
    
    return months <= 0 ? 0 : months;
  }

  async create(recordImmunizationDto: RecordImmunizationDto, userId?: string): Promise<ImmunizationResponseDto> {
    // Validate child exists
    const child = await this.prisma.child.findUnique({
      where: { id: recordImmunizationDto.childId },
      include: {
        parent: true,
      },
    });

    if (!child) {
      throw new NotFoundException(`Child with ID ${recordImmunizationDto.childId} not found`);
    }

    // Validate vaccine exists
    const vaccine = await this.prisma.vaccine.findUnique({
      where: { id: recordImmunizationDto.vaccineId },
    });

    if (!vaccine) {
      throw new NotFoundException(`Vaccine with ID ${recordImmunizationDto.vaccineId} not found`);
    }

    // Validate facility exists
    const facility = await this.prisma.healthFacility.findUnique({
      where: { id: recordImmunizationDto.facilityId },
    });

    if (!facility) {
      throw new NotFoundException(`Health facility with ID ${recordImmunizationDto.facilityId} not found`);
    }

    // Validate health worker exists and belongs to facility
    const healthWorker = await this.prisma.healthWorker.findUnique({
      where: { id: recordImmunizationDto.healthWorkerId },
      include: {
        user: true,
        facility: true,
      },
    });

    if (!healthWorker) {
      throw new NotFoundException(`Health worker with ID ${recordImmunizationDto.healthWorkerId} not found`);
    }

    if (healthWorker.facilityId !== recordImmunizationDto.facilityId) {
      throw new BadRequestException('Health worker does not belong to the specified facility');
    }

    // Check if user is authorized (health worker or admin)
    if (userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      const isAuthorized = user?.role === 'HEALTH_WORKER' || 
                          user?.role === 'ADMIN' || 
                          user?.role === 'SUPER_ADMIN' ||
                          user?.id === healthWorker.userId;

      if (!isAuthorized) {
        throw new ForbiddenException('You are not authorized to record immunizations');
      }
    }

    // Validate vaccine administration age
    const childAgeDays = recordImmunizationDto.ageAtDays;
    const validation = await this.vaccinesService.validateVaccineForChild(
      vaccine.code,
      childAgeDays,
    );

    if (!validation.isValid) {
      throw new BadRequestException(validation.message);
    }

    // Check for duplicate immunization (same child, same vaccine)
    const existingImmunization = await this.prisma.immunization.findFirst({
      where: {
        childId: recordImmunizationDto.childId,
        vaccineId: recordImmunizationDto.vaccineId,
        status: 'ADMINISTERED',
      },
    });

    if (existingImmunization) {
      throw new ConflictException('This vaccine has already been administered to this child');
    }

    // Update vaccination schedule status
    await this.updateVaccinationSchedule(
      recordImmunizationDto.childId,
      recordImmunizationDto.vaccineId,
      'ADMINISTERED',
    );

    // Create immunization record
    const immunization = await this.prisma.immunization.create({
      data: {
        ...recordImmunizationDto,
        dateAdministered: recordImmunizationDto.dateAdministered 
          ? new Date(recordImmunizationDto.dateAdministered)
          : new Date(),
        status: recordImmunizationDto.status || ImmunizationStatus.ADMINISTERED,
      },
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
            administrationRoute: true,
            dosage: true,
          },
        },
        facility: {
          select: {
            id: true,
            name: true,
            code: true,
            type: true,
          },
        },
        healthWorker: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
              },
            },
          },
        },
      },
    });

    // Update child's last immunization date
    await this.prisma.child.update({
      where: { id: recordImmunizationDto.childId },
      data: {
        updatedAt: new Date(),
      },
    });

    return this.mapToImmunizationResponseDto(immunization);
  }

  private async updateVaccinationSchedule(
    childId: string,
    vaccineId: string,
    status: ImmunizationStatus,
  ): Promise<void> {
    await this.prisma.vaccinationSchedule.updateMany({
      where: {
        childId,
        vaccineId,
        status: 'SCHEDULED',
      },
      data: {
        status: status === ImmunizationStatus.ADMINISTERED ? 'COMPLETED' : status === ImmunizationStatus.MISSED ? 'MISSED' : status as any,
      },
    });
  }

  async findAll(
    page: number = 1,
    limit: number = 10,
    childId?: string,
    vaccineId?: string,
    facilityId?: string,
    healthWorkerId?: string,
    startDate?: string,
    endDate?: string,
    status?: ImmunizationStatus,
    search?: string,
  ): Promise<PaginatedImmunizationsResponseDto> {
    const skip = (page - 1) * limit;

    const where: any = {};

    if (childId) where.childId = childId;
    if (vaccineId) where.vaccineId = vaccineId;
    if (facilityId) where.facilityId = facilityId;
    if (healthWorkerId) where.healthWorkerId = healthWorkerId;
    if (status) where.status = status;

    // Date range filter
    if (startDate || endDate) {
      where.dateAdministered = {};
      if (startDate) where.dateAdministered.gte = new Date(startDate);
      if (endDate) where.dateAdministered.lte = new Date(endDate);
    }

    // Search filter
    if (search) {
      where.OR = [
        { batchNumber: { contains: search, mode: 'insensitive' } },
        { notes: { contains: search, mode: 'insensitive' } },
        {
          child: {
            OR: [
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName: { contains: search, mode: 'insensitive' } },
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
        {
          facility: {
            name: { contains: search, mode: 'insensitive' },
          },
        },
      ];
    }

    const [total, immunizations] = await Promise.all([
      this.prisma.immunization.count({ where }),
      this.prisma.immunization.findMany({
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
              administrationRoute: true,
              dosage: true,
            },
          },
          facility: {
            select: {
              id: true,
              name: true,
              code: true,
              type: true,
            },
          },
          healthWorker: {
            include: {
              user: {
                select: {
                  id: true,
                  fullName: true,
                  email: true,
                },
              },
            },
          },
        },
        orderBy: { dateAdministered: 'desc' },
      }),
    ]);

    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      data: immunizations.map(immunization => this.mapToImmunizationResponseDto(immunization)),
    };
  }

  async findOne(id: string): Promise<ImmunizationResponseDto> {
    const immunization = await this.prisma.immunization.findUnique({
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
            administrationRoute: true,
            dosage: true,
            diseasePrevented: true,
            sideEffects: true,
            contraindications: true,
          },
        },
        facility: {
          select: {
            id: true,
            name: true,
            code: true,
            type: true,
            county: true,
            subCounty: true,
            address: true,
            phone: true,
            email: true,
          },
        },
        healthWorker: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
                phoneNumber: true,
              },
            },
            facility: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
          },
        },
      },
    });

    if (!immunization) {
      throw new NotFoundException(`Immunization with ID ${id} not found`);
    }

    return this.mapToImmunizationResponseDto(immunization);
  }

  async findByChildId(childId: string): Promise<ImmunizationResponseDto[]> {
    const immunizations = await this.prisma.immunization.findMany({
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
            administrationRoute: true,
            dosage: true,
          },
        },
        facility: {
          select: {
            id: true,
            name: true,
            code: true,
            type: true,
          },
        },
        healthWorker: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: { dateAdministered: 'desc' },
    });

    return immunizations.map(immunization => this.mapToImmunizationResponseDto(immunization));
  }

  async update(
    id: string,
    updateImmunizationDto: UpdateImmunizationDto,
    userId?: string,
  ): Promise<ImmunizationResponseDto> {
    // Check if immunization exists
    const existingImmunization = await this.prisma.immunization.findUnique({
      where: { id },
      include: {
        healthWorker: true,
      },
    });

    if (!existingImmunization) {
      throw new NotFoundException(`Immunization with ID ${id} not found`);
    }

    // Check authorization
    if (userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      const isAuthorized = user?.role === 'ADMIN' || 
                          user?.role === 'SUPER_ADMIN' ||
                          user?.id === existingImmunization.healthWorker?.userId;

      if (!isAuthorized) {
        throw new ForbiddenException('You are not authorized to update this immunization record');
      }
    }

    // If status is being changed, update vaccination schedule
    if (updateImmunizationDto.status && updateImmunizationDto.status !== existingImmunization.status) {
      await this.updateVaccinationSchedule(
        existingImmunization.childId,
        existingImmunization.vaccineId,
        updateImmunizationDto.status,
      );
    }

    const updatedImmunization = await this.prisma.immunization.update({
      where: { id },
      data: {
        ...updateImmunizationDto,
      },
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
            administrationRoute: true,
            dosage: true,
          },
        },
        facility: {
          select: {
            id: true,
            name: true,
            code: true,
            type: true,
          },
        },
        healthWorker: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
              },
            },
          },
        },
      },
    });

    return this.mapToImmunizationResponseDto(updatedImmunization);
  }

  async remove(id: string, userId?: string): Promise<void> {
    // Check if immunization exists
    const immunization = await this.prisma.immunization.findUnique({
      where: { id },
      include: {
        healthWorker: true,
      },
    });

    if (!immunization) {
      throw new NotFoundException(`Immunization with ID ${id} not found`);
    }

    // Check authorization
    if (userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      const isAuthorized = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';

      if (!isAuthorized) {
        throw new ForbiddenException('Only administrators can delete immunization records');
      }
    }

    // Update vaccination schedule back to SCHEDULED
    await this.updateVaccinationSchedule(
      immunization.childId,
      immunization.vaccineId,
      'SCHEDULED',
    );

    await this.prisma.immunization.delete({
      where: { id },
    });
  }

  async getStats(
    facilityId?: string,
    startDate?: string,
    endDate?: string,
  ): Promise<ImmunizationStatsDto> {
    const where: any = {};

    if (facilityId) where.facilityId = facilityId;

    // Date range filter
    if (startDate || endDate) {
      where.dateAdministered = {};
      if (startDate) where.dateAdministered.gte = new Date(startDate);
      if (endDate) where.dateAdministered.lte = new Date(endDate);
    }

    const [
      totalImmunizations,
      administered,
      pending,
      missed,
      contraindicated,
      withAdverseReactions,
      monthlyTrend,
      topFacilities,
    ] = await Promise.all([
      this.prisma.immunization.count({ where }),
      this.prisma.immunization.count({ where: { ...where, status: 'ADMINISTERED' } }),
      this.prisma.vaccinationSchedule.count({ where: { status: 'SCHEDULED' } }),
      this.prisma.vaccinationSchedule.count({ where: { status: 'MISSED' } }),
      this.prisma.immunization.count({ where: { ...where, status: 'CONTRAINDICATED' } }),
      this.prisma.immunization.count({ where: { ...where, hadAdverseReaction: true } }),
      this.prisma.$queryRaw`
        SELECT 
          TO_CHAR("dateAdministered", 'YYYY-MM') as month,
          COUNT(*) as count
        FROM immunizations
        WHERE "dateAdministered" >= NOW() - INTERVAL '12 months'
        GROUP BY TO_CHAR("dateAdministered", 'YYYY-MM')
        ORDER BY month DESC
        LIMIT 12
      `,
      this.prisma.$queryRaw`
        SELECT 
          hf.name as "facilityName",
          hf.code as "facilityCode",
          COUNT(i.id) as count
        FROM immunizations i
        JOIN health_facilities hf ON i."facilityId" = hf.id
        GROUP BY hf.id, hf.name, hf.code
        ORDER BY count DESC
        LIMIT 10
      `,
    ]);

    const totalSchedules = administered + pending + missed;
    const coveragePercentage = totalSchedules > 0 ? (administered / totalSchedules) * 100 : 0;

    return {
      totalImmunizations,
      administered,
      pending,
      missed,
      contraindicated,
      withAdverseReactions,
      timelyImmunizations: administered, // For now, assume all administered are timely
      timelinessPercentage: coveragePercentage,
      coveragePercentage: Math.round(coveragePercentage * 100) / 100,
      monthlyTrend: monthlyTrend as any,
      topFacilities: topFacilities as any,
    };
  }

  async getChildImmunizationHistory(childId: string): Promise<{
    immunizations: ImmunizationResponseDto[];
    upcomingVaccines: any[];
    missedVaccines: any[];
    coverage: number;
  }> {
    const [immunizations, schedules] = await Promise.all([
      this.findByChildId(childId),
      this.prisma.vaccinationSchedule.findMany({
        where: { childId },
        include: {
          vaccine: {
            select: {
              id: true,
              code: true,
              name: true,
              recommendedAgeDays: true,
            },
          },
        },
      }),
    ]);

    const today = new Date();
    const upcomingVaccines = schedules.filter(
      schedule => schedule.status === 'SCHEDULED' && schedule.dueDate >= today,
    );
    const missedVaccines = schedules.filter(
      schedule => schedule.status === 'SCHEDULED' && schedule.dueDate < today,
    );

    const administeredCount = immunizations.filter(
      imm => imm.status === 'ADMINISTERED',
    ).length;

    const totalVaccines = schedules.length;
    const coverage = totalVaccines > 0 ? (administeredCount / totalVaccines) * 100 : 0;

    return {
      immunizations,
      upcomingVaccines,
      missedVaccines,
      coverage: Math.round(coverage * 100) / 100,
    };
  }

  async searchImmunizations(searchTerm: string) {
    const immunizations = await this.prisma.immunization.findMany({
      where: {
        OR: [
          { batchNumber: { contains: searchTerm, mode: 'insensitive' } },
          { notes: { contains: searchTerm, mode: 'insensitive' } },
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
          {
            facility: {
              name: { contains: searchTerm, mode: 'insensitive' },
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
        facility: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        healthWorker: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
              },
            },
          },
        },
      },
      orderBy: { dateAdministered: 'desc' },
    });

    return immunizations.map(immunization => ({
      id: immunization.id,
      childName: `${immunization.child.firstName} ${immunization.child.lastName}`,
      vaccineName: immunization.vaccine.name,
      vaccineCode: immunization.vaccine.code,
      dateAdministered: immunization.dateAdministered,
      facilityName: immunization.facility?.name || 'Unknown',
      healthWorkerName: immunization.healthWorker?.user?.fullName || 'Unknown',
      batchNumber: immunization.batchNumber,
      status: immunization.status,
    }));
  }
}