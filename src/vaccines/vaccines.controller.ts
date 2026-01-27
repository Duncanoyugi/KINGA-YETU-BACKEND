import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { VaccinesService } from './vaccines.service';
import { CreateVaccineDto } from './dto/create-vaccine.dto';
import { UpdateVaccineDto } from './dto/update-vaccine.dto';
import { VaccineResponseDto, PaginatedVaccinesResponseDto } from './dto/vaccine-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('vaccines')
@Controller('vaccines')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
export class VaccinesController {
  constructor(private readonly vaccinesService: VaccinesService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a new vaccine' })
  @ApiResponse({
    status: 201,
    description: 'Vaccine created successfully',
    type: VaccineResponseDto,
  })
  @ApiResponse({ status: 409, description: 'Vaccine code already exists' })
  async create(@Body() createVaccineDto: CreateVaccineDto): Promise<VaccineResponseDto> {
    return this.vaccinesService.create(createVaccineDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all vaccines with pagination' })
  @ApiResponse({
    status: 200,
    description: 'List of vaccines',
    type: PaginatedVaccinesResponseDto,
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  @ApiQuery({ name: 'isBirthDose', required: false, type: Boolean })
  @ApiQuery({ name: 'isBooster', required: false, type: Boolean })
  async findAll(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('search') search?: string,
    @Query('isActive') isActive?: boolean,
    @Query('isBirthDose') isBirthDose?: boolean,
    @Query('isBooster') isBooster?: boolean,
  ): Promise<PaginatedVaccinesResponseDto> {
    return this.vaccinesService.findAll(page, limit, search, isActive, isBirthDose, isBooster);
  }

  @Get('stats')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.HEALTH_WORKER)
  @ApiOperation({ summary: 'Get vaccine statistics' })
  @ApiResponse({ status: 200, description: 'Vaccine statistics' })
  async getStats() {
    return this.vaccinesService.getStats();
  }

  @Get('kepi-schedule')
  @ApiOperation({ summary: 'Get KEPI immunization schedule' })
  @ApiResponse({ status: 200, description: 'KEPI schedule' })
  async getKepiSchedule() {
    return this.vaccinesService.getKepiSchedule();
  }

  @Get('seed-kepi')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Seed KEPI vaccines into database' })
  @ApiResponse({ status: 200, description: 'KEPI vaccines seeded' })
  async seedKepiVaccines() {
    return this.vaccinesService.seedKepiVaccines();
  }

  @Get('by-age/:ageDays')
  @Roles(UserRole.HEALTH_WORKER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get vaccines recommended for specific age' })
  @ApiResponse({ status: 200, description: 'Recommended vaccines for age' })
  @ApiParam({ name: 'ageDays', description: 'Age in days' })
  async getVaccinesByAge(@Param('ageDays') ageDays: number) {
    return this.vaccinesService.getVaccinesByAge(Number(ageDays));
  }

  @Get('search/:term')
  @ApiOperation({ summary: 'Search vaccines' })
  @ApiResponse({ status: 200, description: 'Search results' })
  @ApiParam({ name: 'term', description: 'Search term' })
  async search(@Param('term') term: string) {
    return this.vaccinesService.searchVaccines(term);
  }

  @Get('code/:code')
  @ApiOperation({ summary: 'Get vaccine by code' })
  @ApiResponse({
    status: 200,
    description: 'Vaccine details',
    type: VaccineResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Vaccine not found' })
  @ApiParam({ name: 'code', description: 'Vaccine code' })
  async findByCode(@Param('code') code: string): Promise<VaccineResponseDto> {
    return this.vaccinesService.findByCode(code);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a vaccine by ID' })
  @ApiResponse({
    status: 200,
    description: 'Vaccine details',
    type: VaccineResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Vaccine not found' })
  @ApiParam({ name: 'id', description: 'Vaccine ID' })
  async findOne(@Param('id') id: string): Promise<VaccineResponseDto> {
    return this.vaccinesService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update a vaccine' })
  @ApiResponse({
    status: 200,
    description: 'Vaccine updated successfully',
    type: VaccineResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Vaccine not found' })
  @ApiResponse({ status: 409, description: 'Vaccine code already exists' })
  async update(
    @Param('id') id: string,
    @Body() updateVaccineDto: UpdateVaccineDto,
  ): Promise<VaccineResponseDto> {
    return this.vaccinesService.update(id, updateVaccineDto);
  }

  @Patch(':id/deactivate')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Deactivate a vaccine' })
  @ApiResponse({
    status: 200,
    description: 'Vaccine deactivated successfully',
    type: VaccineResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Vaccine not found' })
  async deactivate(@Param('id') id: string): Promise<VaccineResponseDto> {
    return this.vaccinesService.deactivate(id);
  }

  @Patch(':id/activate')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Activate a vaccine' })
  @ApiResponse({
    status: 200,
    description: 'Vaccine activated successfully',
    type: VaccineResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Vaccine not found' })
  async activate(@Param('id') id: string): Promise<VaccineResponseDto> {
    return this.vaccinesService.activate(id);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a vaccine' })
  @ApiResponse({ status: 204, description: 'Vaccine deleted successfully' })
  @ApiResponse({ status: 404, description: 'Vaccine not found' })
  @ApiResponse({ status: 400, description: 'Cannot delete vaccine with records' })
  async remove(@Param('id') id: string): Promise<void> {
    return this.vaccinesService.remove(id);
  }

  @Get('validate/:vaccineCode/:childAgeDays')
  @Roles(UserRole.HEALTH_WORKER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Validate vaccine for child age' })
  @ApiResponse({ status: 200, description: 'Validation result' })
  @ApiParam({ name: 'vaccineCode', description: 'Vaccine code' })
  @ApiParam({ name: 'childAgeDays', description: 'Child age in days' })
  async validateVaccine(
    @Param('vaccineCode') vaccineCode: string,
    @Param('childAgeDays') childAgeDays: number,
  ) {
    return this.vaccinesService.validateVaccineForChild(vaccineCode, Number(childAgeDays));
  }
}