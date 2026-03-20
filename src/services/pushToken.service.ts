/**
 * Push Token Service
 * Manages device push tokens — delegates DB queries to PushTokenRepository
 */

import { PushTokenRepository } from '../repositories/push-token.repository';

export class PushTokenService {
  /**
   * Register or update a push token for a user
   * Uses UPSERT: if token already exists, updates it; otherwise inserts
   */
  static async registerToken(
    userId: string,
    token: string,
    platform: string,
    deviceId?: string,
    deviceName?: string,
    provider: string = 'expo'
  ): Promise<{ success: boolean; tokenId?: string; error?: string }> {
    try {
      const tokenId = await PushTokenRepository.upsert(
        token, userId, platform, deviceId || null, deviceName || null, provider
      );
      return { success: true, tokenId };
    } catch (error: any) {
      console.error('Failed to register push token:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Deactivate a push token (e.g. on logout)
   */
  static async deactivateToken(token: string): Promise<{ success: boolean }> {
    try {
      await PushTokenRepository.deactivateByToken(token);
      return { success: true };
    } catch (error: any) {
      console.error('Failed to deactivate push token:', error);
      return { success: false };
    }
  }

  /**
   * Deactivate all tokens for a user (e.g. on account deletion)
   */
  static async deactivateAllTokensForUser(userId: string): Promise<{ success: boolean }> {
    try {
      await PushTokenRepository.deactivateAllByUser(userId);
      return { success: true };
    } catch (error: any) {
      console.error('Failed to deactivate all push tokens:', error);
      return { success: false };
    }
  }

  /**
   * Get all active push tokens for a user
   */
  static async getActiveTokensForUser(userId: string): Promise<{ success: boolean; tokens: any[] }> {
    try {
      const tokens = await PushTokenRepository.findActiveByUser(userId);
      return { success: true, tokens };
    } catch (error: any) {
      console.error('Failed to get active tokens:', error);
      return { success: true, tokens: [] };
    }
  }
}
