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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { SchedulesService } from './schedules.service';
import { GenerateScheduleDto, RegenerateScheduleDto } from './dto/generate-schedule.dto';
import { ScheduleResponseDto, PaginatedSchedulesResponseDto, ScheduleStatsDto } from './dto/schedule-response.dto';
import { UpcomingVaccinesResponseDto, FacilityUpcomingVaccinesDto } from './dto/upcoming-vaccines.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole, ImmunizationStatus } from '@prisma/client';

@ApiTags('schedules')
@Controller('schedules')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
export class SchedulesController {
  constructor(private readonly schedulesService: SchedulesService) {}

  @Post('generate')
  @Roles(UserRole.HEALTH_WORKER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Generate vaccination schedule for a child' })
  @ApiResponse({ status: 201, description: 'Schedule generated successfully' })
  @ApiResponse({ status: 404, description: 'Child not found' })
  @ApiResponse({ status: 409, description: 'Schedule already exists' })
  async generate(@Body() generateScheduleDto: GenerateScheduleDto) {
    return this.schedulesService.generateSchedule(generateScheduleDto);
  }

  @Post('regenerate')
  @Roles(UserRole.HEALTH_WORKER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Regenerate vaccination schedule for a child' })
  @ApiResponse({ status: 200, description: 'Schedule regenerated successfully' })
  @ApiResponse({ status: 404, description: 'Child not found' })
  async regenerate(@Body() regenerateScheduleDto: RegenerateScheduleDto) {
    return this.schedulesService.regenerateSchedule(regenerateScheduleDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all schedules with pagination' })
  @ApiResponse({
    status: 200,
    description: 'List of schedules',
    type: PaginatedSchedulesResponseDto,
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'childId', required: false })
  @ApiQuery({ name: 'vaccineId', required: false })
  @ApiQuery({ name: 'status', required: false, enum: ImmunizationStatus })
  @ApiQuery({ name: 'overdue', required: false, type: Boolean })
  @ApiQuery({ name: 'upcoming', required: false, type: Boolean })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiQuery({ name: 'search', required: false })
  async findAll(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('childId') childId?: string,
    @Query('vaccineId') vaccineId?: string,
    @Query('status') status?: ImmunizationStatus,
    @Query('overdue') overdue?: boolean,
    @Query('upcoming') upcoming?: boolean,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('search') search?: string,
  ): Promise<PaginatedSchedulesResponseDto> {
    return this.schedulesService.findAll(
      page,
      limit,
      childId,
      vaccineId,
      status,
      overdue,
      upcoming,
      startDate,
      endDate,
      search,
    );
  }

  @Get('stats')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.HEALTH_WORKER)
  @ApiOperation({ summary: 'Get schedule statistics' })
  @ApiResponse({
    status: 200,
    description: 'Schedule statistics',
    type: ScheduleStatsDto,
  })
  @ApiQuery({ name: 'facilityId', required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  async getStats(
    @Query('facilityId') facilityId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<ScheduleStatsDto> {
    return this.schedulesService.getStats(facilityId, startDate, endDate);
  }

  @Get('upcoming')
  @Roles(UserRole.HEALTH_WORKER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get upcoming vaccines' })
  @ApiResponse({
    status: 200,
    description: 'Upcoming vaccines',
    type: UpcomingVaccinesResponseDto,
  })
  @ApiQuery({ name: 'daysAhead', required: false, type: Number })
  @ApiQuery({ name: 'facilityId', required: false })
  @ApiQuery({ name: 'childId', required: false })
  async getUpcomingVaccines(
    @Query('daysAhead') daysAhead: number = 30,
    @Query('facilityId') facilityId?: string,
    @Query('childId') childId?: string,
  ): Promise<UpcomingVaccinesResponseDto> {
    return this.schedulesService.getUpcomingVaccines(daysAhead, facilityId, childId);
  }

  @Get('overdue')
  @Roles(UserRole.HEALTH_WORKER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get overdue vaccines' })
  @ApiResponse({ status: 200, description: 'Overdue vaccines' })
  @ApiQuery({ name: 'daysOverdue', required: false, type: Number })
  @ApiQuery({ name: 'childId', required: false })
  async getOverdueVaccines(
    @Query('daysOverdue') daysOverdue: number = 30,
    @Query('childId') childId?: string,
  ) {
    return this.schedulesService.getOverdueVaccines(daysOverdue, childId);
  }

  @Get('facility/:facilityId/upcoming')
  @Roles(UserRole.HEALTH_WORKER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get upcoming vaccines for a facility' })
  @ApiResponse({
    status: 200,
    description: 'Facility upcoming vaccines',
    type: FacilityUpcomingVaccinesDto,
  })
  @ApiParam({ name: 'facilityId', description: 'Facility ID' })
  async getFacilityUpcomingVaccines(
    @Param('facilityId') facilityId: string,
  ): Promise<FacilityUpcomingVaccinesDto> {
    return this.schedulesService.getFacilityUpcomingVaccines(facilityId);
  }

  @Get('child/:childId')
  @Roles(UserRole.PARENT, UserRole.HEALTH_WORKER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get all schedules for a child' })
  @ApiResponse({
    status: 200,
    description: 'Child schedules',
    type: [ScheduleResponseDto],
  })
  @ApiParam({ name: 'childId', description: 'Child ID' })
  async findByChildId(@Param('childId') childId: string): Promise<ScheduleResponseDto[]> {
    return this.schedulesService.findByChildId(childId);
  }

  @Get('child/:childId/stats')
  @Roles(UserRole.PARENT, UserRole.HEALTH_WORKER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get child schedule statistics' })
  @ApiResponse({ status: 200, description: 'Child schedule statistics' })
  @ApiParam({ name: 'childId', description: 'Child ID' })
  async getChildStats(@Param('childId') childId: string) {
    return this.schedulesService.getChildScheduleStats(childId);
  }

  @Get('child/:childId/print')
  @Roles(UserRole.PARENT, UserRole.HEALTH_WORKER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get schedule for printing' })
  @ApiResponse({ status: 200, description: 'Schedule for printing' })
  @ApiParam({ name: 'childId', description: 'Child ID' })
  async getScheduleForPrint(@Param('childId') childId: string) {
    return this.schedulesService.getScheduleForPrint(childId);
  }

  @Get('search/:term')
  @Roles(UserRole.HEALTH_WORKER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Search schedules' })
  @ApiResponse({ status: 200, description: 'Search results' })
  @ApiParam({ name: 'term', description: 'Search term' })
  async search(@Param('term') term: string) {
    return this.schedulesService.searchSchedules(term);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a schedule by ID' })
  @ApiResponse({
    status: 200,
    description: 'Schedule details',
    type: ScheduleResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Schedule not found' })
  @ApiParam({ name: 'id', description: 'Schedule ID' })
  async findOne(@Param('id') id: string): Promise<ScheduleResponseDto> {
    return this.schedulesService.findOne(id);
  }

  @Patch(':id/reschedule')
  @Roles(UserRole.HEALTH_WORKER, UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.PARENT)
  @ApiOperation({ summary: 'Reschedule a vaccine' })
  @ApiResponse({
    status: 200,
    description: 'Vaccine rescheduled successfully',
    type: ScheduleResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Schedule not found' })
  @ApiResponse({ status: 400, description: 'Invalid reschedule date' })
  async reschedule(
    @Param('id') id: string,
    @Body() body: { newDate: string; reason?: string },
    @Request() req: any,
  ): Promise<ScheduleResponseDto> {
    return this.schedulesService.reschedule(
      id,
      new Date(body.newDate),
      body.reason,
      req.user.id,
    );
  }

  @Patch(':id/contraindicated')
  @Roles(UserRole.HEALTH_WORKER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Mark vaccine as contraindicated' })
  @ApiResponse({
    status: 200,
    description: 'Vaccine marked as contraindicated',
    type: ScheduleResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Schedule not found' })
  async markAsContraindicated(
    @Param('id') id: string,
    @Body() body: { reason: string },
    @Request() req: any,
  ): Promise<ScheduleResponseDto> {
    return this.schedulesService.markAsContraindicated(
      id,
      body.reason,
      req.user.id,
    );
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a schedule' })
  @ApiResponse({ status: 204, description: 'Schedule deleted successfully' })
  @ApiResponse({ status: 404, description: 'Schedule not found' })
  @ApiResponse({ status: 400, description: 'Cannot delete schedule for administered vaccine' })
  async remove(@Param('id') id: string): Promise<void> {
    return this.schedulesService.remove(id);
  }

  @Get('my-child/schedules')
  @Roles(UserRole.PARENT)
  @ApiOperation({ summary: 'Get current parent\'s child schedules' })
  @ApiResponse({
    status: 200,
    description: 'Parent\'s child schedules',
    type: [ScheduleResponseDto],
  })
  async getMyChildSchedules(@Request() req: any) {
    // Get parent's children
    const parent = await this.schedulesService['prisma'].parent.findUnique({
      where: { userId: req.user.id },
      include: {
        children: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!parent) {
      return [];
    }

    // Get schedules for all children
    const allSchedules: ScheduleResponseDto[] = [];
    for (const child of parent.children) {
      const schedules = await this.schedulesService.findByChildId(child.id);
      allSchedules.push(...schedules);
    }

    return allSchedules;
  }
}