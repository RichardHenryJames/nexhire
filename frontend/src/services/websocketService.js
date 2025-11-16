import * as signalR from '@microsoft/signalr';
import { getToken } from './api';

class SignalRService {
  connection = null;
  connected = false;
  listeners = new Map();

  /**
   * Connect to Azure SignalR
   */
  async connect(token) {
    if (this.connection && this.connected) {
      console.log('✅ Already connected to SignalR');
      return;
    }

    try {
      // Get SignalR connection info from negotiate endpoint
      const API_URL = process.env.REACT_APP_API_URL || 'https://refopen-api-func.azurewebsites.net/api';
   
      console.log('🔄 Negotiating SignalR connection...');
      
      const response = await fetch(`${API_URL}/signalr/negotiate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token || getToken()}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Negotiate failed: ${response.status} - ${errorText}`);
      }

      const connectionInfo = await response.json();
      console.log('✅ SignalR connection info received:', connectionInfo.url);

      // Build SignalR connection
      this.connection = new signalR.HubConnectionBuilder()
        .withUrl(connectionInfo.url, {
          accessTokenFactory: () => connectionInfo.accessToken,
        })
        .withAutomaticReconnect([0, 2000, 10000, 30000]) // Retry intervals
        .configureLogging(signalR.LogLevel.Information)
        .build();

      // Connection events
      this.connection.onclose((error) => {
        this.connected = false;
        console.log('❌ SignalR disconnected', error ? `(Error: ${error.message})` : '');
      });

      this.connection.onreconnecting((error) => {
        console.log('🔄 SignalR reconnecting...', error ? `(${error.message})` : '');
      });

      this.connection.onreconnected((connectionId) => {
        this.connected = true;
        console.log('✅ SignalR reconnected (Connection ID:', connectionId, ')');
      });

      // Re-attach all existing listeners
      this.listeners.forEach((callback, event) => {
        this.connection.on(event, callback);
        console.log(`🎧 Re-attached listener: ${event}`);
      });

      // Start connection
      console.log('🚀 Starting SignalR connection...');
      await this.connection.start();
      this.connected = true;
      console.log('✅ SignalR connected successfully! Real-time messaging enabled.');

    } catch (error) {
      console.error('❌ SignalR connection error:', error);
      throw error;
    }
  }

  /**
   * Disconnect from SignalR
   */
  async disconnect() {
    if (this.connection) {
      await this.connection.stop();
      this.connection = null;
      this.connected = false;
      console.log('🔌 SignalR disconnected manually');
    }
  }

  /**
   * Listen for new messages
   */
  onNewMessage(callback) {
    this.on('newMessage', callback);
  }

  /**
   * Listen for conversation marked as read
   */
  onConversationRead(callback) {
    this.on('conversationRead', callback);
  }

  /**
   * Generic event listener
   */
  on(event, callback) {
    if (this.connection) {
      this.connection.on(event, callback);
      this.listeners.set(event, callback);
      console.log(`🎧 Now listening for: ${event}`);
    } else {
      // Store listener for when connection is established
      this.listeners.set(event, callback);
      console.log(`📝 Queued listener for: ${event} (will attach when connected)`);
    }
  }

  /**
   * Remove event listener
   */
  off(event) {
    if (this.connection) {
      this.connection.off(event);
      this.listeners.delete(event);
      console.log(`🔇 Stopped listening for: ${event}`);
    }
  }

  /**
   * Check if connected
   */
  isConnected() {
    return this.connected && this.connection && this.connection.state === signalR.HubConnectionState.Connected;
  }
}

// Export singleton instance
const signalRService = new SignalRService();
export default signalRService;
