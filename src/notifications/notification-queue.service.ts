import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { SmsProvider } from './providers/sms.provider';
import { EmailProvider } from './providers/email.provider';
import { PushProvider } from './providers/push.provider';
import { NotificationType, Prisma } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import * as handlebars from 'handlebars';

export interface NotificationOptions {
  type: NotificationType;
  userId: string;
  title: string;
  message: string;
  data?: Record<string, any>;
  priority?: 'low' | 'normal' | 'high';
  scheduledFor?: Date;
  channels?: ('email' | 'sms' | 'push')[];
}

export interface NotificationStats {
  queued: number;
  sent: number;
  failed: number;
  pending: number;
  byType: Record<NotificationType, number>;
  byChannel: Record<string, number>;
}

@Injectable()
export class NotificationQueueService {
  private readonly logger = new Logger(NotificationQueueService.name);
  private smsTemplateCache = new Map<string, string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly smsProvider: SmsProvider,
    private readonly emailProvider: EmailProvider,
    private readonly pushProvider: PushProvider,
  ) {}

  /**
   * Queue a notification for sending
   */
  async queueNotification(options: NotificationOptions): Promise<string> {
    try {
      // Create notification record
      const notification = await this.prisma.notification.create({
        data: {
          userId: options.userId,
          type: options.type,
          title: options.title,
          message: options.message,
          data: options.data ? JSON.stringify(options.data) : '{}',
          sentAt: options.scheduledFor || new Date(),
          isRead: false,
        },
      });

      this.logger.debug(`Queued notification ${notification.id} for user ${options.userId}`);
      return notification.id;
    } catch (error) {
      this.logger.error(`Failed to queue notification: ${error.message}`);
      throw error;
    }
  }

  /**
   * Process pending notifications
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async processPendingNotifications(): Promise<void> {
    try {
      const pendingNotifications = await this.prisma.notification.findMany({
        where: {
          sentAt: {
            lte: new Date(),
          },
          isRead: false,
        },
        include: {
          user: {
            select: {
              email: true,
              phoneNumber: true,
              notifications: {
                where: {
                  type: NotificationType.PUSH_NOTIFICATION,
                  isRead: false,
                },
                orderBy: {
                  sentAt: 'desc',
                },
                take: 1,
              },
            },
          },
        },
        take: 100, // Process in batches
      });

      this.logger.debug(`Processing ${pendingNotifications.length} pending notifications`);

      for (const notification of pendingNotifications) {
        await this.sendNotification(notification);
      }
    } catch (error) {
      this.logger.error(`Error processing notifications: ${error.message}`);
    }
  }

  /**
   * Send notification through appropriate channels
   */
  private async sendNotification(notification: any): Promise<void> {
    try {
      const user = notification.user;
      const data = notification.data ? JSON.parse(notification.data) : {};
      const channels = data.channels || this.determineChannels(notification.type, user);

      const results = await Promise.allSettled(
        channels.map(channel => this.sendViaChannel(notification, user, channel, data)),
      );

      // Mark notification as sent
      await this.prisma.notification.update({
        where: { id: notification.id },
        data: {
          data: JSON.stringify({
            ...data,
            channelsAttempted: channels,
            sentResults: results.map(r => r.status),
            sentAt: new Date().toISOString(),
          }),
        },
      });

      // Log results
      const successful = results.filter(r => r.status === 'fulfilled');
      const failed = results.filter(r => r.status === 'rejected');
      
      if (failed.length > 0) {
        this.logger.warn(`Notification ${notification.id}: ${successful.length}/${channels.length} channels successful`);
      } else {
        this.logger.debug(`Notification ${notification.id} sent successfully via ${channels.length} channels`);
      }
    } catch (error) {
      this.logger.error(`Failed to send notification ${notification.id}: ${error.message}`);
    }
  }

  /**
   * Send notification via specific channel
   */
  private async sendViaChannel(
    notification: any,
    user: any,
    channel: string,
    data: Record<string, any>,
  ): Promise<void> {
    switch (channel) {
      case 'email':
        await this.sendEmailNotification(notification, user, data);
        break;
      case 'sms':
        await this.sendSmsNotification(notification, user, data);
        break;
      case 'push':
        await this.sendPushNotification(notification, user, data);
        break;
      default:
        throw new Error(`Unsupported channel: ${channel}`);
    }
  }

  /**
   * Send email notification
   */
  private async sendEmailNotification(notification: any, user: any, data: Record<string, any>): Promise<void> {
    if (!user.email) {
      throw new Error('User email not available');
    }

    const templateName = this.getEmailTemplateName(notification.type);
    const templateData = {
      ...data,
      userName: user.fullName || user.email.split('@')[0],
      notificationTitle: notification.title,
      notificationMessage: notification.message,
      sentAt: new Date().toLocaleString(),
    };

    await this.emailProvider.sendEmail({
      to: user.email,
      subject: notification.title,
      template: templateName,
      templateData,
    });
  }

  /**
   * Send SMS notification
   */
  private async sendSmsNotification(notification: any, user: any, data: Record<string, any>): Promise<void> {
    if (!user.phoneNumber) {
      throw new Error('User phone number not available');
    }

    const template = this.getSmsTemplate(notification.type);
    const message = this.renderSmsTemplate(template, {
      ...data,
      message: notification.message,
    });

    await this.smsProvider.sendSms({
      to: user.phoneNumber,
      message: message.substring(0, 160), // SMS length limit
      from: 'ImmuniTrack',
    });
  }

  /**
   * Send push notification
   */
  private async sendPushNotification(notification: any, user: any, data: Record<string, any>): Promise<void> {
    // Get device token from user's last push notification or profile
    const deviceToken = data.deviceToken || user.notifications?.[0]?.data?.deviceToken;
    
    if (!deviceToken) {
      throw new Error('User device token not available');
    }

    await this.pushProvider.sendPushNotification({
      token: deviceToken,
      title: notification.title,
      body: notification.message,
      data: {
        notificationId: notification.id,
        type: notification.type,
        ...data,
      },
      priority: data.priority || 'normal',
    });
  }

  /**
   * Determine which channels to use based on notification type and user preferences
   */
  private determineChannels(type: NotificationType, user: any): string[] {
    const defaultChannels: Record<string, string[]> = {
      VACCINE_REMINDER: ['sms', 'push'],
      APPOINTMENT_CONFIRMATION: ['sms', 'email'],
      REPORT_READY: ['email', 'push'],
      SYSTEM_ALERT: ['push', 'email', 'sms'],
      SECURITY_ALERT: ['push', 'sms'],
      PUSH_NOTIFICATION: ['push'],
      UPDATE: ['push', 'email'],
      REMINDER: ['sms', 'push'],
      ALERT: ['push', 'email', 'sms'],
      SYSTEM: ['push', 'email'],
    };

    const channels = defaultChannels[type] || ['push'];

    // Filter based on user availability
    return channels.filter(channel => {
      switch (channel) {
        case 'email':
          return !!user.email;
        case 'sms':
          return !!user.phoneNumber;
        case 'push':
          return true; // Assume push is always available
        default:
          return false;
      }
    });
  }

  /**
   * Get email template name for notification type
   */
  private getEmailTemplateName(type: NotificationType): string {
    const templateMap: Record<string, string> = {
      VACCINE_REMINDER: 'reminder-email',
      APPOINTMENT_CONFIRMATION: 'reminder-email',
      REPORT_READY: 'report-ready',
      SYSTEM_ALERT: 'system-alert',
      SECURITY_ALERT: 'security-alert',
      PUSH_NOTIFICATION: 'push-notification',
      UPDATE: 'system-alert',
      REMINDER: 'reminder-email',
      ALERT: 'system-alert',
      SYSTEM: 'system-alert',
    };

    return templateMap[type] || 'default';
  }

  /**
   * Get SMS template for notification type
   */
  private getSmsTemplate(type: NotificationType): string {
    if (this.smsTemplateCache.has(type)) {
      return this.smsTemplateCache.get(type)!;
    }

    const templateMap: Record<string, string> = {
      VACCINE_REMINDER: 'reminder-sms',
      APPOINTMENT_CONFIRMATION: 'reminder-sms',
      REPORT_READY: 'report-sms',
      SYSTEM_ALERT: 'alert-sms',
      SECURITY_ALERT: 'alert-sms',
      PUSH_NOTIFICATION: 'push-sms',
      UPDATE: 'alert-sms',
      REMINDER: 'reminder-sms',
      ALERT: 'alert-sms',
      SYSTEM: 'alert-sms',
    };

    const templateName = templateMap[type] || 'default';
    const templatePath = path.join(
      __dirname,
      'templates',
      'sms',
      `${templateName}.template.txt`,
    );

    try {
      const template = fs.readFileSync(templatePath, 'utf8');
      this.smsTemplateCache.set(type, template);
      return template;
    } catch (error) {
      this.logger.warn(`SMS template not found for ${type}, using default`);
      return '{{message}}';
    }
  }

  /**
   * Render SMS template with data
   */
  private renderSmsTemplate(template: string, data: Record<string, any>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return data[key] !== undefined ? String(data[key]) : match;
    });
  }

  /**
   * Get notification statistics
   */
  async getStatistics(startDate: Date, endDate: Date): Promise<NotificationStats> {
    const [total, byType, byChannel] = await Promise.all([
      this.prisma.notification.count({
        where: {
          sentAt: {
            gte: startDate,
            lte: endDate,
          },
        },
      }),
      this.prisma.notification.groupBy({
        by: ['type'],
        where: {
          sentAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        _count: true,
      }),
      // This would require additional tracking of channel usage
      this.getChannelStatistics(startDate, endDate),
    ]);

    const pending = await this.prisma.notification.count({
      where: {
        sentAt: {
          gte: startDate,
          lte: endDate,
        },
        isRead: false,
      },
    });

    return {
      queued: total,
      sent: total - pending,
      failed: 0, // Would need failure tracking
      pending,
      byType: byType.reduce((acc, curr) => {
        acc[curr.type] = curr._count;
        return acc;
      }, {} as Record<NotificationType, number>),
      byChannel: byChannel,
    };
  }

  private async getChannelStatistics(startDate: Date, endDate: Date): Promise<Record<string, number>> {
    // Implement channel statistics tracking
    return {
      email: 0,
      sms: 0,
      push: 0,
    };
  }

  /**
   * Clean old notifications
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanOldNotifications(): Promise<void> {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const result = await this.prisma.notification.deleteMany({
        where: {
          sentAt: {
            lt: thirtyDaysAgo,
          },
          isRead: true,
        },
      });

      this.logger.log(`Cleaned ${result.count} old notifications`);
    } catch (error) {
      this.logger.error(`Failed to clean old notifications: ${error.message}`);
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string): Promise<void> {
    await this.prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });
  }

  /**
   * Get user notifications
   */
  async getUserNotifications(
    userId: string,
    page: number = 1,
    limit: number = 20,
    unreadOnly: boolean = false,
  ): Promise<{ data: any[]; total: number; unreadCount: number }> {
    const skip = (page - 1) * limit;
    const where: Prisma.NotificationWhereInput = { userId };

    if (unreadOnly) {
      where.isRead = false;
    }

    const [notifications, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { sentAt: 'desc' },
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { userId, isRead: false } }),
    ]);

    return {
      data: notifications,
      total,
      unreadCount,
    };
  }
}