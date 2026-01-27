import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { DataMiningService } from '../analytics/data-mining.service';
import { CoverageReportTemplate } from './templates/coverage-report.template';
import { FacilityReportTemplate } from './templates/facility-report.template';
import {
  CoverageReportRequestDto,
  CoverageReportResponseDto,
} from './dto/coverage-report.dto';
import {
  FacilityStatsRequestDto,
  FacilityStatsResponseDto,
} from './dto/facility-stats.dto';
import {
  MissedVaccinesRequestDto,
  MissedVaccinesResponseDto,
} from './dto/missed-vaccines.dto';
import { ReportType, ReportFormat, Report } from '@prisma/client';
import { AnalyticsDimension } from '../analytics/dto/analytics-request.dto';
import * as fs from 'fs';
import * as path from 'path';
import * as pdf from 'html-pdf';
import * as ExcelJS from 'exceljs';
import moment from 'moment';

@Injectable()
export class ReportGeneratorService {
  private readonly logger = new Logger(ReportGeneratorService.name);
  private readonly reportsDir = path.join(process.cwd(), 'storage', 'reports');

  constructor(
    private readonly prisma: PrismaService,
    private readonly analyticsService: AnalyticsService,
    private readonly dataMiningService: DataMiningService,
    private readonly coverageTemplate: CoverageReportTemplate,
    private readonly facilityTemplate: FacilityReportTemplate,
  ) {
    // Ensure reports directory exists
    if (!fs.existsSync(this.reportsDir)) {
      fs.mkdirSync(this.reportsDir, { recursive: true });
    }
  }

