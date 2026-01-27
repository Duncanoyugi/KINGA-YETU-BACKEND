import { ApiProperty } from '@nestjs/swagger';
import { AnalyticsMetric, AnalyticsDimension, AnalyticsPeriod } from './analytics-request.dto';

export class AnalyticsDataPointDto {
  @ApiProperty()
  period: string;

  @ApiProperty()
  value: number;

  @ApiProperty({ required: false })
  target?: number;

  @ApiProperty({ required: false })
  baseline?: number;

  @ApiProperty({ required: false })
  confidenceLow?: number;

  @ApiProperty({ required: false })
  confidenceHigh?: number;
}

export class AnalyticsDimensionValueDto {
  @ApiProperty()
  dimension: AnalyticsDimension;

  @ApiProperty()
  value: string;

  @ApiProperty()
  count: number;

  @ApiProperty()
  percentage: number;
}

export class AnalyticsResponseDto {
  @ApiProperty()
  metric: AnalyticsMetric;

  @ApiProperty({ type: [AnalyticsDataPointDto] })
  dataPoints: AnalyticsDataPointDto[];

  @ApiProperty({ required: false })
  average?: number;

  @ApiProperty({ required: false })
  total?: number;

  @ApiProperty({ required: false })
  trend?: number; // Percentage change

  @ApiProperty({ required: false })
  targetAchievement?: number; // Percentage of target achieved

  @ApiProperty({ enum: AnalyticsPeriod })
  period: AnalyticsPeriod;

  @ApiProperty()
  startDate: Date;

  @ApiProperty()
  endDate: Date;

  @ApiProperty({ required: false, type: [AnalyticsDimensionValueDto] })
  breakdown?: AnalyticsDimensionValueDto[];
}

export class PredictionResponseDto {
  @ApiProperty()
  targetMetric: string;

  @ApiProperty({ enum: AnalyticsPeriod })
  forecastPeriod: AnalyticsPeriod;

  @ApiProperty({ type: [AnalyticsDataPointDto] })
  forecast: AnalyticsDataPointDto[];

  @ApiProperty()
  modelAccuracy: number;

  @ApiProperty({ required: false })
  modelName?: string;

  @ApiProperty()
  generatedAt: Date;

  @ApiProperty({ required: false })
  insights?: string[];
}

export class OutbreakRiskResponseDto {
  @ApiProperty()
  disease: string;

  @ApiProperty()
  overallRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

  @ApiProperty()
  riskScore: number;

  @ApiProperty()
  atRiskPopulation: number;

  @ApiProperty()
  coverageGap: number;

  @ApiProperty({ type: [AnalyticsDimensionValueDto] })
  highRiskAreas: AnalyticsDimensionValueDto[];

  @ApiProperty({ required: false, type: [AnalyticsDimensionValueDto] })
  recommendedActions?: AnalyticsDimensionValueDto[];

  @ApiProperty()
  generatedAt: Date;
}

export class ComparisonResponseDto {
  @ApiProperty()
  metric: AnalyticsMetric;

  @ApiProperty()
  baselinePeriod: {
    start: Date;
    end: Date;
    average: number;
    total: number;
  };

  @ApiProperty()
  comparisonPeriod: {
    start: Date;
    end: Date;
    average: number;
    total: number;
  };

  @ApiProperty()
  percentageChange: number;

  @ApiProperty()
  absoluteChange: number;

  @ApiProperty({ required: false })
  statisticalSignificance?: boolean;

  @ApiProperty({ required: false })
  pValue?: number;

  @ApiProperty()
  interpretation: string;
}

export class SystemStatsDto {
  @ApiProperty()
  totalChildren: number;

  @ApiProperty()
  totalParents: number;

  @ApiProperty()
  totalFacilities: number;

  @ApiProperty()
  totalHealthWorkers: number;

  @ApiProperty()
  totalImmunizations: number;

  @ApiProperty()
  totalVaccines: number;

  @ApiProperty()
  activeUsersToday: number;

  @ApiProperty()
  pendingReminders: number;

  @ApiProperty()
  overdueVaccinations: number;

  @ApiProperty()
  systemUptime: number;

  @ApiProperty()
  lastUpdated: Date;
}

export class PerformanceMetricsDto {
  @ApiProperty()
  coverageRate: number;

  @ApiProperty()
  dropoutRate: number;

  @ApiProperty()
  timelinessRate: number;

  @ApiProperty()
  wastageRate: number;

  @ApiProperty()
  notificationSuccessRate: number;

  @ApiProperty()
  dataCompleteness: number;

  @ApiProperty()
  benchmark: number;

  @ApiProperty()
  status: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';

  @ApiProperty()
  generatedAt: Date;
}