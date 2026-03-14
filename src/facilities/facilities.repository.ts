import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, HealthFacility, HealthFacilityType } from '@prisma/client';

export interface FacilityFilter {
  county?: string;
  subCounty?: string;
  type?: HealthFacilityType;
  status?: 'active' | 'inactive';
  search?: string;
}

@Injectable()
export class FacilitiesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(filter?: FacilityFilter): Promise<HealthFacility[]> {
    const where: Prisma.HealthFacilityWhereInput = {};

    if (filter?.county) {
      where.county = filter.county;
    }

    if (filter?.subCounty) {
      where.subCounty = filter.subCounty;
    }

    if (filter?.type) {
      where.type = filter.type;
    }

    if (filter?.status === 'active') {
      where.isActive = true;
    } else if (filter?.status === 'inactive') {
      where.isActive = false;
    }

    if (filter?.search) {
      where.OR = [
        { name: { contains: filter.search, mode: 'insensitive' } },
        { code: { contains: filter.search, mode: 'insensitive' } },
        { mflCode: { contains: filter.search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.healthFacility.findMany({
      where,
      orderBy: { name: 'asc' },
    });
  }

  async findById(id: string): Promise<HealthFacility | null> {
    return this.prisma.healthFacility.findUnique({
      where: { id },
    });
  }

  async findByCounty(county: string): Promise<HealthFacility[]> {
    return this.prisma.healthFacility.findMany({
      where: { county },
      orderBy: { name: 'asc' },
    });
  }

  async findByMflCode(mflCode: string): Promise<HealthFacility | null> {
    return this.prisma.healthFacility.findUnique({
      where: { mflCode },
    });
  }

  async findByCode(code: string): Promise<HealthFacility | null> {
    return this.prisma.healthFacility.findUnique({
      where: { code },
    });
  }

  async create(data: Prisma.HealthFacilityCreateInput): Promise<HealthFacility> {
    return this.prisma.healthFacility.create({
      data,
    });
  }

  async update(
    id: string,
    data: Prisma.HealthFacilityUpdateInput,
  ): Promise<HealthFacility> {
    return this.prisma.healthFacility.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.healthFacility.delete({
      where: { id },
    });
  }

  async activate(id: string): Promise<HealthFacility> {
    return this.prisma.healthFacility.update({
      where: { id },
      data: { isActive: true },
    });
  }

  async deactivate(id: string): Promise<HealthFacility> {
    return this.prisma.healthFacility.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async getStats(): Promise<{
    total: number;
    active: number;
    inactive: number;
    byType: Record<string, number>;
  }> {
    const [total, active, inactive, byTypeResult] = await Promise.all([
      this.prisma.healthFacility.count(),
      this.prisma.healthFacility.count({ where: { isActive: true } }),
      this.prisma.healthFacility.count({ where: { isActive: false } }),
      this.prisma.healthFacility.groupBy({
        by: ['type'],
        _count: true,
      }),
    ]);

    const byType: Record<string, number> = {};
    byTypeResult.forEach((item) => {
      byType[item.type] = item._count;
    });

    return { total, active, inactive, byType };
  }
}
