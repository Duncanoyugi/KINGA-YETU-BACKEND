import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  Min,
  IsBoolean,
} from 'class-validator';

export class CreateVaccineDto {
  @ApiProperty({
    example: 'BCG',
    description: 'Vaccine code (unique identifier)',
  })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({
    example: 'Bacillus Calmette-Guérin',
    description: 'Vaccine name',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    example: 'Tuberculosis vaccine given at birth',
    description: 'Vaccine description',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    example: 0,
    description: 'Recommended age in days (from birth)',
    minimum: 0,
  })
  @IsInt()
  @Min(0)
  recommendedAgeDays: number;

  @ApiProperty({
    example: 0,
    description: 'Minimum age in days (earliest acceptable)',
    required: false,
    minimum: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  minAgeDays?: number;

  @ApiProperty({
    example: 30,
    description: 'Maximum age in days (latest acceptable)',
    required: false,
    minimum: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  maxAgeDays?: number;

  @ApiProperty({
    example: true,
    description: 'Is this a birth dose vaccine?',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isBirthDose?: boolean;

  @ApiProperty({
    example: false,
    description: 'Is this a booster dose?',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isBooster?: boolean;

  @ApiProperty({
    example: 'Live attenuated vaccine',
    description: 'Vaccine type/category',
    required: false,
  })
  @IsOptional()
  @IsString()
  vaccineType?: string;

  @ApiProperty({
    example: 'Intradermal',
    description: 'Route of administration',
    required: false,
  })
  @IsOptional()
  @IsString()
  administrationRoute?: string;

  @ApiProperty({
    example: 'Left upper arm',
    description: 'Recommended administration site',
    required: false,
  })
  @IsOptional()
  @IsString()
  administrationSite?: string;

  @ApiProperty({
    example: '0.05ml',
    description: 'Dosage',
    required: false,
  })
  @IsOptional()
  @IsString()
  dosage?: string;

  @ApiProperty({
    example: 'Single dose',
    description: 'Number of doses required',
    required: false,
  })
  @IsOptional()
  @IsString()
  dosesRequired?: string;

  @ApiProperty({
    example: 'Protects against tuberculosis',
    description: 'Disease prevented',
    required: false,
  })
  @IsOptional()
  @IsString()
  diseasePrevented?: string;

  @ApiProperty({
    example: 'Manufacturer XYZ',
    description: 'Manufacturer information',
    required: false,
  })
  @IsOptional()
  @IsString()
  manufacturer?: string;

  @ApiProperty({
    example: 'Store at 2-8°C',
    description: 'Storage requirements',
    required: false,
  })
  @IsOptional()
  @IsString()
  storageRequirements?: string;

  @ApiProperty({
    example: 'Mild fever, soreness at injection site',
    description: 'Common side effects',
    required: false,
  })
  @IsOptional()
  @IsString()
  sideEffects?: string;

  @ApiProperty({
    example: 'Severe immunodeficiency',
    description: 'Contraindications',
    required: false,
  })
  @IsOptional()
  @IsString()
  contraindications?: string;

  @ApiProperty({
    example: true,
    description: 'Is the vaccine currently active/available?',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}