import { ApiProperty } from '@nestjs/swagger';
import { Gender } from '@prisma/client';
import {
  IsString,
  IsNotEmpty,
  IsDateString,
  IsEnum,
  IsOptional,
  Matches,
  IsPhoneNumber,
  IsUUID,
} from 'class-validator';

export class CreateChildDto {
  @ApiProperty({
    example: 'John',
    description: 'Child first name',
  })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({
    example: 'James',
    description: 'Child middle name',
    required: false,
  })
  @IsOptional()
  @IsString()
  middleName?: string;

  @ApiProperty({
    example: 'Doe',
    description: 'Child last name',
  })
  @IsString()
  @IsNotEmpty()
  lastName: string;

  @ApiProperty({
    example: '2023-01-15',
    description: 'Date of birth (YYYY-MM-DD)',
  })
  @IsDateString()
  @IsNotEmpty()
  dateOfBirth: string;

  @ApiProperty({
    enum: Gender,
    example: Gender.MALE,
    description: 'Child gender',
  })
  @IsEnum(Gender)
  gender: Gender;

  @ApiProperty({
    example: 'KC12345678',
    description: 'Birth certificate number',
    required: false,
  })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z0-9]{8,20}$/, {
    message: 'Birth certificate number must be 8-20 alphanumeric characters',
  })
  birthCertificateNo?: string;

  // parentId is derived server-side from authenticated user
  @ApiProperty({
    description: 'Parent ID (optional - derived from authenticated user for PARENT role)',
    required: false,
  })
  @IsOptional()
  @IsString()
  parentId?: string;

@ApiProperty({
    example: 'Nairobi Hospital',
    description: 'Birth facility name',
    required: false,
  })
  @IsOptional()
  @IsString()
  birthFacilityName?: string;

  @ApiProperty({
    example: 'fac123',
    description: 'Birth facility ID (optional, auto-set from name if provided)',
    required: false,
  })
  @IsOptional()
  @IsUUID('all')
  birthFacilityId?: string;

  @ApiProperty({
    example: '2.5',
    description: 'Birth weight in kg',
    required: false,
  })
  @IsOptional()
  @IsString()
  birthWeight?: string;

  @ApiProperty({
    example: '50',
    description: 'Birth height in cm',
    required: false,
  })
  @IsOptional()
  @IsString()
  birthHeight?: string;

  @ApiProperty({
    example: 'Normal vaginal delivery',
    description: 'Delivery method',
    required: false,
  })
  @IsOptional()
  @IsString()
  deliveryMethod?: string;

  @ApiProperty({
    example: 'Full term',
    description: 'Gestational age',
    required: false,
  })
  @IsOptional()
  @IsString()
  gestationalAge?: string;

  @ApiProperty({
    example: 'No complications',
    description: 'Birth complications',
    required: false,
  })
  @IsOptional()
  @IsString()
  complications?: string;

  @ApiProperty({
    example: 'Healthy newborn, APGAR 9/10',
    description: 'Additional notes/observations',
    required: false,
  })
  @IsOptional()
  @IsString()
  notes?: string;
}

