import { ApiProperty } from '@nestjs/swagger';
import { OtpType } from '@prisma/client';
import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsPhoneNumber, IsString } from 'class-validator';

export class CreateOtpDto {
  @ApiProperty({
    example: 'john.doe@example.com',
    description: 'Email address for OTP',
    required: false,
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({
    example: '+254712345678',
    description: 'Phone number for OTP',
    required: false,
  })
  @IsOptional()
  @IsPhoneNumber('KE')
  phone?: string;

  @ApiProperty({
    enum: OtpType,
    example: OtpType.REGISTRATION,
    description: 'Type of OTP',
  })
  @IsEnum(OtpType)
  @IsNotEmpty()
  type: OtpType;

  @ApiProperty({
    example: '{"userId": "clm89djs300s0p29jf9s"}',
    description: 'Additional metadata',
    required: false,
  })
  @IsOptional()
  @IsString()
  metadata?: string;
}