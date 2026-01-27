import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOtpDto } from './dto/create-otp.dto';
import { UpdateOtpDto } from './dto/update-otp.dto';
import { OtpType } from '@prisma/client';
import { generate } from 'otp-generator';
import { OtpResponseDto } from './dto/otp-response.dto';

@Injectable()
export class OtpService {
  constructor(private prisma: PrismaService) {}

  async generateOtp(data: CreateOtpDto): Promise<OtpResponseDto> {
    // Generate 6-digit numeric OTP
    const otpCode = generate(6, {
      digits: true,
      lowerCaseAlphabets: false,
      upperCaseAlphabets: false,
      specialChars: false,
    });

    // Set expiration to 10 minutes from now
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    // Clean up old unused OTPs
    await this.cleanupExpiredOtps();

    // Check for existing OTPs
    const existingOtp = await this.prisma.otp.findFirst({
      where: {
        email: data.email,
        phone: data.phone,
        type: data.type,
        isUsed: false,
        expiresAt: { gt: new Date() },
      },
    });

    if (existingOtp) {
      // Resend existing OTP if still valid
      return this.mapToOtpResponseDto(existingOtp);
    }

    // Create new OTP
    const otp = await this.prisma.otp.create({
      data: {
        email: data.email || null,
        phone: data.phone || null,
        code: otpCode,
        type: data.type,
        expiresAt,
        metadata: data.metadata,
      },
    });

    return this.mapToOtpResponseDto(otp);
  }

  async verifyOtp(email: string, code: string, type: OtpType): Promise<boolean> {
    const otp = await this.prisma.otp.findFirst({
      where: {
        email,
        code,
        type,
        isUsed: false,
        expiresAt: { gt: new Date() },
      },
    });

    if (!otp) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    // Mark OTP as used
    await this.prisma.otp.update({
      where: { id: otp.id },
      data: { isUsed: true },
    });

    return true;
  }

  async verifyPhoneOtp(phone: string, code: string, type: OtpType): Promise<boolean> {
    const otp = await this.prisma.otp.findFirst({
      where: {
        phone,
        code,
        type,
        isUsed: false,
        expiresAt: { gt: new Date() },
      },
    });

    if (!otp) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    // Mark OTP as used
    await this.prisma.otp.update({
      where: { id: otp.id },
      data: { isUsed: true },
    });

    return true;
  }

  async resendOtp(email: string, type: OtpType): Promise<OtpResponseDto> {
    // Delete existing unused OTPs
    await this.prisma.otp.deleteMany({
      where: {
        email,
        type,
        isUsed: false,
      },
    });

    // Generate new OTP
    return this.generateOtp({ email, type });
  }

  async update(id: string, updateOtpDto: UpdateOtpDto): Promise<OtpResponseDto> {
    const otp = await this.prisma.otp.update({
      where: { id },
      data: updateOtpDto,
    });
    
    return this.mapToOtpResponseDto(otp);
  }

  async remove(id: string): Promise<OtpResponseDto> {
    const otp = await this.prisma.otp.delete({
      where: { id },
    });
    
    return this.mapToOtpResponseDto(otp);
  }

  private async cleanupExpiredOtps(): Promise<void> {
    await this.prisma.otp.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          { isUsed: true },
        ],
      },
    });
  }

  private mapToOtpResponseDto(otp: any): OtpResponseDto {
    return {
      id: otp.id,
      email: otp.email || undefined,
      phone: otp.phone || undefined,
      type: otp.type,
      expiresAt: otp.expiresAt,
      isUsed: otp.isUsed,
      createdAt: otp.createdAt,
      metadata: otp.metadata || undefined,
    };
  }
}