import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { MailerService } from '../mailer/mailer.service';
import { OtpService } from '../otp/otp.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ResetPasswordDto, ResetPasswordConfirmDto } from './dto/reset-password.dto';
import { OtpType, AuditAction, UserRole } from '@prisma/client';

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
}

export interface AuthResponse {
  user: any;
  accessToken: string;
  refreshToken?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private mailerService: MailerService,
    private otpService: OtpService,
  ) {}

  async register(registerDto: RegisterDto): Promise<{ message: string; userId: string }> {
    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: registerDto.email },
    });

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    if (registerDto.phoneNumber) {
      const existingPhone = await this.prisma.user.findUnique({
        where: { phoneNumber: registerDto.phoneNumber },
      });
      if (existingPhone) {
        throw new ConflictException('Phone number already registered');
      }
    }

    // Check terms acceptance
    if (!registerDto.acceptTerms) {
      throw new BadRequestException('You must accept the terms and conditions');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(registerDto.password, 10);

    // Create user
    const user = await this.prisma.user.create({
      data: {
        email: registerDto.email,
        phoneNumber: registerDto.phoneNumber,
        password: hashedPassword,
        fullName: registerDto.fullName,
        role: registerDto.role || UserRole.PARENT,
        isEmailVerified: false,
      },
    });

    // Send welcome email
    await this.mailerService.sendWelcomeEmail(user.email, user.fullName);

    // Generate and send OTP
    await this.otpService.generateOtp({
      email: user.email,
      type: OtpType.EMAIL_VERIFICATION,
      metadata: JSON.stringify({ userId: user.id }),
    });

    // Log audit
    await this.createAuditLog(
      user.id,
      AuditAction.CREATE,
      'User',
      user.id,
      undefined, // oldData
      JSON.stringify(user), // newData
    );

    return {
      message: 'Registration successful. Please check your email for verification code.',
      userId: user.id,
    };
  }

  async login(loginDto: LoginDto): Promise<AuthResponse> {
    const { email, password, ipAddress, userAgent } = loginDto;

    // Find user
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        profile: true,
        parentProfile: true,
        healthWorker: {
          include: {
            facility: true,
          },
        },
        adminProfile: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if account is active
    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Create session
    const session = await this.prisma.session.create({
      data: {
        userId: user.id,
        token: this.generateRandomToken(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    // Generate tokens
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: '7d',
      secret: this.configService.get('JWT_REFRESH_SECRET'),
    });

    // Log audit
    await this.createAuditLog(
      user.id,
      AuditAction.LOGIN,
      'User',
      user.id,
      undefined,
      JSON.stringify({
        ipAddress,
        userAgent,
      }),
    );

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword,
      accessToken,
      refreshToken,
    };
  }

  async logout(userId: string, token?: string): Promise<void> {
    // Delete current session if token provided
    if (token) {
      await this.prisma.session.deleteMany({
        where: {
          userId,
          token,
        },
      });
    }

    // Log audit
    await this.createAuditLog(userId, AuditAction.LOGOUT, 'User', userId);
  }

  async logoutAll(userId: string): Promise<void> {
    await this.prisma.session.deleteMany({
      where: { userId },
    });
  }

  async refreshToken(refreshToken: string): Promise<{ accessToken: string }> {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get('JWT_REFRESH_SECRET'),
      });

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user || !user.isActive) {
        throw new UnauthorizedException('User not found or inactive');
      }

      const newPayload: JwtPayload = {
        sub: user.id,
        email: user.email,
        role: user.role,
      };

      const accessToken = this.jwtService.sign(newPayload);
      return { accessToken };
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async verifyEmail(email: string, otpCode: string): Promise<{ message: string }> {
    // Verify OTP
    await this.otpService.verifyOtp(email, otpCode, OtpType.EMAIL_VERIFICATION);

    // Update user verification status
    const user = await this.prisma.user.update({
      where: { email },
      data: { isEmailVerified: true },
    });

    // Log audit
    await this.createAuditLog(
      user.id,
      AuditAction.UPDATE,
      'User',
      user.id,
      undefined,
      'email_verification',
    );

    return { message: 'Email verified successfully' };
  }

  async requestPasswordReset(resetPasswordDto: ResetPasswordDto): Promise<{ message: string }> {
    const { email } = resetPasswordDto;

    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Don't reveal that user doesn't exist
      return { message: 'If an account exists with this email, you will receive reset instructions.' };
    }

    // Generate OTP
    const otp = await this.otpService.generateOtp({
      email,
      type: OtpType.PASSWORD_RESET,
      metadata: JSON.stringify({ userId: user.id }),
    });

    // Send reset email
    await this.mailerService.sendOtpEmail(email, (otp as any).code, user.fullName);

    return { message: 'Password reset instructions sent to your email.' };
  }

  async resetPassword(resetPasswordConfirmDto: ResetPasswordConfirmDto): Promise<{ message: string }> {
    const { otpCode, newPassword, confirmNewPassword } = resetPasswordConfirmDto;

    if (newPassword !== confirmNewPassword) {
      throw new BadRequestException('Passwords do not match');
    }

    // We need to find which email this OTP belongs to
    const otp = await this.prisma.otp.findFirst({
      where: {
        code: otpCode,
        type: OtpType.PASSWORD_RESET,
        isUsed: false,
        expiresAt: { gt: new Date() },
      },
    });

    if (!otp || !otp.email) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    // Verify OTP
    await this.otpService.verifyOtp(otp.email, otpCode, OtpType.PASSWORD_RESET);

    // Update password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const user = await this.prisma.user.update({
      where: { email: otp.email },
      data: { password: hashedPassword },
    });

    // Log audit
    await this.createAuditLog(
      user.id,
      AuditAction.UPDATE,
      'User',
      user.id,
      undefined,
      'password_reset',
    );

    return { message: 'Password reset successful' };
  }

  async changePassword(userId: string, changePasswordDto: ChangePasswordDto): Promise<{ message: string }> {
    const { currentPassword, newPassword, confirmNewPassword } = changePasswordDto;

    if (newPassword !== confirmNewPassword) {
      throw new BadRequestException('New passwords do not match');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    // Log audit
    await this.createAuditLog(
      userId,
      AuditAction.UPDATE,
      'User',
      userId,
      undefined,
      'password_change',
    );

    return { message: 'Password changed successfully' };
  }

  async resendVerificationEmail(email: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.isEmailVerified) {
      throw new BadRequestException('Email is already verified');
    }

    // Resend OTP
    await this.otpService.resendOtp(email, OtpType.EMAIL_VERIFICATION);

    return { message: 'Verification email resent' };
  }

  private generateRandomToken(length: number = 64): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';
    for (let i = 0; i < length; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
  }

  private async createAuditLog(
    userId: string,
    action: AuditAction,
    entityType: string,
    entityId: string,
    oldData?: string,
    newData?: string,
  ) {
    await this.prisma.auditLog.create({
      data: {
        userId,
        action,
        entityType,
        entityId,
        oldData: oldData || undefined,
        newData: newData || undefined,
      },
    });
  }
}