import { ApiProperty } from '@nestjs/swagger';
import { UserRole, Gender } from '@prisma/client';
import {
  IsEmail,
  IsString,
  IsNotEmpty,
  MinLength,
  IsEnum,
  IsOptional,
  IsDateString,
  IsPhoneNumber,
  Matches,
} from 'class-validator';

export class CreateUserDto {
  @ApiProperty({
    example: 'john.doe@example.com',
    description: 'User email address',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    example: '+254712345678',
    description: 'User phone number',
    required: false,
  })
  @IsOptional()
  @IsPhoneNumber('KE')
  phoneNumber?: string;

  @ApiProperty({
    example: 'John Doe',
    description: 'Full name of the user',
  })
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @ApiProperty({
    example: 'Password@123',
    description: 'User password (min 8 characters)',
    minLength: 8,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/, {
    message: 'Password must contain at least one uppercase letter, one lowercase letter, one number and one special character',
  })
  password: string;

  @ApiProperty({
    enum: UserRole,
    example: UserRole.PARENT,
    description: 'User role in the system',
    default: UserRole.PARENT,
  })
  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole = UserRole.PARENT;

  @ApiProperty({
    example: '1990-01-01',
    description: 'Date of birth',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @ApiProperty({
    enum: Gender,
    example: Gender.MALE,
    description: 'User gender',
    required: false,
  })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

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
    description: 'Physical address',
    required: false,
  })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({
    example: '12345678',
    description: 'National ID number',
    required: false,
  })
  @IsOptional()
  @IsString()
  idNumber?: string;

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
    example: 'MOH-12345',
    description: 'Health worker license number',
    required: false,
  })
  @IsOptional()
  @IsString()
  licenseNumber?: string;

  @ApiProperty({
    example: 'Registered Nurse',
    description: 'Professional qualification',
    required: false,
  })
  @IsOptional()
  @IsString()
  qualification?: string;

  @ApiProperty({
    example: 'Pediatrics',
    description: 'Specialization area',
    required: false,
  })
  @IsOptional()
  @IsString()
  specialization?: string;

  @ApiProperty({
    example: 'clm89djs300s0p29jf9s',
    description: 'Health facility ID',
    required: false,
  })
  @IsOptional()
  @IsString()
  facilityId?: string;

  @ApiProperty({
    example: 'System Administration',
    description: 'Admin department',
    required: false,
  })
  @IsOptional()
  @IsString()
  department?: string;

  @ApiProperty({
    example: '["users:read", "users:write"]',
    description: 'Admin permissions as JSON array',
    required: false,
  })
  @IsOptional()
  permissions?: string;
}