import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Request,
  HttpCode,
  HttpStatus,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiParam, ApiBearerAuth } from '@nestjs/swagger';
import { FacilitiesService } from './facilities.service';
import { CreateFacilityDto } from './dto/create-facility.dto';
import { UpdateFacilityDto } from './dto/update-facility.dto';
import { FacilityFilter } from './facilities.repository';
import { HealthFacilityType, UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UsersService } from '../users/users.service';

@ApiTags('facilities')
@Controller('facilities')
@UsePipes(new ValidationPipe({ transform: true }))
export class FacilitiesController {
  constructor(
    private readonly facilitiesService: FacilitiesService,
    private readonly usersService: UsersService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get all facilities with optional filters' })
  @ApiQuery({ name: 'county', required: false, type: String })
  @ApiQuery({ name: 'subCounty', required: false, type: String })
  @ApiQuery({ name: 'type', required: false, enum: HealthFacilityType })
  @ApiQuery({ name: 'status', required: false, enum: ['active', 'inactive'] })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiResponse({ status: 200, description: 'List of facilities' })
  async getFacilities(
    @Query('county') county?: string,
    @Query('subCounty') subCounty?: string,
    @Query('type') type?: HealthFacilityType,
    @Query('status') status?: 'active' | 'inactive',
    @Query('search') search?: string,
  ) {
    const filter: FacilityFilter = {
      county,
      subCounty,
      type,
      status,
      search,
    };
    return this.facilitiesService.findAll(filter);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get facility statistics' })
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        total: 100,
        active: 80,
        inactive: 20,
        byType: {
          HOSPITAL: 30,
          HEALTH_CENTER: 40,
          DISPENSARY: 30,
        },
      },
    },
  })
  async getFacilityStats() {
    return this.facilitiesService.getStats();
  }

  @Get('county/:county')
  @ApiOperation({ summary: 'Get facilities by county' })
  @ApiParam({ name: 'county', type: String })
  @ApiResponse({ status: 200, description: 'List of facilities by county' })
  async getFacilitiesByCounty(@Param('county') county: string) {
    return this.facilitiesService.findByCounty(county);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a facility by ID' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 404, description: 'Facility not found' })
  async getFacilityById(@Param('id') id: string) {
    return this.facilitiesService.findById(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.HEALTH_WORKER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new facility' })
  @ApiResponse({ status: 201 })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 409, description: 'Facility with this code already exists' })
  async createFacility(@Body() createFacilityDto: CreateFacilityDto, @Request() req: any) {
    const facility = await this.facilitiesService.create(createFacilityDto);

    if (req.user?.role === UserRole.HEALTH_WORKER) {
      await this.usersService.update(req.user.id, {
        facilityId: facility.id,
      });
    }

    return facility;
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a facility' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 404, description: 'Facility not found' })
  @ApiResponse({ status: 409, description: 'Facility with this code already exists' })
  async updateFacility(
    @Param('id') id: string,
    @Body() updateFacilityDto: UpdateFacilityDto,
  ) {
    return this.facilitiesService.update(id, updateFacilityDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a facility' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 204 })
  @ApiResponse({ status: 404, description: 'Facility not found' })
  async deleteFacility(@Param('id') id: string) {
    return this.facilitiesService.delete(id);
  }

  @Post(':id/activate')
  @ApiOperation({ summary: 'Activate a facility' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 404, description: 'Facility not found' })
  async activateFacility(@Param('id') id: string) {
    return this.facilitiesService.activate(id);
  }

  @Post(':id/deactivate')
  @ApiOperation({ summary: 'Deactivate a facility' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 404, description: 'Facility not found' })
  async deactivateFacility(@Param('id') id: string) {
    return this.facilitiesService.deactivate(id);
  }
}
