/**
 * Push Token Service
 * Manages device push tokens in the PushTokens table
 */

import { DatabaseService } from './database.service';

const db = new DatabaseService();

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
      // UPSERT: check if token exists, update or insert
      const result = await db.executeQuery(
        `MERGE PushTokens AS target
         USING (SELECT @param0 AS Token) AS source
         ON target.Token = source.Token
         WHEN MATCHED THEN
           UPDATE SET 
             UserID = @param1,
             Platform = @param2,
             DeviceID = @param3,
             DeviceName = @param4,
             Provider = @param5,
             IsActive = 1,
             LastUsedAt = GETUTCDATE(),
             UpdatedAt = GETUTCDATE()
         WHEN NOT MATCHED THEN
           INSERT (UserID, Token, Platform, DeviceID, DeviceName, Provider, IsActive, LastUsedAt, CreatedAt, UpdatedAt)
           VALUES (@param1, @param0, @param2, @param3, @param4, @param5, 1, GETUTCDATE(), GETUTCDATE(), GETUTCDATE())
         OUTPUT inserted.TokenID;`,
        [token, userId, platform, deviceId || null, deviceName || null, provider]
      );

      const tokenId = result.recordset?.[0]?.TokenID;
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
      await db.executeQuery(
        `UPDATE PushTokens SET IsActive = 0, UpdatedAt = GETUTCDATE() WHERE Token = @param0`,
        [token]
      );
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
      await db.executeQuery(
        `UPDATE PushTokens SET IsActive = 0, UpdatedAt = GETUTCDATE() WHERE UserID = @param0`,
        [userId]
      );
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
      const result = await db.executeQuery(
        `SELECT TokenID, Token, Platform, Provider, DeviceID, DeviceName, LastUsedAt
         FROM PushTokens 
         WHERE UserID = @param0 AND IsActive = 1
         ORDER BY LastUsedAt DESC`,
        [userId]
      );
      return { success: true, tokens: result.recordset || [] };
    } catch (error: any) {
      console.error('Failed to get active tokens:', error);
      return { success: true, tokens: [] };
    }
  }
}
