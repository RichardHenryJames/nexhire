import api from './api';

/**
 * Messaging API Service
 * Handles all messaging-related API calls
 */

class MessagingAPI {
  // ========================================================================
  // CONVERSATIONS
  // ========================================================================

  /**
   * Create or get existing conversation with another user
   */
  async createConversation(otherUserId) {
    try {
      const result = await api.apiCall('/conversations', {
        method: 'POST',
        body: JSON.stringify({ otherUserId }),
      });
    return result;
    } catch (error) {
    console.error('? Create conversation failed:', error);
      throw error;
    }
  }

  /**
   * Get all conversations for current user
   */
  async getMyConversations(page = 1, pageSize = 20) {
    try {
      const params = new URLSearchParams({
  page: page.toString(),
        pageSize: pageSize.toString(),
      });
      
      const result = await api.apiCall(`/conversations/my?${params}`);
      return result;
    } catch (error) {
      console.error('? Get conversations failed:', error);
      throw error;
    }
  }

  /**
   * Archive/unarchive a conversation
   */
  async archiveConversation(conversationId, archive = true) {
    try {
      const result = await api.apiCall(`/conversations/${conversationId}/archive`, {
        method: 'PUT',
    body: JSON.stringify({ archive }),
      });
  return result;
    } catch (error) {
      console.error('? Archive conversation failed:', error);
   throw error;
    }
  }

  /**
   * Mute/unmute a conversation
   */
  async muteConversation(conversationId, mute = true) {
    try {
      const result = await api.apiCall(`/conversations/${conversationId}/mute`, {
        method: 'PUT',
        body: JSON.stringify({ mute }),
      });
  return result;
    } catch (error) {
      console.error('? Mute conversation failed:', error);
      throw error;
    }
  }

  // ========================================================================
  // MESSAGES
  // ========================================================================

  /**
   * Send a message in a conversation
   */
  async sendMessage(conversationId, content, messageType = 'Text') {
    try {
      const result = await api.apiCall('/messages', {
        method: 'POST',
      body: JSON.stringify({
          conversationId,
  content,
       messageType,
        }),
    });
      return result;
    } catch (error) {
      console.error('? Send message failed:', error);
      throw error;
    }
  }

  /**
   * Get messages in a conversation
   */
  async getMessages(conversationId, page = 1, pageSize = 50) {
  try {
  const params = new URLSearchParams({
        page: page.toString(),
      pageSize: pageSize.toString(),
      });
    
const result = await api.apiCall(`/conversations/${conversationId}/messages?${params}`);
      return result;
    } catch (error) {
      console.error('? Get messages failed:', error);
      throw error;
    }
  }

  /**
   * Mark a message as read
   */
  async markMessageAsRead(messageId) {
    try {
      const result = await api.apiCall(`/messages/${messageId}/read`, {
        method: 'PUT',
      });
      return result;
    } catch (error) {
    console.error('? Mark message as read failed:', error);
      throw error;
    }
  }

  /**
   * Mark all messages in conversation as read
   */
  async markConversationAsRead(conversationId) {
    try {
      const result = await api.apiCall(`/conversations/${conversationId}/mark-read`, {
  method: 'PUT',
      });
      
      return result;
    } catch (error) {
      console.error('? Mark conversation as read failed:', error);
  throw error;
    }
  }

  /**
   * Get unread message count
   */
  async getUnreadCount() {
    try {
   const result = await api.apiCall('/messages/unread-count');
      return result;
  } catch (error) {
      console.error('? Get unread count failed:', error);
    throw error;
    }
  }

  /**
   * Delete a message
   */
  async deleteMessage(messageId, deleteFor = 'Sender') {
    try {
      const params = new URLSearchParams({ deleteFor });
      const result = await api.apiCall(`/messages/${messageId}?${params}`, {
        method: 'DELETE',
      });
      return result;
    } catch (error) {
      console.error('? Delete message failed:', error);
      throw error;
    }
  }

  // ========================================================================
  // BLOCKING
  // ========================================================================

  /**
   * Block or unblock a user (unified endpoint)
   */
  async toggleBlockUser(userId, block = true, reason = '') {
    try {
      if (block) {
        // Block user
        const result = await api.apiCall('/users/block', {
          method: 'POST',
          body: JSON.stringify({
            userIdToBlock: userId,
            reason,
          }),
        });
        return result;
      } else {
        // Unblock user - FIXED: Correct endpoint
        const result = await api.apiCall(`/users/block/${userId}`, {
          method: 'DELETE',
        });
        return result;
      }
    } catch (error) {
      console.error(`? ${block ? 'Block' : 'Unblock'} user failed:`, error);
      throw error;
    }
  }

  /**
   * Block a user
   */
  async blockUser(userIdToBlock, reason = '') {
    return this.toggleBlockUser(userIdToBlock, true, reason);
  }

  /**
   * Unblock a user
   */
  async unblockUser(userId) {
    return this.toggleBlockUser(userId, false);
  }

  /**
   * Check if a user is blocked
   */
  async checkIfBlocked(userId) {
    try {
      const result = await api.apiCall(`/users/is-blocked/${userId}`);
 return result;
    } catch (error) {
    console.error('? Check blocked failed:', error);
      throw error;
    }
  }

  /**
   * Get list of blocked users
   */
  async getBlockedUsers() {
    try {
      const result = await api.apiCall('/users/blocked');
      return result;
    } catch (error) {
      console.error('? Get blocked users failed:', error);
      throw error;
    }
  }

  // ========================================================================
  // PROFILE VIEWS
  // ========================================================================

  /**
   * Record a profile view
   */
  async recordProfileView(userId, deviceType = 'Mobile') {
    try {
      const params = new URLSearchParams({ deviceType });
      const result = await api.apiCall(`/users/${userId}/profile-view?${params}`, {
        method: 'POST',
      });
      return result;
    } catch (error) {
 console.error('? Record profile view failed:', error);
      // Don't throw - profile views are not critical
      return { success: false };
    }
  }

  /**
   * Get who viewed my profile
   */
  async getMyProfileViews(page = 1, pageSize = 20) {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
      });
   
      const result = await api.apiCall(`/users/profile-views?${params}`);
   return result;
 } catch (error) {
      console.error('? Get profile views failed:', error);
      throw error;
    }
  }

  /**
   * Get public profile of another user
   */
  async getPublicProfile(userId) {
    try {
   const result = await api.apiCall(`/users/${userId}/public-profile`);
      return result;
    } catch (error) {
      console.error('? Get public profile failed:', error);
      throw error;
    }
  }

  /**
   * Search for users
   */
  async searchUsers(query, page = 1, pageSize = 20) {
    try {
      const params = new URLSearchParams({
        q: query,
        page: page.toString(),
        pageSize: pageSize.toString(),
      });
      const result = await api.apiCall(`/users/search?${params}`);
      return result;
    } catch (error) {
      console.error('? Search users failed:', error);
      throw error;
    }
  }
}

export default new MessagingAPI();
