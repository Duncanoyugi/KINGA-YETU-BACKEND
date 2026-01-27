import { ApiProperty } from '@nestjs/swagger';
import { Gender } from '@prisma/client';

export class ChildResponseDto {
  @ApiProperty({
    example: 'clm89djs300s0p29jf9s',
    description: 'Child unique identifier',
  })
  id: string;

  @ApiProperty({
    example: 'John',
    description: 'Child first name',
  })
  firstName: string;

  @ApiProperty({
    example: 'Michael',
    description: 'Child middle name',
    required: false,
  })
  middleName?: string;

  @ApiProperty({
    example: 'Doe',
    description: 'Child last name',
  })
  lastName: string;

  @ApiProperty({
    example: '1990-01-01T00:00:00.000Z',
    description: 'Child date of birth',
  })
  dateOfBirth: Date;

  @ApiProperty({
    enum: Gender,
    example: Gender.MALE,
    description: 'Child gender',
  })
  gender: Gender;

  @ApiProperty({
    example: 'BC123456789',
    description: 'Birth certificate number',
    required: false,
  })
  birthCertificateNo?: string;

  @ApiProperty({
    example: 'clm89djs400s0p29jf0t',
    description: 'Unique identifier',
  })
  uniqueIdentifier: string;

  @ApiProperty({
    example: 'clm89djs400s0p29jf0t',
    description: 'Parent ID',
  })
  parentId: string;

  @ApiProperty({
    example: {
      id: 'clm89djs400s0p29jf0t',
      name: 'Westlands Health Center',
      code: 'WHC001',
    },
    description: 'Birth facility information',
    required: false,
  })
  birthFacility?: {
    id: string;
    name: string;
    code: string;
  };

  @ApiProperty({
    example: {
      id: 'clm89djs400s0p29jf0t',
      fullName: 'John Doe',
      email: 'john.doe@example.com',
      phoneNumber: '+1234567890',
    },
    description: 'Parent information',
  })
  parent: {
    id: string;
    fullName: string;
    email: string;
    phoneNumber?: string;
  };

  @ApiProperty({
    example: [
      {
        id: 'clm89djs400s0p29jf0t',
        vaccineId: 'clm89djs400s0p29jf0t',
        vaccineName: 'BCG',
        dateAdministered: '2024-01-15T10:30:00.000Z',
        status: 'ADMINISTERED',
      },
    ],
    description: 'Child immunizations',
    required: false,
  })
  immunizations?: {
    id: string;
    vaccineId: string;
    vaccineName: string;
    dateAdministered: Date;
    status: string;
  }[];

  @ApiProperty({
    example: [
      {
        id: 'clm89djs400s0p29jf0t',
        vaccineId: 'clm89djs400s0p29jf0t',
        vaccineName: 'BCG',
        dueDate: '2024-01-15T10:30:00.000Z',
        status: 'DUE',
      },
    ],
    description: 'Child vaccination schedules',
    required: false,
  })
  schedules?: {
    id: string;
    vaccineId: string;
    vaccineName: string;
    dueDate: Date;
    status: string;
  }[];

  @ApiProperty({
    example: [
      {
        id: 'clm89djs400s0p29jf0t',
        measurementDate: '2024-01-15T10:30:00.000Z',
        weight: 3.5,
        height: 50.0,
      },
    ],
    description: 'Child growth records',
    required: false,
  })
  growthRecords?: {
    id: string;
    measurementDate: Date;
    weight: number;
    height?: number;
  }[];

  @ApiProperty({
    example: '2024-01-01T08:00:00.000Z',
    description: 'Record creation timestamp',
  })
  createdAt: Date;

  @ApiProperty({
    example: 12,
    description: 'Age in months',
  })
  ageInMonths: number;

  @ApiProperty({
    example: '2024-01-15T10:30:00.000Z',
    description: 'Last update timestamp',
  })
  updatedAt: Date;
}

export class PaginatedChildrenResponseDto {
  @ApiProperty({
    example: 100,
    description: 'Total number of children',
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
    type: [ChildResponseDto],
    description: 'List of children',
  })
  data: ChildResponseDto[];
}
