import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsDateString, IsOptional, IsBoolean } from 'class-validator';

export class GenerateScheduleDto {
  @ApiProperty({
    example: 'clm89djs300s0p29jf9s',
    description: 'Child ID',
  })
  @IsString()
  @IsNotEmpty()
  childId: string;

  @ApiProperty({
    example: '2023-01-15',
    description: 'Date of birth (YYYY-MM-DD)',
  })
  @IsDateString()
  @IsNotEmpty()
  dateOfBirth: string;

  @ApiProperty({
    example: true,
    description: 'Include catch-up schedule for missed vaccines',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  includeCatchup?: boolean;

  @ApiProperty({
    example: true,
    description: 'Generate reminders automatically',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  generateReminders?: boolean;

  @ApiProperty({
    example: 7,
    description: 'Reminder days before due date',
    default: 7,
  })
  @IsOptional()
  reminderDaysBefore?: number;
}

export class RegenerateScheduleDto {
  @ApiProperty({
    example: 'clm89djs300s0p29jf9s',
    description: 'Child ID',
  })
  @IsString()
  @IsNotEmpty()
  childId: string;

  @ApiProperty({
    example: true,
    description: 'Force regeneration even if schedule exists',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  force?: boolean;

  @ApiProperty({
    example: true,
    description: 'Update existing reminders',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  updateReminders?: boolean;
}