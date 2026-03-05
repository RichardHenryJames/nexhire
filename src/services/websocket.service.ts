import { Server as SocketIOServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import { AuthService } from './auth.service';

interface UserSocket {
  userId: string;
  socketId: string;
}

/**
 * WebSocket Service for Real-Time Messaging
 * Handles Socket.IO connections and events
 */
export class WebSocketService {
  private static io: SocketIOServer | null = null;
  private static connectedUsers: Map<string, string[]> = new Map(); // userId -> socketIds[]

  /**
   * Initialize Socket.IO server
*/
  static initialize(httpServer: HttpServer) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
        credentials: true,
      },
      path: '/socket.io/',
  transports: ['websocket', 'polling'],
    });

    // Authentication middleware
    this.io.use(async (socket, next) => {
      try {
     const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
    
        if (!token) {
          return next(new Error('Authentication error: No token provided'));
        }

        const payload = AuthService.verifyToken(token);
    
        if (payload.type !== 'access') {
          return next(new Error('Authentication error: Invalid token type'));
        }

      // Attach user info to socket
        (socket as any).userId = payload.userId;
        (socket as any).userType = payload.userType;
     
   next();
      } catch (error) {
        next(new Error('Authentication error: Invalid token'));
}
    });

    // Connection handler
    this.io.on('connection', (socket) => {
   const userId = (socket as any).userId;
      
      console.log(`? User connected: ${userId} (socket: ${socket.id})`);

      // Add user to connected users map
      if (!this.connectedUsers.has(userId)) {
        this.connectedUsers.set(userId, []);
      }
      this.connectedUsers.get(userId)!.push(socket.id);

      // Join user's personal room
      socket.join(`user:${userId}`);

 // Handle disconnection
      socket.on('disconnect', () => {
      console.log(`? User disconnected: ${userId} (socket: ${socket.id})`);
        
        // Remove socket from user's connections
     const userSockets = this.connectedUsers.get(userId);
        if (userSockets) {
     const index = userSockets.indexOf(socket.id);
          if (index > -1) {
          userSockets.splice(index, 1);
          }
          
          // Remove user from map if no more connections
 if (userSockets.length === 0) {
    this.connectedUsers.delete(userId);
          }
    }
      });

      // Join conversation room
      socket.on('join_conversation', (conversationId: string) => {
      socket.join(`conversation:${conversationId}`);
        console.log(`?? User ${userId} joined conversation ${conversationId}`);
      });

      // Leave conversation room
      socket.on('leave_conversation', (conversationId: string) => {
        socket.leave(`conversation:${conversationId}`);
        console.log(`?? User ${userId} left conversation ${conversationId}`);
      });

  // User is typing indicator
      socket.on('typing_start', (data: { conversationId: string; otherUserId: string }) => {
        this.emitToUser(data.otherUserId, 'user_typing', {
     conversationId: data.conversationId,
          userId,
      isTyping: true,
 });
      });

   socket.on('typing_stop', (data: { conversationId: string; otherUserId: string }) => {
        this.emitToUser(data.otherUserId, 'user_typing', {
          conversationId: data.conversationId,
     userId,
    isTyping: false,
        });
      });
  });

    console.log('?? WebSocket service initialized');
  }

  /**
   * Get Socket.IO instance
   */
  static getIO(): SocketIOServer {
    if (!this.io) {
      throw new Error('WebSocket service not initialized. Call initialize() first.');
    }
    return this.io;
  }

  /**
   * Check if user is online
   */
  static isUserOnline(userId: string): boolean {
    return this.connectedUsers.has(userId);
  }

  /**
   * Get all online user IDs
   */
  static getOnlineUsers(): string[] {
    return Array.from(this.connectedUsers.keys());
  }

  /**
   * Emit event to specific user (all their connected devices)
   */
  static emitToUser(userId: string, event: string, data: any) {
    if (!this.io) return;
    
    this.io.to(`user:${userId}`).emit(event, data);
    console.log(`?? Emitted ${event} to user ${userId}:`, data);
  }

  /**
   * Emit event to conversation (all participants)
   */
  static emitToConversation(conversationId: string, event: string, data: any) {
    if (!this.io) return;
    
    this.io.to(`conversation:${conversationId}`).emit(event, data);
    console.log(`?? Emitted ${event} to conversation ${conversationId}:`, data);
  }

  /**
   * Emit new message event
   */
  static emitNewMessage(conversationId: string, message: any, receiverUserId: string) {
 this.emitToConversation(conversationId, 'new_message', message);
    this.emitToUser(receiverUserId, 'conversation_updated', {
      conversationId,
      lastMessage: message,
    });
  }

  /**
   * Emit message read event
   */
  static emitMessageRead(conversationId: string, messageIds: string[], readerUserId: string, senderUserId: string) {
    // Notify sender that their messages were read
    this.emitToUser(senderUserId, 'messages_read', {
      conversationId,
      messageIds,
      readBy: readerUserId,
      readAt: new Date().toISOString(),
 });
    
    console.log(`? Emitted messages_read to sender ${senderUserId} for conversation ${conversationId}`);
  }

  /**
   * Emit conversation read event (all messages marked as read)
   */
  static emitConversationRead(conversationId: string, readerUserId: string, senderUserId: string) {
    this.emitToUser(senderUserId, 'conversation_read', {
      conversationId,
      readBy: readerUserId,
      readAt: new Date().toISOString(),
    });
    
    console.log(`? Emitted conversation_read to sender ${senderUserId} for conversation ${conversationId}`);
  }

  /**
   * Emit typing indicator
   */
  static emitTypingIndicator(conversationId: string, userId: string, otherUserId: string, isTyping: boolean) {
    this.emitToUser(otherUserId, 'user_typing', {
      conversationId,
      userId,
      isTyping,
    });
  }
}
