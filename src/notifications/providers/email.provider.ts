import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '../../mailer/mailer.service';
import * as fs from 'fs';
import * as path from 'path';
import * as handlebars from 'handlebars';

export interface EmailOptions {
  to: string | string[];
  subject: string;
  template?: string;
  templateData?: Record<string, any>;
  html?: string;
  text?: string;
  attachments?: Array<{
    filename: string;
    content?: Buffer | string;
    path?: string;
    contentType?: string;
  }>;
}

export interface EmailResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

@Injectable()
export class EmailProvider {
  private readonly logger = new Logger(EmailProvider.name);
  private templateCache = new Map<string, handlebars.TemplateDelegate>();

  constructor(private readonly mailerService: MailerService) {}

  /**
   * Send email using template or raw HTML
   */
  async sendEmail(options: EmailOptions): Promise<EmailResponse> {
    try {
      const recipients = Array.isArray(options.to) ? options.to : [options.to];
      const validRecipients = this.validateEmailAddresses(recipients);

      if (validRecipients.length === 0) {
        return {
          success: false,
          error: 'No valid email addresses provided',
        };
      }

      let htmlContent = options.html;
      let textContent = options.text;

      // Use template if provided
      if (options.template && options.templateData) {
        htmlContent = await this.renderTemplate(options.template, options.templateData);
        textContent = this.htmlToText(htmlContent);
      }

      if (!htmlContent) {
        return {
          success: false,
          error: 'No email content provided',
        };
      }

      // Add default template data if missing
      const templateData = {
        ...options.templateData,
        currentYear: new Date().getFullYear(),
        appName: 'ImmuniTrack Kenya',
        supportEmail: 'support@immunitrack.co.ke',
      };

      // Replace template variables in HTML
      htmlContent = this.replaceTemplateVariables(htmlContent, templateData);
      textContent = textContent ? this.replaceTemplateVariables(textContent, templateData) : undefined;

      // Send email to each recipient
      const results = await Promise.allSettled(
        validRecipients.map(async (recipient) => {
          return this.mailerService.sendEmail(
            recipient,
            options.subject,
            htmlContent!,
          );
        }),
      );

      const successful = results.filter(r => r.status === 'fulfilled');
      const failed = results.filter(r => r.status === 'rejected');

      if (failed.length > 0) {
        this.logger.warn(`Failed to send ${failed.length} emails`);
      }

      return {
        success: successful.length > 0,
        messageId: (successful[0] as any)?.value?.messageId,
        error: failed.length > 0 ? `${failed.length} emails failed to send` : undefined,
      };
    } catch (error) {
      this.logger.error(`Failed to send email: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Send bulk emails with rate limiting
   */
  async sendBulkEmail(
    recipients: string[],
    subject: string,
    template: string,
    templateData: Record<string, any>,
    batchSize = 50,
  ): Promise<{ sent: number; failed: number; errors: string[] }> {
    const validRecipients = this.validateEmailAddresses(recipients);
    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    for (let i = 0; i < validRecipients.length; i += batchSize) {
      const batch = validRecipients.slice(i, i + batchSize);
      
      const batchResults = await Promise.allSettled(
        batch.map(async (recipient) => {
          const personalizedData = {
            ...templateData,
            recipientEmail: recipient,
            recipientName: recipient.split('@')[0], // Simple name extraction
          };

          return this.sendEmail({
            to: recipient,
            subject,
            template,
            templateData: personalizedData,
          });
        }),
      );

      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value.success) {
          sent++;
        } else {
          failed++;
          const error = result.status === 'rejected' 
            ? result.reason.message 
            : (result as any).value?.error;
          errors.push(`Failed ${batch[index]}: ${error}`);
        }
      });

      // Rate limiting: wait 1 second between batches
      if (i + batchSize < validRecipients.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return { sent, failed, errors };
  }

  /**
   * Render email template using Handlebars
   */
  private async renderTemplate(templateName: string, data: Record<string, any>): Promise<string> {
    try {
      // Check cache first
      let template = this.templateCache.get(templateName);
      
      if (!template) {
        // Load template from file
        const templatePath = path.join(
          __dirname,
          '..',
          'templates',
          'email',
          `${templateName}.template.html`,
        );

        if (!fs.existsSync(templatePath)) {
          throw new Error(`Template ${templateName} not found`);
        }

        const templateContent = fs.readFileSync(templatePath, 'utf8');
        template = handlebars.compile(templateContent);
        this.templateCache.set(templateName, template);
      }

      return template(data);
    } catch (error) {
      this.logger.error(`Failed to render template ${templateName}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Validate email addresses
   */
  private validateEmailAddresses(emails: string[]): string[] {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emails.filter(email => emailRegex.test(email));
  }

  /**
   * Convert HTML to plain text (simplified)
   */
  private htmlToText(html: string): string {
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<p\s*\/?>/gi, '\n\n')
      .replace(/<[^>]+>/g, '')
      .replace(/\n\s*\n/g, '\n\n')
      .trim();
  }

  /**
   * Replace template variables in text
   */
  private replaceTemplateVariables(text: string, data: Record<string, any>): string {
    return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return data[key] !== undefined ? data[key] : match;
    });
  }

  /**
   * Clear template cache
   */
  clearCache(): void {
    this.templateCache.clear();
    this.logger.log('Template cache cleared');
  }

  /**
   * Preload templates for better performance
   */
  async preloadTemplates(templateNames: string[]): Promise<void> {
    for (const templateName of templateNames) {
      try {
        await this.renderTemplate(templateName, {});
        this.logger.debug(`Preloaded template: ${templateName}`);
      } catch (error) {
        this.logger.warn(`Failed to preload template ${templateName}: ${error.message}`);
      }
    }
  }
}