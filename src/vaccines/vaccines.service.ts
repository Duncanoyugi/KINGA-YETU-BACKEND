import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVaccineDto } from './dto/create-vaccine.dto';
import { UpdateVaccineDto } from './dto/update-vaccine.dto';
import { VaccineResponseDto, PaginatedVaccinesResponseDto, VaccineStatsDto } from './dto/vaccine-response.dto';
import { KenyaScheduleService } from './keni-schedule.service';

@Injectable()
export class VaccinesService {
  constructor(
    private prisma: PrismaService,
    private kenyaScheduleService: KenyaScheduleService,
  ) {}

  private mapToVaccineResponseDto(vaccine: any): VaccineResponseDto {
    return {
      id: vaccine.id,
      code: vaccine.code,
      name: vaccine.name,
      description: vaccine.description || undefined,
      recommendedAgeDays: vaccine.recommendedAgeDays,
      minAgeDays: vaccine.minAgeDays || undefined,
      maxAgeDays: vaccine.maxAgeDays || undefined,
      isBirthDose: vaccine.isBirthDose,
      isBooster: vaccine.isBooster,
      vaccineType: vaccine.vaccineType || undefined,
      administrationRoute: vaccine.administrationRoute || undefined,
      administrationSite: vaccine.administrationSite || undefined,
      dosage: vaccine.dosage || undefined,
      dosesRequired: vaccine.dosesRequired || undefined,
      diseasePrevented: vaccine.diseasePrevented || undefined,
      manufacturer: vaccine.manufacturer || undefined,
      storageRequirements: vaccine.storageRequirements || undefined,
      sideEffects: vaccine.sideEffects || undefined,
      contraindications: vaccine.contraindications || undefined,
      isActive: vaccine.isActive,
      totalAdministrations: vaccine._count?.immunizations || 0,
      createdAt: vaccine.createdAt,
      updatedAt: vaccine.updatedAt,
    };
  }

  async create(createVaccineDto: CreateVaccineDto): Promise<VaccineResponseDto> {
    // Check if vaccine code already exists
    const existingVaccine = await this.prisma.vaccine.findUnique({
      where: { code: createVaccineDto.code },
    });

    if (existingVaccine) {
      throw new ConflictException(`Vaccine with code ${createVaccineDto.code} already exists`);
    }

    // Validate age ranges
    if (createVaccineDto.minAgeDays !== undefined && createVaccineDto.maxAgeDays !== undefined) {
      if (createVaccineDto.minAgeDays > createVaccineDto.maxAgeDays) {
        throw new BadRequestException('Minimum age cannot be greater than maximum age');
      }
    }

    if (createVaccineDto.recommendedAgeDays < 0) {
      throw new BadRequestException('Recommended age cannot be negative');
    }

    // Create vaccine
    const vaccine = await this.prisma.vaccine.create({
      data: {
        ...createVaccineDto,
        isActive: createVaccineDto.isActive !== undefined ? createVaccineDto.isActive : true,
      },
      include: {
        _count: {
          select: {
            immunizations: true,
          },
        },
      },
    });

    return this.mapToVaccineResponseDto(vaccine);
  }

  async findAll(
    page: number = 1,
    limit: number = 10,
    search?: string,
    isActive?: boolean,
    isBirthDose?: boolean,
    isBooster?: boolean,
  ): Promise<PaginatedVaccinesResponseDto> {
    const skip = (page - 1) * limit;

    const where: any = {};

    if (search) {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    if (isBirthDose !== undefined) {
      where.isBirthDose = isBirthDose;
    }

    if (isBooster !== undefined) {
      where.isBooster = isBooster;
    }

    const [total, vaccines] = await Promise.all([
      this.prisma.vaccine.count({ where }),
      this.prisma.vaccine.findMany({
        skip,
        take: limit,
        where,
        include: {
          _count: {
            select: {
              immunizations: true,
            },
          },
        },
        orderBy: { recommendedAgeDays: 'asc' },
      }),
    ]);

    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      data: vaccines.map(vaccine => this.mapToVaccineResponseDto(vaccine)),
    };
  }

