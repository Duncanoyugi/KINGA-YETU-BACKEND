import { ApiProperty } from '@nestjs/swagger';
import { UserRole, Gender } from '@prisma/client';

export class UserResponseDto {
  @ApiProperty({
    example: 'clm89djs300s0p29jf9s',
    description: 'User unique identifier',
  })
  id: string;

  @ApiProperty({
    example: 'john.doe@example.com',
    description: 'User email address',
  })
  email: string;

  @ApiProperty({
    example: '+254712345678',
    description: 'User phone number',
    required: false,
  })
  phoneNumber?: string;

  @ApiProperty({
    example: 'John Doe',
    description: 'Full name of the user',
  })
  fullName: string;

  @ApiProperty({
    enum: UserRole,
    example: UserRole.PARENT,
    description: 'User role in the system',
  })
  role: UserRole;

  @ApiProperty({
    example: true,
    description: 'Account active status',
  })
  isActive: boolean;

  @ApiProperty({
    example: true,
    description: 'Email verification status',
  })
  isEmailVerified: boolean;

  @ApiProperty({
    example: true,
    description: 'Phone verification status',
  })
  isPhoneVerified: boolean;

  @ApiProperty({
    example: '2024-01-15T10:30:00.000Z',
    description: 'Last login timestamp',
    required: false,
  })
  lastLoginAt?: Date;

  @ApiProperty({
    example: '2024-01-01T08:00:00.000Z',
    description: 'Account creation timestamp',
  })
  createdAt: Date;

  @ApiProperty({
    example: '2024-01-15T10:30:00.000Z',
    description: 'Last update timestamp',
  })
  updatedAt: Date;

  @ApiProperty({
    example: {
      dateOfBirth: '1990-01-01T00:00:00.000Z',
      gender: 'MALE',
      county: 'Nairobi',
      subCounty: 'Westlands',
      address: '123 Main Street',
    },
    description: 'User profile information',
    required: false,
  })
  profile?: {
    dateOfBirth?: Date;
    gender?: Gender;
    profilePicture?: string;
    address?: string;
    county?: string;
    subCounty?: string;
    ward?: string;
    idNumber?: string;
  };

  @ApiProperty({
    example: {
      emergencyContact: 'Jane Doe',
      emergencyPhone: '+254723456789',
    },
    description: 'Parent-specific information',
    required: false,
  })
  parentProfile?: {
    emergencyContact?: string;
    emergencyPhone?: string;
  };

  @ApiProperty({
    example: {
      licenseNumber: 'MOH-12345',
      qualification: 'Registered Nurse',
      specialization: 'Pediatrics',
      facility: {
        id: 'clm89djs400s0p29jf0t',
        name: 'Westlands Health Center',
      },
    },
    description: 'Health worker information',
    required: false,
  })
  healthWorker?: {
    licenseNumber?: string;
    qualification?: string;
    specialization?: string;
    facility?: {
      id: string;
      name: string;
      code: string;
    };
  };

  @ApiProperty({
    example: {
      department: 'System Administration',
      permissions: '["*"]',
    },
    description: 'Admin profile information',
    required: false,
  })
  adminProfile?: {
    department?: string;
    permissions: string;
  };
}

export class PaginatedUsersResponseDto {
  @ApiProperty({
    example: 100,
    description: 'Total number of users',
  })
  total: number;

  @ApiProperty({
    example: 1,
    description: 'Current page number',
  })
  page: number;

  @ApiProperty({
    example: 10,
    description: 'Number of items per page',
  })
  limit: number;

  @ApiProperty({
    example: 10,
    description: 'Total number of pages',
  })
  totalPages: number;

  @ApiProperty({
    type: [UserResponseDto],
    description: 'List of users',
  })
  data: UserResponseDto[];
}