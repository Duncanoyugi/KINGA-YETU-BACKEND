import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

@Injectable()
export class AppService {
  constructor(private readonly prisma: PrismaService) {}

  getHello(): string {
    return 'Kinga Yetu ImmuniTrack API';
  }

  /**
   * Real health check: verifies the process is up AND the database is
   * actually reachable, instead of unconditionally returning "healthy"
   * (which the previous implementation did — a broken DB connection
   * would still have reported healthy to uptime monitoring).
   */
  async getHealth() {
    const startedAt = Date.now();
    let dbStatus: 'up' | 'down' = 'up';

    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      dbStatus = 'down';
    }

    return {
      status: dbStatus === 'up' ? 'healthy' : 'degraded',
      database: dbStatus,
      uptimeSeconds: Math.floor(process.uptime()),
      responseTimeMs: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
    };
  }
}