  /**
   * Generate immunization coverage report
   */
  async generateCoverageReport(
    request: CoverageReportRequestDto,
    userId: string,
  ): Promise<CoverageReportResponseDto> {
    try {
      this.logger.log(`Generating coverage report for ${request.startDate} to ${request.endDate}`);

      // Calculate coverage data
      const coverageData = await this.dataMiningService.calculateCoverageRate(
        request.startDate,
        request.endDate,
      );

      // Get county breakdown
      const counties = await this.prisma.healthFacility.findMany({
        distinct: ['county'],
        select: {
          county: true,
        },
        where: request.county ? { county: request.county } : {},
      });

      const byCounty = await Promise.all(
        counties
          .filter(c => c.county)
          .map(async ({ county }) => {
            const countyCoverage = await this.dataMiningService.calculateCoverageRate(
              request.startDate,
              request.endDate,
              AnalyticsDimension.COUNTY,
              county!,
            );

            return {
              county: county!,
              coverage: countyCoverage.coverage,
              children: countyCoverage.total,
              vaccinated: countyCoverage.vaccinated,
            };
          }),
      );

      // Get facility breakdown if requested
      let byFacility;
      if (request.includeFacilityBreakdown) {
        const facilities = await this.prisma.healthFacility.findMany({
          where: request.facilityId ? { id: request.facilityId } : {},
          select: {
            id: true,
            name: true,
          },
          take: 20, // Limit for report
        });

        byFacility = await Promise.all(
          facilities.map(async (facility) => {
            const facilityCoverage = await this.dataMiningService.calculateCoverageRate(
              request.startDate,
              request.endDate,
              AnalyticsDimension.FACILITY,
              facility.id,
            );

            return {
              facilityName: facility.name,
              coverage: facilityCoverage.coverage,
              children: facilityCoverage.total,
              vaccinated: facilityCoverage.vaccinated,
            };
          }),
        );

        // Sort by coverage descending
        byFacility.sort((a, b) => b.coverage - a.coverage);
      }

      // Get trends if comparison requested
      let trends;
      if (request.includeComparisons) {
        const previousStart = moment(request.startDate)
          .subtract(
            moment(request.endDate).diff(moment(request.startDate), 'days'),
            'days',
          )
          .toDate();
        const previousEnd = moment(request.startDate).subtract(1, 'day').toDate();

        const previousCoverage = await this.dataMiningService.calculateCoverageRate(
          previousStart,
          previousEnd,
        );

        const percentageChange =
          previousCoverage.coverage > 0
            ? ((coverageData.coverage - previousCoverage.coverage) /
                previousCoverage.coverage) *
              100
            : 0;

        trends = {
          previousPeriodCoverage: previousCoverage.coverage,
          percentageChange,
          direction:
            percentageChange > 5
              ? 'improving'
              : percentageChange < -5
              ? 'declining'
              : 'stable',
        };
      }

      // Generate recommendations
      const recommendations = this.generateCoverageRecommendations(
        coverageData.coverage,
        byCounty,
      );

      // Prepare report data
      const reportData = {
        title: `Immunization Coverage Report - ${request.county || 'National'}`,
        period: `${moment(request.startDate).format('MMM D, YYYY')} - ${moment(
          request.endDate,
        ).format('MMM D, YYYY')}`,
        generatedAt: new Date(),
        overallCoverage: coverageData.coverage,
        targetCoverage: 90, // KEPI target
        coverageGap: Math.max(0, 90 - coverageData.coverage),
        totalChildren: coverageData.total,
        vaccinatedChildren: coverageData.vaccinated,
        byCounty: byCounty.sort((a, b) => b.coverage - a.coverage),
        byFacility,
        trends,
        recommendations,
      };

      // Generate report content
      const htmlContent = this.coverageTemplate.generateHTML(reportData);

      // Save report to database
      const report = await this.prisma.report.create({
        data: {
          title: reportData.title,
          type: ReportType.COVERAGE,
          description: `Coverage report for ${reportData.period}`,
          parameters: JSON.stringify(request),
          data: JSON.stringify(reportData),
          generatedById: userId,
        },
      });

      // Generate file based on format
      const fileName = `coverage-report-${report.id}-${Date.now()}`;
      const filePath = await this.generateReportFile(
        htmlContent,
        fileName,
        request.format || ReportFormat.PDF,
      );

      // Create download URL (in production, this would be a proper URL)
      const downloadUrl = `/api/reports/download/${report.id}`;
      const expiresAt = moment().add(7, 'days').toDate();

      return {
        reportId: report.id,
        title: reportData.title,
        period: reportData.period,
        generatedAt: reportData.generatedAt,
        overallCoverage: reportData.overallCoverage,
        targetCoverage: reportData.targetCoverage,
        coverageGap: reportData.coverageGap,
        totalChildren: reportData.totalChildren,
        vaccinatedChildren: reportData.vaccinatedChildren,
        byCounty: reportData.byCounty,
        byFacility: reportData.byFacility,
        trends: reportData.trends,
        recommendations: reportData.recommendations,
        downloadUrl,
        expiresAt,
      };
    } catch (error) {
      this.logger.error(`Error generating coverage report: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Generate facility statistics report
   */
  async generateFacilityStatsReport(
    request: FacilityStatsRequestDto,
    userId: string,
  ): Promise<FacilityStatsResponseDto[]> {
    try {
      this.logger.log(`Generating facility stats report for ${request.startDate} to ${request.endDate}`);

      // Get facility performance data
      const facilityPerformance = await this.dataMiningService.analyzeFacilityPerformance(
        request.startDate,
        request.endDate,
        request.facilityIds ? request.facilityIds.length : 50,
      );

      // Filter by facility IDs if specified
      const filteredFacilities = request.facilityIds
        ? facilityPerformance.filter(f => request.facilityIds!.includes(f.facilityId))
        : facilityPerformance;

      // Generate reports for each facility
      const reports = await Promise.all(
        filteredFacilities.map(async (facility, index) => {
          // Get monthly trends
          const monthlyTrends = await this.getFacilityMonthlyTrends(
            facility.facilityId,
            request.startDate,
            request.endDate,
          );

          // Get vaccine breakdown
          const vaccineBreakdown = await this.getFacilityVaccineBreakdown(
            facility.facilityId,
            request.startDate,
            request.endDate,
          );

          // Calculate growth rate
          const growthRate = await this.calculateFacilityGrowthRate(
            facility.facilityId,
            request.startDate,
            request.endDate,
          );

          // Generate recommendations
          const recommendations = this.generateFacilityRecommendations(facility);

          const reportData: FacilityStatsResponseDto = {
            facilityId: facility.facilityId,
            facilityName: facility.facilityName,
            county: facility.county,
            subCounty: facility.subCounty,
            totalImmunizations: facility.immunizations,
            coverageRate: facility.coverage,
            timelinessRate: facility.timeliness,
            dropoutRate: facility.dropoutRate,
            performanceScore: facility.performanceScore,
            ranking: request.includePerformanceRanking ? index + 1 : undefined,
            totalRanked: request.includePerformanceRanking ? filteredFacilities.length : undefined,
            period: `${moment(request.startDate).format('MMM YYYY')} - ${moment(
              request.endDate,
            ).format('MMM YYYY')}`,
            monthlyTrends,
            vaccineBreakdown,
            growthRate,
            recommendations,
            generatedAt: new Date(),
          };

          // Generate report file if requested
          if (request.includePerformanceRanking && index < 10) {
            await this.generateFacilityReportFile(reportData, userId);
          }

          return reportData;
        }),
      );

      return reports;
    } catch (error) {
      this.logger.error(`Error generating facility stats report: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Generate missed vaccines report
   */
  async generateMissedVaccinesReport(
    request: MissedVaccinesRequestDto,
    userId: string,
  ): Promise<MissedVaccinesResponseDto> {
    try {
      this.logger.log(`Generating missed vaccines report for ${request.startDate} to ${request.endDate}`);

      // Get missed vaccinations
      const missedSchedules = await this.prisma.vaccinationSchedule.findMany({
        where: {
          dueDate: {
            gte: request.startDate,
            lte: request.endDate,
          },
          status: 'MISSED',
          ...(request.vaccineIds && { vaccineId: { in: request.vaccineIds } }),
        },
        include: {
          child: {
            include: {
              parent: {
                include: {
                  user: {
                    select: {
                      phoneNumber: true,
                    },
                  },
                },
              },
              birthFacility: {
                select: {
                  name: true,
                  county: true,
                },
              },
            },
          },
          vaccine: {
            select: {
              name: true,
              recommendedAgeDays: true,
            },
          },
        },
      });

      // Calculate statistics
      const totalMissed = missedSchedules.length;
      const overdueSchedules = missedSchedules.filter(schedule => {
        const daysOverdue = Math.floor(
          (new Date().getTime() - schedule.dueDate.getTime()) / (1000 * 60 * 60 * 24),
        );
        return daysOverdue >= (request.daysOverdue || 30);
      });
      const totalOverdue = overdueSchedules.length;
      const percentageOverdue = totalMissed > 0 ? (totalOverdue / totalMissed) * 100 : 0;

      // Group by county
      const countyMap = new Map<string, { missed: number; overdue: number }>();
      missedSchedules.forEach(schedule => {
        const county = schedule.child.birthFacility?.county || 'Unknown';
        const current = countyMap.get(county) || { missed: 0, overdue: 0 };
        current.missed++;
        
        const daysOverdue = Math.floor(
          (new Date().getTime() - schedule.dueDate.getTime()) / (1000 * 60 * 60 * 24),
        );
        if (daysOverdue >= (request.daysOverdue || 30)) {
          current.overdue++;
        }
        
        countyMap.set(county, current);
      });

      const byCounty = Array.from(countyMap.entries()).map(([county, stats]) => ({
        county,
        missed: stats.missed,
        overdue: stats.overdue,
        percentage: stats.missed > 0 ? (stats.overdue / stats.missed) * 100 : 0,
      }));

      // Group by facility
      const facilityMap = new Map<string, { missed: number; overdue: number; facilityName: string }>();
      missedSchedules.forEach(schedule => {
        const facilityId = schedule.child.birthFacilityId || 'unknown';
        const facilityName = schedule.child.birthFacility?.name || 'Unknown Facility';
        const current = facilityMap.get(facilityId) || { missed: 0, overdue: 0, facilityName };
        current.missed++;
        
        const daysOverdue = Math.floor(
          (new Date().getTime() - schedule.dueDate.getTime()) / (1000 * 60 * 60 * 24),
        );
        if (daysOverdue >= (request.daysOverdue || 30)) {
          current.overdue++;
        }
        
        facilityMap.set(facilityId, current);
      });

      const byFacility = Array.from(facilityMap.values()).map(stats => ({
        facilityName: stats.facilityName,
        missed: stats.missed,
        overdue: stats.overdue,
        percentage: stats.missed > 0 ? (stats.overdue / stats.missed) * 100 : 0,
      }));

      // Group by vaccine
      const vaccineMap = new Map<string, { missed: number; overdue: number; vaccineName: string; recommendedAge: number }>();
      missedSchedules.forEach(schedule => {
        const vaccineId = schedule.vaccineId;
        const current = vaccineMap.get(vaccineId) || {
          missed: 0,
          overdue: 0,
          vaccineName: schedule.vaccine.name,
          recommendedAge: schedule.vaccine.recommendedAgeDays,
        };
        current.missed++;
        
        const daysOverdue = Math.floor(
          (new Date().getTime() - schedule.dueDate.getTime()) / (1000 * 60 * 60 * 24),
        );
        if (daysOverdue >= (request.daysOverdue || 30)) {
          current.overdue++;
        }
        
        vaccineMap.set(vaccineId, current);
      });

      const byVaccine = Array.from(vaccineMap.values());

      // Prepare children list if requested
      let childrenList;
      if (request.includeContactInfo) {
        childrenList = missedSchedules.slice(0, 100).map(schedule => {
          const daysOverdue = Math.floor(
            (new Date().getTime() - schedule.dueDate.getTime()) / (1000 * 60 * 60 * 24),
          );
          
          return {
            childName: `${schedule.child.firstName} ${schedule.child.lastName}`,
            age: Math.floor(
              (new Date().getTime() - schedule.child.dateOfBirth.getTime()) / (1000 * 60 * 60 * 24 * 365.25),
            ),
            missedVaccines: [schedule.vaccine.name],
            daysOverdue,
            parentPhone: schedule.child.parent.user.phoneNumber,
            lastContactDate: schedule.child.updatedAt,
          };
        });
      }

      // Generate follow-up plan if requested
      let followUpPlan;
      if (request.includeFollowUpPlan) {
        const immediate = overdueSchedules.filter(s => {
          const daysOverdue = Math.floor(
            (new Date().getTime() - s.dueDate.getTime()) / (1000 * 60 * 60 * 24),
          );
          return daysOverdue > 90;
        }).length;

        const within7Days = overdueSchedules.filter(s => {
          const daysOverdue = Math.floor(
            (new Date().getTime() - s.dueDate.getTime()) / (1000 * 60 * 60 * 24),
          );
          return daysOverdue > 30 && daysOverdue <= 90;
        }).length;

        const within30Days = overdueSchedules.filter(s => {
          const daysOverdue = Math.floor(
            (new Date().getTime() - s.dueDate.getTime()) / (1000 * 60 * 60 * 24),
          );
          return daysOverdue <= 30;
        }).length;

        followUpPlan = {
          immediateAction: immediate,
          within7Days: within7Days,
          within30Days: within30Days,
          totalRequired: immediate + within7Days + within30Days,
        };
      }

      // Save report to database
      const report = await this.prisma.report.create({
        data: {
          title: `Missed Vaccines Report - ${moment(request.startDate).format('MMM YYYY')} to ${moment(request.endDate).format('MMM YYYY')}`,
          type: ReportType.MISSED_VACCINES,
          description: `Report of missed vaccines for ${request.county || 'all counties'}`,
          parameters: JSON.stringify(request),
          data: JSON.stringify({
            totalMissed,
            totalOverdue,
            percentageOverdue,
            byCounty,
            byFacility,
            byVaccine,
          }),
          generatedById: userId,
        },
      });

      const downloadUrl = `/api/reports/download/${report.id}`;
      const generatedAt = new Date();

      return {
        reportId: report.id,
        period: `${moment(request.startDate).format('MMM D, YYYY')} - ${moment(
          request.endDate,
        ).format('MMM D, YYYY')}`,
        totalMissed,
        totalOverdue,
        percentageOverdue,
        byCounty,
        byFacility: byFacility.sort((a, b) => b.missed - a.missed).slice(0, 20),
        byVaccine: byVaccine.sort((a, b) => b.missed - a.missed),
        childrenList,
        followUpPlan,
        generatedAt,
        downloadUrl,
      };
    } catch (error) {
      this.logger.error(`Error generating missed vaccines report: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Generate custom report based on parameters
   */
  async generateCustomReport(
    reportType: ReportType,
    parameters: Record<string, any>,
    userId: string,
    format: ReportFormat = ReportFormat.PDF,
  ): Promise<Report> {
    try {
      let reportData: any;
      let title = '';

      switch (reportType) {
        case ReportType.COVERAGE:
          const coverageRequest: CoverageReportRequestDto = {
            startDate: new Date(parameters.startDate),
            endDate: new Date(parameters.endDate),
            county: parameters.county,
            subCounty: parameters.subCounty,
            facilityId: parameters.facilityId,
            format: parameters.format || ReportFormat.PDF,
            includeComparisons: parameters.includeComparisons || false,
            includeFacilityBreakdown: parameters.includeFacilityBreakdown || false,
            includeRecommendations: parameters.includeRecommendations || true,
          };
          
          const coverageReport = await this.generateCoverageReport(coverageRequest, userId);
          reportData = coverageReport;
          title = `Custom Coverage Report - ${parameters.county || 'National'}`;
          break;

        case ReportType.FACILITY_PERFORMANCE:
          const facilityRequest: FacilityStatsRequestDto = {
            startDate: new Date(parameters.startDate),
            endDate: new Date(parameters.endDate),
            county: parameters.county,
            subCounty: parameters.subCounty,
            facilityIds: parameters.facilityIds,
            includePerformanceRanking: parameters.includePerformanceRanking || false,
            includeGrowthMetrics: parameters.includeGrowthMetrics || false,
          };
          
          const facilityReports = await this.generateFacilityStatsReport(facilityRequest, userId);
          reportData = facilityReports;
          title = `Custom Facility Performance Report`;
          break;

        case ReportType.MISSED_VACCINES:
          const missedRequest: MissedVaccinesRequestDto = {
            startDate: new Date(parameters.startDate),
            endDate: new Date(parameters.endDate),
            county: parameters.county,
            subCounty: parameters.subCounty,
            vaccineIds: parameters.vaccineIds,
            daysOverdue: parameters.daysOverdue || 30,
            includeContactInfo: parameters.includeContactInfo || false,
            includeFollowUpPlan: parameters.includeFollowUpPlan || false,
          };
          
          const missedReport = await this.generateMissedVaccinesReport(missedRequest, userId);
          reportData = missedReport;
          title = `Custom Missed Vaccines Report`;
          break;

        case ReportType.DEMOGRAPHIC:
          // Generate demographic report
          reportData = await this.generateDemographicReport(parameters, userId);
          title = `Demographic Distribution Report`;
          break;

        case ReportType.TIMELINESS:
          // Generate timeliness report
          reportData = await this.generateTimelinessReport(parameters, userId);
          title = `Vaccination Timeliness Report`;
          break;

        default:
          throw new Error(`Unsupported report type: ${reportType}`);
      }

      // Create report record
      const report = await this.prisma.report.create({
        data: {
          title,
          type: reportType,
          description: `Custom ${reportType.toLowerCase()} report`,
          parameters: JSON.stringify(parameters),
          data: JSON.stringify(reportData),
          generatedById: userId,
        },
      });

      return report;
    } catch (error) {
      this.logger.error(`Error generating custom report: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Schedule recurring report generation
   */
  async scheduleReport(
    reportId: string,
    frequency: string,
    recipients: string[],
    enabled: boolean = true,
  ): Promise<void> {
    try {
      // This would be integrated with a scheduler like Bull or NestJS Schedule
      // For now, we'll just log the schedule
      this.logger.log(`Scheduled report ${reportId} with frequency ${frequency} for ${recipients.length} recipients`);
    } catch (error) {
      this.logger.error(`Error scheduling report: ${error.message}`);
      throw error;
    }
  }

  // Private helper methods
  private async generateReportFile(
    htmlContent: string,
    fileName: string,
    format: ReportFormat,
  ): Promise<string> {
    const fileBasePath = path.join(this.reportsDir, fileName);

    switch (format) {
      case ReportFormat.PDF:
        const pdfPath = `${fileBasePath}.pdf`;
        await this.generatePDF(htmlContent, pdfPath);
        return pdfPath;

      case ReportFormat.EXCEL:
        const excelPath = `${fileBasePath}.xlsx`;
        await this.generateExcel(htmlContent, excelPath);
        return excelPath;

      case ReportFormat.CSV:
        const csvPath = `${fileBasePath}.csv`;
        await this.generateCSV(htmlContent, csvPath);
        return csvPath;

      case ReportFormat.HTML:
        const htmlPath = `${fileBasePath}.html`;
        fs.writeFileSync(htmlPath, htmlContent);
        return htmlPath;

      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  private async generatePDF(htmlContent: string, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const options = {
        format: 'A4',
        orientation: 'portrait',
        border: {
          top: '20mm',
          right: '15mm',
          bottom: '20mm',
          left: '15mm',
        },
        footer: {
          height: '15mm',
          contents: {
            default: '<div style="text-align: center; color: #666; font-size: 10px;">Page {{page}} of {{pages}}</div>',
          },
        },
      };

      pdf.create(htmlContent, options).toFile(outputPath, (err, res) => {
        if (err) reject(err);
        else {
          this.logger.log(`PDF generated: ${outputPath}`);
          resolve();
        }
      });
    });
  }

  private async generateExcel(htmlContent: string, outputPath: string): Promise<void> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Report');

    // Parse HTML table and add to Excel
    // This is a simplified implementation
    worksheet.columns = [
      { header: 'Metric', key: 'metric', width: 30 },
      { header: 'Value', key: 'value', width: 20 },
    ];

    worksheet.addRow({ metric: 'Report', value: 'Generated from HTML' });

    await workbook.xlsx.writeFile(outputPath);
    this.logger.log(`Excel file generated: ${outputPath}`);
  }

  private async generateCSV(htmlContent: string, outputPath: string): Promise<void> {
    // Simplified CSV generation
    const csvContent = 'Metric,Value\nReport,Generated from HTML';
    fs.writeFileSync(outputPath, csvContent);
    this.logger.log(`CSV file generated: ${outputPath}`);
  }

  private async generateFacilityReportFile(
    data: FacilityStatsResponseDto,
    userId: string,
  ): Promise<void> {
    const htmlContent = this.facilityTemplate.generateHTML(data);
    const fileName = `facility-${data.facilityId}-${Date.now()}`;
    const filePath = await this.generateReportFile(htmlContent, fileName, ReportFormat.PDF);

    // Save file reference to database
    await this.prisma.report.create({
      data: {
        title: `${data.facilityName} Performance Report`,
        type: ReportType.FACILITY_PERFORMANCE,
        description: `Performance report for ${data.facilityName}`,
        parameters: JSON.stringify({ facilityId: data.facilityId }),
        data: JSON.stringify(data),
        generatedById: userId,
      },
    });

    this.logger.log(`Facility report generated: ${filePath}`);
  }

  private async getFacilityMonthlyTrends(
    facilityId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<Array<{ month: string; immunizations: number; coverage: number }>> {
    const trends: Array<{ month: string; immunizations: number; coverage: number }> = [];
    let currentDate = moment(startDate).startOf('month');

    while (currentDate.isSameOrBefore(endDate)) {
      const monthStart = currentDate.toDate();
      const monthEnd = currentDate.endOf('month').toDate();

      const immunizations = await this.prisma.immunization.count({
        where: {
          facilityId,
          dateAdministered: {
            gte: monthStart,
            lte: monthEnd,
          },
        },
      });

      const childrenCount = await this.prisma.child.count({
        where: {
          birthFacilityId: facilityId,
          dateOfBirth: {
            lte: monthEnd,
          },
        },
      });

      const coverage = childrenCount > 0 ? (immunizations / childrenCount) * 100 : 0;

      trends.push({
        month: currentDate.format('MMM YYYY'),
        immunizations,
        coverage: Math.round(coverage * 10) / 10,
      });

      currentDate.add(1, 'month');
    }

    return trends;
  }

  private async getFacilityVaccineBreakdown(
    facilityId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<Array<{ vaccineName: string; count: number; percentage: number }>> {
    const immunizations = await this.prisma.immunization.groupBy({
      by: ['vaccineId'],
      where: {
        facilityId,
        dateAdministered: {
          gte: startDate,
          lte: endDate,
        },
      },
      _count: true,
    });

    const total = immunizations.reduce((sum, item) => sum + item._count, 0);

    // Get vaccine names
    const vaccineIds = immunizations.map(i => i.vaccineId);
    const vaccines = await this.prisma.vaccine.findMany({
      where: {
        id: {
          in: vaccineIds,
        },
      },
      select: {
        id: true,
        name: true,
      },
    });

    const vaccineMap = new Map(vaccines.map(v => [v.id, v.name]));

    return immunizations.map(item => ({
      vaccineName: vaccineMap.get(item.vaccineId) || item.vaccineId,
      count: item._count,
      percentage: total > 0 ? (item._count / total) * 100 : 0,
    }));
  }

  private async calculateFacilityGrowthRate(
    facilityId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<number> {
    const periodDays = moment(endDate).diff(moment(startDate), 'days');
    const previousStart = moment(startDate).subtract(periodDays, 'days').toDate();
    const previousEnd = moment(startDate).subtract(1, 'day').toDate();

    const currentImmunizations = await this.prisma.immunization.count({
      where: {
        facilityId,
        dateAdministered: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    const previousImmunizations = await this.prisma.immunization.count({
      where: {
        facilityId,
        dateAdministered: {
          gte: previousStart,
          lte: previousEnd,
        },
      },
    });

    return previousImmunizations > 0
      ? ((currentImmunizations - previousImmunizations) / previousImmunizations) * 100
      : currentImmunizations > 0 ? 100 : 0;
  }

  private generateCoverageRecommendations(
    overallCoverage: number,
    byCounty: Array<{ county: string; coverage: number }>,
  ): string[] {
    const recommendations: string[] = [];

    if (overallCoverage < 80) {
      recommendations.push('Implement targeted outreach campaigns in low-coverage areas');
      recommendations.push('Strengthen community health worker networks for follow-up');
    }

    if (overallCoverage < 90) {
      recommendations.push('Enhance reminder systems for upcoming vaccinations');
      recommendations.push('Consider mobile vaccination clinics for hard-to-reach areas');
    }

    // Identify counties needing attention
    const lowCoverageCounties = byCounty.filter(c => c.coverage < 70);
    if (lowCoverageCounties.length > 0) {
      const countyNames = lowCoverageCounties.map(c => c.county).join(', ');
      recommendations.push(`Focus resources on counties with coverage below 70%: ${countyNames}`);
    }

    // Add standard recommendations
    recommendations.push('Regularly update immunization registries');
    recommendations.push('Train health workers on proper vaccine storage and handling');
    recommendations.push('Engage community leaders to promote vaccination awareness');

    return recommendations;
  }

  private generateFacilityRecommendations(facility: any): string[] {
    const recommendations: string[] = [];

    if (facility.coverage < 70) {
      recommendations.push('Increase community outreach and mobilization efforts');
      recommendations.push('Implement defaulter tracking system for missed appointments');
    }

    if (facility.timeliness < 80) {
      recommendations.push('Improve appointment scheduling and reminder systems');
      recommendations.push('Train staff on timely vaccine administration protocols');
    }

    if (facility.dropoutRate > 20) {
      recommendations.push('Establish follow-up procedures for children who miss doses');
      recommendations.push('Provide education on the importance of completing vaccine series');
    }

    if (facility.performanceScore < 70) {
      recommendations.push('Conduct staff training on immunization best practices');
      recommendations.push('Review and optimize clinic workflow and patient flow');
    }

    // Add positive reinforcement for good performance
    if (facility.performanceScore >= 90) {
      recommendations.push('Continue current practices and serve as a model facility');
      recommendations.push('Consider mentoring other facilities in the region');
    }

    return recommendations;
  }

  private async generateDemographicReport(
    parameters: Record<string, any>,
    userId: string,
  ): Promise<any> {
    // Implementation for demographic report
    return {
      message: 'Demographic report would be generated here',
      parameters,
    };
  }

  private async generateTimelinessReport(
    parameters: Record<string, any>,
    userId: string,
  ): Promise<any> {
    // Implementation for timeliness report
    return {
      message: 'Timeliness report would be generated here',
      parameters,
    };
  }
}