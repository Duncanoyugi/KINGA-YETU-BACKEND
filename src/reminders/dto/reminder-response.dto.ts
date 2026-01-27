import { ApiProperty } from '@nestjs/swagger';
import { ReminderType, ReminderStatus } from '@prisma/client';

export class ReminderResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  childId: string;

  @ApiProperty()
  parentId: string;

  @ApiProperty()
  vaccineId: string;

  @ApiProperty({ required: false })
  scheduleId?: string;

  @ApiProperty({ enum: ReminderType })
  type: ReminderType;

  @ApiProperty({ enum: ReminderStatus })
  status: ReminderStatus;

  @ApiProperty()
  scheduledFor: Date;

  @ApiProperty()
  message: string;

  @ApiProperty({ required: false })
  batchNumber?: string;

  @ApiProperty({ required: false })
  metadata?: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ required: false })
  childName?: string;

  @ApiProperty({ required: false })
  parentPhone?: string;

  @ApiProperty({ required: false })
  vaccineName?: string;

  @ApiProperty({ required: false })
  facilityName?: string;

  @ApiProperty({ required: false })
  isOverdue?: boolean;
}

export class ReminderStatsDto {
  @ApiProperty()
  totalReminders: number;

  @ApiProperty()
  pendingReminders: number;

  @ApiProperty()
  sentReminders: number;

  @ApiProperty()
  failedReminders: number;

  @ApiProperty()
  cancelledReminders: number;

  @ApiProperty()
  byType: Record<ReminderType, number>;

  @ApiProperty()
  successRate: number;

  @ApiProperty()
  overdueCount: number;
}

export class ReminderSummaryDto {
  @ApiProperty()
  total: number;

  @ApiProperty()
  pending: number;

  @ApiProperty()
  sent: number;

  @ApiProperty()
  failed: number;

  @ApiProperty()
  upcomingCount: number;

  @ApiProperty()
  overdueCount: number;
}

export class BulkReminderResponseDto {
  @ApiProperty()
  successCount: number;

  @ApiProperty()
  failedCount: number;

  @ApiProperty()
  failedIds: string[];

  @ApiProperty()
  message: string;
}