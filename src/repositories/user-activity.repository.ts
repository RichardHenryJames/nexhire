/**
 * User Activity Repository — Single source of truth for UserActivityLogs & UserSessions queries.
 *
 * WHY THIS EXISTS:
 *  - Separates analytics SQL from business logic in userActivity.service.ts
 *  - ~17 SQL queries consolidated
 *
 * RULES:
 *  1. Only this repository should write raw SQL for these tables.
 *  2. Services call repository methods — never dbService directly.
 */

import { dbService } from '../services/database.service';

// ── Shared filter fragment (excludes admins & test users) ───────

const NON_ADMIN_FILTER = `
    AND u.UserType != 'Admin'
    AND (u.Phone IS NULL OR u.Phone != '0000000000')
`.replace(/\n/g, ' ');

// ── Repository ──────────────────────────────────────────────────

export class UserActivityRepository {

    // ═══════════════════════════════════════════════════════════
    //  ACTIVITY LOGS
    // ═══════════════════════════════════════════════════════════

    /** Update user LastActive timestamp. */
    static async touchLastActive(userId: string): Promise<void> {
        await dbService.executeQuery(
            `UPDATE Users SET LastActive = GETUTCDATE() WHERE UserID = @param0`,
            [userId]
        );
    }

    /** Insert a new activity log entry. */
    static async insertLog(params: {
        activityId: string;
        userId: string;
        sessionId: string | null;
        screenName: string;
        action: string;
        actionDetails: string | null;
        platform: string | null;
        deviceType: string | null;
        browser: string | null;
        clientIP: string | null;
        userAgent: string | null;
        referrerScreen: string | null;
    }): Promise<void> {
        await dbService.executeQuery(
            `INSERT INTO UserActivityLogs (
                ActivityID, UserID, SessionID, ScreenName, Action, ActionDetails,
                Platform, DeviceType, Browser, ClientIP, UserAgent, ReferrerScreen
            ) VALUES (
                @param0, @param1, @param2, @param3, @param4, @param5,
                @param6, @param7, @param8, @param9, @param10, @param11
            )`,
            [
                params.activityId, params.userId, params.sessionId, params.screenName,
                params.action, params.actionDetails, params.platform, params.deviceType,
                params.browser, params.clientIP, params.userAgent, params.referrerScreen
            ]
        );
    }

    /** Mark a screen exit (sets ExitedAt + DurationSeconds). */
    static async markScreenExit(activityId: string, userId: string): Promise<void> {
        await dbService.executeQuery(
            `UPDATE UserActivityLogs 
             SET ExitedAt = GETUTCDATE(),
                 DurationSeconds = DATEDIFF(SECOND, EnteredAt, GETUTCDATE())
             WHERE ActivityID = @param0 AND UserID = @param1`,
            [activityId, userId]
        );
    }

    // ═══════════════════════════════════════════════════════════
    //  SESSIONS
    // ═══════════════════════════════════════════════════════════

    /**
     * Try to update an existing session. Returns rows affected.
     */
    static async updateSession(sessionId: string, userId: string): Promise<number> {
        const result = await dbService.executeQuery(
            `UPDATE UserSessions 
             SET LastActivityAt = GETUTCDATE(),
                 ScreensVisited = ScreensVisited + 1,
                 TotalDurationSeconds = DATEDIFF(SECOND, StartedAt, GETUTCDATE())
             WHERE SessionID = @param0 AND UserID = @param1`,
            [sessionId, userId]
        );
        return result.rowsAffected?.[0] ?? 0;
    }

    /** Insert a new session. */
    static async insertSession(params: {
        sessionId: string;
        userId: string;
        platform: string | null;
        deviceType: string | null;
        browser: string | null;
        clientIP: string | null;
    }): Promise<void> {
        await dbService.executeQuery(
            `INSERT INTO UserSessions (
                SessionID, UserID, Platform, DeviceType, Browser, ClientIP, ScreensVisited
            ) VALUES (@param0, @param1, @param2, @param3, @param4, @param5, 1)`,
            [params.sessionId, params.userId, params.platform, params.deviceType, params.browser, params.clientIP]
        );
    }

    /** End a session. */
    static async endSession(sessionId: string): Promise<void> {
        await dbService.executeQuery(
            `UPDATE UserSessions 
             SET EndedAt = GETUTCDATE(), IsActive = 0,
                 TotalDurationSeconds = DATEDIFF(SECOND, StartedAt, GETUTCDATE())
             WHERE SessionID = @param0`,
            [sessionId]
        );
    }

