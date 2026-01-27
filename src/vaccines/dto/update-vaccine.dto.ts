import { ApiProperty, PartialType } from '@nestjs/swagger';
import { CreateVaccineDto } from './create-vaccine.dto';
import { IsOptional, IsBoolean, IsString, IsInt, Min } from 'class-validator';

export class UpdateVaccineDto extends PartialType(CreateVaccineDto) {
  @ApiProperty({
    example: 'BCG Updated',
    description: 'Updated vaccine name',
    required: false,
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({
    example: 'Updated description',
    description: 'Updated vaccine description',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    example: 7,
    description: 'Updated recommended age in days',
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  recommendedAgeDays?: number;

  @ApiProperty({
    example: false,
    description: 'Updated active status',
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({
    example: 'Updated administration route',
    description: 'Updated route of administration',
    required: false,
  })
  @IsOptional()
  @IsString()
  administrationRoute?: string;

  @ApiProperty({
    example: 'Updated dosage',
    description: 'Updated dosage information',
    required: false,
  })
  @IsOptional()
  @IsString()
  dosage?: string;
}