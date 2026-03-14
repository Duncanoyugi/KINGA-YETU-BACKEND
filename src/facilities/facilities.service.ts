import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { FacilitiesRepository, FacilityFilter } from './facilities.repository';
import { CreateFacilityDto } from './dto/create-facility.dto';
import { UpdateFacilityDto } from './dto/update-facility.dto';
import { HealthFacility } from '@prisma/client';

@Injectable()
export class FacilitiesService {
  constructor(private readonly facilitiesRepository: FacilitiesRepository) {}

  async findAll(filter?: FacilityFilter): Promise<HealthFacility[]> {
    return this.facilitiesRepository.findAll(filter);
  }

  async findById(id: string): Promise<HealthFacility> {
    const facility = await this.facilitiesRepository.findById(id);
    if (!facility) {
      throw new NotFoundException(`Facility with ID ${id} not found`);
    }
    return facility;
  }

  async findByCounty(county: string): Promise<HealthFacility[]> {
    return this.facilitiesRepository.findByCounty(county);
  }

  async create(createFacilityDto: CreateFacilityDto): Promise<HealthFacility> {
    // Check if facility with same code exists
    const existingByCode = await this.facilitiesRepository.findByCode(
      createFacilityDto.code,
    );
    if (existingByCode) {
      throw new ConflictException('Facility with this code already exists');
    }

    // Check if facility with same MFL code exists (if provided)
    if (createFacilityDto.mflCode) {
      const existingByMflCode = await this.facilitiesRepository.findByMflCode(
        createFacilityDto.mflCode,
      );
      if (existingByMflCode) {
        throw new ConflictException('Facility with this MFL code already exists');
      }
    }

    return this.facilitiesRepository.create(createFacilityDto);
  }

  async update(id: string, updateFacilityDto: UpdateFacilityDto): Promise<HealthFacility> {
    // Check if facility exists
    await this.findById(id);

    // Check if updating to a code that already exists
    if (updateFacilityDto.code) {
      const existingByCode = await this.facilitiesRepository.findByCode(
        updateFacilityDto.code,
      );
      if (existingByCode && existingByCode.id !== id) {
        throw new ConflictException('Facility with this code already exists');
      }
    }

    // Check if updating to an MFL code that already exists
    if (updateFacilityDto.mflCode) {
      const existingByMflCode = await this.facilitiesRepository.findByMflCode(
        updateFacilityDto.mflCode,
      );
      if (existingByMflCode && existingByMflCode.id !== id) {
        throw new ConflictException('Facility with this MFL code already exists');
      }
    }

    return this.facilitiesRepository.update(id, updateFacilityDto);
  }

  async delete(id: string): Promise<void> {
    // Check if facility exists
    await this.findById(id);
    return this.facilitiesRepository.delete(id);
  }

  async activate(id: string): Promise<HealthFacility> {
    // Check if facility exists
    await this.findById(id);
    return this.facilitiesRepository.activate(id);
  }

  async deactivate(id: string): Promise<HealthFacility> {
    // Check if facility exists
    await this.findById(id);
    return this.facilitiesRepository.deactivate(id);
  }

  async getStats(): Promise<{
    total: number;
    active: number;
    inactive: number;
    byType: Record<string, number>;
  }> {
    return this.facilitiesRepository.getStats();
  }
}
