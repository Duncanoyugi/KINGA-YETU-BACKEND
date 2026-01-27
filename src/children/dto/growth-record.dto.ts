import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsDateString, IsNumber, Min, Max, IsOptional } from 'class-validator';

export class CreateGrowthRecordDto {
  @ApiProperty({
    example: 'clm89djs300s0p29jf9s',
    description: 'Child ID',
  })
  @IsString()
  @IsNotEmpty()
  childId: string;

  @ApiProperty({
    example: '2024-01-15',
    description: 'Measurement date',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  measurementDate?: string;

  @ApiProperty({
    example: 8.5,
    description: 'Weight in kg',
    minimum: 0.5,
    maximum: 50,
  })
  @IsNumber()
  @Min(0.5)
  @Max(50)
  weight: number;

  @ApiProperty({
    example: 70.5,
    description: 'Height in cm',
    minimum: 30,
    maximum: 200,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(30)
  @Max(200)
  height?: number;

  @ApiProperty({
    example: 'Routine checkup',
    description: 'Measurement notes',
    required: false,
  })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class GrowthRecordResponseDto {
  @ApiProperty({
    example: 'clm89djs300s0p29jf9s',
    description: 'Growth record ID',
  })
  id: string;

  @ApiProperty({
    example: 'clm89djs400s0p29jf0t',
    description: 'Child ID',
  })
  childId: string;

  @ApiProperty({
    example: '2024-01-15T10:30:00.000Z',
    description: 'Measurement date',
  })
  measurementDate: Date;

  @ApiProperty({
    example: 8.5,
    description: 'Weight in kg',
  })
  weight: number;

  @ApiProperty({
    example: 70.5,
    description: 'Height in cm',
    required: false,
  })
  height?: number;

  @ApiProperty({
    example: {
      id: 'clm89djs500s0p29jf1u',
      fullName: 'Dr. John Smith',
      email: 'john.smith@example.com',
    },
    description: 'Recorded by user information',
  })
  recordedBy: {
    id: string;
    fullName: string;
    email: string;
  };

  @ApiProperty({
    example: 'Routine checkup',
    description: 'Measurement notes',
    required: false,
  })
  notes?: string;

  @ApiProperty({
    example: 'Normal',
    description: 'Weight for age category',
  })
  weightForAge: string;

  @ApiProperty({
    example: 'Normal',
    description: 'Height for age category',
    required: false,
  })
  heightForAge?: string;

  @ApiProperty({
    example: 'Normal',
    description: 'Weight for height category',
    required: false,
  })
  weightForHeight?: string;

  @ApiProperty({
    example: '2024-01-15T10:30:00.000Z',
    description: 'Creation timestamp',
  })
  createdAt: Date;

  @ApiProperty({
    example: '2024-01-15T10:30:00.000Z',
    description: 'Last update timestamp',
  })
  updatedAt: Date;
}

export class GrowthChartDataDto {
  @ApiProperty({
    example: '2024-01-15T10:30:00.000Z',
    description: 'Measurement date',
  })
  date: Date;

  @ApiProperty({
    example: 8.5,
    description: 'Weight in kg',
  })
  weight: number;

  @ApiProperty({
    example: 70.5,
    description: 'Height in cm',
    required: false,
  })
  height?: number;

  @ApiProperty({
    example: 25,
    description: 'Weight percentile',
  })
  weightPercentile: number;

  @ApiProperty({
    example: 30,
    description: 'Height percentile',
    required: false,
  })
  heightPercentile?: number;
}