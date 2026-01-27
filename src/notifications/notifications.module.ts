import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { MailerModule } from '../mailer/mailer.module';
import { NotificationsService } from './notifications.service';
import { NotificationQueueService } from './notification-queue.service';
import { SmsProvider } from './providers/sms.provider';
import { EmailProvider } from './providers/email.provider';
import { PushProvider } from './providers/push.provider';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ConfigModule,
    PrismaModule,
    MailerModule,
  ],
  providers: [
    NotificationsService,
    NotificationQueueService,
    SmsProvider,
    EmailProvider,
    PushProvider,
  ],
  exports: [
    NotificationsService,
    NotificationQueueService,
    SmsProvider,
    EmailProvider,
    PushProvider,
  ],
})
export class NotificationsModule {}