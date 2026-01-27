import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsDateString, IsOptional, IsString, IsNumber, IsBoolean, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export enum AnalyticsPeriod {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  YEARLY = 'YEARLY',
  CUSTOM = 'CUSTOM'
}

export enum AnalyticsMetric {
  COVERAGE_RATE = 'COVERAGE_RATE',
  DROPOUT_RATE = 'DROPOUT_RATE',
  TIMELINESS = 'TIMELINESS',
  VACCINE_CONSUMPTION = 'VACCINE_CONSUMPTION',
  FACILITY_PERFORMANCE = 'FACILITY_PERFORMANCE',
  DEMOGRAPHIC_DISTRIBUTION = 'DEMOGRAPHIC_DISTRIBUTION',
  GROWTH_TRENDS = 'GROWTH_TRENDS',
  NOTIFICATION_EFFECTIVENESS = 'NOTIFICATION_EFFECTIVENESS'
}

export enum AnalyticsDimension {
  COUNTY = 'COUNTY',
  SUB_COUNTY = 'SUB_COUNTY',
  WARD = 'WARD',
  FACILITY = 'FACILITY',
  AGE_GROUP = 'AGE_GROUP',
  GENDER = 'GENDER',
  VACCINE_TYPE = 'VACCINE_TYPE',
  TIME_PERIOD = 'TIME_PERIOD'
}

export class AnalyticsQueryDto {
  @ApiProperty({ enum: AnalyticsMetric, isArray: true })
  @IsArray()
  @IsEnum(AnalyticsMetric, { each: true })
  metrics: AnalyticsMetric[];

  @ApiProperty({ enum: AnalyticsDimension, isArray: true, required: false })
  @IsOptional()
  @IsArray()
  @IsEnum(AnalyticsDimension, { each: true })
  dimensions?: AnalyticsDimension[];

  @ApiProperty({ enum: AnalyticsPeriod })
  @IsEnum(AnalyticsPeriod)
  period: AnalyticsPeriod;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  startDate?: Date;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  endDate?: Date;

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

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  ageGroupStart?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  ageGroupEnd?: number;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  includePredictions?: boolean;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  includeComparisons?: boolean;
}

export class PredictionQueryDto {
  @ApiProperty({ enum: AnalyticsMetric })
  @IsNotEmpty()
  @IsEnum(AnalyticsMetric)
  targetMetric: AnalyticsMetric;

  @ApiProperty({ enum: AnalyticsPeriod })
  @IsEnum(AnalyticsPeriod)
  forecastPeriod: AnalyticsPeriod;

  @ApiProperty()
  @IsNumber()
  forecastHorizon: number; // Number of periods to forecast

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

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  includeConfidenceIntervals?: boolean;
}

export class OutbreakRiskQueryDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  disease: string;

  @ApiProperty()
  @IsNumber()
  thresholdPercentage: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  startDate?: Date;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  endDate?: Date;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  includeFacilityDetails?: boolean;
}

export class ComparisonQueryDto {
  @ApiProperty()
  @IsDateString()
  baselineStartDate: Date;

  @ApiProperty()
  @IsDateString()
  baselineEndDate: Date;

  @ApiProperty()
  @IsDateString()
  comparisonStartDate: Date;

  @ApiProperty()
  @IsDateString()
  comparisonEndDate: Date;

  @ApiProperty({ enum: AnalyticsMetric })
  @IsEnum(AnalyticsMetric)
  metric: AnalyticsMetric;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  county?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  subCounty?: string;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  includeStatisticalSignificance?: boolean;
}