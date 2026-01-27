import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private transporter: nodemailer.Transporter;

  constructor(private configService: ConfigService) {
    this.initializeTransporter();
  }

  private initializeTransporter() {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get('SMTP_HOST'),
      port: this.configService.get('SMTP_PORT'),
      secure: this.configService.get('SMTP_SECURE') === 'true',
      auth: {
        user: this.configService.get('SMTP_USER'),
        pass: this.configService.get('SMTP_PASS'),
      },
    });
  }

  async sendEmail(to: string, subject: string, html: string) {
    try {
      const mailOptions = {
        from: `"ImmuniTrack Kenya" <${this.configService.get('SMTP_FROM')}>`,
        to,
        subject,
        html,
      };

      const info = await this.transporter.sendMail(mailOptions);
      this.logger.log(`Email sent: ${info.messageId}`);
      return info;
    } catch (error) {
      this.logger.error(`Failed to send email: ${error.message}`);
      throw error;
    }
  }

  async sendOtpEmail(to: string, otpCode: string, userName?: string) {
    const subject = 'Your Verification Code - ImmuniTrack Kenya';
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verification Code</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #4CAF50; color: white; padding: 20px; text-align: center; }
          .content { padding: 30px; background: #f9f9f9; }
          .otp-code { 
            font-size: 32px; 
            font-weight: bold; 
            text-align: center; 
            letter-spacing: 5px; 
            color: #4CAF50;
            margin: 20px 0;
            padding: 15px;
            background: white;
            border-radius: 5px;
            border: 2px dashed #4CAF50;
          }
          .footer { 
            margin-top: 30px; 
            padding: 20px; 
            text-align: center; 
            color: #666; 
            font-size: 12px; 
            border-top: 1px solid #ddd; 
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>ImmuniTrack Kenya</h1>
          </div>
          <div class="content">
            <h2>Hello ${userName || 'User'},</h2>
            <p>Your verification code is:</p>
            <div class="otp-code">${otpCode}</div>
            <p>This code will expire in 10 minutes.</p>
            <p>If you didn't request this code, please ignore this email.</p>
            <p>Best regards,<br>The ImmuniTrack Kenya Team</p>
          </div>
          <div class="footer">
            <p>This is an automated message, please do not reply to this email.</p>
            <p>© ${new Date().getFullYear()} ImmuniTrack Kenya. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail(to, subject, html);
  }

  async sendWelcomeEmail(to: string, userName: string) {
    const subject = 'Welcome to ImmuniTrack Kenya';
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #4CAF50; color: white; padding: 20px; text-align: center; }
          .content { padding: 30px; background: #f9f9f9; }
          .footer { 
            margin-top: 30px; 
            padding: 20px; 
            text-align: center; 
            color: #666; 
            font-size: 12px; 
            border-top: 1px solid #ddd; 
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to ImmuniTrack Kenya</h1>
          </div>
          <div class="content">
            <h2>Hello ${userName},</h2>
            <p>Thank you for registering with ImmuniTrack Kenya! Your account has been successfully created.</p>
            <p>You can now:</p>
            <ul>
              <li>Track your child's immunization schedule</li>
              <li>Receive timely reminders for upcoming vaccinations</li>
              <li>View immunization history and growth records</li>
              <li>Access digital immunization certificates</li>
            </ul>
            <p>To get started, please verify your email address by entering the OTP sent to you.</p>
            <p>If you have any questions, please contact our support team.</p>
            <p>Best regards,<br>The ImmuniTrack Kenya Team</p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} ImmuniTrack Kenya. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail(to, subject, html);
  }

  async sendPasswordResetEmail(to: string, userName: string, resetLink: string) {
    const subject = 'Password Reset Request - ImmuniTrack Kenya';
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #4CAF50; color: white; padding: 20px; text-align: center; }
          .content { padding: 30px; background: #f9f9f9; }
          .button { 
            display: inline-block; 
            padding: 12px 24px; 
            background: #4CAF50; 
            color: white; 
            text-decoration: none; 
            border-radius: 5px; 
            margin: 20px 0; 
          }
          .footer { 
            margin-top: 30px; 
            padding: 20px; 
            text-align: center; 
            color: #666; 
            font-size: 12px; 
            border-top: 1px solid #ddd; 
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Password Reset</h1>
          </div>
          <div class="content">
            <h2>Hello ${userName},</h2>
            <p>We received a request to reset your password. Click the button below to reset it:</p>
            <p style="text-align: center;">
              <a href="${resetLink}" class="button">Reset Password</a>
            </p>
            <p>If you didn't request a password reset, please ignore this email.</p>
            <p>This link will expire in 1 hour.</p>
            <p>Best regards,<br>The ImmuniTrack Kenya Team</p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} ImmuniTrack Kenya. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail(to, subject, html);
  }
}