import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsEnum, IsOptional, IsString, IsObject, IsArray, IsBoolean } from 'class-validator';
import { ReportType, ReportFormat, ReportFrequency } from '@prisma/client';

// Re-export for use in other files
export { ReportFormat, ReportFrequency };

export class CreateReportDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  title: string;

  @ApiProperty({ enum: ReportType })
  @IsEnum(ReportType)
  type: ReportType;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ type: Object, default: {} })
  @IsOptional()
  @IsObject()
  parameters?: Record<string, any>;

  @ApiProperty({ enum: ReportFormat, default: ReportFormat.PDF })
  @IsOptional()
  @IsEnum(ReportFormat)
  format?: ReportFormat;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  scheduledFor?: string;

  @ApiProperty({ enum: ReportFrequency, required: false })
  @IsOptional()
  @IsEnum(ReportFrequency)
  frequency?: ReportFrequency;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  sendNotification?: boolean;
}

export class UpdateReportDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsObject()
  data?: Record<string, any>;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}

export class ScheduleReportDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  reportId: string;

  @ApiProperty({ enum: ReportFrequency })
  @IsEnum(ReportFrequency)
  frequency: ReportFrequency;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  scheduleTime: string; // Cron expression or time

  @ApiProperty({ required: false, default: [] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  recipients?: string[];

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
