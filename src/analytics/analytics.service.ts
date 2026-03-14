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
import { CountyAdminDashboardDto, CoverageAlertDto } from './dto/county-admin-dashboard.dto';
import moment from 'moment';
import { ImmunizationStatus, ReminderStatus } from '@prisma/client';

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

  /**
   * Get County Admin Dashboard data - aggregates all data for the dashboard
   */
  async getCountyAdminDashboard(county?: string): Promise<CountyAdminDashboardDto> {
    try {
      const now = new Date();
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
      
      // Get basic counts
      const [
        totalChildren,
        totalFacilities,
        totalHealthWorkers,
        totalImmunizations,
        thisMonthImmunizations,
        lastMonthImmunizations,
      ] = await Promise.all([
        this.prisma.child.count(),
        this.prisma.healthFacility.count(),
        this.prisma.healthWorker.count(),
        this.prisma.immunization.count(),
        this.prisma.immunization.count({
          where: {
            dateAdministered: { gte: new Date(now.getFullYear(), now.getMonth(), 1) },
          },
        }),
        this.prisma.immunization.count({
          where: {
            dateAdministered: { gte: lastMonth, lt: new Date(now.getFullYear(), now.getMonth(), 1) },
          },
        }),
      ]);

      // Calculate coverage (simplified)
      const coverageRate = totalChildren > 0 ? Math.round((totalImmunizations / (totalChildren * 10)) * 100 * 10) / 10 : 0; // Assuming 10 vaccines per child
      const previousCoverage = totalChildren > 0 ? Math.round((lastMonthImmunizations / (totalChildren * 10)) * 100 * 10) / 10 : 0;
      const coverageTrend = coverageRate - previousCoverage;

      // Get facilities grouped by sub-county (using county field)
      const facilities = await this.prisma.healthFacility.findMany({
        include: {
          children: true,
          healthWorkers: true,
          immunizations: {
            where: {
              dateAdministered: { gte: new Date(now.getFullYear(), now.getMonth(), 1) },
            },
          },
        },
      });

      // Aggregate by sub-county
      const subCountyMap = new Map<string, any>();
      facilities.forEach((facility) => {
        const subCounty = facility.subCounty || 'Unknown';
        if (!subCountyMap.has(subCounty)) {
          subCountyMap.set(subCounty, {
            name: subCounty,
            facilities: 0,
            children: 0,
            healthWorkers: 0,
            immunizations: 0,
            coordinates: { lat: -1.2921 + (Math.random() - 0.5) * 0.1, lng: 36.8219 + (Math.random() - 0.5) * 0.1 },
          });
        }
        const sc = subCountyMap.get(subCounty);
        sc.facilities += 1;
        sc.children += facility.children.length;
        sc.healthWorkers += facility.healthWorkers.length;
        sc.immunizations += facility.immunizations.length;
      });

      // Convert to sub-county stats
      const subCountyStats = Array.from(subCountyMap.values()).map((sc: any) => {
        const scCoverage = sc.children > 0 ? Math.round((sc.immunizations / (sc.children * 10)) * 100 * 10) / 10 : 0;
        return {
          name: sc.name,
          coverage: scCoverage,
          facilities: sc.facilities,
          population: this.formatPopulation(sc.children * 10), // Estimate
          target: 85,
          healthWorkers: sc.healthWorkers,
          children: this.formatNumber(sc.children),
          status: scCoverage >= 85 ? 'exceeding' : scCoverage >= 70 ? 'on-track' : scCoverage >= 50 ? 'behind' : 'critical',
          trend: `${scCoverage >= previousCoverage ? '+' : ''}${Math.round((scCoverage - previousCoverage) * 10) / 10}%`,
          coordinates: sc.coordinates,
        };
      });

      // Facility stats
      const facilityStats = await Promise.all(
        facilities.slice(0, 10).map(async (facility) => {
          const immunizations = await this.prisma.immunization.count({
            where: { facilityId: facility.id },
          });
          const children = await this.prisma.child.count({
            where: { birthFacilityId: facility.id },
          });
          const healthWorkers = await this.prisma.healthWorker.count({
            where: { facilityId: facility.id },
          });
          const facilityCoverage = children > 0 ? Math.round((immunizations / (children * 10)) * 100 * 10) / 10 : 0;

          return {
            name: facility.name,
            coverage: facilityCoverage,
            status: facilityCoverage >= 90 ? 'excellent' : facilityCoverage >= 70 ? 'good' : 'needs-improvement',
            children: this.formatNumber(children),
            healthWorkers,
            vaccines: immunizations,
            lastUpdated: 'Just now',
            type: facility.type,
            contact: facility.phone || 'N/A',
          };
        })
      );

      // Get recent activities from notifications/immunizations
      const recentImmunizations = await this.prisma.immunization.findMany({
        take: 10,
        orderBy: { dateAdministered: 'desc' },
        include: {
          child: true,
          facility: true,
          healthWorker: {
            include: { user: true },
          },
          vaccine: true,
        },
      });

      const recentActivities = recentImmunizations.map((imm) => ({
        action: `Vaccination: ${imm.vaccine.name}`,
        facility: imm.facility.name,
        time: this.getRelativeTime(imm.dateAdministered),
        user: imm.healthWorker.user.fullName,
        alert: false,
      }));

      // Get upcoming vaccination schedules
      const upcomingSchedules = await this.prisma.vaccinationSchedule.findMany({
        where: {
          dueDate: {
            gte: now,
            lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000), // Next 7 days
          },
          status: 'SCHEDULED',
        },
        include: {
          child: {
            include: { parent: true },
          },
          vaccine: true,
        },
        take: 10,
        orderBy: { dueDate: 'asc' },
      });

      const upcomingAppointments = upcomingSchedules.map((schedule) => ({
        child: `${schedule.child.firstName} ${schedule.child.lastName}`,
        vaccine: schedule.vaccine.name,
        facility: 'Assigned Facility',
        time: this.formatTime(schedule.dueDate),
        status: schedule.dueDate < now ? 'overdue' : 'confirmed',
        parent: schedule.child.parent ? 'Parent' : 'N/A',
      }));

      // Generate alerts based on data
      const coverageAlerts: CoverageAlertDto[] = [];
      const lowCoverageFacilities = facilityStats.filter(f => f.coverage < 70);
      if (lowCoverageFacilities.length > 0) {
        coverageAlerts.push({
          type: 'low_coverage',
          message: `${lowCoverageFacilities.length} facilities have coverage below 70%`,
          facilities: lowCoverageFacilities.length,
          severity: 'high',
        });
      }

      // Build stats array
      const stats = [
        {
          label: 'County Coverage',
          value: `${coverageRate}%`,
          trend: `${coverageTrend >= 0 ? '+' : ''}${Math.round(coverageTrend * 10) / 10}%`,
          trendUp: coverageTrend >= 0,
          color: 'primary',
          bgColor: 'bg-primary-50',
          textColor: 'text-primary-600',
          description: `vs national target of 85%`,
        },
        {
          label: 'Total Facilities',
          value: totalFacilities.toString(),
          trend: '+0',
          trendUp: true,
          color: 'info',
          bgColor: 'bg-blue-50',
          textColor: 'text-blue-600',
          description: `across ${subCountyStats.length} sub-counties`,
        },
        {
          label: 'Children Registered',
          value: this.formatNumber(totalChildren),
          trend: '+0',
          trendUp: true,
          color: 'success',
          bgColor: 'bg-green-50',
          textColor: 'text-green-600',
          description: 'total registered',
        },
        {
          label: 'Active Health Workers',
          value: totalHealthWorkers.toString(),
          trend: '+0',
          trendUp: true,
          color: 'purple',
          bgColor: 'bg-purple-50',
          textColor: 'text-purple-600',
          description: 'across all facilities',
        },
      ];

      // Resources (mock data - would need separate inventory tracking)
      const resources = [
        { label: 'Vaccine Fridges', value: Math.ceil(totalFacilities * 0.8), icon: '', status: 'operational', capacity: '85%', lastChecked: '1 hour ago' },
        { label: 'Cold Chain Trucks', value: Math.ceil(totalFacilities * 0.2), icon: '', status: 'on-route', active: Math.ceil(totalFacilities * 0.15), lastChecked: '30 mins ago' },
        { label: 'Mobile Clinics', value: Math.ceil(totalFacilities * 0.1), icon: '', status: 'deployed', active: Math.ceil(totalFacilities * 0.08), lastChecked: '2 hours ago' },
      ];

      return {
        stats,
        subCountyStats,
        facilityStats,
        resources,
        recentActivities,
        upcomingAppointments,
        coverageAlerts,
        totalCoverage: coverageRate,
        totalFacilities,
        totalChildren,
        totalHealthWorkers,
        previousMonthCoverage: previousCoverage,
        coverageTrend,
      };
    } catch (error) {
      this.logger.error(`Error getting county admin dashboard: ${error.message}`, error.stack);
      throw error;
    }
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

  // Helper methods for county admin dashboard
  private formatNumber(num: number): string {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  }

  private formatPopulation(num: number): string {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(0) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(0) + 'K';
    }
    return num.toString();
  }

  private getRelativeTime(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - new Date(date).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} mins ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return new Date(date).toLocaleDateString();
  }

  private formatTime(date: Date): string {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  }

  /**
   * Get count of immunizations performed today
   */
  async getImmunizationsToday(startDate: Date, endDate: Date): Promise<number> {
    return this.prisma.immunization.count({
      where: {
        dateAdministered: {
          gte: startDate,
          lt: endDate,
        },
      },
    });
  }

  /**
   * Get count of pending reminders
   */
  async getPendingReminders(): Promise<number> {
    return this.prisma.reminder.count({
      where: {
        status: ReminderStatus.PENDING,
      },
    });
  }

  /**
   * Get count of active users (users logged in recently)
   */
  async getActiveUsers(): Promise<number> {
    // Consider users active if they logged in within the last 30 minutes
    const thirtyMinutesAgo = new Date();
    thirtyMinutesAgo.setMinutes(thirtyMinutesAgo.getMinutes() - 30);

    // This assumes there's a lastLogin field on User
    // If not, we'll return a placeholder based on session activity
    return this.prisma.user.count({
      where: {
        lastLoginAt: {
          gte: thirtyMinutesAgo,
        },
      },
    });
  }

  /**
   * Get count of alerts/notifications
   */
  async getAlertsCount(): Promise<number> {
    return this.prisma.notification.count({
      where: {
        createdAt: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)), // Today only
        },
      },
    });
  }
}
