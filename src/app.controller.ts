import { Controller, Get, HttpCode, HttpStatus, Res } from '@nestjs/common';
import type { Response } from 'express';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  @HttpCode(HttpStatus.OK)
  async getHealth(@Res({ passthrough: true }) res: Response) {
    const health = await this.appService.getHealth();
    // Return 503 when degraded so uptime monitors / load balancers
    // correctly detect an unhealthy instance instead of seeing 200 OK.
    if (health.status !== 'healthy') {
      res.status(HttpStatus.SERVICE_UNAVAILABLE);
    }
    return health;
  }
}
