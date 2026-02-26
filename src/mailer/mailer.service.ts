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
      port: Number(this.configService.get('SMTP_PORT')),
      secure: this.configService.get('SMTP_SECURE') === 'true',
      auth: {
        user: this.configService.get('SMTP_USER'),
        pass: this.configService.get('SMTP_PASS'),
      },
      // Mailtrap doesn't require TLS, but we'll keep it as is
      requireTLS: false,
      connectionTimeout: 10000,
      greetingTimeout: 5000,
      socketTimeout: 10000,
    });

    // Verify connection
    this.transporter.verify((error, success) => {
      if (error) {
        this.logger.error(`Mailtrap SMTP connection failed: ${error.message}`);
      } else {
        this.logger.log('Mailtrap SMTP server is ready to take messages');
      }
    });
  }

  async sendEmail(to: string, subject: string, html: string) {
    // Check if mail is disabled (for development/testing)
    if (this.configService.get('MAIL_ENABLED') === 'false') {
      this.logger.warn(`Email disabled (MAIL_ENABLED=false). Would send to: ${to}, subject: ${subject}`);
      return null;
    }

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
    const subject = 'Verify Your Email - ImmuniTrack Kenya';
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Email Verification</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { 
            background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%); 
            color: white; 
            padding: 30px 20px; 
            text-align: center; 
            border-radius: 10px 10px 0 0;
          }
          .header h1 { margin: 0; font-size: 28px; }
          .content { 
            padding: 40px 30px; 
            background: #f9f9f9; 
            border: 1px solid #e0e0e0;
            border-top: none;
            border-radius: 0 0 10px 10px;
          }
          .otp-container {
            text-align: center;
            margin: 30px 0;
          }
          .otp-code { 
            font-size: 42px; 
            font-weight: bold; 
            letter-spacing: 8px; 
            color: #4CAF50;
            padding: 20px 25px;
            background: white;
            border-radius: 10px;
            border: 3px dashed #4CAF50;
            display: inline-block;
            font-family: 'Courier New', monospace;
            box-shadow: 0 4px 10px rgba(0,0,0,0.1);
          }
          .expiry-note {
            background: #fff3cd;
            border: 1px solid #ffeeba;
            color: #856404;
            padding: 15px;
            border-radius: 5px;
            margin: 25px 0;
            text-align: center;
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
            <h1>🔐 Email Verification</h1>
          </div>
          <div class="content">
            <h2>Hello ${userName || 'User'},</h2>
            <p>Thank you for registering with ImmuniTrack Kenya! To complete your registration, please verify your email address using the code below:</p>
            
            <div class="otp-container">
              <div class="otp-code">${otpCode}</div>
            </div>
            
            <div class="expiry-note">
              <strong>⏰ This code will expire in 10 minutes</strong>
            </div>
            
            <p>If you didn't request this verification, please ignore this email.</p>
            
            <p>Best regards,<br><strong>The ImmuniTrack Kenya Team</strong></p>
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
    const subject = '🎉 Welcome to ImmuniTrack Kenya - Email Verified!';
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to ImmuniTrack Kenya</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { 
            background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%); 
            color: white; 
            padding: 40px 20px; 
            text-align: center; 
            border-radius: 10px 10px 0 0;
          }
          .header h1 { margin: 10px 0 0; font-size: 32px; }
          .success-icon { 
            font-size: 64px;
            margin-bottom: 10px;
          }
          .content { 
            padding: 40px 30px; 
            background: #f9f9f9; 
            border: 1px solid #e0e0e0;
            border-top: none;
            border-radius: 0 0 10px 10px;
          }
          .welcome-message {
            text-align: center;
            margin-bottom: 30px;
          }
          .feature-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 20px;
            margin: 30px 0;
          }
          .feature-card {
            background: white;
            padding: 20px;
            border-radius: 10px;
            text-align: center;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
            border: 1px solid #e0e0e0;
          }
          .feature-icon {
            font-size: 32px;
            margin-bottom: 10px;
          }
          .feature-card h3 {
            color: #4CAF50;
            margin: 10px 0;
            font-size: 16px;
          }
          .feature-card p {
            color: #666;
            font-size: 14px;
            margin: 0;
          }
          .button {
            display: inline-block;
            padding: 15px 40px;
            background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);
            color: white;
            text-decoration: none;
            border-radius: 50px;
            font-weight: bold;
            font-size: 16px;
            margin: 20px 0;
            box-shadow: 0 4px 10px rgba(76, 175, 80, 0.3);
          }
          .button:hover {
            background: linear-gradient(135deg, #45a049 0%, #3d8b40 100%);
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
            <div class="success-icon">✅</div>
            <h1>Email Verified Successfully!</h1>
          </div>
          <div class="content">
            <div class="welcome-message">
              <h2>Welcome to ImmuniTrack Kenya, ${userName}! 🎉</h2>
              <p>Your email has been verified and your account is now fully activated.</p>
            </div>

            <h3 style="text-align: center; color: #4CAF50;">What you can do now:</h3>
            
            <div class="feature-grid">
              <div class="feature-card">
                <div class="feature-icon">📅</div>
                <h3>Track Immunizations</h3>
                <p>Monitor your child's vaccination schedule</p>
              </div>
              
              <div class="feature-card">
                <div class="feature-icon">⏰</div>
                <h3>Get Reminders</h3>
                <p>Receive timely alerts for upcoming vaccines</p>
              </div>
              
              <div class="feature-card">
                <div class="feature-icon">📊</div>
                <h3>View History</h3>
                <p>Access complete immunization records</p>
              </div>
              
              <div class="feature-card">
                <div class="feature-icon">📱</div>
                <h3>Digital Certificates</h3>
                <p>Download and share vaccination proofs</p>
              </div>
            </div>

            <div style="text-align: center;">
              <p style="margin-bottom: 20px;">Ready to get started? Log in to your account now!</p>
              <a href="${this.configService.get('APP_URL') || 'http://localhost:3000'}/login" class="button">
                🚀 Log In to Your Account
              </a>
            </div>

            <p style="margin-top: 30px;">If you have any questions, our support team is here to help!</p>
            
            <p>Best regards,<br><strong>The ImmuniTrack Kenya Team</strong></p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} ImmuniTrack Kenya. All rights reserved.</p>
            <p>Making child immunization tracking simple and accessible.</p>
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
          .header { 
            background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%); 
            color: white; 
            padding: 30px 20px; 
            text-align: center; 
            border-radius: 10px 10px 0 0;
          }
          .content { 
            padding: 40px 30px; 
            background: #f9f9f9; 
            border: 1px solid #e0e0e0;
            border-top: none;
            border-radius: 0 0 10px 10px;
          }
          .button { 
            display: inline-block; 
            padding: 15px 40px; 
            background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);
            color: white; 
            text-decoration: none; 
            border-radius: 50px; 
            font-weight: bold;
            font-size: 16px;
            margin: 20px 0; 
            box-shadow: 0 4px 10px rgba(76, 175, 80, 0.3);
          }
          .warning {
            background: #fff3cd;
            border: 1px solid #ffeeba;
            color: #856404;
            padding: 20px;
            border-radius: 10px;
            margin: 25px 0;
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
            <h1>🔑 Password Reset Request</h1>
          </div>
          <div class="content">
            <h2>Hello ${userName},</h2>
            <p>We received a request to reset your password. Click the button below to create a new password:</p>
            
            <div style="text-align: center;">
              <a href="${resetLink}" class="button">Reset Password</a>
            </div>
            
            <div class="warning">
              <strong>⚠️ Important:</strong> 
              <ul style="margin-top: 10px; margin-bottom: 0;">
                <li>This link will expire in <strong>1 hour</strong></li>
                <li>If you didn't request this, please ignore this email</li>
                <li>Your password will remain unchanged if you don't click the link</li>
              </ul>
            </div>
            
            <p>Best regards,<br><strong>The ImmuniTrack Kenya Team</strong></p>
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