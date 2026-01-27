import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsDateString } from 'class-validator';

export class VaccineScheduleDto {
  @ApiProperty({
    example: 'BCG',
    description: 'Vaccine code',
  })
  @IsString()
  @IsNotEmpty()
  vaccineCode: string;

  @ApiProperty({
    example: 'Bacillus Calmette-Guérin',
    description: 'Vaccine name',
  })
  @IsString()
  @IsNotEmpty()
  vaccineName: string;

  @ApiProperty({
    example: 0,
    description: 'Recommended age in days',
  })
  @IsNotEmpty()
  recommendedAgeDays: number;

  @ApiProperty({
    example: 'Birth',
    description: 'Recommended age description',
  })
  @IsString()
  @IsNotEmpty()
  ageDescription: string;

  @ApiProperty({
    example: 'Single dose',
    description: 'Dose description',
    required: false,
  })
  @IsOptional()
  @IsString()
  doseDescription?: string;

  @ApiProperty({
    example: 'Protects against tuberculosis',
    description: 'Purpose',
    required: false,
  })
  @IsOptional()
  @IsString()
  purpose?: string;
}

export class ChildVaccineScheduleDto {
  @ApiProperty({
    example: 'clm89djs300s0p29jf9s',
    description: 'Child ID',
  })
  @IsString()
  @IsNotEmpty()
  childId: string;

  @ApiProperty({
    example: 'John Doe',
    description: 'Child name',
  })
  @IsString()
  @IsNotEmpty()
  childName: string;

  @ApiProperty({
    example: '2023-01-15',
    description: 'Child date of birth',
  })
  @IsDateString()
  @IsNotEmpty()
  dateOfBirth: string;

  @ApiProperty({
    type: [VaccineScheduleDto],
    description: 'Vaccine schedule',
  })
  vaccines: VaccineScheduleDto[];
}