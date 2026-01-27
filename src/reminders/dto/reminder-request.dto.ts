import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsDateString, IsString, IsOptional, IsNumber, IsBoolean } from 'class-validator';
import { ReminderType, ReminderStatus } from '@prisma/client';

export class CreateReminderDto {
  @ApiProperty({ description: 'Child ID for whom the reminder is created' })
  @IsNotEmpty()
  @IsString()
  childId: string;

  @ApiProperty({ description: 'Parent ID who will receive the reminder' })
  @IsNotEmpty()
  @IsString()
  parentId: string;

  @ApiProperty({ description: 'Vaccine ID related to this reminder' })
  @IsNotEmpty()
  @IsString()
  vaccineId: string;

  @ApiProperty({ description: 'Schedule ID (optional) related to this reminder' })
  @IsOptional()
  @IsString()
  scheduleId?: string;

  @ApiProperty({ enum: ReminderType, description: 'Type of reminder' })
  @IsEnum(ReminderType)
  type: ReminderType;

  @ApiProperty({ description: 'When the reminder should be sent' })
  @IsDateString()
  scheduledFor: Date;

  @ApiProperty({ required: false, description: 'Custom message for the reminder' })
  @IsOptional()
  @IsString()
  customMessage?: string;

  @ApiProperty({ description: 'Priority level (1-5, where 1 is highest)' })
  @IsNumber()
  @IsNotEmpty()
  priority: number;

  @ApiProperty({ required: false, description: 'Health facility ID' })
  @IsOptional()
  @IsString()
  facilityId?: string;

  @ApiProperty({ description: 'Reminder message' })
  @IsNotEmpty()
  @IsString()
  message: string;
}

export class UpdateReminderDto {
  @ApiProperty({ required: false, enum: ReminderStatus })
  @IsOptional()
  @IsEnum(ReminderStatus)
  status?: ReminderStatus;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  sentAt?: Date;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  batchNumber?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  acknowledged?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  responseNote?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  retryCount?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  errorMessage?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  metadata?: string;
}

export class GenerateRemindersDto {
  @ApiProperty({ description: 'Start date for generating reminders' })
  @IsDateString()
  startDate: Date;

  @ApiProperty({ description: 'End date for generating reminders' })
  @IsDateString()
  endDate: Date;

  @ApiProperty({ required: false, description: 'Specific facility ID to generate for' })
  @IsOptional()
  @IsString()
  facilityId?: string;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  includeEscalated?: boolean;

  @ApiProperty({ required: false, enum: ReminderType, isArray: true })
  @IsOptional()
  @IsEnum(ReminderType, { each: true })
  reminderTypes?: ReminderType[];
}

export class SendReminderDto {
  @ApiProperty({ description: 'Reminder ID to send' })
  @IsNotEmpty()
  @IsString()
  reminderId: string;

  @ApiProperty({ required: false, enum: ReminderType })
  @IsOptional()
  @IsEnum(ReminderType)
  forceType?: ReminderType;
}

export class ReminderFilterDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  childId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  parentId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  facilityId?: string;

  @ApiProperty({ required: false, enum: ReminderStatus })
  @IsOptional()
  @IsEnum(ReminderStatus)
  status?: ReminderStatus;

  @ApiProperty({ required: false, enum: ReminderType })
  @IsOptional()
  @IsEnum(ReminderType)
  type?: ReminderType;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  startDate?: Date;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  endDate?: Date;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  overdueOnly?: boolean;
}