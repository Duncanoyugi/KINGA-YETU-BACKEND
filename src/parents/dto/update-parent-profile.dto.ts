import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsPhoneNumber } from 'class-validator';

export class UpdateParentProfileDto {
  @ApiProperty({
    example: 'Emergency Contact',
    description: 'Emergency contact name',
    required: false,
  })
  @IsOptional()
  @IsString()
  emergencyContact?: string;

  @ApiProperty({
    example: '+254723456789',
    description: 'Emergency contact phone',
    required: false,
  })
  @IsOptional()
  @IsPhoneNumber('KE')
  emergencyPhone?: string;

  @ApiProperty({
    example: 'Nairobi',
    description: 'County of residence',
    required: false,
  })
  @IsOptional()
  @IsString()
  county?: string;

  @ApiProperty({
    example: 'Westlands',
    description: 'Sub-county of residence',
    required: false,
  })
  @IsOptional()
  @IsString()
  subCounty?: string;

  @ApiProperty({
    example: '123 Main Street',
    description: 'Address',
    required: false,
  })
  @IsOptional()
  @IsString()
  address?: string;
}