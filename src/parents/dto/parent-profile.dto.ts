import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsPhoneNumber } from 'class-validator';

export class ParentProfileDto {
  @ApiProperty({
    example: 'Jane Doe',
    description: 'Parent full name',
  })
  @IsString()
  fullName: string;

  @ApiProperty({
    example: 'jane.doe@example.com',
    description: 'Parent email',
  })
  @IsString()
  email: string;

  @ApiProperty({
    example: '+254712345678',
    description: 'Parent phone number',
    required: false,
  })
  @IsOptional()
  @IsPhoneNumber('KE')
  phoneNumber?: string;

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