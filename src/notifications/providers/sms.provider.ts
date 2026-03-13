import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import AfricasTalking from 'africastalking';

export interface SmsOptions {
  to: string | string[];
  message: string;
  from?: string;
  enqueue?: boolean;
}

export interface SmsResponse {
  success: boolean;
  messageId?: string;
  status?: string;
  error?: string;
  cost?: string;
}

@Injectable()
export class SmsProvider {
  private readonly logger = new Logger(SmsProvider.name);
  private client: any;
  private isInitialized = false;

  constructor(private configService: ConfigService) {
    this.initialize();
  }

  private initialize() {
    try {
      const apiKey = this.configService.get('AFRICASTALKING_API_KEY');
      const username = this.configService.get('AFRICASTALKING_USERNAME');
      
      if (!apiKey || !username) {
        this.logger.warn('Africa\'s Talking credentials not configured. SMS provider disabled.');
        return;
      }

      this.client = AfricasTalking({
        apiKey,
        username,
      }).SMS;

      this.isInitialized = true;
      this.logger.log('Africa\'s Talking SMS provider initialized successfully');
    } catch (error) {
      this.logger.error(`Failed to initialize SMS provider: ${error.message}`);
    }
  }

  /**
   * Send SMS using Africa's Talking API
   */
  async sendSms(options: SmsOptions): Promise<SmsResponse> {
    if (!this.isInitialized) {
      return {
        success: false,
        error: 'SMS provider not initialized. Check Africa\'s Talking credentials.',
      };
    }

    try {
      const recipients = Array.isArray(options.to) ? options.to : [options.to];
      const validRecipients = this.validatePhoneNumbers(recipients);

      if (validRecipients.length === 0) {
        return {
          success: false,
          error: 'No valid phone numbers provided',
        };
      }

      const smsOptions = {
        to: validRecipients,
        message: options.message,
        from: options.from || this.configService.get('AFRICASTALKING_SENDER_ID') || 'ImmuniTrack',
      };

      this.logger.debug(`Sending SMS to ${validRecipients.length} recipient(s)`);

      const response = await this.client.send(smsOptions);

      if (response.SMSMessageData?.Recipients) {
        const successful = response.SMSMessageData.Recipients.filter(
          (recipient: any) => recipient.status === 'Success',
        );

        const totalCost = response.SMSMessageData.Recipients.reduce(
          (sum: number, recipient: any) => sum + (parseFloat(recipient.cost) || 0),
          0,
        );

        return {
          success: successful.length > 0,
          messageId: response.SMSMessageData.MessageId,
          status: `${successful.length}/${validRecipients.length} sent successfully`,
          cost: totalCost > 0 ? `KES ${totalCost.toFixed(2)}` : undefined,
        };
      }

      return {
        success: false,
        error: 'Unexpected response from Africa\'s Talking',
      };
    } catch (error) {
      this.logger.error(`Failed to send SMS: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Send bulk SMS with rate limiting
   */
  async sendBulkSms(recipients: string[], message: string, batchSize = 100): Promise<SmsResponse[]> {
    const results: SmsResponse[] = [];

    for (let i = 0; i < recipients.length; i += batchSize) {
      const batch = recipients.slice(i, i + batchSize);
      
      try {
        const result = await this.sendSms({
          to: batch,
          message,
        });
        
        results.push(result);
        
        // Rate limiting: wait 1 second between batches
        if (i + batchSize < recipients.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        this.logger.error(`Failed to send batch ${i / batchSize + 1}: ${error.message}`);
        results.push({
          success: false,
          error: `Batch ${i / batchSize + 1} failed: ${error.message}`,
        });
      }
    }

    return results;
  }

  /**
   * Check SMS balance
   */
  async getBalance(): Promise<{ balance: string; currency: string } | null> {
    if (!this.isInitialized) {
      return null;
    }

    try {
      // Note: Africa's Talking API doesn't have direct balance check in free tier
      // This would require premium subscription
      this.logger.warn('Balance check requires premium Africa\'s Talking subscription');
      return null;
    } catch (error) {
      this.logger.error(`Failed to get balance: ${error.message}`);
      return null;
    }
  }

  /**
   * Validate and format Kenyan phone numbers
   */
  private validatePhoneNumbers(phoneNumbers: string[]): string[] {
    const validNumbers: string[] = [];

    for (const number of phoneNumbers) {
      const cleaned = number.replace(/\D/g, '');

      // Validate Kenyan phone number (starts with 254, 07, or 01)
      if (cleaned.match(/^(2547\d{8}|07\d{8}|011\d{7})$/)) {
        let formattedNumber = cleaned;

        // Convert 07... to 2547...
        if (formattedNumber.startsWith('07')) {
          formattedNumber = '254' + formattedNumber.substring(1);
        }
        // Convert 011... to 25411...
        else if (formattedNumber.startsWith('011')) {
          formattedNumber = '254' + formattedNumber.substring(1);
        }
        // Ensure starts with 254
        else if (!formattedNumber.startsWith('254')) {
          continue; // Invalid format
        }

        // Ensure total length is 12 digits (254xxxxxxxxx)
        if (formattedNumber.length === 12) {
          validNumbers.push(formattedNumber);
        }
      }
    }

    return validNumbers;
  }

  /**
   * Simulate SMS sending for testing/development
   */
  private async simulateSms(options: SmsOptions): Promise<SmsResponse> {
    this.logger.debug(`[SIMULATION] SMS to ${options.to}: ${options.message.substring(0, 50)}...`);
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    return {
      success: true,
      messageId: `SIM-${Date.now()}`,
      status: 'Simulated delivery',
      cost: 'KES 0.00',
    };
  }

  /**
   * Check if provider is ready
   */
  isReady(): boolean {
    return this.isInitialized;
  }
}