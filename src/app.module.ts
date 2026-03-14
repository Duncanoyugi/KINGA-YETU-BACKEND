import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ParentsModule } from './parents/parents.module';
import { ChildrenModule } from './children/children.module';
import { VaccinesModule } from './vaccines/vaccines.module';
import { ImmunizationsModule } from './immunizations/immunizations.module';
import { SchedulesModule } from './schedules/schedules.module';
import { RemindersModule } from './reminders/reminders.module';
import { ReportsModule } from './reports/reports.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { MailerModule } from './mailer/mailer.module';
import { OtpModule } from './otp/otp.module';
import { FacilitiesModule } from './facilities/facilities.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    ParentsModule,
    ChildrenModule,
    VaccinesModule,
    ImmunizationsModule,
    SchedulesModule,
    RemindersModule,
    ReportsModule,
    NotificationsModule,
    AnalyticsModule,
    MailerModule,
    OtpModule,
    FacilitiesModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
