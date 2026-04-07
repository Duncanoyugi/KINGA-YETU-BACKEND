import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';
import { AuditAction } from '@prisma/client';

type SystemConfig = {
  general: {
    siteName: string;
    siteUrl: string;
    supportEmail: string;
    supportPhone: string;
    timezone: string;
    dateFormat: string;
    timeFormat: string;
    maintenanceMode: boolean;
  };
  notifications: {
    emailEnabled: boolean;
    smsEnabled: boolean;
    pushEnabled: boolean;
    reminderDays: number[];
    maxReminders: number;
    quietHoursEnabled: boolean;
    quietHoursStart: string;
    quietHoursEnd: string;
  };
  security: {
    passwordMinLength: number;
    requireUppercase: boolean;
    requireLowercase: boolean;
    requireNumbers: boolean;
    requireSpecialChars: boolean;
    maxLoginAttempts: number;
    lockoutDuration: number;
    sessionTimeout: number;
    twoFactorRequired: boolean;
    ipWhitelistEnabled: boolean;
  };
  data: {
    retentionPeriod: number;
    backupEnabled: boolean;
    backupFrequency: string;
    backupTime: string;
    autoExportEnabled: boolean;
    exportFormat: string;
    dataEncryption: boolean;
  };
  api: {
    rateLimit: number;
    rateWindow: number;
    apiTimeout: number;
    maxUploadSize: number;
    allowedFileTypes: string[];
    apiVersion: string;
  };
};

const DEFAULT_SYSTEM_CONFIG: SystemConfig = {
  general: {
    siteName: 'ImmuniTrack Kenya',
    siteUrl: 'https://immunitrack.ke',
    supportEmail: 'support@immunitrack.ke',
    supportPhone: '+254700123456',
    timezone: 'Africa/Nairobi',
    dateFormat: 'MMM dd, yyyy',
    timeFormat: 'HH:mm',
    maintenanceMode: false,
  },
  notifications: {
    emailEnabled: true,
    smsEnabled: true,
    pushEnabled: true,
    reminderDays: [7, 3, 1],
    maxReminders: 3,
    quietHoursEnabled: true,
    quietHoursStart: '22:00',
    quietHoursEnd: '06:00',
  },
  security: {
    passwordMinLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    maxLoginAttempts: 5,
    lockoutDuration: 30,
    sessionTimeout: 60,
    twoFactorRequired: false,
    ipWhitelistEnabled: false,
  },
  data: {
    retentionPeriod: 365,
    backupEnabled: true,
    backupFrequency: 'daily',
    backupTime: '02:00',
    autoExportEnabled: false,
    exportFormat: 'csv',
    dataEncryption: true,
  },
  api: {
    rateLimit: 100,
    rateWindow: 60,
    apiTimeout: 30,
    maxUploadSize: 10,
    allowedFileTypes: ['jpg', 'png', 'pdf', 'csv'],
    apiVersion: 'v1',
  },
};

@Injectable()
export class SystemService {
  private readonly logger = new Logger(SystemService.name);
  private readonly storageDir = path.join(process.cwd(), 'storage', 'system');
  private readonly backupsDir = path.join(this.storageDir, 'backups');
  private readonly configPath = path.join(this.storageDir, 'config.json');

  constructor(private readonly prisma: PrismaService) {
    this.ensureStorage();
  }

  private ensureStorage(): void {
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }

    if (!fs.existsSync(this.backupsDir)) {
      fs.mkdirSync(this.backupsDir, { recursive: true });
    }

    if (!fs.existsSync(this.configPath)) {
      fs.writeFileSync(this.configPath, JSON.stringify(DEFAULT_SYSTEM_CONFIG, null, 2), 'utf8');
    }
  }

  getConfig(): SystemConfig {
    try {
      const rawConfig = fs.readFileSync(this.configPath, 'utf8');
      return JSON.parse(rawConfig) as SystemConfig;
    } catch (error) {
      this.logger.warn('Failed to read system config, falling back to default config');
      return DEFAULT_SYSTEM_CONFIG;
    }
  }

  updateConfig(config: SystemConfig): SystemConfig {
    fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2), 'utf8');
    return config;
  }

  createBackup() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(this.backupsDir, `backup-${timestamp}.json`);
    const payload = {
      createdAt: new Date().toISOString(),
      config: this.getConfig(),
    };

    fs.writeFileSync(backupPath, JSON.stringify(payload, null, 2), 'utf8');

    return {
      success: true,
      fileName: path.basename(backupPath),
      createdAt: payload.createdAt,
    };
  }

  restoreLatestBackup() {
    const backupFiles = fs.readdirSync(this.backupsDir).filter(file => file.endsWith('.json')).sort().reverse();

    if (backupFiles.length === 0) {
      return {
        success: false,
        message: 'No backups available to restore',
      };
    }

    const latestBackupPath = path.join(this.backupsDir, backupFiles[0]);
    const rawBackup = fs.readFileSync(latestBackupPath, 'utf8');
    const backup = JSON.parse(rawBackup) as { createdAt: string; config: SystemConfig };

    fs.writeFileSync(this.configPath, JSON.stringify(backup.config, null, 2), 'utf8');

    return {
      success: true,
      restoredFrom: backupFiles[0],
      restoredAt: new Date().toISOString(),
      backupCreatedAt: backup.createdAt,
    };
  }

  async getAuditLogs(filters: {
    page?: number;
    limit?: number;
    search?: string;
    entityType?: string;
    action?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const page = Number(filters.page || 1);
    const limit = Number(filters.limit || 20);
    const skip = (page - 1) * limit;

    const where: any = {};

    if (filters.entityType && filters.entityType !== 'all') {
      where.entityType = filters.entityType;
    }

    if (filters.action && filters.action !== 'all') {
      where.action = filters.action as AuditAction;
    }

    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) {
        where.createdAt.gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        const endDate = new Date(filters.endDate);
        endDate.setHours(23, 59, 59, 999);
        where.createdAt.lte = endDate;
      }
    }

    if (filters.search) {
      where.OR = [
        {
          entityType: {
            contains: filters.search,
            mode: 'insensitive',
          },
        },
        {
          entityId: {
            contains: filters.search,
            mode: 'insensitive',
          },
        },
        {
          user: {
            OR: [
              {
                fullName: {
                  contains: filters.search,
                  mode: 'insensitive',
                },
              },
              {
                email: {
                  contains: filters.search,
                  mode: 'insensitive',
                },
              },
            ],
          },
        },
      ];
    }

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              email: true,
              role: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      data: logs.map(log => ({
        id: log.id,
        timestamp: log.createdAt,
        user: {
          id: log.user?.id || 'system',
          name: log.user?.fullName || 'System',
          email: log.user?.email || 'system@local',
          role: log.user?.role || 'SYSTEM',
        },
        action: log.action,
        entityType: log.entityType.toUpperCase(),
        entityId: log.entityId || 'N/A',
        entityName: log.entityId || undefined,
        oldData: log.oldData ? this.safeJsonParse(log.oldData) : undefined,
        newData: log.newData ? this.safeJsonParse(log.newData) : undefined,
        ipAddress: 'N/A',
        userAgent: 'N/A',
        status: 'SUCCESS',
        details: undefined,
      })),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  private safeJsonParse(value: string) {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
}
