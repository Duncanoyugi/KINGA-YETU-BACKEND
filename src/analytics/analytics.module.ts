import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';
import { DataMiningService } from './data-mining.service';
import { PredictionModel } from './models/prediction.model';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    ConfigModule,
    ScheduleModule.forRoot(),
    PrismaModule,
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService, DataMiningService, PredictionModel],
  exports: [AnalyticsService, DataMiningService, PredictionModel],
})
export class AnalyticsModule {}