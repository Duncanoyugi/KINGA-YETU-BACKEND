import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DataMiningService } from './data-mining.service';
import { PredictionModel } from './models/prediction.model';
import {
  AnalyticsQueryDto,
  PredictionQueryDto,
  OutbreakRiskQueryDto,
  ComparisonQueryDto,
} from './dto/analytics-request.dto';
import { AnalyticsDimensionValueDto } from './dto/analytics-response.dto';
import {
  AnalyticsResponseDto,
  PredictionResponseDto,
  OutbreakRiskResponseDto,
  ComparisonResponseDto,
  SystemStatsDto,
  PerformanceMetricsDto,
} from './dto/analytics-response.dto';
import { AnalyticsMetric, AnalyticsPeriod } from './dto/analytics-request.dto';
import moment from 'moment';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly dataMiningService: DataMiningService,
    private readonly predictionModel: PredictionModel,
  ) {}

  /**
   * Get comprehensive analytics data
   */
  async getAnalytics(query: AnalyticsQueryDto): Promise<AnalyticsResponseDto[]> {
    try {
      const { startDate, endDate, period } = this.normalizeDates(
        query.startDate,
        query.endDate,
        query.period,
      );

      const results = await Promise.all(
        query.metrics.map(async (metric) => {
          const dataPoints = await this.dataMiningService.generateTimeSeriesData(
            metric,
            period,
            startDate,
            endDate,
          );

          // Calculate summary statistics
          const values = dataPoints.map(dp => dp.value);
          const average = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
          const total = values.reduce((a, b) => a + b, 0);

          // Calculate trend
          let trend = 0;
          if (values.length >= 2) {
            const firstHalf = values.slice(0, Math.floor(values.length / 2));
            const secondHalf = values.slice(Math.floor(values.length / 2));
            const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
            const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
            trend = avgFirst !== 0 ? ((avgSecond - avgFirst) / avgFirst) * 100 : 0;
          }

          // Get breakdown by dimensions if requested
          let breakdown: AnalyticsDimensionValueDto[] = [];
          if (query.dimensions && query.dimensions.length > 0) {
            for (const dimension of query.dimensions) {
              const dimensionBreakdown = await this.dataMiningService.analyzeDemographicDistribution(
                startDate,
                endDate,
                dimension,
              );
              breakdown.push(...dimensionBreakdown.map(item => ({
                dimension,
                ...item,
              })));
            }
          }

          return {
            metric,
            dataPoints,
            average: Math.round(average * 100) / 100,
            total: Math.round(total * 100) / 100,
            trend: Math.round(trend * 100) / 100,
            period,
            startDate,
            endDate,
            breakdown,
          } as AnalyticsResponseDto;
        }),
      );

      return results;
    } catch (error) {
      this.logger.error(`Error getting analytics: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Generate predictions for metrics
   */
  async getPredictions(query: PredictionQueryDto): Promise<PredictionResponseDto> {
    try {
      // Get historical data for the target metric
      const endDate = new Date();
      const startDate = moment(endDate).subtract(6, 'months').toDate(); // Last 6 months

      const historicalData = await this.dataMiningService.generateTimeSeriesData(
        query.targetMetric as AnalyticsMetric,
        AnalyticsPeriod.MONTHLY,
        startDate,
        endDate,
      );

      // Convert to time series format for prediction model
      const timeSeriesData = historicalData.map(dp => ({
        timestamp: moment(dp.period, 'YYYY-MM').toDate(),
        value: dp.value,
      }));

      // Generate predictions
      const { predictions, confidenceIntervals } = await this.predictionModel.predictLinear(
        timeSeriesData,
        query.forecastHorizon,
      );

      // Generate forecast data points
      const forecast = predictions.map((pred, index) => {
        const forecastDate = moment(endDate).add(index + 1, query.forecastPeriod.toLowerCase() as any);
        
        return {
          period: this.formatPeriod(forecastDate.toDate(), query.forecastPeriod),
          value: Math.round(pred * 100) / 100,
          confidenceLow: confidenceIntervals[index]?.low ? Math.round(confidenceIntervals[index].low * 100) / 100 : undefined,
          confidenceHigh: confidenceIntervals[index]?.high ? Math.round(confidenceIntervals[index].high * 100) / 100 : undefined,
        };
      });

      // Generate insights
      const insights = this.generatePredictionInsights(
        timeSeriesData.map(d => d.value),
        predictions,
        query.targetMetric,
      );

      return {
        targetMetric: query.targetMetric,
        forecastPeriod: query.forecastPeriod,
        forecast,
        modelAccuracy: 0.85, // This would come from model validation
        modelName: 'Linear Regression',
        generatedAt: new Date(),
        insights,
      };
    } catch (error) {
      this.logger.error(`Error generating predictions: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Assess outbreak risk
   */
  async assessOutbreakRisk(query: OutbreakRiskQueryDto): Promise<OutbreakRiskResponseDto> {
    try {
      // Get coverage data for the disease/vaccine
      const endDate = query.endDate || new Date();
      const startDate = query.startDate || moment(endDate).subtract(1, 'year').toDate();

      const coverageData = await this.dataMiningService.calculateCoverageRate(
        startDate,
        endDate,
      );

      // Calculate risk score
      const coverageGap = Math.max(0, 90 - coverageData.coverage); // Assuming 90% target coverage
      const riskScore = Math.min(100, (coverageGap / 90) * 100);

      // Determine risk level
      let overallRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
      if (riskScore > 75) overallRiskLevel = 'CRITICAL';
      else if (riskScore > 50) overallRiskLevel = 'HIGH';
      else if (riskScore > 25) overallRiskLevel = 'MEDIUM';
      else overallRiskLevel = 'LOW';

      // Identify high-risk areas
      const highRiskAreas = await this.dataMiningService.identifyHighRiskPopulations(
        startDate,
        endDate,
        query.thresholdPercentage,
      );

      // Generate recommended actions
      const recommendedActions = this.generateOutbreakRecommendations(
        overallRiskLevel,
        coverageGap,
        highRiskAreas,
      );

      return {
        disease: query.disease,
        overallRiskLevel,
        riskScore: Math.round(riskScore),
        atRiskPopulation: coverageData.eligible - coverageData.vaccinated,
        coverageGap: Math.round(coverageGap * 100) / 100,
        highRiskAreas: highRiskAreas.map(area => ({
          dimension: 'AREA' as any,
          value: area.group,
          count: area.population,
          percentage: area.dropoutRate,
        })),
        recommendedActions,
        generatedAt: new Date(),
      };
    } catch (error) {
      this.logger.error(`Error assessing outbreak risk: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Compare periods
   */
  async comparePeriods(query: ComparisonQueryDto): Promise<ComparisonResponseDto> {
    try {
      // Calculate metric for baseline period
      const baselineData = await this.dataMiningService.generateTimeSeriesData(
        query.metric,
        AnalyticsPeriod.CUSTOM,
        query.baselineStartDate,
        query.baselineEndDate,
      );

      const baselineValues = baselineData.map(dp => dp.value);
      const baselineAverage = baselineValues.length > 0 
        ? baselineValues.reduce((a, b) => a + b, 0) / baselineValues.length 
        : 0;
      const baselineTotal = baselineValues.reduce((a, b) => a + b, 0);

      // Calculate metric for comparison period
      const comparisonData = await this.dataMiningService.generateTimeSeriesData(
        query.metric,
        AnalyticsPeriod.CUSTOM,
        query.comparisonStartDate,
        query.comparisonEndDate,
      );

      const comparisonValues = comparisonData.map(dp => dp.value);
      const comparisonAverage = comparisonValues.length > 0 
        ? comparisonValues.reduce((a, b) => a + b, 0) / comparisonValues.length 
        : 0;
      const comparisonTotal = comparisonValues.reduce((a, b) => a + b, 0);

      // Calculate changes
      const absoluteChange = comparisonAverage - baselineAverage;
      const percentageChange = baselineAverage !== 0 
        ? (absoluteChange / baselineAverage) * 100 
        : (comparisonAverage > 0 ? 100 : 0);

      // Calculate statistical significance (simplified)
      let statisticalSignificance = false;
      let pValue = 0.5; // Placeholder

      if (baselineValues.length >= 2 && comparisonValues.length >= 2) {
        // Simple t-test
        const baselineMean = baselineAverage;
        const comparisonMean = comparisonAverage;
        
        const baselineStd = Math.sqrt(
          baselineValues.reduce((sum, val) => sum + Math.pow(val - baselineMean, 2), 0) / 
          (baselineValues.length - 1)
        );
        
        const comparisonStd = Math.sqrt(
          comparisonValues.reduce((sum, val) => sum + Math.pow(val - comparisonMean, 2), 0) / 
          (comparisonValues.length - 1)
        );

        const se = Math.sqrt(
          (baselineStd * baselineStd / baselineValues.length) + 
          (comparisonStd * comparisonStd / comparisonValues.length)
        );

        const tStat = Math.abs((comparisonMean - baselineMean) / se);
        statisticalSignificance = tStat > 1.96; // For 95% confidence
        pValue = Math.exp(-0.717 * tStat - 0.416 * tStat * tStat); // Approximate
      }

      // Generate interpretation
      const interpretation = this.generateComparisonInterpretation(
        query.metric,
        percentageChange,
        absoluteChange,
        statisticalSignificance,
      );

      return {
        metric: query.metric,
        baselinePeriod: {
          start: query.baselineStartDate,
          end: query.baselineEndDate,
          average: Math.round(baselineAverage * 100) / 100,
          total: Math.round(baselineTotal * 100) / 100,
        },
        comparisonPeriod: {
          start: query.comparisonStartDate,
          end: query.comparisonEndDate,
          average: Math.round(comparisonAverage * 100) / 100,
          total: Math.round(comparisonTotal * 100) / 100,
        },
        percentageChange: Math.round(percentageChange * 100) / 100,
        absoluteChange: Math.round(absoluteChange * 100) / 100,
        statisticalSignificance: query.includeStatisticalSignificance ? statisticalSignificance : undefined,
        pValue: query.includeStatisticalSignificance ? Math.round(pValue * 1000) / 1000 : undefined,
        interpretation,
      };
    } catch (error) {
      this.logger.error(`Error comparing periods: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get system statistics
   */
  async getSystemStats(): Promise<SystemStatsDto> {
    try {
      const [
        totalChildren,
        totalParents,
        totalFacilities,
        totalHealthWorkers,
        totalImmunizations,
        totalVaccines,
        activeUsersToday,
        pendingReminders,
        overdueVaccinations,
      ] = await Promise.all([
        this.prisma.child.count(),
        this.prisma.parent.count(),
        this.prisma.healthFacility.count(),
        this.prisma.healthWorker.count(),
        this.prisma.immunization.count(),
        this.prisma.vaccine.count(),
        this.getActiveUsersToday(),
        this.getPendingRemindersCount(),
        this.getOverdueVaccinationsCount(),
      ]);

      // Calculate system uptime (placeholder)
      const systemUptime = 99.8; // Percentage

      return {
        totalChildren,
        totalParents,
        totalFacilities,
        totalHealthWorkers,
        totalImmunizations,
        totalVaccines,
        activeUsersToday,
        pendingReminders,
        overdueVaccinations,
        systemUptime,
        lastUpdated: new Date(),
      };
    } catch (error) {
      this.logger.error(`Error getting system stats: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get performance metrics
   */
  async getPerformanceMetrics(): Promise<PerformanceMetricsDto> {
    try {
      const endDate = new Date();
      const startDate = moment(endDate).subtract(30, 'days').toDate();

      const [
        coverageData,
        dropoutData,
        timelinessData,
        wastageData,
        notificationData,
      ] = await Promise.all([
        this.dataMiningService.calculateCoverageRate(startDate, endDate),
        this.dataMiningService.calculateDropoutRate(startDate, endDate, ['BCG', 'OPV1', 'OPV2']),
        this.dataMiningService.calculateTimeliness(startDate, endDate),
        this.dataMiningService.calculateWastageRate(startDate, endDate),
        this.getNotificationSuccessRate(startDate, endDate),
      ]);

      // Calculate data completeness (placeholder)
      const dataCompleteness = 92.5;

      // Calculate overall status
      const metrics = {
        coverageRate: coverageData.coverage,
        dropoutRate: dropoutData.dropoutRate,
        timelinessRate: timelinessData.timelinessRate,
        wastageRate: wastageData.wastageRate,
        notificationSuccessRate: notificationData.successRate,
        dataCompleteness,
      };

      const benchmark = 85; // Target benchmark
      const average = Object.values(metrics).reduce((a, b) => a + b, 0) / Object.keys(metrics).length;
      
      let status: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';
      if (average >= 90) status = 'EXCELLENT';
      else if (average >= 80) status = 'GOOD';
      else if (average >= 70) status = 'FAIR';
      else status = 'POOR';

      return {
        ...metrics,
        benchmark,
        status,
        generatedAt: new Date(),
      };
    } catch (error) {
      this.logger.error(`Error getting performance metrics: ${error.message}`);
      throw error;
    }
  }

  /**
   * Export analytics data
   */
  async exportAnalytics(query: AnalyticsQueryDto, format: 'csv' | 'json' | 'excel' = 'json') {
    const analytics = await this.getAnalytics(query);
    
    if (format === 'csv') {
      return this.convertToCSV(analytics);
    } else if (format === 'excel') {
      return this.convertToExcel(analytics);
    }
    
    return analytics;
  }

  // Private helper methods
  private normalizeDates(
    startDate?: Date,
    endDate?: Date,
    period?: AnalyticsPeriod,
  ): { startDate: Date; endDate: Date; period: AnalyticsPeriod } {
    const end = endDate || new Date();
    let start = startDate || moment(end).subtract(1, 'year').toDate();
    const actualPeriod = period || AnalyticsPeriod.MONTHLY;

    // Adjust start date based on period
    if (!startDate) {
      switch (actualPeriod) {
        case AnalyticsPeriod.DAILY:
          start = moment(end).subtract(30, 'days').toDate();
          break;
        case AnalyticsPeriod.WEEKLY:
          start = moment(end).subtract(12, 'weeks').toDate();
          break;
        case AnalyticsPeriod.MONTHLY:
          start = moment(end).subtract(12, 'months').toDate();
          break;
        case AnalyticsPeriod.QUARTERLY:
          start = moment(end).subtract(4, 'quarters').toDate();
          break;
        case AnalyticsPeriod.YEARLY:
          start = moment(end).subtract(5, 'years').toDate();
          break;
      }
    }

    return { startDate: start, endDate: end, period: actualPeriod };
  }

  private formatPeriod(date: Date, period: AnalyticsPeriod): string {
    switch (period) {
      case AnalyticsPeriod.DAILY:
        return moment(date).format('YYYY-MM-DD');
      case AnalyticsPeriod.WEEKLY:
        return `Week ${moment(date).week()}, ${moment(date).year()}`;
      case AnalyticsPeriod.MONTHLY:
        return moment(date).format('YYYY-MM');
      case AnalyticsPeriod.QUARTERLY:
        const quarter = Math.ceil((moment(date).month() + 1) / 3);
        return `Q${quarter} ${moment(date).year()}`;
      case AnalyticsPeriod.YEARLY:
        return moment(date).year().toString();
      default:
        return moment(date).format('YYYY-MM-DD');
    }
  }

  private async getActiveUsersToday(): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return this.prisma.user.count({
      where: {
        lastLoginAt: {
          gte: today,
        },
      },
    });
  }

  private async getPendingRemindersCount(): Promise<number> {
    return this.prisma.reminder.count({
      where: {
        status: 'PENDING',
        scheduledFor: {
          lte: new Date(),
        },
      },
    });
  }

  private async getOverdueVaccinationsCount(): Promise<number> {
    return this.prisma.vaccinationSchedule.count({
      where: {
        status: 'SCHEDULED',
        dueDate: {
          lt: new Date(),
        },
      },
    });
  }

  private async getNotificationSuccessRate(startDate: Date, endDate: Date): Promise<{ successRate: number }> {
    // Placeholder - would need notification tracking
    return { successRate: 85.5 };
  }

  private generatePredictionInsights(
    historical: number[],
    predictions: number[],
    metric: string,
  ): string[] {
    const insights: string[] = [];
    const avgHistorical = historical.reduce((a, b) => a + b, 0) / historical.length;
    const avgPredicted = predictions.reduce((a, b) => a + b, 0) / predictions.length;

    if (avgPredicted > avgHistorical * 1.1) {
      insights.push(`Expected improvement in ${metric.toLowerCase()} over the forecast period`);
    } else if (avgPredicted < avgHistorical * 0.9) {
      insights.push(`Potential decline in ${metric.toLowerCase()} - consider intervention strategies`);
    } else {
      insights.push(`Stable trend expected for ${metric.toLowerCase()}`);
    }

    // Add seasonality insight if applicable
    if (historical.length >= 12) {
      const seasonalPattern = this.detectSeasonality(historical);
      if (seasonalPattern) {
        insights.push(`Seasonal pattern detected: ${seasonalPattern}`);
      }
    }

    return insights;
  }

  private detectSeasonality(data: number[]): string | null {
    // Simple seasonality detection
    if (data.length < 12) return null;

    const monthlyAverages = Array(12).fill(0);
    const monthlyCounts = Array(12).fill(0);

    data.forEach((value, index) => {
      const month = index % 12;
      monthlyAverages[month] += value;
      monthlyCounts[month] += 1;
    });

    const normalized = monthlyAverages.map((sum, i) => sum / monthlyCounts[i]);
    const maxDiff = Math.max(...normalized) - Math.min(...normalized);
    const avg = normalized.reduce((a, b) => a + b, 0) / normalized.length;

    if (maxDiff > avg * 0.3) {
      const peakMonth = normalized.indexOf(Math.max(...normalized));
      const troughMonth = normalized.indexOf(Math.min(...normalized));
      
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `Peak in ${months[peakMonth]}, lowest in ${months[troughMonth]}`;
    }

    return null;
  }

  private generateOutbreakRecommendations(
    riskLevel: string,
    coverageGap: number,
    highRiskAreas: Array<{ group: string; dropoutRate: number }>,
  ): AnalyticsDimensionValueDto[] {
    const recommendations: AnalyticsDimensionValueDto[] = [];

    if (riskLevel === 'CRITICAL' || riskLevel === 'HIGH') {
      recommendations.push({
        dimension: 'RECOMMENDATION' as any,
        value: 'Immediate vaccination campaign in high-risk areas',
        count: highRiskAreas.length,
        percentage: 100,
      });

      recommendations.push({
        dimension: 'RECOMMENDATION' as any,
        value: 'Enhanced community mobilization',
        count: Math.ceil(coverageGap),
        percentage: 80,
      });

      recommendations.push({
        dimension: 'RECOMMENDATION' as any,
        value: 'Stockpile vaccines in affected regions',
        count: 1,
        percentage: 60,
      });
    } else if (riskLevel === 'MEDIUM') {
      recommendations.push({
        dimension: 'RECOMMENDATION' as any,
        value: 'Targeted outreach in areas with coverage below 80%',
        count: highRiskAreas.length,
        percentage: 70,
      });

      recommendations.push({
        dimension: 'RECOMMENDATION' as any,
        value: 'Strengthen routine immunization services',
        count: 1,
        percentage: 50,
      });
    } else {
      recommendations.push({
        dimension: 'RECOMMENDATION' as any,
        value: 'Maintain routine immunization monitoring',
        count: 1,
        percentage: 30,
      });

      recommendations.push({
        dimension: 'RECOMMENDATION' as any,
        value: 'Continue with standard outreach programs',
        count: 1,
        percentage: 20,
      });
    }

    return recommendations;
  }

  private generateComparisonInterpretation(
    metric: AnalyticsMetric,
    percentageChange: number,
    absoluteChange: number,
    significant: boolean,
  ): string {
    const metricNames: Record<AnalyticsMetric, string> = {
      [AnalyticsMetric.COVERAGE_RATE]: 'Immunization coverage rate',
      [AnalyticsMetric.DROPOUT_RATE]: 'Dropout rate',
      [AnalyticsMetric.TIMELINESS]: 'Timeliness of vaccinations',
      [AnalyticsMetric.VACCINE_CONSUMPTION]: 'Vaccine consumption',
      [AnalyticsMetric.FACILITY_PERFORMANCE]: 'Facility performance',
      [AnalyticsMetric.DEMOGRAPHIC_DISTRIBUTION]: 'Demographic distribution',
      [AnalyticsMetric.GROWTH_TRENDS]: 'Growth trends',
      [AnalyticsMetric.NOTIFICATION_EFFECTIVENESS]: 'Notification effectiveness',
    };

    const metricName = metricNames[metric] || metric;

    let interpretation = '';
    const absPercentChange = Math.abs(percentageChange);

    if (absPercentChange < 5) {
      interpretation = `No significant change in ${metricName.toLowerCase()}`;
    } else if (percentageChange > 0) {
      interpretation = `${metricName} improved by ${absPercentChange.toFixed(1)}%`;
      
      if (metric === AnalyticsMetric.DROPOUT_RATE) {
        interpretation = `Dropout rate decreased by ${absPercentChange.toFixed(1)}%`;
      }
    } else {
      interpretation = `${metricName} declined by ${absPercentChange.toFixed(1)}%`;
      
      if (metric === AnalyticsMetric.DROPOUT_RATE) {
        interpretation = `Dropout rate increased by ${absPercentChange.toFixed(1)}%`;
      }
    }

    if (significant) {
      interpretation += ' (statistically significant)';
    } else {
      interpretation += ' (not statistically significant)';
    }

    return interpretation;
  }

  private convertToCSV(analytics: AnalyticsResponseDto[]): string {
    let csv = 'Metric,Period,Value,Date\n';
    
    analytics.forEach(response => {
      response.dataPoints.forEach(point => {
        csv += `${response.metric},${point.period},${point.value},${response.endDate.toISOString()}\n`;
      });
    });

    return csv;
  }

  private convertToExcel(analytics: AnalyticsResponseDto[]): any {
    // This would use a library like exceljs in production
    return { message: 'Excel export would be implemented with exceljs library' };
  }
}