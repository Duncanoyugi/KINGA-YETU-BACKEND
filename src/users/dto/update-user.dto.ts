import { ApiProperty } from '@nestjs/swagger';
import { PartialType } from '@nestjs/swagger';
import { CreateUserDto } from './create-user.dto';
import {
  IsOptional,
  IsEmail,
  IsString,
  IsPhoneNumber,
  IsEnum,
  IsBoolean,
} from 'class-validator';
import { UserRole, Gender } from '@prisma/client';

export class UpdateUserDto extends PartialType(CreateUserDto) {
  @ApiProperty({
    example: 'jane.doe@example.com',
    description: 'Updated email address',
    required: false,
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({
    example: '+254799999999',
    description: 'Updated phone number',
    required: false,
  })
  @IsOptional()
  @IsPhoneNumber('KE')
  phoneNumber?: string;

  @ApiProperty({
    example: 'Jane Doe',
    description: 'Updated full name',
    required: false,
  })
  @IsOptional()
  @IsString()
  fullName?: string;

  @ApiProperty({
    enum: UserRole,
    example: UserRole.HEALTH_WORKER,
    description: 'Updated user role',
    required: false,
  })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiProperty({
    example: true,
    description: 'Account active status',
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({
    example: true,
    description: 'Email verification status',
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  isEmailVerified?: boolean;

  @ApiProperty({
    example: true,
    description: 'Phone verification status',
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  isPhoneVerified?: boolean;

  @ApiProperty({
    enum: Gender,
    example: Gender.FEMALE,
    description: 'Updated gender',
    required: false,
  })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @ApiProperty({
    example: 'Kiambu',
    description: 'Updated county',
    required: false,
  })
  @IsOptional()
  @IsString()
  county?: string;

  @ApiProperty({
    example: 'Kikuyu',
    description: 'Updated sub-county',
    required: false,
  })
  @IsOptional()
  @IsString()
  subCounty?: string;

  @ApiProperty({
    example: '456 New Street',
    description: 'Updated address',
    required: false,
  })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({
    example: '87654321',
    description: 'Updated ID number',
    required: false,
  })
  @IsOptional()
  @IsString()
  idNumber?: string;

  @ApiProperty({
    example: 'New Emergency Contact',
    description: 'Updated emergency contact',
    required: false,
  })
  @IsOptional()
  @IsString()
  emergencyContact?: string;

  @ApiProperty({
    example: '+254788888888',
    description: 'Updated emergency phone',
    required: false,
  })
  @IsOptional()
  @IsPhoneNumber('KE')
  emergencyPhone?: string;

  @ApiProperty({
    example: 'MOH-54321',
    description: 'Updated license number',
    required: false,
  })
  @IsOptional()
  @IsString()
  licenseNumber?: string;

  @ApiProperty({
    example: 'Clinical Officer',
    description: 'Updated qualification',
    required: false,
  })
  @IsOptional()
  @IsString()
  qualification?: string;

  @ApiProperty({
    example: 'Maternal Health',
    description: 'Updated specialization',
    required: false,
  })
  @IsOptional()
  @IsString()
  specialization?: string;

  @ApiProperty({
    example: 'clm89djs400s0p29jf0t',
    description: 'Updated facility ID',
    required: false,
  })
  @IsOptional()
  @IsString()
  facilityId?: string;

  @ApiProperty({
    example: 'Human Resources',
    description: 'Updated admin department',
    required: false,
  })
  @IsOptional()
  @IsString()
  department?: string;

  @ApiProperty({
    example: '["reports:generate", "users:manage"]',
    description: 'Updated permissions',
    required: false,
  })
  @IsOptional()
  @IsString()
  permissions?: string;
}