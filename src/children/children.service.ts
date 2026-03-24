import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { ChildrenRepository } from './children.repository';
import { CreateChildDto } from './dto/create-child.dto';
import { UpdateChildDto } from './dto/update-child.dto';
import { ChildResponseDto, PaginatedChildrenResponseDto } from './dto/child-response.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ChildrenService {
  private readonly logger = new Logger(ChildrenService.name);

  constructor(
    private readonly childrenRepository: ChildrenRepository,
    private readonly prisma: PrismaService,
  ) {}

  private mapToChildResponseDto(child: any): ChildResponseDto {
    const fullName = child.middleName 
      ? `${child.firstName} ${child.middleName} ${child.lastName}`
      : `${child.firstName} ${child.lastName}`;

    const ageInMonths = this.calculateAgeInMonths(child.dateOfBirth);

    return {
      id: child.id,
      firstName: child.firstName,
      middleName: child.middleName || undefined,
      lastName: child.lastName,
      dateOfBirth: child.dateOfBirth,
      gender: child.gender,
      ageInMonths,
      birthCertificateNo: child.birthCertificateNo || undefined,
      uniqueIdentifier: child.uniqueIdentifier,
      parentId: child.parentId,
      birthFacilityName: child.birthFacility?.name || undefined,
      birthWeight: child.birthWeight || undefined,
      birthHeight: child.birthHeight || undefined,
      deliveryMethod: child.deliveryMethod || undefined,
      gestationalAge: child.gestationalAge || undefined,
      complications: child.complications || undefined,
      notes: child.notes || undefined,
      parent: {
        id: child.parent.user.id,
        fullName: child.parent.user.fullName,
        email: child.parent.user.email,
        phoneNumber: child.parent.user.phoneNumber || undefined,
      },
      birthFacility: child.birthFacility
        ? {
            id: child.birthFacility.id,
            name: child.birthFacility.name,
            code: child.birthFacility.code,
          }
        : undefined,
      createdAt: child.createdAt,
      updatedAt: child.updatedAt,
      immunizations: child.immunizations?.map(immunization => ({
        id: immunization.id,
        vaccineId: immunization.vaccine.id,
        vaccineName: immunization.vaccine.name,
        dateAdministered: immunization.dateAdministered,
        status: immunization.status,
      })),
      schedules: child.schedules?.map(schedule => ({
        id: schedule.id,
        vaccineId: schedule.vaccine.id,
        vaccineName: schedule.vaccine.name,
        dueDate: schedule.dueDate,
        status: schedule.status,
      })),
      growthRecords: child.growthRecords?.map(record => ({
        id: record.id,
        measurementDate: record.measurementDate,
        weight: record.weight,
        height: record.height || undefined,
      })),
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

  async create(createChildDto: CreateChildDto, userId: string): Promise<ChildResponseDto> {
    if (!userId) {
      throw new BadRequestException('User ID is required');
    }

    try {
      // Derive parent server-side (auto-create if missing)
      // Priority: 1) Use parentId from DTO if provided (for ADMIN/HEALTH_WORKER), 2) Derive from userId
      let parent;
      if (createChildDto.parentId) {
        parent = await this.prisma.parent.findUnique({
          where: { id: createChildDto.parentId },
        });
        if (!parent) {
          throw new NotFoundException('Parent not found');
        }
      } else {
        parent = await this.prisma.parent.findUnique({
          where: { userId },
        });

        if (!parent) {
          this.logger.log(`Creating new parent profile for user: ${userId}`);
          parent = await this.prisma.parent.create({
            data: { userId },
          });
        }
      }

      const parentId = parent.id;
      this.logger.log(`Using parentId: ${parentId}`);

      // Merge with DTO
      const dtoWithParent = { ...createChildDto, parentId };
      this.logger.log(`DTO with parent: ${JSON.stringify(dtoWithParent)}`);

      // Check authorization for non-owner
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, role: true },
      });

      // For PARENT role, they can only register for themselves (userId === parent.userId)
      // For ADMIN/HEALTH_WORKER/SUPER_ADMIN, they can register for any parent
      if (user?.role === 'PARENT' && userId !== parent.userId) {
        throw new ForbiddenException('Unauthorized to register a child for another parent');
      }

      // Check birth certificate
    if (dtoWithParent.birthCertificateNo) {
      const existingChild = await this.childrenRepository.findByBirthCertificate(
        dtoWithParent.birthCertificateNo,
      );
      if (existingChild) {
        throw new ConflictException('Birth certificate number already exists');
      }
    }

    // Resolve birth facility - if not found, just skip it (don't fail)
    if (dtoWithParent.birthFacilityName) {
      try {
        const facility = await this.prisma.healthFacility.findFirst({
          where: {
            name: {
              contains: dtoWithParent.birthFacilityName.trim(),
              mode: 'insensitive'
            },
            isActive: true
          }
        });
        if (facility) {
          (dtoWithParent as any).birthFacilityId = facility.id;
        }
        // If facility not found, just continue without setting birthFacilityId
        delete (dtoWithParent as any).birthFacilityName;
      } catch (error) {
        // If any error occurs during facility lookup, just skip it
        console.warn('Failed to resolve birth facility:', error.message);
        delete (dtoWithParent as any).birthFacilityName;
      }
    }

    // Validate DOB
    const dob = new Date(dtoWithParent.dateOfBirth);
    const today = new Date();
    if (dob > today) {
      throw new BadRequestException('Date of birth cannot be in the future');
    }

    const child = await this.childrenRepository.create(dtoWithParent as any);
    return this.mapToChildResponseDto(child);
      } catch (error) {
        this.logger.error(`Error creating child: ${error.message}`, error.stack);
        throw error;
      }
  }

  async findAll(
    page: number = 1,
    limit: number = 10,
    parentId?: string,
    search?: string,
  ): Promise<PaginatedChildrenResponseDto> {
    const skip = (page - 1) * limit;
    
    const where: any = {};
    
    if (parentId) {
      where.parentId = parentId;
    }
    
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { birthCertificateNo: { contains: search, mode: 'insensitive' } },
        { uniqueIdentifier: { contains: search, mode: 'insensitive' } },
      ];
    }

    const result = await this.childrenRepository.findAll({
      skip,
      take: limit,
      where,
      orderBy: { createdAt: 'desc' },
    });

    return {
      total: result.total,
      page,
      limit,
      totalPages: Math.ceil(result.total / limit),
      data: result.children.map(child => this.mapToChildResponseDto(child)),
    };
  }

  async findOne(id: string): Promise<ChildResponseDto> {
    const child = await this.childrenRepository.findOne(id);
    return this.mapToChildResponseDto(child);
  }

  async findByParentId(parentId: string): Promise<ChildResponseDto[]> {
    const children = await this.childrenRepository.findByParentId(parentId);
    return children.map(child => this.mapToChildResponseDto(child));
  }

  async update(id: string, updateChildDto: UpdateChildDto, userId?: string): Promise<ChildResponseDto> {
    // Check if child exists
    const existingChild = await this.childrenRepository.findOne(id);
    if (!existingChild) {
      throw new NotFoundException(`Child with ID ${id} not found`);
    }

    // Check authorization - get the parent to compare with userId
    if (userId) {
      const parent = await this.prisma.parent.findUnique({
        where: { id: existingChild.parentId },
        select: { userId: true },
      });
      
      // FIX: Compare userId with parent.userId, not parent.id
      if (parent && userId !== parent.userId) {
        const user = await this.prisma.user.findUnique({
          where: { id: userId },
        });

        if (user?.role !== 'ADMIN' && user?.role !== 'SUPER_ADMIN' && user?.role !== 'HEALTH_WORKER') {
          throw new ForbiddenException('You are not authorized to update this child');
        }
      }
    }

// Resolve birth facility by name if provided (update)
    if (updateChildDto.birthFacilityName !== undefined) {
      const facility = await this.prisma.healthFacility.findFirst({
        where: {
          name: {
            contains: updateChildDto.birthFacilityName!.trim(),
            mode: 'insensitive'
          },
          isActive: true
        }
      });
      if (updateChildDto.birthFacilityName && !facility) {
        throw new NotFoundException(`No active facility found matching "${updateChildDto.birthFacilityName}"`);
      }
      (updateChildDto as any).birthFacilityId = facility?.id || null;
      delete (updateChildDto as any).birthFacilityName;
    }

// Check if birth certificate number is being changed and if it already exists
    if (updateChildDto.birthCertificateNo && 
        updateChildDto.birthCertificateNo !== existingChild.birthCertificateNo) {
      const existingWithBC = await this.childrenRepository.findByBirthCertificate(
        updateChildDto.birthCertificateNo,
      );
      if (existingWithBC) {
        throw new ConflictException('Birth certificate number already exists');
      }
    }

    // Validate date of birth if being updated
    if (updateChildDto.dateOfBirth) {
      const dob = new Date(updateChildDto.dateOfBirth);
      const today = new Date();
      if (dob > today) {
        throw new BadRequestException('Date of birth cannot be in the future');
      }
    }

    const updatedChild = await this.childrenRepository.update(id, updateChildDto);
    return this.mapToChildResponseDto(updatedChild);
  }

  async remove(id: string, userId?: string): Promise<void> {
    // Check if child exists
    const child = await this.childrenRepository.findOne(id);
    if (!child) {
      throw new NotFoundException(`Child with ID ${id} not found`);
    }

    // Check authorization - get the parent to compare with userId
    if (userId) {
      const parent = await this.prisma.parent.findUnique({
        where: { id: child.parentId },
        select: { userId: true },
      });
      
      // FIX: Compare userId with parent.userId, not parent.id
      if (parent && userId !== parent.userId) {
        const user = await this.prisma.user.findUnique({
          where: { id: userId },
        });

        if (user?.role !== 'ADMIN' && user?.role !== 'SUPER_ADMIN') {
          throw new ForbiddenException('You are not authorized to delete this child');
        }
      }
    }

    // Check if child has any immunizations or other records
    const hasRecords = await this.prisma.immunization.count({
      where: { childId: id },
    });

    if (hasRecords > 0) {
      throw new BadRequestException('Cannot delete child with immunization records. Consider deactivating instead.');
    }

    await this.childrenRepository.remove(id);
  }

  async getStats() {
    return this.childrenRepository.getStats();
  }

  async searchChildren(searchTerm: string) {
    const children = await this.prisma.child.findMany({
      where: {
        OR: [
          { firstName: { contains: searchTerm, mode: 'insensitive' } },
          { lastName: { contains: searchTerm, mode: 'insensitive' } },
          { birthCertificateNo: { contains: searchTerm, mode: 'insensitive' } },
          { uniqueIdentifier: { contains: searchTerm, mode: 'insensitive' } },
        ],
      },
      take: 20,
      include: {
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
      orderBy: { createdAt: 'desc' },
    });

    return children.map(child => ({
      id: child.id,
      fullName: `${child.firstName} ${child.lastName}`,
      dateOfBirth: child.dateOfBirth,
      birthCertificateNo: child.birthCertificateNo,
      uniqueIdentifier: child.uniqueIdentifier,
      parent: {
        name: child.parent.user.fullName,
        phone: child.parent.user.phoneNumber,
      },
    }));
  }

  async validateChildForVaccination(childId: string): Promise<{
    isValid: boolean;
    child: ChildResponseDto | null;
    message?: string;
  }> {
    try {
      const child = await this.findOne(childId);
      const ageInMonths = this.calculateAgeInMonths(child.dateOfBirth);
      
      if (ageInMonths < 0) {
        return {
          isValid: false,
          child,
          message: 'Child date of birth is in the future',
        };
      }
      
      return {
        isValid: true,
        child,
      };
    } catch (error) {
      return {
        isValid: false,
        child: null,
        message: error.message,
      };
    }
  }
}