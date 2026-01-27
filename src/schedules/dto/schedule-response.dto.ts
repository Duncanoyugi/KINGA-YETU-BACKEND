import { ApiProperty } from '@nestjs/swagger';
import { ImmunizationStatus } from '@prisma/client';

export class ScheduleResponseDto {
  @ApiProperty({
    example: 'clm89djs300s0p29jf9s',
    description: 'Schedule ID',
  })
  id: string;

  @ApiProperty({
    example: 'clm89djs400s0p29jf0t',
    description: 'Child ID',
  })
  childId: string;

  @ApiProperty({
    example: {
      id: 'clm89djs500s0p29jf1u',
      firstName: 'John',
      lastName: 'Doe',
      dateOfBirth: '2023-01-15T00:00:00.000Z',
      fullName: 'John Doe',
    },
    description: 'Child information',
  })
  child: {
    id: string;
    firstName: string;
    lastName: string;
    dateOfBirth: Date;
    fullName: string;
  };

  @ApiProperty({
    example: 'clm89djs600s0p29jf2v',
    description: 'Vaccine ID',
  })
  vaccineId: string;

  @ApiProperty({
    example: {
      id: 'clm89djs700s0p29jf3w',
      code: 'BCG',
      name: 'Bacillus Calmette-Guérin',
      recommendedAgeDays: 0,
      description: 'Tuberculosis vaccine',
    },
    description: 'Vaccine information',
  })
  vaccine: {
    id: string;
    code: string;
    name: string;
    recommendedAgeDays: number;
    description?: string;
    minAgeDays?: number;
    maxAgeDays?: number;
    isBirthDose: boolean;
    isBooster: boolean;
  };

  @ApiProperty({
    example: '2023-01-15T00:00:00.000Z',
    description: 'Due date',
  })
  dueDate: Date;

  @ApiProperty({
    enum: ImmunizationStatus,
    example: ImmunizationStatus.SCHEDULED,
    description: 'Schedule status',
  })
  status: ImmunizationStatus;

  @ApiProperty({
    example: 'At birth',
    description: 'Age description',
  })
  ageDescription: string;

  @ApiProperty({
    example: 0,
    description: 'Days until due (negative for overdue)',
  })
  daysUntilDue: number;

  @ApiProperty({
    example: true,
    description: 'Is overdue',
  })
  isOverdue: boolean;

  @ApiProperty({
    example: false,
    description: 'Is upcoming (within 30 days)',
  })
  isUpcoming: boolean;

  @ApiProperty({
    example: true,
    description: 'Is eligible (child is within age range)',
  })
  isEligible: boolean;

  @ApiProperty({
    example: '2024-01-01T10:30:00.000Z',
    description: 'Creation timestamp',
  })
  createdAt: Date;

  @ApiProperty({
    example: '2024-01-15T10:30:00.000Z',
    description: 'Last update timestamp',
  })
  updatedAt: Date;
}

export class PaginatedSchedulesResponseDto {
  @ApiProperty({
    example: 100,
    description: 'Total number of schedules',
  })
  total: number;

  @ApiProperty({
    example: 1,
    description: 'Current page number',
  })
  page: number;

  @ApiProperty({
    example: 10,
    description: 'Number of items per page',
  })
  limit: number;

  @ApiProperty({
    example: 10,
    description: 'Total number of pages',
  })
  totalPages: number;

  @ApiProperty({
    type: [ScheduleResponseDto],
    description: 'List of schedules',
  })
  data: ScheduleResponseDto[];
}

export class ScheduleStatsDto {
  @ApiProperty({
    example: 500,
    description: 'Total schedules',
  })
  totalSchedules: number;

  @ApiProperty({
    example: 400,
    description: 'Scheduled (pending)',
  })
  scheduled: number;

  @ApiProperty({
    example: 50,
    description: 'Administered',
  })
  administered: number;

  @ApiProperty({
    example: 30,
    description: 'Missed',
  })
  missed: number;

  @ApiProperty({
    example: 20,
    description: 'Contraindicated',
  })
  contraindicated: number;

  @ApiProperty({
    example: 100,
    description: 'Overdue schedules',
  })
  overdue: number;

  @ApiProperty({
    example: 50,
    description: 'Upcoming schedules (next 30 days)',
  })
  upcoming: number;

  @ApiProperty({
    example: 75.5,
    description: 'Timeliness percentage (administered on time)',
  })
  timelinessPercentage: number;
}