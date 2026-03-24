import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ReportGeneratorService } from './report-generator.service';
import { CreateReportDto, UpdateReportDto, ScheduleReportDto } from './dto/report-request.dto';
import { CoverageReportRequestDto } from './dto/coverage-report.dto';
import { FacilityStatsRequestDto } from './dto/facility-stats.dto';
import { MissedVaccinesRequestDto } from './dto/missed-vaccines.dto';
import { Report, ReportType, ReportFormat, ReportFrequency } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);
  private readonly reportsDir = path.join(process.cwd(), 'storage', 'reports');

  constructor(
    private readonly prisma: PrismaService,
    private readonly reportGenerator: ReportGeneratorService,
  ) {}

  /**
   * Create a new report
   */
  async create(createReportDto: CreateReportDto, userId: string): Promise<Report> {
    try {
      // If it's a predefined report type, generate it
      if (createReportDto.parameters && Object.keys(createReportDto.parameters).length > 0) {
        return await this.reportGenerator.generateCustomReport(
          createReportDto.type,
          createReportDto.parameters,
          userId,
          createReportDto.format,
        );
      }

      // Otherwise create a placeholder report
      const report = await this.prisma.report.create({
        data: {
          title: createReportDto.title,
          type: createReportDto.type,
          description: createReportDto.description || '',
          parameters: createReportDto.parameters ? JSON.stringify(createReportDto.parameters) : '{}',
          data: '{}',
          userId: userId,
          generatedById: userId,
        },
      });

      // Schedule if requested
      if (createReportDto.scheduledFor) {
        await this.scheduleReport({
          reportId: report.id,
          frequency: createReportDto.frequency ?? ReportFrequency.ON_DEMAND,
          scheduleTime: createReportDto.scheduledFor,
          recipients: [],
          enabled: true,
        });
      }

      return report;
    } catch (error) {
      this.logger.error(`Error creating report: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get all reports with pagination
   */
  async findAll(
    page: number = 1,
    limit: number = 20,
    filters?: {
      type?: ReportType;
      generatedById?: string;
      startDate?: Date;
      endDate?: Date;
      search?: string;
    },
  ): Promise<{ data: Report[]; total: number; page: number; totalPages: number }> {
    try {
      const skip = (page - 1) * limit;
      const where: any = {};

      if (filters) {
        if (filters.type) where.type = filters.type;
        if (filters.generatedById) where.generatedById = filters.generatedById;
        if (filters.startDate || filters.endDate) {
          where.generatedAt = {};
          if (filters.startDate) where.generatedAt.gte = filters.startDate;
          if (filters.endDate) where.generatedAt.lte = filters.endDate;
        }
        if (filters.search) {
          where.OR = [
            { title: { contains: filters.search, mode: 'insensitive' } },
            { description: { contains: filters.search, mode: 'insensitive' } },
          ];
        }
      }

      const [reports, total] = await Promise.all([
        this.prisma.report.findMany({
          where,
          include: {
            generatedBy: {
              select: {
                id: true,
                fullName: true,
                email: true,
              },
            },
          },
          skip,
          take: limit,
          orderBy: { generatedAt: 'desc' },
        }),
        this.prisma.report.count({ where }),
      ]);

      return {
        data: reports,
        total,
        page,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      this.logger.error(`Error finding reports: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get a specific report by ID
   */
  async findOne(id: string): Promise<Report> {
    try {
      const report = await this.prisma.report.findUnique({
        where: { id },
        include: {
          generatedBy: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
        },
      });

      if (!report) {
        throw new NotFoundException(`Report with ID ${id} not found`);
      }

      return report;
    } catch (error) {
      this.logger.error(`Error finding report ${id}: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Update a report
   */
  async update(id: string, updateReportDto: UpdateReportDto): Promise<Report> {
    try {
      const report = await this.prisma.report.findUnique({
        where: { id },
      });

      if (!report) {
        throw new NotFoundException(`Report with ID ${id} not found`);
      }

      const updatedReport = await this.prisma.report.update({
        where: { id },
        data: {
          title: updateReportDto.title || report.title,
          description: updateReportDto.description || report.description,
          data: updateReportDto.data ? JSON.stringify(updateReportDto.data) : report.data,
          isPublic: updateReportDto.isPublic !== undefined ? updateReportDto.isPublic : report.isPublic,
        },
      });

      return updatedReport;
    } catch (error) {
      this.logger.error(`Error updating report ${id}: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Delete a report
   */
  async remove(id: string): Promise<void> {
    try {
      const report = await this.prisma.report.findUnique({
        where: { id },
      });

      if (!report) {
        throw new NotFoundException(`Report with ID ${id} not found`);
      }

      // Delete associated file if exists
      await this.deleteReportFile(id);

      await this.prisma.report.delete({
        where: { id },
      });

      this.logger.log(`Report ${id} deleted successfully`);
    } catch (error) {
      this.logger.error(`Error deleting report ${id}: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Generate coverage report
   */
  async generateCoverageReport(
    request: CoverageReportRequestDto,
    userId: string,
  ) {
    return this.reportGenerator.generateCoverageReport(request, userId);
  }

  /**
   * Generate facility statistics report
   */
  async generateFacilityStatsReport(
    request: FacilityStatsRequestDto,
    userId: string,
  ) {
    return this.reportGenerator.generateFacilityStatsReport(request, userId);
  }

  /**
   * Generate missed vaccines report
   */
  async generateMissedVaccinesReport(
    request: MissedVaccinesRequestDto,
    userId: string,
  ) {
    return this.reportGenerator.generateMissedVaccinesReport(request, userId);
  }

  /**
   * Generate custom report
   */
  async generateCustomReport(
    type: ReportType,
    parameters: Record<string, any>,
    userId: string,
    format?: ReportFormat,
  ) {
    return this.reportGenerator.generateCustomReport(type, parameters, userId, format);
  }

  /**
   * Schedule a report
   */
  async scheduleReport(scheduleDto: ScheduleReportDto): Promise<void> {
    return this.reportGenerator.scheduleReport(
      scheduleDto.reportId,
      scheduleDto.frequency,
      scheduleDto.recipients || [],
      scheduleDto.enabled,
    );
  }

  /**
   * Get report download URL
   */
  async getReportDownloadUrl(reportId: string): Promise<{ url: string; expiresAt: Date }> {
    const report = await this.findOne(reportId);
    
    // Check if report file exists
    const filePattern = path.join(this.reportsDir, `*${reportId}*`);
    const files = fs.readdirSync(this.reportsDir).filter(f => f.includes(reportId));
    
    if (files.length === 0) {
      // Generate file if it doesn't exist
      await this.regenerateReportFile(report);
    }

    const url = `/api/reports/download/${reportId}`;
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    return { url, expiresAt };
  }

  /**
   * Get report statistics
   */
  async getReportStatistics(
    startDate: Date,
    endDate: Date,
    userId?: string,
  ): Promise<{
    total: number;
    byType: Record<ReportType, number>;
    byUser: Array<{ userId: string; userName: string; count: number }>;
    growthRate: number;
  }> {
    const where: any = {
      generatedAt: {
        gte: startDate,
        lte: endDate,
      },
    };

    if (userId) {
      where.generatedById = userId;
    }

    const [reports, byType, byUser] = await Promise.all([
      this.prisma.report.findMany({ where }),
      this.prisma.report.groupBy({
        by: ['type'],
        where,
        _count: true,
      }),
      this.prisma.report.groupBy({
        by: ['generatedById'],
        where,
        _count: true,
      }),
    ]);

    // Get user names for byUser breakdown
    const userDetails = await Promise.all(
      byUser.map(async (item) => {
        if (!item.generatedById) {
          return {
            userId: 'unknown',
            userName: 'Unknown',
            email: undefined,
            count: item._count,
          };
        }
        const user = await this.prisma.user.findUnique({
          where: { id: item.generatedById },
          select: { fullName: true, email: true },
        });

        return {
          userId: item.generatedById,
          userName: user?.fullName || 'Unknown',
          email: user?.email,
          count: item._count,
        };
      }),
    );

    // Calculate growth rate
    const previousStart = new Date(startDate);
    previousStart.setMonth(previousStart.getMonth() - 1);
    const previousEnd = new Date(endDate);
    previousEnd.setMonth(previousEnd.getMonth() - 1);

    const previousCount = await this.prisma.report.count({
      where: {
        generatedAt: {
          gte: previousStart,
          lte: previousEnd,
        },
      },
    });

    const growthRate = previousCount > 0 
      ? ((reports.length - previousCount) / previousCount) * 100 
      : reports.length > 0 ? 100 : 0;

    return {
      total: reports.length,
      byType: byType.reduce((acc, curr) => {
        acc[curr.type] = curr._count;
        return acc;
      }, {} as Record<ReportType, number>),
      byUser: userDetails,
      growthRate,
    };
  }

  /**
   * Export reports list
   */
  async exportReportsList(
    filters?: {
      type?: ReportType;
      startDate?: Date;
      endDate?: Date;
    },
    format: 'csv' | 'excel' = 'csv',
  ): Promise<string> {
    const where: any = {};

    if (filters) {
      if (filters.type) where.type = filters.type;
      if (filters.startDate || filters.endDate) {
        where.generatedAt = {};
        if (filters.startDate) where.generatedAt.gte = filters.startDate;
        if (filters.endDate) where.generatedAt.lte = filters.endDate;
      }
    }

    const reports = await this.prisma.report.findMany({
      where,
      include: {
        generatedBy: {
          select: {
            fullName: true,
            email: true,
          },
        },
      },
      orderBy: { generatedAt: 'desc' },
    });

    if (format === 'csv') {
      return this.convertReportsToCSV(reports);
    } else {
      return this.convertReportsToExcel(reports);
    }
  }

  /**
   * Clean up old reports
   */
  async cleanupOldReports(days: number = 90): Promise<{ deleted: number }> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      // Find old reports
      const oldReports = await this.prisma.report.findMany({
        where: {
          generatedAt: {
            lt: cutoffDate,
          },
        },
        select: {
          id: true,
        },
      });

      // Delete associated files
      await Promise.all(
        oldReports.map(report => this.deleteReportFile(report.id)),
      );

      // Delete from database
      const result = await this.prisma.report.deleteMany({
        where: {
          generatedAt: {
            lt: cutoffDate,
          },
        },
      });

      this.logger.log(`Cleaned up ${result.count} reports older than ${days} days`);
      return { deleted: result.count };
    } catch (error) {
      this.logger.error(`Error cleaning up old reports: ${error.message}`);
      throw error;
    }
  }

  // Private helper methods
  private async deleteReportFile(reportId: string): Promise<void> {
    try {
      const filePattern = path.join(this.reportsDir, `*${reportId}*`);
      const files = fs.readdirSync(this.reportsDir).filter(f => f.includes(reportId));
      
      for (const file of files) {
        const filePath = path.join(this.reportsDir, file);
        fs.unlinkSync(filePath);
        this.logger.log(`Deleted report file: ${filePath}`);
      }
    } catch (error) {
      this.logger.warn(`Could not delete report file for ${reportId}: ${error.message}`);
    }
  }

  private async regenerateReportFile(report: Report): Promise<void> {
    try {
      // Parse parameters
      const parameters = JSON.parse(report.parameters || '{}');
      
      // Regenerate based on report type
      await this.reportGenerator.generateCustomReport(
        report.type,
        parameters,
        report.generatedById || report.userId,
        ReportFormat.PDF,
      );
    } catch (error) {
      this.logger.error(`Error regenerating report file for ${report.id}: ${error.message}`);
      throw error;
    }
  }

  private convertReportsToCSV(reports: any[]): string {
    let csv = 'ID,Title,Type,Generated By,Generated At,Parameters\n';
    
    reports.forEach(report => {
      const params = JSON.parse(report.parameters || '{}');
      const paramsStr = Object.entries(params)
        .map(([key, value]) => `${key}: ${value}`)
        .join('; ');
      
      csv += `"${report.id}","${report.title}","${report.type}","${report.generatedBy?.fullName || 'Unknown'}","${report.generatedAt.toISOString()}","${paramsStr}"\n`;
    });

    return csv;
  }

  private convertReportsToExcel(reports: any[]): string {
    // This would use exceljs in production
    return JSON.stringify(reports);
  }
}