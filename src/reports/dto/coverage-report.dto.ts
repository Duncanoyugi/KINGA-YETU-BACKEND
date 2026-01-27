import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsDateString, IsOptional, IsString, IsNumber, IsArray, IsEnum, IsBoolean } from 'class-validator';

export enum ReportFormat {
  PDF = 'PDF',
  EXCEL = 'EXCEL',
  CSV = 'CSV',
  HTML = 'HTML'
}

export enum ReportFrequency {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  YEARLY = 'YEARLY',
  ON_DEMAND = 'ON_DEMAND'
}

export class CoverageReportRequestDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsDateString()
  startDate: Date;

  @ApiProperty()
  @IsNotEmpty()
  @IsDateString()
  endDate: Date;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  county?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  subCounty?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  facilityId?: string;

  @ApiProperty({ enum: ReportFormat, default: ReportFormat.PDF })
  @IsOptional()
  @IsEnum(ReportFormat)
  format?: ReportFormat;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  includeComparisons?: boolean;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  includeFacilityBreakdown?: boolean;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  includeRecommendations?: boolean;
}

export class CoverageReportResponseDto {
  @ApiProperty()
  reportId: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  period: string;

  @ApiProperty()
  generatedAt: Date;

  @ApiProperty()
  overallCoverage: number;

  @ApiProperty()
  targetCoverage: number;

  @ApiProperty()
  coverageGap: number;

  @ApiProperty()
  totalChildren: number;

  @ApiProperty()
  vaccinatedChildren: number;

  @ApiProperty({ type: [Object] })
  byCounty: Array<{
    county: string;
    coverage: number;
    children: number;
    vaccinated: number;
  }>;

  @ApiProperty({ type: [Object], required: false })
  byFacility?: Array<{
    facilityName: string;
    coverage: number;
    children: number;
    vaccinated: number;
  }>;

  @ApiProperty({ type: [Object], required: false })
  byAgeGroup?: Array<{
    ageGroup: string;
    coverage: number;
    children: number;
    vaccinated: number;
  }>;

  @ApiProperty({ required: false })
  trends?: {
    previousPeriodCoverage: number;
    percentageChange: number;
    direction: 'improving' | 'declining' | 'stable';
  };

  @ApiProperty({ required: false })
  recommendations?: string[];

  @ApiProperty()
  downloadUrl: string;

  @ApiProperty()
  expiresAt: Date;
}