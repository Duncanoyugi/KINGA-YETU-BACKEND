import { IsString, IsEnum, IsOptional, IsBoolean, MinLength, MaxLength, IsEmail } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { HealthFacilityType } from '@prisma/client';

export class CreateFacilityDto {
  @ApiProperty({ example: 'Kenyatta National Hospital' })
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  name: string;

  @ApiProperty({ enum: HealthFacilityType, example: HealthFacilityType.HOSPITAL })
  @IsEnum(HealthFacilityType)
  type: HealthFacilityType;

  @ApiProperty({ example: 'KNH001' })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  code: string;

  @ApiPropertyOptional({ example: '12345' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  mflCode?: string;

  @ApiProperty({ example: 'Nairobi' })
  @IsString()
  @MaxLength(100)
  county: string;

  @ApiProperty({ example: 'Starehe' })
  @IsString()
  @MaxLength(100)
  subCounty: string;

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

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean = true;
}
