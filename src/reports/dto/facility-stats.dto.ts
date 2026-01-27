import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsDateString, IsOptional, IsString, IsNumber, IsArray, IsBoolean } from 'class-validator';

export class FacilityStatsRequestDto {
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
  @IsArray()
  facilityIds?: string[];

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  includePerformanceRanking?: boolean;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  includeGrowthMetrics?: boolean;
}

export class FacilityStatsResponseDto {
  @ApiProperty()
  facilityId: string;

  @ApiProperty()
  facilityName: string;

  @ApiProperty()
  county: string;

  @ApiProperty()
  subCounty: string;

  @ApiProperty()
  totalImmunizations: number;

  @ApiProperty()
  coverageRate: number;

  @ApiProperty()
  timelinessRate: number;

  @ApiProperty()
  dropoutRate: number;

  @ApiProperty()
  performanceScore: number;

  @ApiProperty({ required: false })
  ranking?: number;

  @ApiProperty({ required: false })
  totalRanked?: number;

  @ApiProperty()
  period: string;

  @ApiProperty({ type: [Object] })
  monthlyTrends: Array<{
    month: string;
    immunizations: number;
    coverage: number;
  }>;

  @ApiProperty({ type: [Object] })
  vaccineBreakdown: Array<{
    vaccineName: string;
    count: number;
    percentage: number;
  }>;

  @ApiProperty()
  growthRate: number;

  @ApiProperty()
  recommendations: string[];

  @ApiProperty()
  generatedAt: Date;
}