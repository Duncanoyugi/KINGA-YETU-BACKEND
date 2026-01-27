import { ApiProperty } from '@nestjs/swagger';

export class ParentResponseDto {
  @ApiProperty({
    example: 'clm89djs300s0p29jf9s',
    description: 'Parent ID',
  })
  id: string;

  @ApiProperty({
    example: 'clm89djs400s0p29jf0t',
    description: 'User ID',
  })
  userId: string;

  @ApiProperty({
    example: 'Jane Doe',
    description: 'Parent full name',
  })
  fullName: string;

  @ApiProperty({
    example: 'jane.doe@example.com',
    description: 'Parent email',
  })
  email: string;

  @ApiProperty({
    example: '+254712345678',
    description: 'Parent phone number',
    required: false,
  })
  phoneNumber?: string;

  @ApiProperty({
    example: 'Emergency Contact',
    description: 'Emergency contact name',
    required: false,
  })
  emergencyContact?: string;

  @ApiProperty({
    example: '+254723456789',
    description: 'Emergency contact phone',
    required: false,
  })
  emergencyPhone?: string;

  @ApiProperty({
    example: [
      {
        id: 'clm89djs500s0p29jf1u',
        firstName: 'John',
        lastName: 'Doe',
        dateOfBirth: '2023-01-15T00:00:00.000Z',
        gender: 'MALE',
      },
    ],
    description: 'Children',
  })
  children: Array<{
    id: string;
    firstName: string;
    lastName: string;
    dateOfBirth: Date;
    gender: string;
  }>;

  @ApiProperty({
    example: 2,
    description: 'Number of children',
  })
  childrenCount: number;

  @ApiProperty({
    example: 'Nairobi',
    description: 'County of residence',
    required: false,
  })
  county?: string;

  @ApiProperty({
    example: 'Westlands',
    description: 'Sub-county of residence',
    required: false,
  })
  subCounty?: string;

  @ApiProperty({
    example: '123 Main Street',
    description: 'Address',
    required: false,
  })
  address?: string;

  @ApiProperty({
    example: '2024-01-01T10:30:00.000Z',
    description: 'Creation timestamp',
  })
  createdAt: Date;

  @ApiProperty({
    example: '2024-01-15T10:30:00.000Z',
    description: 'Last update timestamp',
  })
  updatedAt: Date;
}

export class PaginatedParentsResponseDto {
  @ApiProperty({
    example: 100,
    description: 'Total number of parents',
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
    type: [ParentResponseDto],
    description: 'List of parents',
  })
  data: ParentResponseDto[];
}