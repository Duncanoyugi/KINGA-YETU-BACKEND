import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
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
import { SystemModule } from './system/system.module';
import { AgentsModule } from './agents/agents.module';
import { validateEnv } from './common/config/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validate: validateEnv,
    }),
    // Global request-rate limiting. Per-route limits (e.g. tighter ones
    // on /auth/login, /auth/register, /otp/*) are layered on top with
    // the @Throttle() decorator on those controllers — see
    // auth.controller.ts and otp.controller.ts.
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60_000, // 1 minute
        limit: 120, // 120 requests / minute / IP across the whole API
      },
    ]),
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
    FacilitiesModule,
    SystemModule,
    AgentsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
