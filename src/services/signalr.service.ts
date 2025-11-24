import https from 'https';
import crypto from 'crypto';

const SIGNALR_CONNECTION_STRING = process.env.SIGNALR_CONNECTION_STRING || '';

interface SignalRMessage {
  target: string;
  arguments: any[];
}

/**
 * Azure SignalR Service Helper
 * Send real-time messages to connected clients
 */
export class SignalRService {
  private static endpoint: string;
  private static accessKey: string;

  static initialize() {
    if (!SIGNALR_CONNECTION_STRING) {
      console.warn('⚠️ SIGNALR_CONNECTION_STRING not configured');
      return;
    }

    console.log('🔄 Initializing SignalR Service...');
    console.log('Connection string present:', !!SIGNALR_CONNECTION_STRING);
    console.log('Connection string length:', SIGNALR_CONNECTION_STRING.length);

    const endpointMatch = SIGNALR_CONNECTION_STRING.match(/Endpoint=([^;]+)/);
    const keyMatch = SIGNALR_CONNECTION_STRING.match(/AccessKey=([^;]+)/);

    if (endpointMatch && keyMatch) {
      this.endpoint = endpointMatch[1];
      this.accessKey = keyMatch[1];
      console.log('✅ SignalR Service initialized');
      console.log('Endpoint:', this.endpoint);
      console.log('AccessKey length:', this.accessKey.length);
    } else {
      console.error('❌ Failed to parse SignalR connection string');
      console.error('Endpoint match:', !!endpointMatch);
      console.error('Key match:', !!keyMatch);
    }
  }

  /**
   * Generate JWT token for REST API calls
   */
  private static generateAccessToken(audience: string): string {
    const expiresAt = Math.floor(Date.now() / 1000) + 3600;

    const payload = {
      aud: audience,
      exp: expiresAt,
    };

    const header = { alg: 'HS256', typ: 'JWT' };
    
    const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
    
    const signature = crypto
      .createHmac('sha256', this.accessKey)
 .update(`${encodedHeader}.${encodedPayload}`)
      .digest('base64url');

    return `${encodedHeader}.${encodedPayload}.${signature}`;
  }

  /**
   * Send message to specific user
   */
  static async sendToUser(userId: string, message: SignalRMessage): Promise<void> {
    if (!this.endpoint || !this.accessKey) {
      console.warn('⚠️ SignalR not configured, skipping message');
      console.warn('Endpoint:', this.endpoint);
      console.warn('AccessKey present:', !!this.accessKey);
      return;
    }

    try {
      const audience = `${this.endpoint}/api/v1/hubs/messaging`;
      const token = this.generateAccessToken(audience);
      
      const url = new URL(`${this.endpoint}/api/v1/hubs/messaging/users/${userId}`);
      const data = JSON.stringify(message);

      console.log(`📤 Sending to SignalR:`, {
        url: url.toString(),
        userId,
        target: message.target,
        endpoint: this.endpoint
      });

      await this.makeRequest(url, token, data);
      console.log(`✅ SignalR message sent to user ${userId}:`, message.target);
    } catch (error) {
      console.error('❌ SignalR sendToUser error:', error);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        userId,
        target: message.target
      });
      throw error; // Re-throw to be caught by caller
    }
  }

  /**
 * Send message to group (conversation)
   */
  static async sendToGroup(groupName: string, message: SignalRMessage): Promise<void> {
    if (!this.endpoint || !this.accessKey) {
      console.warn('SignalR not configured, skipping message');
      return;
    }

    try {
      const audience = `${this.endpoint}/api/v1/hubs/messaging`;
      const token = this.generateAccessToken(audience);
      
      const url = new URL(`${this.endpoint}/api/v1/hubs/messaging/groups/${groupName}`);
      const data = JSON.stringify(message);

      await this.makeRequest(url, token, data);
      console.log(`?? SignalR message sent to group ${groupName}:`, message.target);
    } catch (error) {
    console.error('SignalR sendToGroup error:', error);
    }
  }

  /**
   * Make HTTPS request to SignalR REST API
   */
  private static makeRequest(url: URL, token: string, data: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const options = {
        method: 'POST',
 headers: {
        'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
    'Content-Length': Buffer.byteLength(data),
        },
      };

const req = https.request(url, options, (res) => {
        if (res.statusCode === 202) {
     resolve();
        } else {
    reject(new Error(`SignalR request failed: ${res.statusCode}`));
        }
      });

      req.on('error', reject);
      req.write(data);
      req.end();
    });
  }

  /**
   * Send new message event - USING CONVERSATION GROUP (works better with free tier)
   */
  static async emitNewMessage(conversationId: string, message: any, receiverUserId: string) {
    console.log(`📤 Emitting newMessage - Conversation: ${conversationId}, Receiver: ${receiverUserId}`);
    
    try {
      // Send to conversation group (both users in the conversation)
      await this.sendToGroup(`conversation_${conversationId}`, {
        target: 'newMessage',
        arguments: [message],
      });
      console.log(`✅ Message sent to conversation group: conversation_${conversationId}`);
      
      // Also try sending to specific user (if supported)
      try {
        await this.sendToUser(receiverUserId, {
          target: 'newMessage',
          arguments: [message],
        });
        console.log(`✅ Message also sent to user: ${receiverUserId}`);
      } catch (userError) {
        console.warn(`⚠️ Could not send to user directly (non-critical):`, userError);
      }
    } catch (error) {
      console.error('❌ Failed to emit new message via SignalR:', error);
      throw error;
    }
  }

  /**
   * Send conversation read event
   */
  static async emitConversationRead(conversationId: string, readerUserId: string, senderUserId: string) {
    await this.sendToUser(senderUserId, {
      target: 'conversationRead',
      arguments: [{
        conversationId,
        readBy: readerUserId,
        readAt: new Date().toISOString(),
      }],
    });
  }
}

// Initialize on module load
SignalRService.initialize();
