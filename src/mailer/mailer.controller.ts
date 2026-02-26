import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { MailerService } from './mailer.service';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

class TestEmailDto {
  email: string;
}

@ApiTags('mailer')
@Controller('mailer')
export class MailerController {
  constructor(private readonly mailerService: MailerService) {}

  @Post('test')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Test email sending' })
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
        message: 'Test email sent successfully. Check your Mailtrap inbox.' 
      };
    } catch (error) {
      return { 
        success: false, 
        message: 'Failed to send email', 
        error: error.message 
      };
    }
  }
}