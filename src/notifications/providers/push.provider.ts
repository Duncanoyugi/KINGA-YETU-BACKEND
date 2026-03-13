import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';

export interface PushNotificationOptions {
  token: string | string[];
  title: string;
  body: string;
  data?: Record<string, any>;
  imageUrl?: string;
  badge?: number;
  sound?: string;
  priority?: 'normal' | 'high';
  ttl?: number; // Time to live in seconds
}

export interface PushNotificationResponse {
  success: boolean;
  messageId?: string;
  error?: string;
  invalidTokens?: string[];
}

@Injectable()
export class PushProvider {
  private readonly logger = new Logger(PushProvider.name);
  private isInitialized = false;

  constructor(private configService: ConfigService) {
    this.initialize();
  }

  private initialize() {
    try {
      const serviceAccount = this.configService.get('FIREBASE_SERVICE_ACCOUNT');
      
      if (!serviceAccount) {
        this.logger.warn('Firebase service account not configured. Push notifications disabled.');
        return;
      }

      // Parse the service account - handle both string and object formats
      let parsedServiceAccount: any;
      
      if (typeof serviceAccount === 'string') {
        try {
          parsedServiceAccount = JSON.parse(serviceAccount);
        } catch (parseError) {
          // If it's not JSON, check if it's a file path or handle as raw string
          this.logger.warn('Firebase service account is not valid JSON. Push notifications disabled.');
          this.logger.debug(`Service account content (first 100 chars): ${serviceAccount.substring(0, 100)}`);
          return;
        }
      } else if (typeof serviceAccount === 'object') {
        parsedServiceAccount = serviceAccount;
      } else {
        this.logger.warn('Firebase service account format is invalid. Push notifications disabled.');
        return;
      }

      // Validate required fields for Firebase service account
      const requiredFields = ['project_id', 'private_key', 'client_email'];
      const missingFields = requiredFields.filter(field => !parsedServiceAccount[field]);
      
      if (missingFields.length > 0) {
        this.logger.warn(`Firebase service account missing required fields: ${missingFields.join(', ')}. Push notifications disabled.`);
        return;
      }

      if (!admin.apps.length) {
        admin.initializeApp({
          credential: admin.credential.cert(parsedServiceAccount),
        });
      }

      this.isInitialized = true;
      this.logger.log('Firebase Cloud Messaging initialized successfully');
    } catch (error) {
      this.logger.error(`Failed to initialize push notifications: ${error.message}`);
    }
  }

  /**
   * Send push notification to a single device or multiple devices
   */
  async sendPushNotification(options: PushNotificationOptions): Promise<PushNotificationResponse> {
    if (!this.isInitialized) {
      return {
        success: false,
        error: 'Push notification provider not initialized. Check Firebase configuration.',
      };
    }

    try {
      const tokens = Array.isArray(options.token) ? options.token : [options.token];
      const validTokens = tokens.filter(token => this.isValidToken(token));

      if (validTokens.length === 0) {
        return {
          success: false,
          error: 'No valid device tokens provided',
        };
      }

      const message = {
        notification: {
          title: options.title,
          body: options.body,
          imageUrl: options.imageUrl,
        },
        data: options.data,
        android: {
          priority: (options.priority === 'high' ? 'high' : 'normal') as 'normal' | 'high',
          ttl: options.ttl ? options.ttl * 1000 : 3600 * 1000, // Default 1 hour
          notification: {
            sound: options.sound || 'default',
            channelId: 'immunitrack_alerts',
            icon: 'ic_notification',
            color: '#4CAF50',
            tag: 'vaccination_reminder',
          },
        },
        apns: {
          payload: {
            aps: {
              alert: {
                title: options.title,
                body: options.body,
              },
              badge: options.badge,
              sound: options.sound || 'default',
              'content-available': 1,
            },
          },
          headers: {
            'apns-priority': options.priority === 'high' ? '10' : '5',
          },
        },
        webpush: {
          headers: {
            Urgency: options.priority === 'high' ? 'high' : 'normal',
          },
          notification: {
            icon: '/assets/icons/icon-192x192.png',
            badge: '/assets/icons/badge-72x72.png',
            actions: [
              {
                action: 'view',
                title: 'View Details',
              },
            ],
          },
        },
      };

      let response;
      if (validTokens.length === 1) {
        // Single device
        response = await admin.messaging().send({
          ...message,
          token: validTokens[0],
        });
      } else {
        // Multiple devices
        response = await admin.messaging().sendEachForMulticast({
          ...message,
          tokens: validTokens,
        });
      }

      if (validTokens.length > 1 && response.failureCount > 0) {
        const invalidTokens: string[] = [];
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            invalidTokens.push(validTokens[idx]);
            this.logger.error(`Failed to send to token ${validTokens[idx]}: ${resp.error?.message}`);
          }
        });

        return {
          success: response.successCount > 0,
          messageId: response.responses[0]?.messageId,
          invalidTokens,
          error: response.failureCount > 0 ? `${response.failureCount} tokens failed` : undefined,
        };
      }

      return {
        success: true,
        messageId: response.messageId || response.responses?.[0]?.messageId,
      };
    } catch (error) {
      this.logger.error(`Failed to send push notification: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Subscribe device token to a topic
   */
  async subscribeToTopic(tokens: string | string[], topic: string): Promise<boolean> {
    if (!this.isInitialized) return false;

    try {
      const tokenArray = Array.isArray(tokens) ? tokens : [tokens];
      const response = await admin.messaging().subscribeToTopic(tokenArray, topic);
      
      this.logger.log(`Subscribed ${response.successCount} devices to topic: ${topic}`);
      return response.successCount > 0;
    } catch (error) {
      this.logger.error(`Failed to subscribe to topic ${topic}: ${error.message}`);
      return false;
    }
  }

  /**
   * Unsubscribe device token from a topic
   */
  async unsubscribeFromTopic(tokens: string | string[], topic: string): Promise<boolean> {
    if (!this.isInitialized) return false;

    try {
      const tokenArray = Array.isArray(tokens) ? tokens : [tokens];
      const response = await admin.messaging().unsubscribeFromTopic(tokenArray, topic);
      
      this.logger.log(`Unsubscribed ${response.successCount} devices from topic: ${topic}`);
      return response.successCount > 0;
    } catch (error) {
      this.logger.error(`Failed to unsubscribe from topic ${topic}: ${error.message}`);
      return false;
    }
  }

  /**
   * Send notification to a topic
   */
  async sendToTopic(topic: string, options: Omit<PushNotificationOptions, 'token'>): Promise<PushNotificationResponse> {
    if (!this.isInitialized) {
      return {
        success: false,
        error: 'Push notification provider not initialized',
      };
    }

    try {
      const message = {
        notification: {
          title: options.title,
          body: options.body,
        },
        data: options.data,
        topic: topic,
      };

      const response = await admin.messaging().send(message);

      return {
        success: true,
        messageId: response,
      };
    } catch (error) {
      this.logger.error(`Failed to send to topic ${topic}: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Validate device token format
   */
  private isValidToken(token: string): boolean {
    if (!token || typeof token !== 'string') return false;
    
    // Basic validation for FCM tokens
    return token.length > 100 && token.length < 2000;
  }

  /**
   * Check if provider is ready
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Clean up resources
   */
  async cleanup() {
    if (admin.apps.length) {
      await admin.app().delete();
      this.isInitialized = false;
      this.logger.log('Firebase app cleaned up');
    }
  }
}