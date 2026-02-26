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

  async register(registerDto: RegisterDto): Promise<{
    user: any;
    accessToken: string;
    message: string;
  }> {
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

    console.log(`✅ [AuthService] User created: ${user.email}`);

    // Generate and send OTP
    try {
      // Generate OTP which now returns the code
      const otpResult = await this.otpService.generateOtp({
        email: user.email,
        type: OtpType.EMAIL_VERIFICATION,
        metadata: JSON.stringify({ userId: user.id }),
      });
      
      // Access the code directly from the result
      const otpCode = otpResult.code;
      
      console.log(`📧 [AuthService] Sending OTP email to ${user.email} with code: ${otpCode}`);
      
      // Send OTP email with the actual code
      await this.mailerService.sendOtpEmail(user.email, otpCode, user.fullName);
      
      console.log(`✅ [AuthService] OTP email sent successfully to ${user.email}`);
    } catch (error) {
      console.error(`❌ [AuthService] Failed to send OTP email to ${user.email}:`, error.message);
    }

    // Log audit
    await this.createAuditLog(
      user.id,
      AuditAction.CREATE,
      'User',
      user.id,
      undefined,
      JSON.stringify(user),
    );

    // Generate JWT token
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload);

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword,
      accessToken,
      message: 'Registration successful. Please check your email for verification code.',
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

    // Check if email is verified
    if (!user.isEmailVerified) {
      throw new UnauthorizedException('Please verify your email before logging in');
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
    await this.prisma.session.create({
      data: {
        userId: user.id,
        token: this.generateRandomToken(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
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
    if (token) {
      await this.prisma.session.deleteMany({
        where: {
          userId,
          token,
        },
      });
    }

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

      if (!user.isEmailVerified) {
        throw new UnauthorizedException('Email not verified');
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

    console.log(`✅ [AuthService] Email verified for ${email}`);

    // Send welcome email AFTER successful verification
    try {
      await this.mailerService.sendWelcomeEmail(user.email, user.fullName);
      console.log(`📧 [AuthService] Welcome email sent to ${user.email}`);
    } catch (error) {
      console.warn(`[AuthService] Failed to send welcome email to ${user.email}: ${error.message}`);
    }

    // Log audit
    await this.createAuditLog(
      user.id,
      AuditAction.UPDATE,
      'User',
      user.id,
      undefined,
      'email_verification',
    );

    return { message: 'Email verified successfully. Welcome to ImmuniTrack Kenya!' };
  }

  async requestPasswordReset(resetPasswordDto: ResetPasswordDto): Promise<{ message: string }> {
    const { email } = resetPasswordDto;

    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return { message: 'If an account exists with this email, you will receive reset instructions.' };
    }

    try {
      const otpResult = await this.otpService.generateOtp({
        email,
        type: OtpType.PASSWORD_RESET,
        metadata: JSON.stringify({ userId: user.id }),
      });

      const otpCode = otpResult.code;
      
      console.log(`📧 [AuthService] Sending password reset OTP to ${email} with code: ${otpCode}`);
      
      await this.mailerService.sendOtpEmail(email, otpCode, user.fullName);
    } catch (error) {
      console.warn(`[AuthService] Failed to send password reset email to ${email}: ${error.message}`);
    }

    return { message: 'If an account exists with this email, you will receive reset instructions.' };
  }

  async resetPassword(resetPasswordConfirmDto: ResetPasswordConfirmDto): Promise<{ message: string }> {
    const { otpCode, newPassword, confirmNewPassword } = resetPasswordConfirmDto;

    if (newPassword !== confirmNewPassword) {
      throw new BadRequestException('Passwords do not match');
    }

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

    await this.otpService.verifyOtp(otp.email, otpCode, OtpType.PASSWORD_RESET);

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const user = await this.prisma.user.update({
      where: { email: otp.email },
      data: { password: hashedPassword },
    });

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

    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

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
    const otpResult = await this.otpService.resendOtp(email, OtpType.EMAIL_VERIFICATION);
    const otpCode = otpResult.code;
    
    console.log(`📧 [AuthService] Resending verification OTP to ${email} with code: ${otpCode}`);
    
    // Send OTP email
    await this.mailerService.sendOtpEmail(email, otpCode, user.fullName);

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