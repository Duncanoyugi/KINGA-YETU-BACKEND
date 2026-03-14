import { PartialType } from '@nestjs/swagger';
import { IsString, IsEnum, IsOptional, IsBoolean, MinLength, MaxLength, IsEmail } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { HealthFacilityType } from '@prisma/client';
import { CreateFacilityDto } from './create-facility.dto';

export class UpdateFacilityDto extends PartialType(CreateFacilityDto) {
  @ApiPropertyOptional({ example: 'Kenyatta National Hospital' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({ enum: HealthFacilityType, example: HealthFacilityType.HOSPITAL })
  @IsOptional()
  @IsEnum(HealthFacilityType)
  type?: HealthFacilityType;

  @ApiPropertyOptional({ example: 'KNH001' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  code?: string;

  @ApiPropertyOptional({ example: '12345' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  mflCode?: string;

  @ApiPropertyOptional({ example: 'Nairobi' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  county?: string;

  @ApiPropertyOptional({ example: 'Starehe' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  subCounty?: string;

  @ApiPropertyOptional({ example: 'Westlands' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  ward?: string;

  @ApiPropertyOptional({ example: 'P.O Box 12345, Nairobi' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @ApiPropertyOptional({ example: '+254700000000' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @ApiPropertyOptional({ example: 'info@facility.go.ke' })
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
