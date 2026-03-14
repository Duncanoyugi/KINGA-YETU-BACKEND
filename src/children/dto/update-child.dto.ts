import { ApiProperty, PartialType } from '@nestjs/swagger';
import { CreateChildDto } from './create-child.dto';
import { IsOptional, IsString, IsDateString, IsEnum, IsUUID } from 'class-validator';
import { Gender } from '@prisma/client';

export class UpdateChildDto extends PartialType(CreateChildDto) {
  @ApiProperty({
    example: 'John Michael',
    description: 'Updated first name',
    required: false,
  })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiProperty({
    example: 'James',
    description: 'Updated middle name',
    required: false,
  })
  @IsOptional()
  @IsString()
  middleName?: string;

  @ApiProperty({
    example: 'Doe',
    description: 'Updated last name',
    required: false,
  })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiProperty({
    example: '2023-01-15',
    description: 'Updated date of birth',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @ApiProperty({
    enum: Gender,
    example: Gender.MALE,
    description: 'Updated gender',
    required: false,
  })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @ApiProperty({
    example: 'KC12345678',
    description: 'Updated birth certificate number',
    required: false,
  })
  @IsOptional()
  @IsString()
birthCertificateNo?: string;

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
}
