import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { ReportGeneratorService } from './report-generator.service';
import { CoverageReportTemplate } from './templates/coverage-report.template';
import { FacilityReportTemplate } from './templates/facility-report.template';
import { PrismaModule } from '../prisma/prisma.module';
import { AnalyticsModule } from '../analytics/analytics.module';

@Module({
  imports: [
    ConfigModule,
    ScheduleModule.forRoot(),
    PrismaModule,
    AnalyticsModule,
  ],
  controllers: [ReportsController],
  providers: [
    ReportsService,
    ReportGeneratorService,
    CoverageReportTemplate,
    FacilityReportTemplate,
  ],
  exports: [ReportsService, ReportGeneratorService],
})
export class ReportsModule {}