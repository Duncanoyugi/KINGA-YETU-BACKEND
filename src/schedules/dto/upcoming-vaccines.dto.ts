import { ApiProperty } from '@nestjs/swagger';

export class UpcomingVaccineDto {
  @ApiProperty({
    example: 'clm89djs300s0p29jf9s',
    description: 'Schedule ID',
  })
  scheduleId: string;

  @ApiProperty({
    example: 'BCG',
    description: 'Vaccine code',
  })
  vaccineCode: string;

  @ApiProperty({
    example: 'Bacillus Calmette-Guérin',
    description: 'Vaccine name',
  })
  vaccineName: string;

  @ApiProperty({
    example: '2024-02-15T10:30:00.000Z',
    description: 'Due date',
  })
  dueDate: Date;

  @ApiProperty({
    example: 15,
    description: 'Days until due',
  })
  daysUntilDue: number;

  @ApiProperty({
    example: 'John Doe',
    description: 'Child name',
  })
  childName: string;

  @ApiProperty({
    example: 'clm89djs400s0p29jf0t',
    description: 'Child ID',
  })
  childId: string;

  @ApiProperty({
    example: '2023-01-15T00:00:00.000Z',
    description: 'Child date of birth',
  })
  childDateOfBirth: Date;

  @ApiProperty({
    example: 'At birth',
    description: 'Recommended age',
  })
  recommendedAge: string;

  @ApiProperty({
    example: 'Jane Doe',
    description: 'Parent name',
  })
  parentName: string;

  @ApiProperty({
    example: 'jane.doe@example.com',
    description: 'Parent email',
  })
  parentEmail: string;

  @ApiProperty({
    example: '+254712345678',
    description: 'Parent phone',
  })
  parentPhone?: string;
}

export class UpcomingVaccinesResponseDto {
  @ApiProperty({
    example: 50,
    description: 'Total upcoming vaccines',
  })
  total: number;

  @ApiProperty({
    example: 10,
    description: 'Vaccines due this week',
  })
  thisWeek: number;

  @ApiProperty({
    example: 20,
    description: 'Vaccines due next week',
  })
  nextWeek: number;

  @ApiProperty({
    example: 20,
    description: 'Vaccines due this month',
  })
  thisMonth: number;

  @ApiProperty({
    type: [UpcomingVaccineDto],
    description: 'Upcoming vaccines',
  })
  vaccines: UpcomingVaccineDto[];
}

export class FacilityUpcomingVaccinesDto {
  @ApiProperty({
    example: 'clm89djs300s0p29jf9s',
    description: 'Facility ID',
  })
  facilityId: string;

  @ApiProperty({
    example: 'Nairobi Hospital',
    description: 'Facility name',
  })
  facilityName: string;

  @ApiProperty({
    example: 100,
    description: 'Total upcoming vaccines',
  })
  totalUpcoming: number;

  @ApiProperty({
    type: [UpcomingVaccineDto],
    description: 'Upcoming vaccines',
  })
  vaccines: UpcomingVaccineDto[];
}