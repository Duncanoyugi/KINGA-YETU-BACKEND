import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOtpDto } from './dto/create-otp.dto';
import { UpdateOtpDto } from './dto/update-otp.dto';
import { OtpType } from '@prisma/client';
import { generate } from 'otp-generator';
import { OtpResponseDto } from './dto/otp-response.dto';

// Extended interface to include code for email sending
export interface OtpWithCode extends OtpResponseDto {
  code: string;
}

// Maximum number of incorrect guesses allowed against a single OTP
// before it is invalidated, regardless of expiry. Combined with the
// request-rate throttling on the OTP endpoints (see main.ts /
// otp.controller.ts), this stops a 6-digit code from being brute-forced.
const MAX_OTP_ATTEMPTS = 5;

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  constructor(private prisma: PrismaService) {}

  async generateOtp(data: CreateOtpDto): Promise<OtpWithCode> {
    // Generate 6-digit numeric OTP
    const otpCode = generate(6, {
      digits: true,
      lowerCaseAlphabets: false,
      upperCaseAlphabets: false,
      specialChars: false,
    });

    // NOTE: never log the OTP code itself (email/SMS providers already
    // receive it) — it is sensitive, single-use credential material and
    // must not end up in application logs or log aggregators.
    this.logger.log(`Generating OTP for ${this.maskContact(data.email || data.phone)}`);

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
      // Return existing OTP with code for email sending
      return {
        ...this.mapToOtpResponseDto(existingOtp),
        code: existingOtp.code,
      };
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

    // Return with code for email sending
    return {
      ...this.mapToOtpResponseDto(otp),
      code: otp.code,
    };
  }

  async verifyOtp(email: string, code: string, type: OtpType): Promise<boolean> {
    const otp = await this.prisma.otp.findFirst({
      where: {
        email,
        type,
        isUsed: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    return this.checkAndConsume(otp, code);
  }

  async verifyPhoneOtp(phone: string, code: string, type: OtpType): Promise<boolean> {
    const otp = await this.prisma.otp.findFirst({
      where: {
        phone,
        type,
        isUsed: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    return this.checkAndConsume(otp, code);
  }

  /**
   * Shared verification logic: rejects once MAX_OTP_ATTEMPTS wrong
   * guesses have been made against a given OTP row (even if it has not
   * expired), so a 6-digit code cannot be brute-forced by attackers who
   * get past the per-IP rate limit (e.g. via a botnet).
   */
  private async checkAndConsume(
    otp: { id: string; code: string; attempts: number } | null,
    code: string,
  ): Promise<boolean> {
    if (!otp) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    if (otp.attempts >= MAX_OTP_ATTEMPTS) {
      await this.prisma.otp.update({ where: { id: otp.id }, data: { isUsed: true } });
      throw new BadRequestException('Too many incorrect attempts. Please request a new code.');
    }

    if (otp.code !== code) {
      await this.prisma.otp.update({
        where: { id: otp.id },
        data: { attempts: { increment: 1 } },
      });
      throw new BadRequestException('Invalid or expired OTP');
    }

    // Mark OTP as used
    await this.prisma.otp.update({
      where: { id: otp.id },
      data: { isUsed: true },
    });

    return true;
  }

  async resendOtp(email: string, type: OtpType): Promise<OtpWithCode> {
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

  // Helper method to get OTP code for email sending
  async getOtpCodeForEmail(email: string, type: OtpType): Promise<string> {
    const otp = await this.prisma.otp.findFirst({
      where: {
        email,
        type,
        isUsed: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!otp) {
      throw new BadRequestException('No valid OTP found');
    }

    return otp.code;
  }

  /** Masks an email/phone for safe logging, e.g. "jo***@example.com" */
  private maskContact(contact?: string | null): string {
    if (!contact) return 'unknown';
    if (contact.includes('@')) {
      const [user, domain] = contact.split('@');
      return `${user.slice(0, 2)}***@${domain}`;
    }
    return `${contact.slice(0, 4)}***${contact.slice(-2)}`;
  }
}