  async findOne(id: string): Promise<VaccineResponseDto> {
    const vaccine = await this.prisma.vaccine.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            immunizations: true,
            schedules: true,
            reminders: true,
          },
        },
        immunizations: {
          take: 10,
          orderBy: { dateAdministered: 'desc' },
          include: {
            child: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                dateOfBirth: true,
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

    if (!vaccine) {
      throw new NotFoundException(`Vaccine with ID ${id} not found`);
    }

    return this.mapToVaccineResponseDto(vaccine);
  }

  async findByCode(code: string): Promise<VaccineResponseDto> {
    const vaccine = await this.prisma.vaccine.findUnique({
      where: { code },
      include: {
        _count: {
          select: {
            immunizations: true,
          },
        },
      },
    });

    if (!vaccine) {
      throw new NotFoundException(`Vaccine with code ${code} not found`);
    }

    return this.mapToVaccineResponseDto(vaccine);
  }

  async update(id: string, updateVaccineDto: UpdateVaccineDto): Promise<VaccineResponseDto> {
    // Check if vaccine exists
    const existingVaccine = await this.prisma.vaccine.findUnique({
      where: { id },
    });

    if (!existingVaccine) {
      throw new NotFoundException(`Vaccine with ID ${id} not found`);
    }

    // Check if code is being changed and if it already exists
    if (updateVaccineDto.code && updateVaccineDto.code !== existingVaccine.code) {
      const existingCode = await this.prisma.vaccine.findUnique({
        where: { code: updateVaccineDto.code },
      });
      if (existingCode) {
        throw new ConflictException(`Vaccine with code ${updateVaccineDto.code} already exists`);
      }
    }

    // Validate age ranges if being updated
    if (
      (updateVaccineDto.minAgeDays !== undefined || updateVaccineDto.maxAgeDays !== undefined) &&
      (updateVaccineDto.minAgeDays !== undefined && updateVaccineDto.maxAgeDays !== undefined)
    ) {
      if (updateVaccineDto.minAgeDays > updateVaccineDto.maxAgeDays) {
        throw new BadRequestException('Minimum age cannot be greater than maximum age');
      }
    }

    const updatedVaccine = await this.prisma.vaccine.update({
      where: { id },
      data: updateVaccineDto,
      include: {
        _count: {
          select: {
            immunizations: true,
          },
        },
      },
    });

    return this.mapToVaccineResponseDto(updatedVaccine);
  }

  async remove(id: string): Promise<void> {
    // Check if vaccine exists
    const vaccine = await this.prisma.vaccine.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            immunizations: true,
            schedules: true,
            reminders: true,
          },
        },
      },
    });

    if (!vaccine) {
      throw new NotFoundException(`Vaccine with ID ${id} not found`);
    }

    // Check if vaccine has any records
    if (vaccine._count.immunizations > 0 || vaccine._count.schedules > 0 || vaccine._count.reminders > 0) {
      throw new BadRequestException(
        'Cannot delete vaccine with existing immunizations, schedules, or reminders. Deactivate instead.',
      );
    }

    await this.prisma.vaccine.delete({
      where: { id },
    });
  }

  async deactivate(id: string): Promise<VaccineResponseDto> {
    const vaccine = await this.prisma.vaccine.findUnique({
      where: { id },
    });

    if (!vaccine) {
      throw new NotFoundException(`Vaccine with ID ${id} not found`);
    }

    const updatedVaccine = await this.prisma.vaccine.update({
      where: { id },
      data: { isActive: false },
      include: {
        _count: {
          select: {
            immunizations: true,
          },
        },
      },
    });

    return this.mapToVaccineResponseDto(updatedVaccine);
  }

  async activate(id: string): Promise<VaccineResponseDto> {
    const vaccine = await this.prisma.vaccine.findUnique({
      where: { id },
    });

    if (!vaccine) {
      throw new NotFoundException(`Vaccine with ID ${id} not found`);
    }

    const updatedVaccine = await this.prisma.vaccine.update({
      where: { id },
      data: { isActive: true },
      include: {
        _count: {
          select: {
            immunizations: true,
          },
        },
      },
    });

    return this.mapToVaccineResponseDto(updatedVaccine);
  }

  async getStats(): Promise<VaccineStatsDto> {
    const [
      totalVaccines,
      activeVaccines,
      birthDoseVaccines,
      boosterVaccines,
      totalAdministrations,
    ] = await Promise.all([
      this.prisma.vaccine.count(),
      this.prisma.vaccine.count({ where: { isActive: true } }),
      this.prisma.vaccine.count({ where: { isBirthDose: true } }),
      this.prisma.vaccine.count({ where: { isBooster: true } }),
      this.prisma.immunization.count(),
    ]);

    // Use Prisma query instead of raw SQL for better reliability
    const topAdministeredRaw = await this.prisma.immunization.groupBy({
      by: ['vaccineId'],
      _count: { vaccineId: true },
      orderBy: { _count: { vaccineId: 'desc' } },
      take: 10,
    });

    const vaccineIds = topAdministeredRaw.map(item => item.vaccineId);
    const vaccines = await this.prisma.vaccine.findMany({
      where: { id: { in: vaccineIds } },
      select: { id: true, name: true, code: true },
    });

    const topAdministered = topAdministeredRaw.map(item => {
      const vaccine = vaccines.find(v => v.id === item.vaccineId);
      return {
        vaccineName: vaccine?.name || 'Unknown',
        vaccineCode: vaccine?.code || 'UNK',
        count: item._count.vaccineId,
      };
    });

    return {
      totalVaccines,
      activeVaccines,
      birthDoseVaccines,
      boosterVaccines,
      totalAdministrations,
      topAdministered,
    };
  }

  async seedKepiVaccines() {
    return this.kenyaScheduleService.seedKepiVaccines();
  }

  async getKepiSchedule() {
    return this.kenyaScheduleService.getVaccineSchedule();
  }

  async getVaccinesByAge(ageDays: number) {
    return this.kenyaScheduleService.getRecommendedVaccinesForAge(ageDays);
  }

  async validateVaccineForChild(vaccineCode: string, childAgeDays: number) {
    console.log('[VaccinesService] Validating vaccine for child:', vaccineCode, 'age:', childAgeDays);
    const result = this.kenyaScheduleService.validateVaccineAdministration(vaccineCode, childAgeDays);
    console.log('[VaccinesService] Validation result:', JSON.stringify(result, null, 2));
    return result;
  }

  async searchVaccines(searchTerm: string) {
    const vaccines = await this.prisma.vaccine.findMany({
      where: {
        OR: [
          { code: { contains: searchTerm, mode: 'insensitive' } },
          { name: { contains: searchTerm, mode: 'insensitive' } },
          { description: { contains: searchTerm, mode: 'insensitive' } },
          { diseasePrevented: { contains: searchTerm, mode: 'insensitive' } },
        ],
      },
      take: 20,
      include: {
        _count: {
          select: {
            immunizations: true,
          },
        },
      },
      orderBy: { recommendedAgeDays: 'asc' },
    });

    return vaccines.map(vaccine => ({
      id: vaccine.id,
      code: vaccine.code,
      name: vaccine.name,
      recommendedAgeDays: vaccine.recommendedAgeDays,
      isBirthDose: vaccine.isBirthDose,
      isBooster: vaccine.isBooster,
      isActive: vaccine.isActive,
      totalAdministrations: vaccine._count.immunizations,
    }));
  }

  // ============ Inventory Methods ============

  async addInventory(inventoryDto: any) {
    const { vaccineId, facilityId, quantity, batchNumber, expiryDate, manufacturer } = inventoryDto;
    
    // Check if inventory already exists for this vaccine and facility
    let inventory = await this.prisma.vaccineInventory.findFirst({
      where: {
        vaccineId,
        facilityId,
        batchNumber,
      },
    });

    if (inventory) {
      // Update existing inventory
      inventory = await this.prisma.vaccineInventory.update({
        where: { id: inventory.id },
        data: {
          quantity: inventory.quantity + quantity,
        },
      });
    } else {
      // Create new inventory
      inventory = await this.prisma.vaccineInventory.create({
        data: {
          vaccineId,
          facilityId,
          quantity,
          batchNumber,
          expiryDate: new Date(expiryDate),
          manufacturer,
        },
      });
    }

    return inventory;
  }

  async getInventory(facilityId?: string) {
    const where = facilityId ? { facilityId } : {};
    
    const inventory = await this.prisma.vaccineInventory.findMany({
      where,
    });

    return {
      data: inventory,
      total: inventory.length,
    };
  }

  async getInventoryByFacility(facilityId: string) {
    const inventory = await this.prisma.vaccineInventory.findMany({
      where: { facilityId },
    });

    return {
      data: inventory,
      total: inventory.length,
    };
  }

  async getStockAlerts(facilityId?: string) {
    const where = facilityId ? { facilityId } : {};
    
    const inventory = await this.prisma.vaccineInventory.findMany({
      where,
    });

    const alerts: any[] = [];
    const today = new Date();
    const thirtyDaysFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

    for (const item of inventory) {
      // Check for low stock (threshold is typically 10)
      if (item.quantity <= 10) {
        alerts.push({
          severity: item.quantity === 0 ? 'HIGH' : 'MEDIUM',
          vaccineId: item.vaccineId,
          vaccineName: 'Vaccine',
          batchNumber: item.batchNumber,
          status: item.quantity === 0 ? 'Out of Stock' : 'Low Stock',
          message: `Vaccine has ${item.quantity} doses remaining`,
        });
      }

      // Check for expiring
      if (item.expiryDate && new Date(item.expiryDate) <= thirtyDaysFromNow) {
        alerts.push({
          severity: new Date(item.expiryDate) <= today ? 'HIGH' : 'MEDIUM',
          vaccineId: item.vaccineId,
          vaccineName: 'Vaccine',
          batchNumber: item.batchNumber,
          status: new Date(item.expiryDate) <= today ? 'Expired' : 'Expiring Soon',
          message: `Vaccine batch ${item.batchNumber} expires on ${item.expiryDate}`,
        });
      }
    }

    return alerts;
  }
}