    // ═══════════════════════════════════════════════════════════
    //  ANALYTICS QUERIES
    // ═══════════════════════════════════════════════════════════

    /** Users with activity in last 5 minutes. */
    static async findActiveUsers(): Promise<any[]> {
        const result = await dbService.executeQuery(`
            SELECT DISTINCT 
                u.UserID, u.FirstName, u.LastName, u.Email, u.ProfilePictureURL, u.UserType,
                al.ScreenName AS CurrentScreen, al.EnteredAt AS LastActivityAt, al.Platform
            FROM UserActivityLogs al
            INNER JOIN Users u ON al.UserID = u.UserID
            WHERE al.EnteredAt >= DATEADD(MINUTE, -5, GETUTCDATE())
                ${NON_ADMIN_FILTER}
                AND al.EnteredAt = (SELECT MAX(al2.EnteredAt) FROM UserActivityLogs al2 WHERE al2.UserID = al.UserID)
            ORDER BY al.EnteredAt DESC
        `, []);
        return result.recordset || [];
    }

    /** All distinct users with activity in the last N days. */
    static async findAllUsersInPeriod(days: number): Promise<any[]> {
        const result = await dbService.executeQuery(`
            SELECT DISTINCT 
                u.UserID, u.FirstName, u.LastName, u.Email, u.ProfilePictureURL, u.UserType,
                COUNT(al.ActivityID) AS TotalViews,
                MAX(al.EnteredAt) AS LastSeen,
                (SELECT TOP 1 ScreenName FROM UserActivityLogs WHERE UserID = u.UserID ORDER BY EnteredAt DESC) AS LastScreen
            FROM UserActivityLogs al
            INNER JOIN Users u ON al.UserID = u.UserID
            WHERE al.EnteredAt >= DATEADD(DAY, -@param0, GETUTCDATE())
                ${NON_ADMIN_FILTER}
            GROUP BY u.UserID, u.FirstName, u.LastName, u.Email, u.ProfilePictureURL, u.UserType
            ORDER BY TotalViews DESC
        `, [days]);
        return result.recordset || [];
    }

    /** User activity timeline. */
    static async findUserActivity(userId: string, days: number): Promise<any[]> {
        const result = await dbService.executeQuery(`
            SELECT ActivityID, ScreenName, Action, ActionDetails, Platform, DeviceType,
                   EnteredAt, ExitedAt, DurationSeconds, ReferrerScreen
            FROM UserActivityLogs
            WHERE UserID = @param0 AND EnteredAt >= DATEADD(DAY, -@param1, GETUTCDATE())
            ORDER BY EnteredAt DESC
        `, [userId, days]);
        return result.recordset || [];
    }

    /** Screen-level stats. */
    static async getScreenStats(days: number): Promise<any[]> {
        const result = await dbService.executeQuery(`
            SELECT 
                al.ScreenName, COUNT(*) AS TotalViews, COUNT(DISTINCT al.UserID) AS UniqueUsers,
                AVG(ISNULL(al.DurationSeconds, 0)) AS AvgDurationSeconds,
                CAST(SUM(CASE WHEN al.DurationSeconds IS NOT NULL AND al.DurationSeconds < 5 THEN 1 ELSE 0 END) AS FLOAT) / 
                    NULLIF(COUNT(CASE WHEN al.DurationSeconds IS NOT NULL THEN 1 END), 0) * 100 AS BounceRate
            FROM UserActivityLogs al
            INNER JOIN Users u ON al.UserID = u.UserID
            WHERE al.EnteredAt >= DATEADD(DAY, -@param0, GETUTCDATE())
                AND al.ScreenName NOT LIKE 'Admin%' ${NON_ADMIN_FILTER}
            GROUP BY al.ScreenName
            ORDER BY TotalViews DESC
        `, [days]);
        return result.recordset || [];
    }

