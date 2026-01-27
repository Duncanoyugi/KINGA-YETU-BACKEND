import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsDateString,
  IsInt,
  Min,
  IsEnum,
  IsBoolean,
} from 'class-validator';
import { ImmunizationStatus } from '@prisma/client';

export class RecordImmunizationDto {
  @ApiProperty({
    example: 'clm89djs300s0p29jf9s',
    description: 'Child ID',
  })
  @IsString()
  @IsNotEmpty()
  childId: string;

  @ApiProperty({
    example: 'clm89djs400s0p29jf0t',
    description: 'Vaccine ID',
  })
  @IsString()
  @IsNotEmpty()
  vaccineId: string;

  @ApiProperty({
    example: 'clm89djs500s0p29jf1u',
    description: 'Health facility ID',
  })
  @IsString()
  @IsNotEmpty()
  facilityId: string;

  @ApiProperty({
    example: 'clm89djs600s0p29jf2v',
    description: 'Health worker ID',
  })
  @IsString()
  @IsNotEmpty()
  healthWorkerId: string;

  @ApiProperty({
    example: '2024-01-15T10:30:00.000Z',
    description: 'Date and time of administration',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  dateAdministered?: string;

  @ApiProperty({
    example: 42,
    description: 'Child age in days at administration',
    minimum: 0,
  })
  @IsInt()
  @Min(0)
  ageAtDays: number;

  @ApiProperty({
    enum: ImmunizationStatus,
    example: ImmunizationStatus.ADMINISTERED,
    description: 'Immunization status',
    default: ImmunizationStatus.ADMINISTERED,
  })
  @IsOptional()
  @IsEnum(ImmunizationStatus)
  status?: ImmunizationStatus;

  @ApiProperty({
    example: 'ABC123456',
    description: 'Vaccine batch/lot number',
    required: false,
  })
  @IsOptional()
  @IsString()
  batchNumber?: string;

  @ApiProperty({
    example: '2024-12-31',
    description: 'Vaccine expiration date',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  expirationDate?: string;

  @ApiProperty({
    example: 'Manufacturer XYZ',
    description: 'Vaccine manufacturer',
    required: false,
  })
  @IsOptional()
  @IsString()
  manufacturer?: string;

  @ApiProperty({
    example: 'Left upper arm',
    description: 'Administration site',
    required: false,
  })
  @IsOptional()
  @IsString()
  administrationSite?: string;

  @ApiProperty({
    example: '0.5ml',
    description: 'Dosage administered',
    required: false,
  })
  @IsOptional()
  @IsString()
  dosage?: string;

  @ApiProperty({
    example: 'No adverse reactions',
    description: 'Notes/observations',
    required: false,
  })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({
    example: false,
    description: 'Was there any adverse reaction?',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  hadAdverseReaction?: boolean;

  @ApiProperty({
    example: 'Mild fever',
    description: 'Adverse reaction details',
    required: false,
  })
  @IsOptional()
  @IsString()
  adverseReactionDetails?: string;

  @ApiProperty({
    example: 'No',
    description: 'Contraindications noted',
    required: false,
  })
  @IsOptional()
  @IsString()
  contraindications?: string;

  @ApiProperty({
    example: 'Dr. Jane Smith',
    description: 'Name of administering health worker',
    required: false,
  })
  @IsOptional()
  @IsString()
  administeredBy?: string;
}