import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BrevoClient } from '@getbrevo/brevo';

@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private readonly brevo: BrevoClient | null;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('BREVO_API_KEY')?.trim();
    this.brevo = apiKey
      ? new BrevoClient({ apiKey, timeoutInSeconds: 30, maxRetries: 2 })
      : null;
  }

  // ---------------------------------------------------------------------------
  // Core sender
  // ---------------------------------------------------------------------------

  async sendEmail(to: string, subject: string, html: string) {
    // Mail can be switched off for development/testing
    if (this.configService.get('MAIL_ENABLED') === 'false') {
      this.logger.warn(
        `Email disabled (MAIL_ENABLED=false). Would send to: ${to}, subject: ${subject}`,
      );
      return null;
    }

    if (!this.brevo) {
      const error = new Error('BREVO_API_KEY is not configured');
      this.logger.error(error.message);
      throw error;
    }

    const fromEmail = this.configService.get<string>('MAIL_FROM_EMAIL')?.trim();
    const fromName =
      this.configService.get<string>('MAIL_FROM_NAME')?.trim() ||
      'Kinga Yetu ImmuniTrack';

    if (!fromEmail) {
      const error = new Error('MAIL_FROM_EMAIL is not configured');
      this.logger.error(error.message);
      throw error;
    }

    try {
      const result = await this.brevo.transactionalEmails.sendTransacEmail({
        to: [{ email: to }],
        subject,
        htmlContent: html,
        sender: {
          name: fromName,
          email: fromEmail,
        },
      });

      this.logger.log(`Email accepted by Brevo: ${result.messageId}`);
      return { messageId: result.messageId };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Brevo failed to send email (from: ${fromEmail}): ${message}`,
      );
      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // Public email types
  // ---------------------------------------------------------------------------

  async sendOtpEmail(to: string, otpCode: string, userName?: string) {
    const subject = 'Verify Your Email - ImmuniTrack Kenya';

    const html = this.layout({
      title: 'Email Verification',
      header: '<h1>🔐 Email Verification</h1>',
      body: `
        <h2>Hello ${this.escapeHtml(userName || 'User')},</h2>
        <p>Thank you for registering with ImmuniTrack Kenya! To complete your registration, please verify your email address using the code below:</p>

        <div class="otp-container">
          <div class="otp-code">${this.escapeHtml(otpCode)}</div>
        </div>

        <div class="note">
          <strong>⏰ This code will expire in 10 minutes</strong>
        </div>

        <p>If you didn't request this verification, please ignore this email.</p>

        <p>Best regards,<br><strong>The ImmuniTrack Kenya Team</strong></p>
      `,
      footer: `
        <p>This is an automated message, please do not reply to this email.</p>
        <p>© ${new Date().getFullYear()} ImmuniTrack Kenya. All rights reserved.</p>
      `,
    });

    return this.sendEmail(to, subject, html);
  }

  async sendWelcomeEmail(to: string, userName: string) {
    const subject = '🎉 Welcome to ImmuniTrack Kenya - Email Verified!';

    const appUrl = (
      this.configService.get<string>('APP_URL') || 'http://localhost:3000'
    ).replace(/\/+$/, '');
    const loginUrl = this.escapeHtml(`${appUrl}/login`);

    const html = this.layout({
      title: 'Welcome to ImmuniTrack Kenya',
      header: `
        <div style="font-size:64px; margin-bottom:10px;">✅</div>
        <h1>Email Verified Successfully!</h1>
      `,
      body: `
        <div style="text-align:center; margin-bottom:30px;">
          <h2>Welcome to ImmuniTrack Kenya, ${this.escapeHtml(userName)}! 🎉</h2>
          <p>Your email has been verified and your account is now fully activated.</p>
        </div>

        <h3 style="text-align:center; color:#4CAF50;">What you can do now:</h3>

        <!-- Table layout: display:grid is not supported by most email clients -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:20px 0;">
          <tr>
            ${this.featureCard('📅', 'Track Immunizations', "Monitor your child's vaccination schedule")}
            ${this.featureCard('⏰', 'Get Reminders', 'Receive timely alerts for upcoming vaccines')}
          </tr>
          <tr>
            ${this.featureCard('📊', 'View History', 'Access complete immunization records')}
            ${this.featureCard('📱', 'Digital Certificates', 'Download and share vaccination proofs')}
          </tr>
        </table>

        <div style="text-align:center;">
          <p style="margin-bottom:20px;">Ready to get started? Log in to your account now!</p>
          <a href="${loginUrl}" class="button">🚀 Log In to Your Account</a>
        </div>

        <p style="margin-top:30px;">If you have any questions, our support team is here to help!</p>

        <p>Best regards,<br><strong>The ImmuniTrack Kenya Team</strong></p>
      `,
      footer: `
        <p>© ${new Date().getFullYear()} ImmuniTrack Kenya. All rights reserved.</p>
        <p>Making child immunization tracking simple and accessible.</p>
      `,
    });

    return this.sendEmail(to, subject, html);
  }

  async sendPasswordResetEmail(
    to: string,
    userName: string,
    resetLink: string,
  ) {
    const subject = 'Password Reset Request - ImmuniTrack Kenya';

    const html = this.layout({
      title: 'Password Reset',
      header: '<h1>🔑 Password Reset Request</h1>',
      body: `
        <h2>Hello ${this.escapeHtml(userName)},</h2>
        <p>We received a request to reset your password. Click the button below to create a new password:</p>

        <div style="text-align:center;">
          <a href="${this.escapeHtml(resetLink)}" class="button">Reset Password</a>
        </div>

        <div class="note" style="text-align:left;">
          <strong>⚠️ Important:</strong>
          <ul style="margin-top:10px; margin-bottom:0;">
            <li>This link will expire in <strong>1 hour</strong></li>
            <li>If you didn't request this, please ignore this email</li>
            <li>Your password will remain unchanged if you don't click the link</li>
          </ul>
        </div>

        <p>Best regards,<br><strong>The ImmuniTrack Kenya Team</strong></p>
      `,
      footer: `
        <p>© ${new Date().getFullYear()} ImmuniTrack Kenya. All rights reserved.</p>
      `,
    });

    return this.sendEmail(to, subject, html);
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /** Escape user-supplied text before putting it into HTML. */
  private escapeHtml(value: string): string {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private featureCard(icon: string, title: string, text: string): string {
    return `
      <td width="50%" valign="top" style="padding:8px;">
        <div style="background:#ffffff; padding:20px; border-radius:10px; text-align:center; border:1px solid #e0e0e0;">
          <div style="font-size:32px; margin-bottom:10px;">${icon}</div>
          <h3 style="color:#4CAF50; margin:10px 0; font-size:16px;">${this.escapeHtml(title)}</h3>
          <p style="color:#666666; font-size:14px; margin:0;">${this.escapeHtml(text)}</p>
        </div>
      </td>
    `;
  }

  /** Shared page shell so the three emails look consistent and stay short. */
  private layout(opts: {
    title: string;
    header: string;
    body: string;
    footer: string;
  }): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${this.escapeHtml(opts.title)}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header {
            background-color: #4CAF50; /* fallback for clients without gradients */
            background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);
            color: #ffffff;
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
          .otp-container { text-align: center; margin: 30px 0; }
          .otp-code {
            font-size: 42px;
            font-weight: bold;
            letter-spacing: 8px;
            color: #4CAF50;
            padding: 20px 25px;
            background: #ffffff;
            border-radius: 10px;
            border: 3px dashed #4CAF50;
            display: inline-block;
            font-family: 'Courier New', monospace;
          }
          .note {
            background: #fff3cd;
            border: 1px solid #ffeeba;
            color: #856404;
            padding: 15px;
            border-radius: 8px;
            margin: 25px 0;
            text-align: center;
          }
          .button {
            display: inline-block;
            padding: 15px 40px;
            background-color: #4CAF50; /* fallback */
            background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);
            color: #ffffff !important;
            text-decoration: none;
            border-radius: 50px;
            font-weight: bold;
            font-size: 16px;
            margin: 20px 0;
          }
          .footer {
            margin-top: 30px;
            padding: 20px;
            text-align: center;
            color: #666666;
            font-size: 12px;
            border-top: 1px solid #dddddd;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">${opts.header}</div>
          <div class="content">${opts.body}</div>
          <div class="footer">${opts.footer}</div>
        </div>
      </body>
      </html>
    `;
  }
}
