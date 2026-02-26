import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Query, 
  HttpCode, 
  HttpStatus,
  UsePipes,
  ValidationPipe,
  Param,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiParam } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import {
  AnalyticsQueryDto,
  PredictionQueryDto,
  OutbreakRiskQueryDto,
  ComparisonQueryDto,
  AnalyticsMetric,
  AnalyticsPeriod,
} from './dto/analytics-request.dto';
import {
  AnalyticsResponseDto,
  PredictionResponseDto,
  OutbreakRiskResponseDto,
  ComparisonResponseDto,
  SystemStatsDto,
  PerformanceMetricsDto,
} from './dto/analytics-response.dto';

@ApiTags('analytics')
@Controller('analytics')
@UsePipes(new ValidationPipe({ transform: true }))
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Post('query')
  @ApiOperation({ summary: 'Query analytics data with multiple metrics and dimensions' })
  @ApiResponse({ status: 200, type: [AnalyticsResponseDto] })
  async getAnalytics(@Body() queryDto: AnalyticsQueryDto): Promise<AnalyticsResponseDto[]> {
    return this.analyticsService.getAnalytics(queryDto);
  }

  @Post('predict')
  @ApiOperation({ summary: 'Generate predictions for metrics' })
  @ApiResponse({ status: 200, type: PredictionResponseDto })
  async getPredictions(@Body() queryDto: PredictionQueryDto): Promise<PredictionResponseDto> {
    return this.analyticsService.getPredictions(queryDto);
  }

  @Post('outbreak-risk')
  @ApiOperation({ summary: 'Assess outbreak risk for specific diseases' })
  @ApiResponse({ status: 200, type: OutbreakRiskResponseDto })
  async assessOutbreakRisk(@Body() queryDto: OutbreakRiskQueryDto): Promise<OutbreakRiskResponseDto> {
    return this.analyticsService.assessOutbreakRisk(queryDto);
  }

  @Post('compare')
  @ApiOperation({ summary: 'Compare metrics between two time periods' })
  @ApiResponse({ status: 200, type: ComparisonResponseDto })
  async comparePeriods(@Body() queryDto: ComparisonQueryDto): Promise<ComparisonResponseDto> {
    return this.analyticsService.comparePeriods(queryDto);
  }

  @Get('system-stats')
  @ApiOperation({ summary: 'Get overall system statistics' })
  @ApiResponse({ status: 200, type: SystemStatsDto })
  async getSystemStats(): Promise<SystemStatsDto> {
    return this.analyticsService.getSystemStats();
  }

  @Get('performance-metrics')
  @ApiOperation({ summary: 'Get performance metrics and benchmarks' })
  @ApiResponse({ status: 200, type: PerformanceMetricsDto })
  async getPerformanceMetrics(): Promise<PerformanceMetricsDto> {
    return this.analyticsService.getPerformanceMetrics();
  }

  @Get('export')
  @ApiOperation({ summary: 'Export analytics data in different formats' })
  @ApiQuery({ name: 'format', enum: ['csv', 'json', 'excel'], required: false })
  async exportAnalytics(
    @Body() queryDto: AnalyticsQueryDto,
    @Query('format') format: 'csv' | 'json' | 'excel' = 'json',
  ) {
    return this.analyticsService.exportAnalytics(queryDto, format);
  }

  @Get('coverage-rate')
  @ApiOperation({ summary: 'Get immunization coverage rate analytics' })
  @ApiQuery({ name: 'startDate', required: false, type: Date })
  @ApiQuery({ name: 'endDate', required: false, type: Date })
  @ApiQuery({ name: 'county', required: false, type: String })
  async getCoverageRate(
    @Query('startDate') startDate?: Date,
    @Query('endDate') endDate?: Date,
    @Query('county') county?: string,
  ) {
    const query: AnalyticsQueryDto = {
      metrics: [AnalyticsMetric.COVERAGE_RATE],
      period: AnalyticsPeriod.MONTHLY,
      startDate,
      endDate,
      county,
    };
    return this.analyticsService.getAnalytics(query);
  }

  @Get('dropout-rate')
  @ApiOperation({ summary: 'Get dropout rate analytics' })
  @ApiQuery({ name: 'startDate', required: false, type: Date })
  @ApiQuery({ name: 'endDate', required: false, type: Date })
  async getDropoutRate(
    @Query('startDate') startDate?: Date,
    @Query('endDate') endDate?: Date,
  ) {
    const query: AnalyticsQueryDto = {
      metrics: [AnalyticsMetric.DROPOUT_RATE],
      period: AnalyticsPeriod.MONTHLY,
      startDate,
      endDate,
    };
    return this.analyticsService.getAnalytics(query);
  }

  @Get('timeliness')
  @ApiOperation({ summary: 'Get timeliness analytics' })
  @ApiQuery({ name: 'startDate', required: false, type: Date })
  @ApiQuery({ name: 'endDate', required: false, type: Date })
  async getTimeliness(
    @Query('startDate') startDate?: Date,
    @Query('endDate') endDate?: Date,
  ) {
    const query: AnalyticsQueryDto = {
      metrics: [AnalyticsMetric.TIMELINESS],
      period: AnalyticsPeriod.MONTHLY,
      startDate,
      endDate,
    };
    return this.analyticsService.getAnalytics(query);
  }

  @Get('facility-performance/:topN')
  @ApiOperation({ summary: 'Get top performing facilities' })
  @ApiParam({ name: 'topN', type: Number })
  @ApiQuery({ name: 'startDate', required: false, type: Date })
  @ApiQuery({ name: 'endDate', required: false, type: Date })
  async getFacilityPerformance(
    @Param('topN') topN: number,
    @Query('startDate') startDate?: Date,
    @Query('endDate') endDate?: Date,
  ) {
    // This would use a separate service method for facility performance
    return {
      message: `Top ${topN} facilities would be returned here`,
      startDate,
      endDate,
    };
  }

  @Get('dashboard')
  @ApiOperation({ summary: 'Get dashboard summary analytics' })
  async getDashboardSummary() {
    const [systemStats, performanceMetrics] = await Promise.all([
      this.analyticsService.getSystemStats(),
      this.analyticsService.getPerformanceMetrics(),
    ]);

    // Get recent coverage trend
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 6);

    const coverageQuery: AnalyticsQueryDto = {
      metrics: [AnalyticsMetric.COVERAGE_RATE],
      period: AnalyticsPeriod.MONTHLY,
      startDate,
      endDate,
    };

    const coverageAnalytics = await this.analyticsService.getAnalytics(coverageQuery);

    return {
      systemStats,
      performanceMetrics,
      coverageTrend: coverageAnalytics[0]?.dataPoints.slice(-6) || [],
      lastUpdated: new Date(),
    };
  }

  @Get('anomalies')
  @ApiOperation({ summary: 'Detect anomalies in immunization data' })
  @ApiQuery({ name: 'metric', required: true, type: String })
  @ApiQuery({ name: 'threshold', required: false, type: Number })
  async detectAnomalies(
    @Query('metric') metric: string,
    @Query('threshold') threshold: number = 3,
  ) {
    // This would use the prediction model's anomaly detection
    return {
      metric,
      threshold,
      anomalies: [], // Would be populated with actual anomaly detection
      detectedAt: new Date(),
    };
  }

  @Get('trends/:metric')
  @ApiOperation({ summary: 'Analyze trends for a specific metric' })
  @ApiParam({ name: 'metric', type: String })
  @ApiQuery({ name: 'period', required: false, type: String })
  async analyzeTrends(
    @Param('metric') metric: string,
    @Query('period') period: string = '6months',
  ) {
    // This would use trend analysis from the prediction model
    return {
      metric,
      period,
      trend: {
        direction: 'increasing',
        strength: 0.75,
        confidence: 0.85,
      },
      analysis: 'Steady improvement observed over the period',
    };
  }

  @Get('county-dashboard')
  @ApiOperation({ summary: 'Get County Admin Dashboard data' })
  @ApiQuery({ name: 'county', required: false, type: String })
  async getCountyAdminDashboard(@Query('county') county?: string) {
    return this.analyticsService.getCountyAdminDashboard(county);
  }
}
