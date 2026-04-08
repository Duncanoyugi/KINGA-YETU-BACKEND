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
import { MailerService } from '../mailer/mailer.service';
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
    private mailerService: MailerService,
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
      facility: immunization.facility ? {
        id: immunization.facility.id,
        name: immunization.facility.name,
        code: immunization.facility.code,
      } : undefined,
      healthWorkerId: immunization.healthWorkerId,
      healthWorker: immunization.healthWorker ? {
        id: immunization.healthWorker.user.id,
        fullName: immunization.healthWorker.user.fullName,
        licenseNumber: immunization.healthWorker.licenseNumber || undefined,
      } : undefined,
      dateAdministered: immunization.dateAdministered,
      ageAtDays: immunization.ageAtDays,
      status: immunization.status,
      batchNumber: immunization.batchNumber || undefined,
      expirationDate: immunization.expirationDate || undefined,
      manufacturer: immunization.manufacturer || undefined,
      administrationSite: immunization.administrationSite || undefined,
      dosage: immunization.dosage || undefined,
      notes: immunization.notes || undefined,
      hadAdverseReaction: immunization.hadAdverseReaction || false,
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

  private formatDisplayDate(date: Date): string {
    return new Intl.DateTimeFormat('en-KE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(new Date(date));
  }

  private async sendVaccinationRecordedEmail(immunization: any): Promise<void> {
    const parentEmail = immunization.child?.parent?.user?.email;

    if (!parentEmail) {
      return;
    }

    const nextScheduledVaccine = await this.prisma.vaccinationSchedule.findFirst({
      where: {
        childId: immunization.childId,
        status: {
          in: ['PENDING', 'SCHEDULED'],
        },
        dueDate: {
          gt: immunization.dateAdministered,
        },
      },
      include: {
        vaccine: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        dueDate: 'asc',
      },
    });

    const childName = `${immunization.child.firstName} ${immunization.child.lastName}`.trim();
    const parentName = immunization.child.parent.user.fullName || 'Parent';
    const vaccineName = immunization.vaccine.name;
    const facilityName = immunization.facility?.name || 'your health facility';
    const administeredDate = this.formatDisplayDate(immunization.dateAdministered);
    const nextVaccineHtml = nextScheduledVaccine
      ? `
        <div style="margin-top: 24px; padding: 16px; background: #f3f8f4; border: 1px solid #d8e9db; border-radius: 8px;">
          <h3 style="margin: 0 0 8px; color: #2d6a4f;">Next scheduled vaccine</h3>
          <p style="margin: 0; color: #333;">
            ${nextScheduledVaccine.vaccine.name} is due on <strong>${this.formatDisplayDate(nextScheduledVaccine.dueDate)}</strong>.
          </p>
        </div>
      `
      : '';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Vaccination Recorded</title>
      </head>
      <body style="margin: 0; padding: 0; background: #f4f7f5; font-family: Arial, sans-serif; color: #1f2937;">
        <div style="max-width: 640px; margin: 0 auto; padding: 24px;">
          <div style="background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e5e7eb;">
            <div style="background: linear-gradient(135deg, #2d6a4f 0%, #40916c 100%); color: white; padding: 28px 24px;">
              <h1 style="margin: 0; font-size: 24px;">Vaccination Recorded Successfully</h1>
            </div>
            <div style="padding: 24px;">
              <p style="margin-top: 0;">Hello ${parentName},</p>
              <p>
                This is to confirm that <strong>${childName}</strong> has received the
                <strong>${vaccineName}</strong> vaccine.
              </p>
              <div style="margin: 20px 0; padding: 16px; background: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb;">
                <p style="margin: 0 0 8px;"><strong>Date administered:</strong> ${administeredDate}</p>
                <p style="margin: 0 0 8px;"><strong>Facility:</strong> ${facilityName}</p>
                <p style="margin: 0;"><strong>Recorded by:</strong> ${immunization.healthWorker?.user?.fullName || 'Health worker'}</p>
              </div>
              ${nextVaccineHtml}
              <p style="margin-top: 24px;">
                Please keep this email for your records. If you have any questions, kindly contact your health facility.
              </p>
              <p style="margin-bottom: 0;">Best regards,<br><strong>The ImmuniTrack Kenya Team</strong></p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    await this.mailerService.sendEmail(
      parentEmail,
      `Vaccination Recorded for ${childName}`,
      html,
    );
  }

  async create(recordImmunizationDto: RecordImmunizationDto, userId?: string): Promise<ImmunizationResponseDto> {
    console.log('[ImmunizationsService] === START CREATE IMMUNIZATION ===');
    console.log('[ImmunizationsService] Full DTO:', JSON.stringify(recordImmunizationDto, null, 2));
    console.log('[ImmunizationsService] User ID:', userId);
    
    try {
    // Validate child exists
    console.log('[ImmunizationsService] Step 1: Validating child...');
    const child = await this.prisma.child.findUnique({
      where: { id: recordImmunizationDto.childId },
      include: {
        parent: true,
      },
    });

    if (!child) {
      console.error('[ImmunizationsService] Child not found:', recordImmunizationDto.childId);
      throw new NotFoundException(`Child with ID ${recordImmunizationDto.childId} not found`);
    }
    console.log('[ImmunizationsService] Child found:', child.firstName, child.lastName);

    // Validate vaccine exists
    console.log('[ImmunizationsService] Step 2: Validating vaccine...');
    const vaccine = await this.prisma.vaccine.findUnique({
      where: { id: recordImmunizationDto.vaccineId },
    });

    if (!vaccine) {
      console.error('[ImmunizationsService] Vaccine not found:', recordImmunizationDto.vaccineId);
      throw new NotFoundException(`Vaccine with ID ${recordImmunizationDto.vaccineId} not found`);
    }
    console.log('[ImmunizationsService] Vaccine found:', vaccine.code, vaccine.name);

    // Validate facility exists
    console.log('[ImmunizationsService] Step 3: Validating facility...');
    const facility = await this.prisma.healthFacility.findUnique({
      where: { id: recordImmunizationDto.facilityId },
    });

    if (!facility) {
      console.error(`Facility not found: ${recordImmunizationDto.facilityId}`);
      throw new NotFoundException(`Health facility with ID ${recordImmunizationDto.facilityId} not found`);
    }

    // Validate health worker exists and belongs to facility
    console.log('[ImmunizationsService] Step 4: Validating health worker...');
    const healthWorker = await this.prisma.healthWorker.findUnique({
      where: { id: recordImmunizationDto.healthWorkerId },
      include: {
        user: true,
        facility: true,
      },
    });

    if (!healthWorker) {
      console.error(`Health worker not found: ${recordImmunizationDto.healthWorkerId}`);
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

    // Validate vaccine administration age using vaccine's own age constraints (not KEPI schedule)
    const childAgeDays = recordImmunizationDto.ageAtDays;
    console.log('[ImmunizationsService] Validating vaccine for child age (days):', childAgeDays);
    console.log('[ImmunizationsService] Vaccine:', vaccine.code, vaccine.name);
    console.log('[ImmunizationsService] Vaccine minAgeDays:', vaccine.minAgeDays, 'maxAgeDays:', vaccine.maxAgeDays);
    
    // Use the vaccine's own min/max age from database instead of KEPI schedule codes
    // If vaccine doesn't have age constraints, allow it (some vaccines may not have strict age limits)
    const minAge = vaccine.minAgeDays ?? 0;
    const maxAge = vaccine.maxAgeDays ?? Infinity;
    
    let validation = { isValid: true, message: 'Valid' };
    if (minAge > 0 && childAgeDays < minAge) {
      validation = {
        isValid: false,
        message: `Child is too young for this vaccine. Minimum age: ${minAge} days`,
      };
    } else if (maxAge !== Infinity && childAgeDays > maxAge) {
      validation = {
        isValid: false,
        message: `Child is too old for this vaccine. Maximum age: ${maxAge} days`,
      };
    }
    
    console.log('[ImmunizationsService] Vaccine validation result:', validation);

    if (!validation.isValid) {
      console.log('[ImmunizationsService] Vaccine validation failed:', validation.message);
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
    console.log('[ImmunizationsService] Step 7: Creating immunization record...');
    console.log('[ImmunizationsService] Creating with data:', {
      childId: recordImmunizationDto.childId,
      vaccineId: recordImmunizationDto.vaccineId,
      facilityId: recordImmunizationDto.facilityId,
      healthWorkerId: recordImmunizationDto.healthWorkerId,
      ageAtDays: recordImmunizationDto.ageAtDays,
      dateAdministered: recordImmunizationDto.dateAdministered || new Date().toISOString(),
      status: recordImmunizationDto.status || 'ADMINISTERED',
      batchNumber: recordImmunizationDto.batchNumber,
      notes: recordImmunizationDto.notes,
    });
    
    let immunization;
    try {
      immunization = await this.prisma.immunization.create({
      data: {
        childId: recordImmunizationDto.childId,
        vaccineId: recordImmunizationDto.vaccineId,
        facilityId: recordImmunizationDto.facilityId,
        healthWorkerId: recordImmunizationDto.healthWorkerId,
        ageAtDays: recordImmunizationDto.ageAtDays,
        dateAdministered: recordImmunizationDto.dateAdministered 
          ? new Date(recordImmunizationDto.dateAdministered)
          : new Date(),
        status: (recordImmunizationDto.status || ImmunizationStatus.ADMINISTERED) as ImmunizationStatus,
        batchNumber: recordImmunizationDto.batchNumber,
        expirationDate: recordImmunizationDto.expirationDate ? new Date(recordImmunizationDto.expirationDate) : undefined,
        manufacturer: recordImmunizationDto.manufacturer,
        administrationSite: recordImmunizationDto.administrationSite,
        dosage: recordImmunizationDto.dosage,
        notes: recordImmunizationDto.notes,
        hadAdverseReaction: recordImmunizationDto.hadAdverseReaction,
        adverseReactionDetails: recordImmunizationDto.adverseReactionDetails,
        contraindications: recordImmunizationDto.contraindications,
        administeredBy: recordImmunizationDto.administeredBy,
      },
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
                    email: true,
                    fullName: true,
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
    console.log('[ImmunizationsService] Immunization created successfully:', immunization.id);
    } catch (createError: any) {
      console.error('[ImmunizationsService] Error creating immunization record:', createError.message);
      console.error('[ImmunizationsService] Create error details:', createError);
      throw new Error(`Failed to create immunization: ${createError.message}`);
    }

    // Update child's last immunization date
    await this.prisma.child.update({
      where: { id: recordImmunizationDto.childId },
      data: {
        updatedAt: new Date(),
      },
    });

    try {
      await this.sendVaccinationRecordedEmail(immunization);
    } catch (emailError: any) {
      console.error('[ImmunizationsService] Failed to send vaccination confirmation email:', emailError.message);
    }

    return this.mapToImmunizationResponseDto(immunization);
    } catch (error) {
      console.error('Error creating immunization:', error);
      throw error;
    }
  }

  private async updateVaccinationSchedule(
    childId: string,
    vaccineId: string,
    status: ImmunizationStatus,
  ): Promise<void> {
    let scheduleStatus: string;
    if (status === ImmunizationStatus.ADMINISTERED) {
      scheduleStatus = 'COMPLETED';
    } else if (status === ImmunizationStatus.MISSED) {
      scheduleStatus = 'MISSED';
    } else {
      scheduleStatus = status;
    }

    try {
      await this.prisma.vaccinationSchedule.updateMany({
        where: {
          childId,
          vaccineId,
          status: 'SCHEDULED',
        },
        data: {
          status: scheduleStatus as any,
        },
      });
    } catch (error) {
      console.error('Error updating vaccination schedule:', error);
    }
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
    try {
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
    } catch (error) {
      console.error(`Error fetching immunizations for child ${childId}:`, error);
      throw error;
    }
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
