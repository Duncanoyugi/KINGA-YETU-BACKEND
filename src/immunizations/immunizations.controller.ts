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
  Request,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { ImmunizationsService } from './immunizations.service';
import { RecordImmunizationDto } from './dto/record-immunization.dto';
import { UpdateImmunizationDto } from './dto/update-immunization.dto';
import { ImmunizationResponseDto, PaginatedImmunizationsResponseDto } from './dto/immunization-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole, ImmunizationStatus } from '@prisma/client';

@ApiTags('immunizations')
@Controller('immunizations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
export class ImmunizationsController {
  constructor(private readonly immunizationsService: ImmunizationsService) {}

  @Post()
  @Roles(UserRole.HEALTH_WORKER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Record a new immunization' })
  @ApiResponse({
    status: 201,
    description: 'Immunization recorded successfully',
    type: ImmunizationResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Child, vaccine, facility, or health worker not found' })
  @ApiResponse({ status: 409, description: 'Vaccine already administered to child' })
  @ApiResponse({ status: 400, description: 'Invalid vaccine administration age' })
  async create(
    @Body() recordImmunizationDto: RecordImmunizationDto,
    @Request() req: any,
  ): Promise<ImmunizationResponseDto> {
    return this.immunizationsService.create(recordImmunizationDto, req.user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Get all immunizations with pagination' })
  @ApiResponse({
    status: 200,
    description: 'List of immunizations',
    type: PaginatedImmunizationsResponseDto,
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'childId', required: false })
  @ApiQuery({ name: 'vaccineId', required: false })
  @ApiQuery({ name: 'facilityId', required: false })
  @ApiQuery({ name: 'healthWorkerId', required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiQuery({ name: 'status', required: false, enum: ImmunizationStatus })
  @ApiQuery({ name: 'search', required: false })
  async findAll(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('childId') childId?: string,
    @Query('vaccineId') vaccineId?: string,
    @Query('facilityId') facilityId?: string,
    @Query('healthWorkerId') healthWorkerId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('status') status?: ImmunizationStatus,
    @Query('search') search?: string,
  ): Promise<PaginatedImmunizationsResponseDto> {
    return this.immunizationsService.findAll(
      page,
      limit,
      childId,
      vaccineId,
      facilityId,
      healthWorkerId,
      startDate,
      endDate,
      status,
      search,
    );
  }

  @Get('stats')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.HEALTH_WORKER)
  @ApiOperation({ summary: 'Get immunization statistics' })
  @ApiResponse({ status: 200, description: 'Immunization statistics' })
  @ApiQuery({ name: 'facilityId', required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  async getStats(
    @Query('facilityId') facilityId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.immunizationsService.getStats(facilityId, startDate, endDate);
  }

  @Get('child/:childId/history')
  @Roles(UserRole.PARENT, UserRole.HEALTH_WORKER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get child immunization history' })
  @ApiResponse({ status: 200, description: 'Child immunization history' })
  @ApiParam({ name: 'childId', description: 'Child ID' })
  async getChildHistory(@Param('childId') childId: string) {
    return this.immunizationsService.getChildImmunizationHistory(childId);
  }

  @Get('child/:childId')
  @Roles(UserRole.PARENT, UserRole.HEALTH_WORKER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get all immunizations for a child' })
  @ApiResponse({
    status: 200,
    description: 'Child immunizations',
    type: [ImmunizationResponseDto],
  })
  @ApiParam({ name: 'childId', description: 'Child ID' })
  async findByChildId(@Param('childId') childId: string): Promise<ImmunizationResponseDto[]> {
    return this.immunizationsService.findByChildId(childId);
  }

  @Get('search/:term')
  @Roles(UserRole.HEALTH_WORKER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Search immunizations' })
  @ApiResponse({ status: 200, description: 'Search results' })
  @ApiParam({ name: 'term', description: 'Search term' })
  async search(@Param('term') term: string) {
    return this.immunizationsService.searchImmunizations(term);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an immunization by ID' })
  @ApiResponse({
    status: 200,
    description: 'Immunization details',
    type: ImmunizationResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Immunization not found' })
  @ApiParam({ name: 'id', description: 'Immunization ID' })
  async findOne(@Param('id') id: string): Promise<ImmunizationResponseDto> {
    return this.immunizationsService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.HEALTH_WORKER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update an immunization' })
  @ApiResponse({
    status: 200,
    description: 'Immunization updated successfully',
    type: ImmunizationResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Immunization not found' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async update(
    @Param('id') id: string,
    @Body() updateImmunizationDto: UpdateImmunizationDto,
    @Request() req: any,
  ): Promise<ImmunizationResponseDto> {
    return this.immunizationsService.update(id, updateImmunizationDto, req.user.id);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an immunization' })
  @ApiResponse({ status: 204, description: 'Immunization deleted successfully' })
  @ApiResponse({ status: 404, description: 'Immunization not found' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async remove(@Param('id') id: string, @Request() req: any): Promise<void> {
    return this.immunizationsService.remove(id, req.user.id);
  }

  @Get('today/health-worker')
  @Roles(UserRole.HEALTH_WORKER)
  @ApiOperation({ summary: 'Get today\'s immunizations for health worker' })
  @ApiResponse({ status: 200, description: 'Today\'s immunizations' })
  async getTodayImmunizations(@Request() req: any) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const healthWorker = await this.immunizationsService['prisma'].healthWorker.findUnique({
      where: { userId: req.user.id },
    });

    if (!healthWorker) {
      throw new NotFoundException('Health worker profile not found');
    }

    return this.immunizationsService.findAll(
      1,
      50,
      undefined,
      undefined,
      undefined,
      healthWorker.id,
      today.toISOString(),
      tomorrow.toISOString(),
    );
  }

  @Get('facility/:facilityId/today')
  @Roles(UserRole.HEALTH_WORKER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get today\'s immunizations for a facility' })
  @ApiResponse({ status: 200, description: 'Today\'s immunizations for facility' })
  @ApiParam({ name: 'facilityId', description: 'Facility ID' })
  async getTodayFacilityImmunizations(@Param('facilityId') facilityId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return this.immunizationsService.findAll(
      1,
      100,
      undefined,
      undefined,
      facilityId,
      undefined,
      today.toISOString(),
      tomorrow.toISOString(),
    );
  }
}