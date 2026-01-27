import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ChildrenRepository } from './children.repository';
import { CreateChildDto } from './dto/create-child.dto';
import { UpdateChildDto } from './dto/update-child.dto';
import { ChildResponseDto, PaginatedChildrenResponseDto } from './dto/child-response.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ChildrenService {
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

  async create(createChildDto: CreateChildDto, userId?: string): Promise<ChildResponseDto> {
    // Check if parent exists
    const parent = await this.prisma.parent.findUnique({
      where: { userId: createChildDto.parentId },
    });

    if (!parent) {
      throw new NotFoundException(`Parent with ID ${createChildDto.parentId} not found`);
    }

    // Check if user is authorized (either parent or admin)
    if (userId && userId !== createChildDto.parentId) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (user?.role !== 'ADMIN' && user?.role !== 'SUPER_ADMIN' && user?.role !== 'HEALTH_WORKER') {
        throw new ForbiddenException('You are not authorized to register children for this parent');
      }
    }

    // Check if birth certificate number already exists
    if (createChildDto.birthCertificateNo) {
      const existingChild = await this.childrenRepository.findByBirthCertificate(
        createChildDto.birthCertificateNo,
      );
      if (existingChild) {
        throw new ConflictException('Birth certificate number already exists');
      }
    }

    // Check if birth facility exists
    if (createChildDto.birthFacilityId) {
      const facility = await this.prisma.healthFacility.findUnique({
        where: { id: createChildDto.birthFacilityId },
      });
      if (!facility) {
        throw new NotFoundException(`Health facility with ID ${createChildDto.birthFacilityId} not found`);
      }
    }

    // Validate date of birth (not in future)
    const dob = new Date(createChildDto.dateOfBirth);
    const today = new Date();
    if (dob > today) {
      throw new BadRequestException('Date of birth cannot be in the future');
    }

    // Create child
    const child = await this.childrenRepository.create(createChildDto);
    return this.mapToChildResponseDto(child);
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

    // Check authorization
    if (userId && userId !== existingChild.parentId) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (user?.role !== 'ADMIN' && user?.role !== 'SUPER_ADMIN' && user?.role !== 'HEALTH_WORKER') {
        throw new ForbiddenException('You are not authorized to update this child');
      }
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

    // Check authorization
    if (userId && userId !== child.parentId) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (user?.role !== 'ADMIN' && user?.role !== 'SUPER_ADMIN') {
        throw new ForbiddenException('You are not authorized to delete this child');
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