import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ReminderEngineService } from './reminder-engine.service';
import {
  CreateReminderDto,
  UpdateReminderDto,
  GenerateRemindersDto,
  SendReminderDto,
  ReminderFilterDto,
} from './dto/reminder-request.dto';
import {
  ReminderResponseDto,
  ReminderStatsDto,
  ReminderSummaryDto,
  BulkReminderResponseDto,
} from './dto/reminder-response.dto';
import { ReminderType, ReminderStatus, Prisma } from '@prisma/client';
import moment from 'moment';

@Injectable()
export class RemindersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reminderEngine: ReminderEngineService,
  ) {}

  async create(createReminderDto: CreateReminderDto): Promise<ReminderResponseDto> {
    // Validate child and parent exist
    await this.validateChildAndParent(
      createReminderDto.childId,
      createReminderDto.parentId,
    );

    // Validate vaccine exists
    const vaccine = await this.prisma.vaccine.findUnique({
      where: { id: createReminderDto.vaccineId },
    });

    if (!vaccine) {
      throw new NotFoundException(`Vaccine with ID ${createReminderDto.vaccineId} not found`);
    }

    const reminder = await this.prisma.reminder.create({
      data: {
        ...createReminderDto,
        metadata: createReminderDto['metadata'] || '{}',
      },
      include: {
        child: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        vaccine: {
          select: {
            name: true,
          },
        },
        parent: {
          include: {
            user: {
              select: {
                phoneNumber: true,
              },
            },
          },
        },
      },
    });

    return this.mapToResponseDto(reminder);
  }

  async findAll(
    page: number = 1,
    limit: number = 50,
    filters?: ReminderFilterDto,
  ): Promise<{ data: ReminderResponseDto[]; total: number; page: number; totalPages: number }> {
    const skip = (page - 1) * limit;
    
    const where = this.buildWhereClause(filters);
    
    const [reminders, total] = await Promise.all([
      this.prisma.reminder.findMany({
        where,
        include: {
          child: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
          vaccine: {
            select: {
              name: true,
            },
          },
          parent: {
            include: {
              user: {
                select: {
                  phoneNumber: true,
                },
              },
            },
          },
        },
        skip,
        take: limit,
        orderBy: { scheduledFor: 'asc' },
      }),
      this.prisma.reminder.count({ where }),
    ]);
    
    const responseData = reminders.map(reminder => this.mapToResponseDto(reminder));
    
    return {
      data: responseData,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string): Promise<ReminderResponseDto> {
    const reminder = await this.prisma.reminder.findUnique({
      where: { id },
      include: {
        child: {
          select: {
            firstName: true,
            lastName: true,
            dateOfBirth: true,
          },
        },
        vaccine: {
          select: {
            name: true,
            code: true,
          },
        },
        parent: {
          include: {
            user: {
              select: {
                email: true,
                phoneNumber: true,
                fullName: true,
              },
            },
          },
        },
      },
    });
    
    if (!reminder) {
      throw new NotFoundException(`Reminder with ID ${id} not found`);
    }
    
    return this.mapToResponseDto(reminder);
  }

  async update(id: string, updateReminderDto: UpdateReminderDto): Promise<ReminderResponseDto> {
    const reminder = await this.prisma.reminder.findUnique({
      where: { id },
    });
    
    if (!reminder) {
      throw new NotFoundException(`Reminder with ID ${id} not found`);
    }
    
    // Cannot update sent reminders
    if (reminder.status === ReminderStatus.SENT) {
      throw new BadRequestException('Cannot update sent reminders');
    }
    
    const updatedReminder = await this.prisma.reminder.update({
      where: { id },
      data: updateReminderDto,
      include: {
        child: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        vaccine: {
          select: {
            name: true,
          },
        },
        parent: {
          include: {
            user: {
              select: {
                phoneNumber: true,
              },
            },
          },
        },
      },
    });
    
    return this.mapToResponseDto(updatedReminder);
  }

  async remove(id: string): Promise<void> {
    const reminder = await this.prisma.reminder.findUnique({
      where: { id },
    });
    
    if (!reminder) {
      throw new NotFoundException(`Reminder with ID ${id} not found`);
    }
    
    // Cannot delete sent reminders
    if (reminder.status === ReminderStatus.SENT) {
      throw new BadRequestException('Cannot delete sent reminders');
    }
    
    await this.prisma.reminder.delete({
      where: { id },
    });
  }

  async generateReminders(generateDto: GenerateRemindersDto): Promise<{ count: number; message: string }> {
    const result = await this.reminderEngine.generateVaccinationReminders(
      generateDto.startDate,
      generateDto.endDate,
      generateDto.facilityId,
      generateDto.reminderTypes,
    );
    
    return {
      count: result.created,
      message: `Successfully generated ${result.created} reminders, skipped ${result.skipped}`,
    };
  }

  async sendReminder(sendDto: SendReminderDto): Promise<ReminderResponseDto> {
    const reminder = await this.prisma.reminder.findUnique({
      where: { id: sendDto.reminderId },
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
    
    if (!reminder) {
      throw new NotFoundException(`Reminder with ID ${sendDto.reminderId} not found`);
    }
    
    if (reminder.status !== ReminderStatus.PENDING) {
      throw new BadRequestException('Only pending reminders can be sent');
    }
    
    // Override type if forced
    if (sendDto.forceType) {
      await this.prisma.reminder.update({
        where: { id: reminder.id },
        data: { type: sendDto.forceType },
      });
      reminder.type = sendDto.forceType;
    }
    
    // Send immediately
    await this.reminderEngine.sendReminder(reminder);
    
    const updatedReminder = await this.prisma.reminder.findUnique({
      where: { id: reminder.id },
      include: {
        child: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        vaccine: {
          select: {
            name: true,
          },
        },
        parent: {
          include: {
            user: {
              select: {
                phoneNumber: true,
              },
            },
          },
        },
      },
    });
    
    return this.mapToResponseDto(updatedReminder);
  }

  async getChildReminders(childId: string, includePast: boolean = false): Promise<ReminderResponseDto[]> {
    const reminders = await this.reminderEngine.getChildReminders(childId, includePast);
    return reminders.map(reminder => this.mapToResponseDto(reminder));
  }

  async getParentReminders(parentId: string): Promise<ReminderResponseDto[]> {
    const reminders = await this.reminderEngine.getParentReminders(parentId);
    return reminders.map(reminder => this.mapToResponseDto(reminder));
  }

  async acknowledgeReminder(id: string, responseNote?: string): Promise<ReminderResponseDto> {
    const reminder = await this.reminderEngine.acknowledgeReminder(id, responseNote);
    return this.mapToResponseDto(reminder);
  }

  async getStatistics(startDate: Date, endDate: Date, facilityId?: string): Promise<ReminderStatsDto> {
    const stats = await this.reminderEngine.getStatistics(startDate, endDate, facilityId);
    
    return {
      totalReminders: stats.totalReminders,
      pendingReminders: stats.byStatus[ReminderStatus.PENDING] || 0,
      sentReminders: stats.byStatus[ReminderStatus.SENT] || 0,
      failedReminders: stats.byStatus[ReminderStatus.FAILED] || 0,
      cancelledReminders: stats.byStatus[ReminderStatus.CANCELLED] || 0,
      byType: stats.byType,
      successRate: stats.successRate,
      overdueCount: stats.overdueCount,
    };
  }

  async getSummary(): Promise<ReminderSummaryDto> {
    const [total, pending, sent, failed] = await Promise.all([
      this.prisma.reminder.count(),
      this.prisma.reminder.count({
        where: { status: ReminderStatus.PENDING },
      }),
      this.prisma.reminder.count({
        where: { status: ReminderStatus.SENT },
      }),
      this.prisma.reminder.count({
        where: { status: ReminderStatus.FAILED },
      }),
    ]);

    const upcomingCount = await this.prisma.reminder.count({
      where: {
        status: ReminderStatus.PENDING,
        scheduledFor: {
          gte: new Date(),
          lte: moment().add(7, 'days').toDate(),
        },
      },
    });

    const overdueCount = await this.prisma.reminder.count({
      where: {
        status: ReminderStatus.PENDING,
        scheduledFor: { lt: new Date() },
      },
    });

    return {
      total,
      pending,
      sent,
      failed,
      upcomingCount,
      overdueCount,
    };
  }

  async rescheduleReminder(id: string, newDate: Date): Promise<ReminderResponseDto> {
    const reminder = await this.prisma.reminder.findUnique({
      where: { id },
    });
    
    if (!reminder) {
      throw new NotFoundException(`Reminder with ID ${id} not found`);
    }
    
    if (reminder.status !== ReminderStatus.PENDING) {
      throw new BadRequestException('Only pending reminders can be rescheduled');
    }
    
    const updatedReminder = await this.prisma.reminder.update({
      where: { id },
      data: { scheduledFor: newDate },
      include: {
        child: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        vaccine: {
          select: {
            name: true,
          },
        },
        parent: {
          include: {
            user: {
              select: {
                phoneNumber: true,
              },
            },
          },
        },
      },
    });
    
    return this.mapToResponseDto(updatedReminder);
  }

  async cancelReminder(id: string, reason?: string): Promise<ReminderResponseDto> {
    const reminder = await this.prisma.reminder.findUnique({
      where: { id },
    });
    
    if (!reminder) {
      throw new NotFoundException(`Reminder with ID ${id} not found`);
    }
    
    if (reminder.status === ReminderStatus.SENT) {
      throw new BadRequestException('Cannot cancel sent reminders');
    }
    
    const updatedReminder = await this.prisma.reminder.update({
      where: { id },
      data: {
        status: ReminderStatus.CANCELLED,
        metadata: JSON.stringify({
          ...JSON.parse(reminder.metadata || '{}'),
          cancelledAt: new Date().toISOString(),
          cancellationReason: reason,
        }),
      },
      include: {
        child: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        vaccine: {
          select: {
            name: true,
          },
        },
        parent: {
          include: {
            user: {
              select: {
                phoneNumber: true,
              },
            },
          },
        },
      },
    });
    
    return this.mapToResponseDto(updatedReminder);
  }

  async bulkCreate(reminders: CreateReminderDto[]): Promise<BulkReminderResponseDto> {
    const result = await this.reminderEngine.bulkCreateReminders(reminders);
    
    return {
      successCount: result.success,
      failedCount: result.failed,
      failedIds: [], // In real implementation, track failed IDs
      message: `Created ${result.success} reminders, ${result.failed} failed`,
    };
  }

  async sendBulkReminders(reminderIds: string[]): Promise<BulkReminderResponseDto> {
    let successCount = 0;
    const failedIds: string[] = [];

    for (const reminderId of reminderIds) {
      try {
        await this.sendReminder({ reminderId });
        successCount++;
      } catch (error) {
        failedIds.push(reminderId);
      }
    }

    return {
      successCount,
      failedCount: failedIds.length,
      failedIds,
      message: `Sent ${successCount} reminders, ${failedIds.length} failed`,
    };
  }

  // Private helper methods
  private async validateChildAndParent(childId: string, parentId: string): Promise<void> {
    const [child, parent] = await Promise.all([
      this.prisma.child.findUnique({
        where: { id: childId },
      }),
      this.prisma.parent.findUnique({
        where: { id: parentId },
      }),
    ]);

    if (!child) {
      throw new NotFoundException(`Child with ID ${childId} not found`);
    }

    if (!parent) {
      throw new NotFoundException(`Parent with ID ${parentId} not found`);
    }

    // Verify child belongs to parent
    if (child.parentId !== parentId) {
      throw new BadRequestException('Child does not belong to the specified parent');
    }
  }

  private buildWhereClause(filters?: ReminderFilterDto): Prisma.ReminderWhereInput {
    const where: Prisma.ReminderWhereInput = {};

    if (filters) {
      if (filters.childId) where.childId = filters.childId;
      if (filters.parentId) where.parentId = filters.parentId;
      if (filters.status) where.status = filters.status;
      if (filters.type) where.type = filters.type;
      
      if (filters.startDate || filters.endDate) {
        where.scheduledFor = {};
        if (filters.startDate) where.scheduledFor.gte = filters.startDate;
        if (filters.endDate) where.scheduledFor.lte = filters.endDate;
      }

      if (filters.overdueOnly) {
        where.scheduledFor = { lt: new Date() };
        where.status = ReminderStatus.PENDING;
      }

      if (filters.facilityId) {
        where.child = {
          birthFacilityId: filters.facilityId,
        };
      }
    }

    return where;
  }

  private mapToResponseDto(reminder: any): ReminderResponseDto {
    const metadata = JSON.parse(reminder.metadata || '{}');
    const isOverdue = reminder.status === ReminderStatus.PENDING && 
                     reminder.scheduledFor < new Date();
    
    return {
      id: reminder.id,
      childId: reminder.childId,
      parentId: reminder.parentId,
      vaccineId: reminder.vaccineId,
      scheduleId: metadata.scheduleId,
      type: reminder.type,
      status: reminder.status,
      scheduledFor: reminder.scheduledFor,
      message: reminder.message,
      batchNumber: reminder.batchNumber,
      metadata: reminder.metadata,
      createdAt: reminder.createdAt,
      updatedAt: reminder.updatedAt,
      childName: reminder.child ? `${reminder.child.firstName} ${reminder.child.lastName}` : undefined,
      parentPhone: reminder.parent?.user?.phoneNumber,
      vaccineName: reminder.vaccine?.name,
      facilityName: metadata.facilityName,
      isOverdue,
    };
  }
}