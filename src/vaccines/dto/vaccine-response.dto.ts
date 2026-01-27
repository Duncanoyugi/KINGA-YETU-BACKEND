import { ApiProperty } from '@nestjs/swagger';

export class VaccineResponseDto {
  @ApiProperty({
    example: 'clm89djs300s0p29jf9s',
    description: 'Vaccine ID',
  })
  id: string;

  @ApiProperty({
    example: 'BCG',
    description: 'Vaccine code',
  })
  code: string;

  @ApiProperty({
    example: 'Bacillus Calmette-Guérin',
    description: 'Vaccine name',
  })
  name: string;

  @ApiProperty({
    example: 'Tuberculosis vaccine given at birth',
    description: 'Vaccine description',
    required: false,
  })
  description?: string;

  @ApiProperty({
    example: 0,
    description: 'Recommended age in days',
  })
  recommendedAgeDays: number;

  @ApiProperty({
    example: 0,
    description: 'Minimum age in days',
    required: false,
  })
  minAgeDays?: number;

  @ApiProperty({
    example: 30,
    description: 'Maximum age in days',
    required: false,
  })
  maxAgeDays?: number;

  @ApiProperty({
    example: true,
    description: 'Is birth dose',
  })
  isBirthDose: boolean;

  @ApiProperty({
    example: false,
    description: 'Is booster dose',
  })
  isBooster: boolean;

  @ApiProperty({
    example: 'Live attenuated',
    description: 'Vaccine type',
    required: false,
  })
  vaccineType?: string;

  @ApiProperty({
    example: 'Intradermal',
    description: 'Route of administration',
    required: false,
  })
  administrationRoute?: string;

  @ApiProperty({
    example: 'Left upper arm',
    description: 'Administration site',
    required: false,
  })
  administrationSite?: string;

  @ApiProperty({
    example: '0.05ml',
    description: 'Dosage',
    required: false,
  })
  dosage?: string;

  @ApiProperty({
    example: 'Single dose',
    description: 'Doses required',
    required: false,
  })
  dosesRequired?: string;

  @ApiProperty({
    example: 'Tuberculosis',
    description: 'Disease prevented',
    required: false,
  })
  diseasePrevented?: string;

  @ApiProperty({
    example: 'Manufacturer XYZ',
    description: 'Manufacturer',
    required: false,
  })
  manufacturer?: string;

  @ApiProperty({
    example: 'Store at 2-8°C',
    description: 'Storage requirements',
    required: false,
  })
  storageRequirements?: string;

  @ApiProperty({
    example: 'Mild fever',
    description: 'Side effects',
    required: false,
  })
  sideEffects?: string;

  @ApiProperty({
    example: 'Severe immunodeficiency',
    description: 'Contraindications',
    required: false,
  })
  contraindications?: string;

  @ApiProperty({
    example: true,
    description: 'Is active',
  })
  isActive: boolean;

  @ApiProperty({
    example: 100,
    description: 'Total administrations recorded',
  })
  totalAdministrations: number;

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

export class PaginatedVaccinesResponseDto {
  @ApiProperty({
    example: 50,
    description: 'Total number of vaccines',
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
    example: 5,
    description: 'Total number of pages',
  })
  totalPages: number;

  @ApiProperty({
    type: [VaccineResponseDto],
    description: 'List of vaccines',
  })
  data: VaccineResponseDto[];
}

export class VaccineStatsDto {
  @ApiProperty({
    example: 50,
    description: 'Total vaccines',
  })
  totalVaccines: number;

  @ApiProperty({
    example: 45,
    description: 'Active vaccines',
  })
  activeVaccines: number;

  @ApiProperty({
    example: 5,
    description: 'Birth dose vaccines',
  })
  birthDoseVaccines: number;

  @ApiProperty({
    example: 10,
    description: 'Booster vaccines',
  })
  boosterVaccines: number;

  @ApiProperty({
    example: 1000,
    description: 'Total administrations',
  })
  totalAdministrations: number;

  @ApiProperty({
    example: [
      { vaccineName: 'BCG', count: 200 },
      { vaccineName: 'OPV', count: 180 },
    ],
    description: 'Top administered vaccines',
  })
  topAdministered: Array<{
    vaccineName: string;
    vaccineCode: string;
    count: number;
  }>;
}