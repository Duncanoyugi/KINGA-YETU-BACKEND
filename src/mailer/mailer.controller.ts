import { Controller, Post, Body, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { MailerService } from './mailer.service';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

class TestEmailDto {
  email: string;
}

// Previously this controller had NO auth guard at all: POST /mailer/test
// let anyone on the internet, with no login, send an email to any address
// they supplied through this app's mail provider — an open-mail-relay /
// spam-abuse vector, and a way to burn through send quota or get the
// sending domain blacklisted. This is a debug/ops utility, so it's
// restricted to admins and rate-limited on top of that as defense in depth.
@ApiTags('mailer')
@ApiBearerAuth()
@Controller('mailer')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class MailerController {
  constructor(private readonly mailerService: MailerService) {}

  @Post('test')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @ApiOperation({ summary: 'Test email sending (admin only)' })
  @ApiResponse({ status: 200, description: 'Test email sent successfully' })
  async testEmail(@Body() testEmailDto: TestEmailDto) {
    try {
      await this.mailerService.sendOtpEmail(
        testEmailDto.email,
        '123456',
        'Test User'
      );
      return {
        success: true,
        message: 'Test email sent successfully. Check the recipient inbox.'
      };
    } catch (error: any) {
      return {
        success: false,
        message: 'Failed to send email',
        error: error.message
      };
    }
  }
}
