/**
 * Push Token Repository — Single source of truth for PushTokens table queries.
 *
 * WHY THIS EXISTS:
 *  - Separates data-access (SQL) from business logic in pushToken.service.ts
 *  - Makes queries testable and reusable
 *
 * RULES:
 *  1. Only this repository should write raw PushTokens SQL.
 *  2. Services call repository methods — never dbService directly for this table.
 */

import { dbService } from '../services/database.service';

// ── Repository ──────────────────────────────────────────────────

export class PushTokenRepository {

    /**
     * Upsert a push token — if token exists, update it; otherwise insert.
     * Returns the TokenID from the OUTPUT clause.
     */
    static async upsert(
        token: string,
        userId: string,
        platform: string,
        deviceId: string | null,
        deviceName: string | null,
        provider: string
    ): Promise<string | undefined> {
        const result = await dbService.executeQuery(
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
            [token, userId, platform, deviceId, deviceName, provider]
        );
        return result.recordset?.[0]?.TokenID;
    }

    /**
     * Deactivate a single token by its value.
     */
    static async deactivateByToken(token: string): Promise<void> {
        await dbService.executeQuery(
            `UPDATE PushTokens SET IsActive = 0, UpdatedAt = GETUTCDATE() WHERE Token = @param0`,
            [token]
        );
    }

    /**
     * Deactivate all tokens for a user (e.g., on account deletion).
     */
    static async deactivateAllByUser(userId: string): Promise<void> {
        await dbService.executeQuery(
            `UPDATE PushTokens SET IsActive = 0, UpdatedAt = GETUTCDATE() WHERE UserID = @param0`,
            [userId]
        );
    }

    /**
     * Fetch all active tokens for a user, most recently used first.
     */
    static async findActiveByUser(userId: string): Promise<any[]> {
        const result = await dbService.executeQuery(
            `SELECT TokenID, Token, Platform, Provider, DeviceID, DeviceName, LastUsedAt
             FROM PushTokens 
             WHERE UserID = @param0 AND IsActive = 1
             ORDER BY LastUsedAt DESC`,
            [userId]
        );
        return result.recordset || [];
    }
}
