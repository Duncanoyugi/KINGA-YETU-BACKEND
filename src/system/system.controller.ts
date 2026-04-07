import { Body, Controller, Get, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { SystemService } from './system.service';

@ApiTags('system')
@Controller('system')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class SystemController {
  constructor(private readonly systemService: SystemService) {}

  @Get('config')
  @ApiOperation({ summary: 'Get system configuration' })
  getConfig() {
    return this.systemService.getConfig();
  }

  @Put('config')
  @ApiOperation({ summary: 'Update system configuration' })
  updateConfig(@Body() config: any) {
    return this.systemService.updateConfig(config);
  }

  @Get('audit-logs')
  @ApiOperation({ summary: 'Get audit logs' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'entityType', required: false, type: String })
  @ApiQuery({ name: 'action', required: false, type: String })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  getAuditLogs(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('entityType') entityType?: string,
    @Query('action') action?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.systemService.getAuditLogs({
      page,
      limit,
      search,
      entityType,
      action,
      startDate,
      endDate,
    });
  }

  @Post('backup')
  @ApiOperation({ summary: 'Create a configuration backup' })
  createBackup() {
    return this.systemService.createBackup();
  }

  @Post('restore')
  @ApiOperation({ summary: 'Restore latest configuration backup' })
  restoreLatestBackup() {
    return this.systemService.restoreLatestBackup();
  }
}
