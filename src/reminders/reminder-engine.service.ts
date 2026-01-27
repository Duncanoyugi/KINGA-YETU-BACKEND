import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SchedulerRegistry } from '@nestjs/schedule';
import { ReminderType, ReminderStatus, ImmunizationStatus, Prisma } from '@prisma/client';
import { CreateReminderDto } from './dto/reminder-request.dto';
import moment from 'moment';

@Injectable()
export class ReminderEngineService {
  private readonly logger = new Logger(ReminderEngineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private schedulerRegistry: SchedulerRegistry,
  ) {}

  /**
   * Generate reminders for upcoming vaccinations based on KEPI guidelines
   */
  async generateVaccinationReminders(
    startDate: Date,
    endDate: Date,
    facilityId?: string,
    reminderTypes?: ReminderType[],
  ): Promise<{ created: number; skipped: number }> {
    try {
      this.logger.log(`Generating reminders from ${startDate} to ${endDate}`);

      // Get upcoming vaccination schedules
      const whereCondition: Prisma.VaccinationScheduleWhereInput = {
        dueDate: {
          gte: startDate,
          lte: endDate,
        },
        status: ImmunizationStatus.SCHEDULED,
      };

      if (facilityId) {
        // Get children in this facility
        const childrenInFacility = await this.prisma.child.findMany({
          where: { birthFacilityId: facilityId },
          select: { id: true },
        });
        
        whereCondition.childId = {
          in: childrenInFacility.map(child => child.id),
        };
      }

      const schedules = await this.prisma.vaccinationSchedule.findMany({
        where: whereCondition,
        include: {
          child: {
            include: {
              parent: {
                include: {
                  user: {
                    select: {
                      email: true,
                      phoneNumber: true,
                    },
                  },
                },
              },
            },
          },
          vaccine: true,
        },
      });

      let created = 0;
      let skipped = 0;

      for (const schedule of schedules) {
        try {
          // Check if reminder already exists for this schedule
          const existingReminder = await this.prisma.reminder.findFirst({
            where: {
              childId: schedule.childId,
              vaccineId: schedule.vaccineId,
              scheduledFor: {
                gte: new Date(startDate),
                lte: new Date(endDate),
              },
              status: {
                in: [ReminderStatus.PENDING, ReminderStatus.SENT],
              },
            },
          });

          if (existingReminder) {
            skipped++;
            continue;
          }

          // Generate tiered reminders (7 days, 3 days, 1 day before)
          const reminderDates = this.calculateTieredReminderDates(schedule.dueDate);
          const parent = schedule.child.parent;
          
          for (const reminderDate of reminderDates) {
            const reminderType = this.getReminderTypeForDaysBefore(schedule.dueDate, reminderDate);
            
            // Skip if specific types are requested and this type isn't included
            if (reminderTypes && reminderTypes.length > 0 && !reminderTypes.includes(reminderType)) {
              continue;
            }

            const message = this.generateReminderMessage(
              schedule.child.firstName,
              schedule.vaccine.name,
              reminderDate,
              schedule.dueDate,
              reminderType,
            );

            await this.prisma.reminder.create({
              data: {
                childId: schedule.childId,
                parentId: schedule.child.parentId,
                vaccineId: schedule.vaccineId,
                type: reminderType,
                message: message,
                scheduledFor: reminderDate,
                status: ReminderStatus.PENDING,
                metadata: JSON.stringify({
                  scheduleId: schedule.id,
                  daysBefore: moment(schedule.dueDate).diff(moment(reminderDate), 'days'),
                  vaccineName: schedule.vaccine.name,
                  childName: `${schedule.child.firstName} ${schedule.child.lastName}`,
                  dueDate: schedule.dueDate,
                }),
              },
            });

            created++;
          }
        } catch (error) {
          this.logger.error(`Error generating reminder for schedule ${schedule.id}: ${error.message}`);
          skipped++;
        }
      }

      this.logger.log(`Generated ${created} reminders, skipped ${skipped}`);
      return { created, skipped };
    } catch (error) {
      this.logger.error(`Error generating reminders: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Process and send pending reminders
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async processPendingReminders(): Promise<void> {
    try {
      const pendingReminders = await this.prisma.reminder.findMany({
        where: {
          status: ReminderStatus.PENDING,
          scheduledFor: {
            lte: new Date(),
          },
          OR: [
            { retryCount: { lt: 3 } },
          ],
        },
        include: {
          child: {
            include: {
              parent: {
                include: {
                  user: {
                    select: {
                      email: true,
                      phoneNumber: true,
                    },
                  },
                },
              },
            },
          },
          vaccine: true,
        },
        take: 100, // Process in batches
      });

      for (const reminder of pendingReminders) {
        await this.sendReminder(reminder);
      }
    } catch (error) {
      this.logger.error(`Error processing reminders: ${error.message}`);
    }
  }

  /**
   * Handle missed appointments escalation
   */
  @Cron(CronExpression.EVERY_HOUR)
  async escalateMissedAppointments(): Promise<void> {
    try {
      // Find scheduled vaccinations that are overdue and not administered
      const overdueSchedules = await this.prisma.vaccinationSchedule.findMany({
        where: {
          dueDate: {
            lt: new Date(),
          },
          status: ImmunizationStatus.SCHEDULED,
        },
        include: {
          child: {
            include: {
              parent: {
                include: {
                  user: true,
                },
              },
            },
          },
          vaccine: true,
        },
      });

      for (const schedule of overdueSchedules) {
        // Check if escalation reminder already exists
        const existingEscalation = await this.prisma.reminder.findFirst({
          where: {
            childId: schedule.childId,
            vaccineId: schedule.vaccineId,
            type: ReminderType.SMS, // Escalation reminders are SMS
            scheduledFor: {
              gte: new Date(new Date().setHours(0, 0, 0, 0)),
            },
          },
        });

        if (!existingEscalation) {
          const daysOverdue = Math.floor(
            (new Date().getTime() - schedule.dueDate.getTime()) / (1000 * 60 * 60 * 24),
          );

          // Create escalation reminder
          const message = this.generateEscalationMessage(
            schedule.child.firstName,
            schedule.vaccine.name,
            daysOverdue,
            schedule.dueDate,
          );

          await this.prisma.reminder.create({
            data: {
              childId: schedule.childId,
              parentId: schedule.child.parentId,
              vaccineId: schedule.vaccineId,
              type: ReminderType.SMS,
              message: message,
              scheduledFor: new Date(),
              status: ReminderStatus.PENDING,
              metadata: JSON.stringify({
                scheduleId: schedule.id,
                daysOverdue: daysOverdue,
                isEscalation: true,
                escalationLevel: this.calculateEscalationLevel(daysOverdue),
                dueDate: schedule.dueDate,
              }),
            },
          });

          // Update schedule status to MISSED if overdue by more than 30 days
          if (daysOverdue > 30) {
            await this.prisma.vaccinationSchedule.update({
              where: { id: schedule.id },
              data: { status: ImmunizationStatus.MISSED },
            });
          }
        }
      }
    } catch (error) {
      this.logger.error(`Error escalating missed appointments: ${error.message}`);
    }
  }

  /**
   * Send a reminder through the appropriate channel
   */
  async sendReminder(reminder: any): Promise<void> {
    try {
      this.logger.log(`Sending reminder ${reminder.id} via ${reminder.type}`);
      
      // Update status to sending
      await this.prisma.reminder.update({
        where: { id: reminder.id },
        data: {
          status: ReminderStatus.SENT,
          batchNumber: `BATCH-${Date.now()}`,
        },
      });

      // Send through appropriate channel
      switch (reminder.type) {
        case ReminderType.SMS:
          await this.sendSmsReminder(reminder);
          break;
        case ReminderType.EMAIL:
          await this.sendEmailReminder(reminder);
          break;
        case ReminderType.PUSH:
          await this.sendPushNotification(reminder);
          break;
      }

      // Log successful delivery
      await this.prisma.reminder.update({
        where: { id: reminder.id },
        data: {
          metadata: JSON.stringify({
            ...JSON.parse(reminder.metadata || '{}'),
            sentAt: new Date().toISOString(),
            deliveryStatus: 'delivered',
          }),
        },
      });
      
    } catch (error) {
      this.logger.error(`Failed to send reminder ${reminder.id}: ${error.message}`);
      
      // Update failure information
      await this.prisma.reminder.update({
        where: { id: reminder.id },
        data: {
          status: ReminderStatus.FAILED,
          retryCount: { increment: 1 },
          errorMessage: error.message.substring(0, 500), // Limit length
          metadata: JSON.stringify({
            ...JSON.parse(reminder.metadata || '{}'),
            lastError: error.message,
            lastRetry: new Date().toISOString(),
          }),
        },
      });

      // Schedule retry if under limit
      if ((reminder.retryCount || 0) < 3) {
        await this.scheduleRetry(reminder);
      }
    }
  }

  /**
   * Get reminders for a specific child
   */
  async getChildReminders(childId: string, includePast: boolean = false): Promise<any[]> {
    const where: Prisma.ReminderWhereInput = { childId };
    
    if (!includePast) {
      where.scheduledFor = { gte: new Date() };
    }

    return await this.prisma.reminder.findMany({
      where,
      include: {
        vaccine: true,
        child: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { scheduledFor: 'asc' },
    });
  }

  /**
   * Get reminders for a specific parent
   */
  async getParentReminders(parentId: string): Promise<any[]> {
    return await this.prisma.reminder.findMany({
      where: { parentId },
      include: {
        vaccine: true,
        child: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { scheduledFor: 'asc' },
    });
  }

  /**
   * Get reminder statistics
   */
  async getStatistics(startDate: Date, endDate: Date, facilityId?: string): Promise<any> {
    const where: Prisma.ReminderWhereInput = {
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    };

    if (facilityId) {
      // Get children in this facility
      const childrenInFacility = await this.prisma.child.findMany({
        where: { birthFacilityId: facilityId },
        select: { id: true },
      });
      
      where.childId = {
        in: childrenInFacility.map(child => child.id),
      };
    }

    const [total, byStatus, byType] = await Promise.all([
      this.prisma.reminder.count({ where }),
      this.prisma.reminder.groupBy({
        by: ['status'],
        where,
        _count: true,
      }),
      this.prisma.reminder.groupBy({
        by: ['type'],
        where,
        _count: true,
      }),
    ]);

    const overdueCount = await this.prisma.reminder.count({
      where: {
        ...where,
        status: ReminderStatus.PENDING,
        scheduledFor: { lt: new Date() },
      },
    });

    // Calculate success rate (sent vs total)
    const sentCount = byStatus.find(s => s.status === ReminderStatus.SENT)?._count || 0;
    const successRate = total > 0 ? (sentCount / total) * 100 : 0;

    return {
      totalReminders: total,
      byStatus: byStatus.reduce((acc, curr) => {
        acc[curr.status] = curr._count;
        return acc;
      }, {}),
      byType: byType.reduce((acc, curr) => {
        acc[curr.type] = curr._count;
        return acc;
      }, {}),
      successRate,
      overdueCount,
    };
  }

  /**
   * Acknowledge a reminder (when parent responds)
   */
  async acknowledgeReminder(reminderId: string, responseNote?: string): Promise<any> {
    return await this.prisma.reminder.update({
      where: { id: reminderId },
      data: {
        metadata: JSON.stringify({
          acknowledged: true,
          acknowledgedAt: new Date().toISOString(),
          responseNote: responseNote,
        }),
      },
    });
  }

  /**
   * Bulk create reminders
   */
  async bulkCreateReminders(reminders: CreateReminderDto[]): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    for (const reminderData of reminders) {
      try {
        await this.prisma.reminder.create({
          data: reminderData,
        });
        success++;
      } catch (error) {
        this.logger.error(`Failed to create reminder: ${error.message}`);
        failed++;
      }
    }

    return { success, failed };
  }

  // Helper methods
  private calculateTieredReminderDates(dueDate: Date): Date[] {
    const dates: Date[] = [];
    const momentDueDate = moment(dueDate);
    
    // 7 days before
    dates.push(momentDueDate.clone().subtract(7, 'days').toDate());
    // 3 days before
    dates.push(momentDueDate.clone().subtract(3, 'days').toDate());
    // 1 day before
    dates.push(momentDueDate.clone().subtract(1, 'days').toDate());
    
    return dates;
  }

  private getReminderTypeForDaysBefore(dueDate: Date, reminderDate: Date): ReminderType {
    const daysBefore = moment(dueDate).diff(moment(reminderDate), 'days');
    
    // Default to SMS for most reminders
    return ReminderType.SMS;
  }

  private generateReminderMessage(
    childName: string,
    vaccineName: string,
    reminderDate: Date,
    dueDate: Date,
    type: ReminderType,
  ): string {
    const daysBefore = moment(dueDate).diff(moment(reminderDate), 'days');
    const formattedDueDate = moment(dueDate).format('MMMM Do');
    
    switch (daysBefore) {
      case 7:
        return `Reminder: ${childName} has a ${vaccineName} vaccination due on ${formattedDueDate}. Please plan your visit.`;
      case 3:
        return `Confirm: ${childName}'s ${vaccineName} vaccination is in 3 days (${formattedDueDate}). Reply YES to confirm.`;
      case 1:
        return `Final reminder: ${childName}'s ${vaccineName} vaccination is tomorrow. Bring the immunization card.`;
      default:
        return `Follow-up: ${childName} has a vaccination due soon.`;
    }
  }

  private generateEscalationMessage(
    childName: string,
    vaccineName: string,
    daysOverdue: number,
    dueDate: Date,
  ): string {
    const formattedDueDate = moment(dueDate).format('MMMM Do');
    
    if (daysOverdue <= 7) {
      return `URGENT: ${childName} missed ${vaccineName} vaccination (due ${formattedDueDate}). Please visit clinic soon.`;
    } else if (daysOverdue <= 30) {
      return `IMPORTANT: ${childName}'s ${vaccineName} vaccination is ${daysOverdue} days overdue. Community Health Worker will visit.`;
    } else {
      return `CRITICAL: ${childName} has missed ${vaccineName} vaccination for ${daysOverdue} days. Facility follow-up required.`;
    }
  }

  private calculateEscalationLevel(daysOverdue: number): number {
    if (daysOverdue <= 7) return 1;
    if (daysOverdue <= 14) return 2;
    if (daysOverdue <= 30) return 3;
    return 4;
  }

  private async scheduleRetry(reminder: any): Promise<void> {
    const retryDelay = Math.pow(2, reminder.retryCount || 1) * 15 * 60 * 1000; // Exponential backoff
    
    setTimeout(async () => {
      try {
        const updatedReminder = await this.prisma.reminder.findUnique({
          where: { id: reminder.id },
        });
        
        if (updatedReminder && updatedReminder.status === ReminderStatus.FAILED) {
          await this.prisma.reminder.update({
            where: { id: reminder.id },
            data: {
              status: ReminderStatus.PENDING,
              scheduledFor: new Date(),
            },
          });
        }
      } catch (error) {
        this.logger.error(`Retry scheduling failed for reminder ${reminder.id}`);
      }
    }, retryDelay);
  }

  // These methods would integrate with actual communication services
  private async sendSmsReminder(reminder: any): Promise<void> {
    const parentPhone = reminder.child?.parent?.user?.phoneNumber;
    
    if (!parentPhone) {
      throw new Error('Parent phone number not found');
    }

    // Integrate with SMS gateway (Africa's Talking, Twilio, etc.)
    this.logger.log(`SMS sent to ${parentPhone}: ${reminder.message}`);
    
    // Simulate SMS sending
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  private async sendEmailReminder(reminder: any): Promise<void> {
    const parentEmail = reminder.child?.parent?.user?.email;
    
    if (!parentEmail) {
      throw new Error('Parent email not found');
    }

    // Integrate with email service
    this.logger.log(`Email sent to ${parentEmail}: ${reminder.message}`);
    
    // Simulate email sending
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  private async sendPushNotification(reminder: any): Promise<void> {
    // Integrate with Firebase Cloud Messaging or similar
    this.logger.log(`Push notification sent: ${reminder.message}`);
    
    // Simulate push notification
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}