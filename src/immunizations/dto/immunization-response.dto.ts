import { ApiProperty } from '@nestjs/swagger';
import { ImmunizationStatus } from '@prisma/client';

export class ImmunizationResponseDto {
  @ApiProperty({
    example: 'clm89djs300s0p29jf9s',
    description: 'Immunization unique identifier',
  })
  id: string;

  @ApiProperty({
    example: 'clm89djs400s0p29jf0t',
    description: 'Child ID',
  })
  childId: string;

  @ApiProperty({
    example: {
      id: 'clm89djs400s0p29jf0t',
      firstName: 'John',
      lastName: 'Doe',
      dateOfBirth: '2020-01-01T00:00:00.000Z',
    },
    description: 'Child information',
  })
  child: {
    id: string;
    firstName: string;
    lastName: string;
    dateOfBirth: Date;
  };

  @ApiProperty({
    example: 'clm89djs400s0p29jf0t',
    description: 'Vaccine ID',
  })
  vaccineId: string;

  @ApiProperty({
    example: {
      id: 'clm89djs400s0p29jf0t',
      name: 'BCG',
      code: 'BCG',
    },
    description: 'Vaccine information',
  })
  vaccine: {
    id: string;
    name: string;
    code: string;
  };

  @ApiProperty({
    example: 'clm89djs400s0p29jf0t',
    description: 'Facility ID',
  })
  facilityId: string;

  @ApiProperty({
    example: {
      id: 'clm89djs400s0p29jf0t',
      name: 'Westlands Health Center',
      code: 'WHC001',
    },
    description: 'Facility information',
  })
  facility: {
    id: string;
    name: string;
    code: string;
  };

  @ApiProperty({
    example: 'clm89djs400s0p29jf0t',
    description: 'Health worker ID',
  })
  healthWorkerId: string;

  @ApiProperty({
    example: {
      id: 'clm89djs400s0p29jf0t',
      fullName: 'Dr. Jane Smith',
      licenseNumber: 'MOH-12345',
    },
    description: 'Health worker information',
  })
  healthWorker: {
    id: string;
    fullName: string;
    licenseNumber?: string;
  };

  @ApiProperty({
    example: '2024-01-15T10:30:00.000Z',
    description: 'Date administered',
  })
  dateAdministered: Date;

  @ApiProperty({
    example: 30,
    description: 'Age at administration in days',
  })
  ageAtDays: number;

  @ApiProperty({
    enum: ImmunizationStatus,
    example: ImmunizationStatus.ADMINISTERED,
    description: 'Immunization status',
  })
  status: ImmunizationStatus;

  @ApiProperty({
    example: 'LOT123456',
    description: 'Vaccine batch number',
    required: false,
  })
  batchNumber?: string;

  @ApiProperty({
    example: 'Administered without complications',
    description: 'Additional notes',
    required: false,
  })
  notes?: string;

  @ApiProperty({
    example: '2025-01-15T10:30:00.000Z',
    description: 'Vaccine expiration date',
    required: false,
  })
  expirationDate?: Date;

  @ApiProperty({
    example: 'Manufacturer XYZ',
    description: 'Vaccine manufacturer',
    required: false,
  })
  manufacturer?: string;

  @ApiProperty({
    example: 'Left upper arm',
    description: 'Administration site',
    required: false,
  })
  administrationSite?: string;

  @ApiProperty({
    example: '0.5ml',
    description: 'Dosage administered',
    required: false,
  })
  dosage?: string;

  @ApiProperty({
    example: true,
    description: 'Whether adverse reaction occurred',
    required: false,
  })
  hadAdverseReaction?: boolean;

  @ApiProperty({
    example: 'Mild fever and swelling',
    description: 'Details of adverse reaction',
    required: false,
  })
  adverseReactionDetails?: string;

  @ApiProperty({
    example: 'Severe allergic reaction history',
    description: 'Contraindications noted',
    required: false,
  })
  contraindications?: string;

  @ApiProperty({
    example: 'Dr. Jane Smith',
    description: 'Person who administered the vaccine',
    required: false,
  })
  administeredBy?: string;

  @ApiProperty({
    example: '2024-01-01T08:00:00.000Z',
    description: 'Record creation timestamp',
  })
  createdAt: Date;

  @ApiProperty({
    example: '2024-01-15T10:30:00.000Z',
    description: 'Last update timestamp',
  })
  updatedAt: Date;
}

export class PaginatedImmunizationsResponseDto {
  @ApiProperty({
    example: 100,
    description: 'Total number of immunizations',
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
    type: [ImmunizationResponseDto],
    description: 'List of immunizations',
  })
  data: ImmunizationResponseDto[];
}

export class ImmunizationStatsDto {
  @ApiProperty({
    example: 150,
    description: 'Total immunizations administered',
  })
  totalImmunizations: number;

  @ApiProperty({
    example: 140,
    description: 'Administered immunizations',
  })
  administered: number;

  @ApiProperty({
    example: 5,
    description: 'Pending immunizations',
  })
  pending: number;

  @ApiProperty({
    example: 10,
    description: 'Missed immunizations',
  })
  missed: number;

  @ApiProperty({
    example: 2,
    description: 'Contraindicated immunizations',
  })
  contraindicated: number;

  @ApiProperty({
    example: 3,
    description: 'Immunizations with adverse reactions',
  })
  withAdverseReactions: number;

  @ApiProperty({
    example: 140,
    description: 'Timely immunizations',
  })
  timelyImmunizations: number;

  @ApiProperty({
    example: 93.3,
    description: 'Timeliness percentage',
  })
  timelinessPercentage: number;

  @ApiProperty({
    example: 85.0,
    description: 'Coverage percentage',
  })
  coveragePercentage: number;

  @ApiProperty({
    description: 'Monthly trend data',
  })
  monthlyTrend: any[];

  @ApiProperty({
    description: 'Top performing facilities',
  })
  topFacilities: any[];
}