    /** Drop-off analytics. */
    static async getDropOffStats(days: number): Promise<any[]> {
        const result = await dbService.executeQuery(`
            WITH ScreenSequence AS (
                SELECT al.UserID, al.SessionID, al.ScreenName, al.EnteredAt,
                    LEAD(al.ScreenName) OVER (PARTITION BY al.SessionID ORDER BY al.EnteredAt) AS NextScreen
                FROM UserActivityLogs al
                INNER JOIN Users u ON al.UserID = u.UserID
                WHERE al.EnteredAt >= DATEADD(DAY, -@param0, GETUTCDATE())
                    AND al.SessionID IS NOT NULL AND al.ScreenName NOT LIKE 'Admin%' ${NON_ADMIN_FILTER}
            )
            SELECT ScreenName, COUNT(*) AS TotalExits, COUNT(DISTINCT UserID) AS UniqueExits,
                CAST(SUM(CASE WHEN NextScreen IS NULL THEN 1 ELSE 0 END) AS FLOAT) / NULLIF(COUNT(*), 0) * 100 AS ExitRate
            FROM ScreenSequence WHERE ScreenName NOT LIKE 'Admin%'
            GROUP BY ScreenName ORDER BY ExitRate DESC
        `, [days]);
        return result.recordset || [];
    }

    /** User flow analytics. */
    static async getUserFlowStats(days: number): Promise<any[]> {
        const result = await dbService.executeQuery(`
            SELECT al.ReferrerScreen AS FromScreen, al.ScreenName AS ToScreen,
                COUNT(*) AS TransitionCount, COUNT(DISTINCT al.UserID) AS UniqueUsers
            FROM UserActivityLogs al
            INNER JOIN Users u ON al.UserID = u.UserID
            WHERE al.EnteredAt >= DATEADD(DAY, -@param0, GETUTCDATE())
                AND al.ReferrerScreen IS NOT NULL AND al.ScreenName NOT LIKE 'Admin%'
                AND al.ReferrerScreen NOT LIKE 'Admin%' ${NON_ADMIN_FILTER}
            GROUP BY al.ReferrerScreen, al.ScreenName ORDER BY TransitionCount DESC
        `, [days]);
        return result.recordset || [];
    }

    /** Daily active users trend. */
    static async getDailyTrend(days: number): Promise<any[]> {
        const result = await dbService.executeQuery(`
            SELECT CAST(al.EnteredAt AS DATE) AS Date,
                COUNT(DISTINCT al.UserID) AS ActiveUsers,
                COUNT(*) AS TotalScreenViews,
                COUNT(DISTINCT al.SessionID) AS TotalSessions
            FROM UserActivityLogs al
            INNER JOIN Users u ON al.UserID = u.UserID
            WHERE al.EnteredAt >= DATEADD(DAY, -@param0, GETUTCDATE())
                AND al.ScreenName NOT LIKE 'Admin%' ${NON_ADMIN_FILTER}
            GROUP BY CAST(al.EnteredAt AS DATE) ORDER BY Date DESC
        `, [days]);
        return result.recordset || [];
    }

    /** Hourly activity pattern. */
    static async getHourlyPattern(days: number): Promise<any[]> {
        const result = await dbService.executeQuery(`
            SELECT DATEPART(HOUR, al.EnteredAt) AS Hour, COUNT(*) AS ActivityCount,
                COUNT(DISTINCT al.UserID) AS UniqueUsers
            FROM UserActivityLogs al
            INNER JOIN Users u ON al.UserID = u.UserID
            WHERE al.EnteredAt >= DATEADD(DAY, -@param0, GETUTCDATE())
                AND al.ScreenName NOT LIKE 'Admin%' ${NON_ADMIN_FILTER}
            GROUP BY DATEPART(HOUR, al.EnteredAt) ORDER BY Hour
        `, [days]);
        return result.recordset || [];
    }

    /** Generic breakdown query (device, browser, or platform). */
    static async getBreakdown(column: 'DeviceType' | 'Browser' | 'Platform', days: number): Promise<any[]> {
        const result = await dbService.executeQuery(`
            SELECT ISNULL(al.${column}, 'unknown') AS ${column},
                COUNT(*) AS Count, COUNT(DISTINCT al.UserID) AS UniqueUsers
            FROM UserActivityLogs al
            INNER JOIN Users u ON al.UserID = u.UserID
            WHERE al.EnteredAt >= DATEADD(DAY, -@param0, GETUTCDATE())
                AND al.ScreenName NOT LIKE 'Admin%' ${NON_ADMIN_FILTER}
            GROUP BY al.${column} ORDER BY Count DESC
        `, [days]);
        return result.recordset || [];
    }
}
