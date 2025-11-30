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
      return;
    }

    try {
      // Get SignalR connection info from negotiate endpoint
      const API_URL = process.env.REACT_APP_API_URL || 'https://refopen-api-func.azurewebsites.net/api';
   
      
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

      // Build SignalR connection
      this.connection = new signalR.HubConnectionBuilder()
        .withUrl(connectionInfo.url, {
          accessTokenFactory: () => connectionInfo.accessToken,
        })
        .withAutomaticReconnect([0, 2000, 10000, 30000]) // Retry intervals
        .configureLogging(signalR.LogLevel.None)
        .build();

      // Connection events
      this.connection.onclose((error) => {
        this.connected = false;
      });

      this.connection.onreconnecting((error) => {
      });

      this.connection.onreconnected((connectionId) => {
        this.connected = true;
      });

      // Re-attach all existing listeners
      this.listeners.forEach((callback, event) => {
        this.connection.on(event, callback);
      });

      // Start connection
      await this.connection.start();
      this.connected = true;

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
    } else {
      // Store listener for when connection is established
      this.listeners.set(event, callback);
    }
  }

  /**
   * Remove event listener
   */
  off(event) {
    if (this.connection) {
      this.connection.off(event);
      this.listeners.delete(event);
    }
  }

  /**
   * Join a conversation group
   */
  async joinConversationGroup(conversationId) {
    if (!this.connection || !this.connected) {
      console.warn('⚠️ Cannot join group - not connected to SignalR');
      return;
    }

    try {
      // Azure SignalR automatically manages groups - client just needs to listen
    } catch (error) {
      console.error('❌ Error joining conversation group:', error);
    }
  }

  /**
   * Leave a conversation group
   */
  async leaveConversationGroup(conversationId) {
    if (!this.connection || !this.connected) {
      return;
    }

    try {
      // Logic to leave group if needed
    } catch (error) {
      console.error('❌ Error leaving conversation group:', error);
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
