import {
  Controller,
  Get,
  Patch,
  Delete,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { NotificationQueueService } from './notification-queue.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('notifications')
@Controller('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly notificationQueue: NotificationQueueService,
  ) {}

  @Get('user/:userId')
  @Roles(UserRole.PARENT, UserRole.HEALTH_WORKER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get user notifications' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'unreadOnly', required: false, type: Boolean })
  @ApiResponse({ status: 200, description: 'User notifications retrieved' })
  async getUserNotifications(
    @Param('userId') userId: string,
    @Request() req: any,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('unreadOnly') unreadOnly?: boolean,
  ) {
    // Previously nothing in this controller looked at req.user: the
    // userId in the URL was trusted outright, so any logged-in account
    // could read, clear or delete anyone's notifications and read or
    // change anyone's notification preferences (e.g. switch off another
    // parent's vaccine reminders).
    this.notificationsService.assertOwnerOrAdmin(userId, req.user);
    return this.notificationsService.getUserNotifications(
      userId,
      page ? Number(page) : 1,
      limit ? Number(limit) : 20,
      unreadOnly === true,
    );
  }

  @Get('user/:userId/unread/count')
  @Roles(UserRole.PARENT, UserRole.HEALTH_WORKER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get unread notification count' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'Unread count retrieved' })
  async getUnreadCount(@Param('userId') userId: string, @Request() req: any) {
    this.notificationsService.assertOwnerOrAdmin(userId, req.user);
    const result = await this.notificationsService.getUserNotifications(userId, 1, 1, true);
    return result.unreadCount;
  }

  @Patch('user/:userId/read-all')
  @Roles(UserRole.PARENT, UserRole.HEALTH_WORKER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Mark all notifications as read' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'All notifications marked as read' })
  async markAllAsRead(@Param('userId') userId: string, @Request() req: any) {
    this.notificationsService.assertOwnerOrAdmin(userId, req.user);
    return this.notificationsService.markAllAsRead(userId);
  }

  @Patch(':notificationId/read')
  @Roles(UserRole.PARENT, UserRole.HEALTH_WORKER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Mark notification as read' })
  @ApiParam({ name: 'notificationId', description: 'Notification ID' })
  @ApiResponse({ status: 200, description: 'Notification marked as read' })
  async markAsRead(@Param('notificationId') notificationId: string, @Request() req: any) {
    return this.notificationsService.markAsRead(notificationId, req.user);
  }

  @Delete(':notificationId')
  @Roles(UserRole.PARENT, UserRole.HEALTH_WORKER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Delete notification' })
  @ApiParam({ name: 'notificationId', description: 'Notification ID' })
  @ApiResponse({ status: 200, description: 'Notification deleted' })
  async deleteNotification(@Param('notificationId') notificationId: string, @Request() req: any) {
    return this.notificationsService.deleteNotification(notificationId, req.user);
  }

  @Get('preferences/:userId')
  @Roles(UserRole.PARENT, UserRole.HEALTH_WORKER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get user notification preferences' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'User notification preferences retrieved' })
  async getPreferences(@Param('userId') userId: string, @Request() req: any) {
    this.notificationsService.assertOwnerOrAdmin(userId, req.user);
    return this.notificationsService.getNotificationPreferences(userId);
  }

  @Put('preferences/:userId')
  @Roles(UserRole.PARENT, UserRole.HEALTH_WORKER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update user notification preferences' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'User notification preferences updated' })
  async updatePreferences(
    @Param('userId') userId: string,
    @Request() req: any,
    @Body() updateData: {
      emailNotifications?: boolean;
      smsNotifications?: boolean;
      pushNotifications?: boolean;
      quietHoursStart?: string;
      quietHoursEnd?: string;
      reminderDays?: number[];
    },
  ) {
    this.notificationsService.assertOwnerOrAdmin(userId, req.user);
    return this.notificationsService.updateNotificationPreferences(userId, updateData);
  }
}
