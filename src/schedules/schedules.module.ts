import { Module } from '@nestjs/common';
import { SchedulesService } from './schedules.service';
import { SchedulesController } from './schedules.controller';
import { ScheduleCalculatorService } from './schedule-calculator.service';
import { PrismaModule } from '../prisma/prisma.module';
import { VaccinesModule } from '../vaccines/vaccines.module';

@Module({
  imports: [PrismaModule, VaccinesModule],
  controllers: [SchedulesController],
  providers: [SchedulesService, ScheduleCalculatorService],
  exports: [SchedulesService, ScheduleCalculatorService],
})
export class SchedulesModule {}