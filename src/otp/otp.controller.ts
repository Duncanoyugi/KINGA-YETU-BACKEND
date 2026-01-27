import { Controller, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { OtpService } from './otp.service';
import { CreateOtpDto } from './dto/create-otp.dto';
import { UpdateOtpDto } from './dto/update-otp.dto';
import { OtpResponseDto } from './dto/otp-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('otp')
@Controller('otp')
export class OtpController {
  constructor(private readonly otpService: OtpService) {}

  @Post('generate')
  @ApiOperation({ summary: 'Generate OTP' })
  @ApiResponse({
    status: 201,
    description: 'OTP generated successfully',
    type: OtpResponseDto,
  })
  async generate(@Body() createOtpDto: CreateOtpDto): Promise<OtpResponseDto> {
    return this.otpService.generateOtp(createOtpDto);
  }

  @Post('verify')
  @ApiOperation({ summary: 'Verify OTP' })
  @ApiResponse({ status: 200, description: 'OTP verified successfully' })
  @ApiResponse({ status: 400, description: 'Invalid or expired OTP' })
  async verify(
    @Body() body: { email: string; code: string; type: string },
  ) {
    const isValid = await this.otpService.verifyOtp(
      body.email,
      body.code,
      body.type as any,
    );
    return { valid: isValid };
  }

  @Post('resend')
  @ApiOperation({ summary: 'Resend OTP' })
  @ApiResponse({
    status: 200,
    description: 'OTP resent successfully',
    type: OtpResponseDto,
  })
  async resend(
    @Body() body: { email: string; type: string },
  ) {
    return this.otpService.resendOtp(body.email, body.type as any);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update OTP' })
  @ApiResponse({ status: 200, description: 'OTP updated successfully' })
  async update(
    @Param('id') id: string,
    @Body() updateOtpDto: UpdateOtpDto,
  ) {
    return this.otpService.update(id, updateOtpDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete OTP' })
  @ApiResponse({ status: 200, description: 'OTP deleted successfully' })
  async remove(@Param('id') id: string) {
    return this.otpService.remove(id);
  }
}