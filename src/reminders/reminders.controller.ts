import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Patch, 
  Param, 
  Delete, 
  Query, 
  UsePipes, 
  ValidationPipe,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
  ParseBoolPipe 
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiParam, ApiBody } from '@nestjs/swagger';
import { RemindersService } from './reminders.service';
import { 
  CreateReminderDto, 
  UpdateReminderDto, 
  GenerateRemindersDto, 
  SendReminderDto,
  ReminderFilterDto 
} from './dto/reminder-request.dto';
import { 
  ReminderResponseDto, 
  ReminderStatsDto, 
  ReminderSummaryDto,
  BulkReminderResponseDto 
} from './dto/reminder-response.dto';

@ApiTags('reminders')
@Controller('reminders')
@UsePipes(new ValidationPipe({ transform: true }))
export class RemindersController {
  constructor(private readonly remindersService: RemindersService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new reminder' })
  @ApiResponse({ status: 201, type: ReminderResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 404, description: 'Child, parent or vaccine not found' })
  create(@Body() createReminderDto: CreateReminderDto) {
    return this.remindersService.create(createReminderDto);
  }

  @Post('bulk')
  @ApiOperation({ summary: 'Create multiple reminders in bulk' })
  @ApiBody({ type: [CreateReminderDto] })
  @ApiResponse({ status: 201, type: BulkReminderResponseDto })
  bulkCreate(@Body() reminders: CreateReminderDto[]) {
    return this.remindersService.bulkCreate(reminders);
  }

  @Get()
  @ApiOperation({ summary: 'Get all reminders with pagination and filters' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, type: [ReminderResponseDto] })
  findAll(
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
    @Query() filters?: ReminderFilterDto,
  ) {
    return this.remindersService.findAll(page, limit, filters);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Get summary of reminders' })
  @ApiResponse({ status: 200, type: ReminderSummaryDto })
  getSummary() {
    return this.remindersService.getSummary();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific reminder by ID' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, type: ReminderResponseDto })
  @ApiResponse({ status: 404, description: 'Reminder not found' })
  findOne(@Param('id') id: string) {
    return this.remindersService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a reminder' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, type: ReminderResponseDto })
  @ApiResponse({ status: 404, description: 'Reminder not found' })
  update(@Param('id') id: string, @Body() updateReminderDto: UpdateReminderDto) {
    return this.remindersService.update(id, updateReminderDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a reminder' })
  @ApiParam({ name: 'id', type: String })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiResponse({ status: 204, description: 'Reminder deleted successfully' })
  remove(@Param('id') id: string) {
    return this.remindersService.remove(id);
  }

  @Post('generate')
  @ApiOperation({ summary: 'Generate reminders for upcoming vaccinations' })
  @ApiResponse({ status: 201, description: 'Reminders generated successfully' })
  generateReminders(@Body() generateDto: GenerateRemindersDto) {
    return this.remindersService.generateReminders(generateDto);
  }

  @Post('send')
  @ApiOperation({ summary: 'Send a specific reminder immediately' })
  @ApiResponse({ status: 200, type: ReminderResponseDto })
  sendReminder(@Body() sendDto: SendReminderDto) {
    return this.remindersService.sendReminder(sendDto);
  }

  @Post('send-bulk')
  @ApiOperation({ summary: 'Send multiple reminders immediately' })
  @ApiBody({ type: [String] })
  @ApiResponse({ status: 200, type: BulkReminderResponseDto })
  sendBulkReminders(@Body() reminderIds: string[]) {
    return this.remindersService.sendBulkReminders(reminderIds);
  }

  @Get('child/:childId')
  @ApiOperation({ summary: 'Get all reminders for a specific child' })
  @ApiParam({ name: 'childId', type: String })
  @ApiQuery({ name: 'includePast', required: false, type: Boolean })
  @ApiResponse({ status: 200, type: [ReminderResponseDto] })
  getChildReminders(
    @Param('childId') childId: string,
    @Query('includePast', new ParseBoolPipe({ optional: true })) includePast?: boolean,
  ) {
    return this.remindersService.getChildReminders(childId, includePast);
  }

  @Get('parent/:parentId')
  @ApiOperation({ summary: 'Get all reminders for a specific parent' })
  @ApiParam({ name: 'parentId', type: String })
  @ApiResponse({ status: 200, type: [ReminderResponseDto] })
  getParentReminders(@Param('parentId') parentId: string) {
    return this.remindersService.getParentReminders(parentId);
  }

  @Post(':id/acknowledge')
  @ApiOperation({ summary: 'Acknowledge a reminder (parent response)' })
  @ApiParam({ name: 'id', type: String })
  @ApiQuery({ name: 'responseNote', required: false, type: String })
  @ApiResponse({ status: 200, type: ReminderResponseDto })
  acknowledgeReminder(
    @Param('id') id: string,
    @Query('responseNote') responseNote?: string,
  ) {
    return this.remindersService.acknowledgeReminder(id, responseNote);
  }

  @Get('stats/summary')
  @ApiOperation({ summary: 'Get reminder statistics' })
  @ApiQuery({ name: 'startDate', required: true, type: Date })
  @ApiQuery({ name: 'endDate', required: true, type: Date })
  @ApiQuery({ name: 'facilityId', required: false, type: String })
  @ApiResponse({ status: 200, type: ReminderStatsDto })
  getStatistics(
    @Query('startDate') startDate: Date,
    @Query('endDate') endDate: Date,
    @Query('facilityId') facilityId?: string,
  ) {
    return this.remindersService.getStatistics(new Date(startDate), new Date(endDate), facilityId);
  }

  @Patch(':id/reschedule')
  @ApiOperation({ summary: 'Reschedule a reminder' })
  @ApiParam({ name: 'id', type: String })
  @ApiQuery({ name: 'newDate', required: true, type: Date })
  @ApiResponse({ status: 200, type: ReminderResponseDto })
  rescheduleReminder(
    @Param('id') id: string,
    @Query('newDate') newDate: Date,
  ) {
    return this.remindersService.rescheduleReminder(id, new Date(newDate));
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Cancel a reminder' })
  @ApiParam({ name: 'id', type: String })
  @ApiQuery({ name: 'reason', required: false, type: String })
  @ApiResponse({ status: 200, type: ReminderResponseDto })
  cancelReminder(
    @Param('id') id: string,
    @Query('reason') reason?: string,
  ) {
    return this.remindersService.cancelReminder(id, reason);
  }

  @Get('pending/overdue')
  @ApiOperation({ summary: 'Get overdue pending reminders' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, type: [ReminderResponseDto] })
  getOverdueReminders(
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    return this.remindersService.findAll(page, limit, { overdueOnly: true });
  }
}