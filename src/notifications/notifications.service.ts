import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { NotificationQueueService, NotificationOptions } from './notification-queue.service';
import { SmsProvider, SmsOptions } from './providers/sms.provider';
import { EmailProvider, EmailOptions } from './providers/email.provider';
import { PushProvider, PushNotificationOptions } from './providers/push.provider';
import { NotificationType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationQueue: NotificationQueueService,
    private readonly smsProvider: SmsProvider,
    private readonly emailProvider: EmailProvider,
    private readonly pushProvider: PushProvider,
  ) {}

  /**
   * Send immediate notification
   */
  async sendNotification(options: NotificationOptions): Promise<string> {
    try {
      return await this.notificationQueue.queueNotification(options);
    } catch (error) {
      this.logger.error(`Failed to send notification: ${error.message}`);
      throw error;
    }
  }

  /**
   * Send vaccine reminder
   */
  async sendVaccineReminder(userId: string, data: {
    childName: string;
    vaccineName: string;
    dueDate: string;
    daysRemaining: number;
    facilityName: string;
  }): Promise<string> {
    return this.sendNotification({
      type: NotificationType.VACCINE_REMINDER,
      userId,
      title: `Vaccination Reminder: ${data.childName}`,
      message: `${data.childName} has ${data.vaccineName} due on ${data.dueDate}. ${data.daysRemaining} days remaining. Facility: ${data.facilityName}`,
      data: {
        ...data,
        actionUrl: `/vaccines/due/${data.childName}`,
        priority: data.daysRemaining <= 2 ? 'high' : 'normal',
      },
      priority: data.daysRemaining <= 2 ? 'high' : 'normal',
    });
  }

  /**
   * Send appointment confirmation
   */
  async sendAppointmentConfirmation(userId: string, data: {
    childName: string;
    vaccineName: string;
    appointmentDate: string;
    facilityName: string;
    appointmentId: string;
  }): Promise<string> {
    return this.sendNotification({
      type: NotificationType.APPOINTMENT_CONFIRMATION,
      userId,
      title: `Appointment Confirmed: ${data.childName}`,
      message: `Appointment confirmed for ${data.childName}'s ${data.vaccineName} on ${data.appointmentDate} at ${data.facilityName}`,
      data: {
        ...data,
        actionUrl: `/appointments/${data.appointmentId}`,
      },
    });
  }

  /**
   * Send report ready notification
   */
  async sendReportReady(userId: string, data: {
    reportTitle: string;
    reportType: string;
    downloadUrl: string;
    generatedDate: string;
  }): Promise<string> {
    return this.sendNotification({
      type: NotificationType.REPORT_READY,
      userId,
      title: `Report Ready: ${data.reportTitle}`,
      message: `Your ${data.reportType} report "${data.reportTitle}" is ready for download. Generated on ${data.generatedDate}.`,
      data: {
        ...data,
        actionUrl: data.downloadUrl,
      },
    });
  }

  /**
   * Send system alert
   */
  async sendSystemAlert(userId: string, data: {
    alertType: string;
    message: string;
    severity: 'info' | 'warning' | 'error' | 'critical';
    actionRequired?: boolean;
  }): Promise<string> {
    return this.sendNotification({
      type: NotificationType.SYSTEM_ALERT,
      userId,
      title: `System Alert: ${data.alertType}`,
      message: data.message,
      data: {
        ...data,
        priority: data.severity === 'critical' ? 'high' : 'normal',
      },
      priority: data.severity === 'critical' ? 'high' : 'normal',
    });
  }

  /**
   * Send security alert
   */
  async sendSecurityAlert(userId: string, data: {
    alertType: 'login' | 'password_change' | 'suspicious_activity';
    message: string;
    location?: string;
    device?: string;
  }): Promise<string> {
    return this.sendNotification({
      type: NotificationType.SECURITY_ALERT,
      userId,
      title: `Security Alert: ${data.alertType}`,
      message: data.message,
      data: {
        ...data,
        priority: 'high',
        requiresImmediateAttention: true,
      },
      priority: 'high',
      channels: ['push', 'sms'], // Security alerts go through all channels
    });
  }

  /**
   * Send immediate SMS
   */
  async sendSms(options: SmsOptions) {
    return this.smsProvider.sendSms(options);
  }

  /**
   * Send immediate email
   */
  async sendEmail(options: EmailOptions) {
    return this.emailProvider.sendEmail(options);
  }

  /**
   * Send immediate push notification
   */
  async sendPush(options: PushNotificationOptions) {
    return this.pushProvider.sendPushNotification(options);
  }

  /**
   * Get user notifications
   */
  async getUserNotifications(userId: string, page?: number, limit?: number, unreadOnly?: boolean) {
    return this.notificationQueue.getUserNotifications(userId, page, limit, unreadOnly);
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string) {
    return this.notificationQueue.markAsRead(notificationId);
  }

  /**
   * Mark all notifications as read for user
   */
  async markAllAsRead(userId: string): Promise<number> {
    try {
      const result = await this.notificationQueue['prisma'].notification.updateMany({
        where: { userId, isRead: false },
        data: { isRead: true },
      });

      this.logger.log(`Marked ${result.count} notifications as read for user ${userId}`);
      return result.count;
    } catch (error) {
      this.logger.error(`Failed to mark all as read for user ${userId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get notification statistics
   */
  async getStatistics(startDate: Date, endDate: Date) {
    return this.notificationQueue.getStatistics(startDate, endDate);
  }

  /**
   * Check service status
   */
  async getServiceStatus() {
    return {
      sms: this.smsProvider.isReady(),
      email: true, // Email is always ready through MailerService
      push: this.pushProvider.isReady(),
      queue: true,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Clear template cache
   */
  clearTemplateCache(): void {
    this.emailProvider.clearCache();
    this.logger.log('Notification template cache cleared');
  }

  /**
   * Test notification delivery
   */
  async testNotification(userId: string, channel: 'email' | 'sms' | 'push'): Promise<boolean> {
    try {
      switch (channel) {
        case 'email':
          await this.emailProvider.sendEmail({
            to: 'test@example.com', // Would need actual user email
            subject: 'Test Notification',
            html: '<p>This is a test notification from ImmuniTrack Kenya</p>',
          });
          break;
        case 'sms':
          await this.smsProvider.sendSms({
            to: '+254700000000', // Would need actual user phone
            message: 'Test SMS from ImmuniTrack Kenya',
          });
          break;
        case 'push':
          await this.pushProvider.sendPushNotification({
            token: 'test-token', // Would need actual device token
            title: 'Test Notification',
            body: 'This is a test push notification',
          });
          break;
      }
      return true;
    } catch (error) {
      this.logger.error(`Test notification failed for ${channel}: ${error.message}`);
      return false;
    }
  }

  /**
   * Get notification preferences for a user
   */
  async getNotificationPreferences(userId: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          emailNotifications: true,
          smsNotifications: true,
          pushNotifications: true,
          quietHoursStart: true,
          quietHoursEnd: true,
          reminderDays: true,
        },
      });

      if (!user) {
        throw new NotFoundException(`User with ID ${userId} not found`);
      }

      return {
        emailNotifications: user.emailNotifications ?? true,
        smsNotifications: user.smsNotifications ?? true,
        pushNotifications: user.pushNotifications ?? true,
        quietHoursStart: user.quietHoursStart ?? '22:00',
        quietHoursEnd: user.quietHoursEnd ?? '07:00',
        reminderDays: user.reminderDays ?? [7, 3, 1],
      };
    } catch (error) {
      this.logger.error(`Failed to get notification preferences: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update notification preferences for a user
   */
  async updateNotificationPreferences(
    userId: string,
    updateData: {
      emailNotifications?: boolean;
      smsNotifications?: boolean;
      pushNotifications?: boolean;
      quietHoursStart?: string;
      quietHoursEnd?: string;
      reminderDays?: number[];
    },
  ) {
    try {
      const user = await this.prisma.user.update({
        where: { id: userId },
        data: {
          ...(updateData.emailNotifications !== undefined && { emailNotifications: updateData.emailNotifications }),
          ...(updateData.smsNotifications !== undefined && { smsNotifications: updateData.smsNotifications }),
          ...(updateData.pushNotifications !== undefined && { pushNotifications: updateData.pushNotifications }),
          ...(updateData.quietHoursStart !== undefined && { quietHoursStart: updateData.quietHoursStart }),
          ...(updateData.quietHoursEnd !== undefined && { quietHoursEnd: updateData.quietHoursEnd }),
          ...(updateData.reminderDays !== undefined && { reminderDays: updateData.reminderDays }),
        },
        select: {
          id: true,
          emailNotifications: true,
          smsNotifications: true,
          pushNotifications: true,
          quietHoursStart: true,
          quietHoursEnd: true,
          reminderDays: true,
        },
      });

      this.logger.log(`Updated notification preferences for user ${userId}`);

      return {
        emailNotifications: user.emailNotifications,
        smsNotifications: user.smsNotifications,
        pushNotifications: user.pushNotifications,
        quietHoursStart: user.quietHoursStart,
        quietHoursEnd: user.quietHoursEnd,
        reminderDays: user.reminderDays,
      };
    } catch (error) {
      this.logger.error(`Failed to update notification preferences: ${error.message}`);
      throw error;
    }
  }
}