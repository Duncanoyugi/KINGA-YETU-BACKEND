import { ApiProperty } from '@nestjs/swagger';
import { OtpType } from '@prisma/client';

export class OtpResponseDto {
  @ApiProperty({
    example: 'clm89djs300s0p29jf9s',
    description: 'OTP ID',
  })
  id: string;

  @ApiProperty({
    example: 'john.doe@example.com',
    description: 'Email address',
    required: false,
  })
  email?: string;

  @ApiProperty({
    example: '+254712345678',
    description: 'Phone number',
    required: false,
  })
  phone?: string;

  @ApiProperty({
    example: OtpType.REGISTRATION,
    enum: OtpType,
    description: 'Type of OTP',
  })
  type: OtpType;

  @ApiProperty({
    example: '2024-01-01T10:30:00.000Z',
    description: 'Expiration time',
  })
  expiresAt: Date;

  @ApiProperty({
    example: false,
    description: 'Whether OTP has been used',
  })
  isUsed: boolean;

  @ApiProperty({
    example: '2024-01-01T10:00:00.000Z',
    description: 'Creation time',
  })
  createdAt: Date;

  // Add metadata field
  @ApiProperty({
    example: '{"userId": "clm89djs300s0p29jf9s"}',
    description: 'Additional metadata',
    required: false,
  })
  metadata?: string;
}