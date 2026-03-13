import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  HttpCode,
  HttpStatus,
  UsePipes,
  ValidationPipe,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiParam, ApiBearerAuth } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { CreateReportDto, UpdateReportDto, ScheduleReportDto } from './dto/report-request.dto';
import { CoverageReportRequestDto } from './dto/coverage-report.dto';
import { FacilityStatsRequestDto } from './dto/facility-stats.dto';
import { MissedVaccinesRequestDto } from './dto/missed-vaccines.dto';
import { ReportType } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

@ApiTags('reports')
@Controller('reports')
@UsePipes(new ValidationPipe({ transform: true }))
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new report' })
  @ApiResponse({ status: 201, description: 'Report created successfully' })
  async create(@Body() createReportDto: CreateReportDto, @Query('userId') userId: string) {
    return this.reportsService.create(createReportDto, userId);
  }

  @Get()
  @ApiOperation({ summary: 'Get all reports with pagination and filtering' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'type', required: false, enum: ReportType })
  @ApiQuery({ name: 'generatedById', required: false, type: String })
  @ApiQuery({ name: 'startDate', required: false, type: Date })
  @ApiQuery({ name: 'endDate', required: false, type: Date })
  @ApiQuery({ name: 'search', required: false, type: String })
  async findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('type') type?: ReportType,
    @Query('generatedById') generatedById?: string,
    @Query('startDate') startDate?: Date,
    @Query('endDate') endDate?: Date,
    @Query('search') search?: string,
  ) {
    return this.reportsService.findAll(page, limit, {
      type,
      generatedById,
      startDate,
      endDate,
      search,
    });
  }

  // Specific routes must be defined BEFORE parameterized routes
  // to avoid :id catching keywords like 'coverage'

  @Get('coverage')
  @ApiOperation({ summary: 'Get immunization coverage report data' })
  @ApiResponse({ status: 200, description: 'Coverage report data retrieved' })
  async getCoverageReport(
    @Query() query: CoverageReportRequestDto,
    @Query('userId') userId?: string,
  ) {
    return this.reportsService.generateCoverageReport(query, userId || '');
  }

  @Get('coverage/download')
  @ApiOperation({ summary: 'Download coverage report' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Coverage report downloaded' })
  async downloadCoverageReport(@Query('id') id: string) {
    return this.reportsService.getReportDownloadUrl(id);
  }

  @Post('coverage')
  @ApiOperation({ summary: 'Generate immunization coverage report' })
  @ApiResponse({ status: 201, description: 'Coverage report generated successfully' })
  async generateCoverageReport(
    @Body() request: CoverageReportRequestDto,
    @Query('userId') userId: string,
  ) {
    return this.reportsService.generateCoverageReport(request, userId);
  }

  @Post('facility-stats')
  @ApiOperation({ summary: 'Generate facility statistics report' })
  @ApiResponse({ status: 201, description: 'Facility stats report generated successfully' })
  async generateFacilityStatsReport(
    @Body() request: FacilityStatsRequestDto,
    @Query('userId') userId: string,
  ) {
    return this.reportsService.generateFacilityStatsReport(request, userId);
  }

  @Post('missed-vaccines')
  @ApiOperation({ summary: 'Generate missed vaccines report' })
  @ApiResponse({ status: 201, description: 'Missed vaccines report generated successfully' })
  async generateMissedVaccinesReport(
    @Body() request: MissedVaccinesRequestDto,
    @Query('userId') userId: string,
  ) {
    return this.reportsService.generateMissedVaccinesReport(request, userId);
  }

  @Post('custom/:type')
  @ApiOperation({ summary: 'Generate custom report' })
  @ApiParam({ name: 'type', enum: ReportType })
  @ApiResponse({ status: 201, description: 'Custom report generated successfully' })
  async generateCustomReport(
    @Param('type') type: ReportType,
    @Body() parameters: Record<string, any>,
    @Query('userId') userId: string,
    @Query('format') format?: string,
  ) {
    return this.reportsService.generateCustomReport(type, parameters, userId, format as any);
  }

  @Post('schedule')
  @ApiOperation({ summary: 'Schedule a report for recurring generation' })
  @ApiResponse({ status: 200, description: 'Report scheduled successfully' })
  async scheduleReport(@Body() scheduleDto: ScheduleReportDto) {
    return this.reportsService.scheduleReport(scheduleDto);
  }

  @Get(':id/download-url')
  @ApiOperation({ summary: 'Get download URL for a report' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Download URL generated' })
  async getDownloadUrl(@Param('id') id: string) {
    return this.reportsService.getReportDownloadUrl(id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific report by ID' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Report found' })
  @ApiResponse({ status: 404, description: 'Report not found' })
  async findOne(@Param('id') id: string) {
    return this.reportsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a report' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Report updated successfully' })
  async update(@Param('id') id: string, @Body() updateReportDto: UpdateReportDto) {
    return this.reportsService.update(id, updateReportDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a report' })
  @ApiParam({ name: 'id', type: String })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiResponse({ status: 204, description: 'Report deleted successfully' })
  async remove(@Param('id') id: string) {
    return this.reportsService.remove(id);
  }

  @Get('download/:id')
  @ApiOperation({ summary: 'Download a report file' })
  @ApiParam({ name: 'id', type: String })
  async downloadReport(@Param('id') id: string, @Res() res: Response) {
    const report = await this.reportsService.findOne(id);
    
    // Find the report file
    const reportsDir = path.join(process.cwd(), 'storage', 'reports');
    const files = fs.readdirSync(reportsDir).filter(f => f.includes(id));
    
    if (files.length === 0) {
      return res.status(404).json({ message: 'Report file not found' });
    }

    const filePath = path.join(reportsDir, files[0]);
    const fileExt = path.extname(filePath).toLowerCase();
    
    // Set appropriate content type
    let contentType = 'application/octet-stream';
    switch (fileExt) {
      case '.pdf':
        contentType = 'application/pdf';
        break;
      case '.xlsx':
        contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        break;
      case '.csv':
        contentType = 'text/csv';
        break;
      case '.html':
        contentType = 'text/html';
        break;
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${report.title}${fileExt}"`);
    
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  }

  @Get('stats/summary')
  @ApiOperation({ summary: 'Get report generation statistics' })
  @ApiQuery({ name: 'startDate', required: true, type: Date })
  @ApiQuery({ name: 'endDate', required: true, type: Date })
  @ApiQuery({ name: 'userId', required: false, type: String })
  async getReportStatistics(
    @Query('startDate') startDate: Date,
    @Query('endDate') endDate: Date,
    @Query('userId') userId?: string,
  ) {
    return this.reportsService.getReportStatistics(new Date(startDate), new Date(endDate), userId);
  }

  @Get('export/list')
  @ApiOperation({ summary: 'Export reports list' })
  @ApiQuery({ name: 'type', required: false, enum: ReportType })
  @ApiQuery({ name: 'startDate', required: false, type: Date })
  @ApiQuery({ name: 'endDate', required: false, type: Date })
  @ApiQuery({ name: 'format', required: false, enum: ['csv', 'excel'] })
  async exportReportsList(
    @Query('type') type?: ReportType,
    @Query('startDate') startDate?: Date,
    @Query('endDate') endDate?: Date,
    @Query('format') format: 'csv' | 'excel' = 'csv',
  ) {
    return this.reportsService.exportReportsList(
      { type, startDate, endDate },
      format,
    );
  }

  @Post('cleanup')
  @ApiOperation({ summary: 'Clean up old reports' })
  @ApiQuery({ name: 'days', required: false, type: Number, description: 'Delete reports older than X days' })
  async cleanupOldReports(@Query('days') days: number = 90) {
    return this.reportsService.cleanupOldReports(days);
  }

  @Get('types/supported')
  @ApiOperation({ summary: 'Get supported report types' })
  getSupportedReportTypes() {
    return {
      types: [
        {
          type: 'COVERAGE',
          name: 'Immunization Coverage Report',
          description: 'Reports on vaccination coverage rates at various levels',
          parameters: ['startDate', 'endDate', 'county', 'subCounty', 'facilityId'],
        },
        {
          type: 'FACILITY_PERFORMANCE',
          name: 'Facility Performance Report',
          description: 'Performance metrics for health facilities',
          parameters: ['startDate', 'endDate', 'county', 'subCounty', 'facilityIds'],
        },
        {
          type: 'MISSED_VACCINES',
          name: 'Missed Vaccines Report',
          description: 'Report on children who missed vaccinations',
          parameters: ['startDate', 'endDate', 'county', 'subCounty', 'vaccineIds', 'daysOverdue'],
        },
        {
          type: 'DEMOGRAPHIC',
          name: 'Demographic Distribution Report',
          description: 'Analysis of immunization by demographic factors',
          parameters: ['startDate', 'endDate', 'dimension'],
        },
        {
          type: 'TIMELINESS',
          name: 'Vaccination Timeliness Report',
          description: 'Analysis of vaccination timeliness',
          parameters: ['startDate', 'endDate', 'ageToleranceDays'],
        },
      ],
    };
  }

  @Get('templates/available')
  @ApiOperation({ summary: 'Get available report templates' })
  getAvailableTemplates() {
    return {
      templates: [
        {
          id: 'coverage-national',
          name: 'National Coverage Report',
          type: 'COVERAGE',
          description: 'Standard national immunization coverage report',
          parameters: {
            startDate: '2024-01-01',
            endDate: '2024-12-31',
            includeComparisons: true,
            includeFacilityBreakdown: true,
            includeRecommendations: true,
          },
        },
        {
          id: 'facility-monthly',
          name: 'Monthly Facility Performance',
          type: 'FACILITY_PERFORMANCE',
          description: 'Monthly performance report for facilities',
          parameters: {
            startDate: '2024-01-01',
            endDate: '2024-01-31',
            includePerformanceRanking: true,
            includeGrowthMetrics: true,
          },
        },
        {
          id: 'missed-vaccines-quarterly',
          name: 'Quarterly Missed Vaccines',
          type: 'MISSED_VACCINES',
          description: 'Quarterly report on missed vaccinations',
          parameters: {
            startDate: '2024-01-01',
            endDate: '2024-03-31',
            daysOverdue: 30,
            includeContactInfo: true,
            includeFollowUpPlan: true,
          },
        },
      ],
    };
  }
}