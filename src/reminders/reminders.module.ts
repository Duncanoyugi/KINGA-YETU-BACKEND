import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { RemindersService } from './reminders.service';
import { RemindersController } from './reminders.controller';
import { ReminderEngineService } from './reminder-engine.service';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SchedulesModule } from '../schedules/schedules.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    NotificationsModule,
    SchedulesModule,
  ],
  controllers: [RemindersController],
  providers: [RemindersService, ReminderEngineService],
  exports: [RemindersService, ReminderEngineService],
})
export class RemindersModule {}