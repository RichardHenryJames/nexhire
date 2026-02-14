/**
 * User Activity Tracking Service
 * Tracks screen views, user sessions, and engagement metrics
 */

import { dbService } from './database.service';
import { AuthService } from './auth.service';

interface ActivityLog {
  screenName: string;
  action?: string;
  actionDetails?: any;
  platform?: string;
  deviceType?: string;
  browser?: string;
  sessionId?: string;
  referrerScreen?: string;
  clientIP?: string;
  userAgent?: string;
}

// Note: SQL Server returns PascalCase column names
interface ScreenStats {
  ScreenName: string;
  TotalViews: number;
  UniqueUsers: number;
  AvgDurationSeconds: number;
  BounceRate: number;
}

export class UserActivityService {
  
  /**
   * Log a screen view or user action
   */
  static async logActivity(userId: string, activity: ActivityLog): Promise<{ success: boolean; activityId?: string }> {
    try {
      const activityId = AuthService.generateUniqueId();
      
      // Update user's LastActive timestamp
      await dbService.executeQuery(
        `UPDATE Users SET LastActive = GETUTCDATE() WHERE UserID = @param0`,
        [userId]
      );

      // Insert activity log
      await dbService.executeQuery(
        `INSERT INTO UserActivityLogs (
          ActivityID, UserID, SessionID, ScreenName, Action, ActionDetails,
          Platform, DeviceType, Browser, ClientIP, UserAgent, ReferrerScreen
        ) VALUES (
          @param0, @param1, @param2, @param3, @param4, @param5,
          @param6, @param7, @param8, @param9, @param10, @param11
        )`,
        [
          activityId,
          userId,
          activity.sessionId || null,
          activity.screenName,
          activity.action || 'view',
          activity.actionDetails ? JSON.stringify(activity.actionDetails) : null,
          activity.platform || null,
          activity.deviceType || null,
          activity.browser || null,
          activity.clientIP || null,
          activity.userAgent || null,
          activity.referrerScreen || null
        ]
      );

      // Update or create session
      if (activity.sessionId) {
        await this.updateSession(userId, activity.sessionId, activity);
      }

      return { success: true, activityId };
    } catch (error) {
      console.error('Error logging activity:', error);
      return { success: false };
    }
  }

  /**
   * Log when user exits a screen (to calculate duration)
   */
  static async logScreenExit(userId: string, activityId: string): Promise<void> {
    try {
      await dbService.executeQuery(
        `UPDATE UserActivityLogs 
         SET ExitedAt = GETUTCDATE(),
             DurationSeconds = DATEDIFF(SECOND, EnteredAt, GETUTCDATE())
         WHERE ActivityID = @param0 AND UserID = @param1`,
        [activityId, userId]
      );
    } catch (error) {
      console.error('Error logging screen exit:', error);
    }
  }

  /**
   * Update or create user session
   */
  static async updateSession(userId: string, sessionId: string, activity: ActivityLog): Promise<void> {
    try {
      // Try to update existing session
      const result = await dbService.executeQuery(
        `UPDATE UserSessions 
         SET LastActivityAt = GETUTCDATE(),
             ScreensVisited = ScreensVisited + 1,
             TotalDurationSeconds = DATEDIFF(SECOND, StartedAt, GETUTCDATE())
         WHERE SessionID = @param0 AND UserID = @param1`,
        [sessionId, userId]
      );

      // If no session exists, create one
      if (result.rowsAffected?.[0] === 0) {
        await dbService.executeQuery(
          `INSERT INTO UserSessions (
            SessionID, UserID, Platform, DeviceType, Browser, ClientIP, ScreensVisited
          ) VALUES (
            @param0, @param1, @param2, @param3, @param4, @param5, 1
          )`,
          [
            sessionId,
            userId,
            activity.platform || null,
            activity.deviceType || null,
            activity.browser || null,
            activity.clientIP || null
          ]
        );
      }
    } catch (error) {
      console.error('Error updating session:', error);
    }
  }

  /**
   * End a user session
   */
  static async endSession(sessionId: string): Promise<void> {
    try {
      await dbService.executeQuery(
        `UPDATE UserSessions 
         SET EndedAt = GETUTCDATE(),
             IsActive = 0,
             TotalDurationSeconds = DATEDIFF(SECOND, StartedAt, GETUTCDATE())
         WHERE SessionID = @param0`,
        [sessionId]
      );
    } catch (error) {
      console.error('Error ending session:', error);
    }
  }

  /**
   * Get currently active users (activity in last 5 minutes)
   */
  static async getActiveUsers(): Promise<any[]> {
    try {
      // Get users who have activity logs in the last 5 minutes
      const result = await dbService.executeQuery(
        `SELECT DISTINCT 
          u.UserID, u.FirstName, u.LastName, u.Email, u.ProfilePictureURL, u.UserType,
          al.ScreenName AS CurrentScreen,
          al.EnteredAt AS LastActivityAt,
          al.Platform
        FROM UserActivityLogs al
        INNER JOIN Users u ON al.UserID = u.UserID
        WHERE al.EnteredAt >= DATEADD(MINUTE, -5, GETUTCDATE())
          AND u.UserType != 'Admin'
          AND (u.Phone IS NULL OR u.Phone != '0000000000')
          AND al.EnteredAt = (
            SELECT MAX(al2.EnteredAt) FROM UserActivityLogs al2 WHERE al2.UserID = al.UserID
          )
        ORDER BY al.EnteredAt DESC`,
        []
      );
      return result.recordset || [];
    } catch (error) {
      console.error('Error getting active users:', error);
      return [];
    }
  }

  /**
   * Get all users who have activity in a time period
   */
  static async getAllActiveUsersInPeriod(days: number = 30): Promise<any[]> {
    try {
      const result = await dbService.executeQuery(
        `SELECT DISTINCT 
          u.UserID, u.FirstName, u.LastName, u.Email, u.ProfilePictureURL, u.UserType,
          COUNT(al.ActivityID) AS TotalViews,
          MAX(al.EnteredAt) AS LastSeen,
          (SELECT TOP 1 ScreenName FROM UserActivityLogs WHERE UserID = u.UserID ORDER BY EnteredAt DESC) AS LastScreen
        FROM UserActivityLogs al
        INNER JOIN Users u ON al.UserID = u.UserID
        WHERE al.EnteredAt >= DATEADD(DAY, -@param0, GETUTCDATE())
          AND u.UserType != 'Admin'
          AND (u.Phone IS NULL OR u.Phone != '0000000000')
        GROUP BY u.UserID, u.FirstName, u.LastName, u.Email, u.ProfilePictureURL, u.UserType
        ORDER BY TotalViews DESC`,
        [days]
      );
      return result.recordset || [];
    } catch (error) {
      console.error('Error getting all active users:', error);
      return [];
    }
  }

  /**
   * Get user activity timeline
   */
  static async getUserActivity(userId: string, days: number = 7): Promise<any[]> {
    try {
      const result = await dbService.executeQuery(
        `SELECT 
          ActivityID, ScreenName, Action, ActionDetails, Platform, DeviceType,
          EnteredAt, ExitedAt, DurationSeconds, ReferrerScreen
        FROM UserActivityLogs
        WHERE UserID = @param0 AND EnteredAt >= DATEADD(DAY, -@param1, GETUTCDATE())
        ORDER BY EnteredAt DESC`,
        [userId, days]
      );
      return result.recordset || [];
    } catch (error) {
      console.error('Error getting user activity:', error);
      return [];
    }
  }

  /**
   * Get screen analytics (most visited screens, avg time, etc.)
   * Excludes Admin screens from analytics
   */
  static async getScreenAnalytics(days: number = 30): Promise<ScreenStats[]> {
    try {
      const result = await dbService.executeQuery(
        `SELECT 
          al.ScreenName,
          COUNT(*) AS TotalViews,
          COUNT(DISTINCT al.UserID) AS UniqueUsers,
          AVG(ISNULL(al.DurationSeconds, 0)) AS AvgDurationSeconds,
          -- Bounce rate: % of users who left within 5 seconds
          CAST(SUM(CASE WHEN al.DurationSeconds IS NOT NULL AND al.DurationSeconds < 5 THEN 1 ELSE 0 END) AS FLOAT) / 
            NULLIF(COUNT(CASE WHEN al.DurationSeconds IS NOT NULL THEN 1 END), 0) * 100 AS BounceRate
        FROM UserActivityLogs al
        INNER JOIN Users u ON al.UserID = u.UserID
        WHERE al.EnteredAt >= DATEADD(DAY, -@param0, GETUTCDATE())
          AND al.ScreenName NOT LIKE 'Admin%'
          AND u.UserType != 'Admin'
          AND (u.Phone IS NULL OR u.Phone != '0000000000')
        GROUP BY al.ScreenName
        ORDER BY TotalViews DESC`,
        [days]
      );
      return result.recordset || [];
    } catch (error) {
      console.error('Error getting screen analytics:', error);
      return [];
    }
  }

  /**
   * Get user drop-off points (screens where users leave)
   * Excludes Admin screens from analytics
   */
  static async getDropOffAnalytics(days: number = 30): Promise<any[]> {
    try {
      const result = await dbService.executeQuery(
        `WITH ScreenSequence AS (
          SELECT 
            al.UserID, al.SessionID, al.ScreenName, al.EnteredAt,
            LEAD(al.ScreenName) OVER (PARTITION BY al.SessionID ORDER BY al.EnteredAt) AS NextScreen
          FROM UserActivityLogs al
          INNER JOIN Users u ON al.UserID = u.UserID
          WHERE al.EnteredAt >= DATEADD(DAY, -@param0, GETUTCDATE())
            AND al.SessionID IS NOT NULL
            AND al.ScreenName NOT LIKE 'Admin%'
            AND u.UserType != 'Admin'
            AND (u.Phone IS NULL OR u.Phone != '0000000000')
        )
        SELECT 
          ScreenName,
          COUNT(*) AS TotalExits,
          COUNT(DISTINCT UserID) AS UniqueExits,
          -- Exit rate: % who didn't go to another screen
          CAST(SUM(CASE WHEN NextScreen IS NULL THEN 1 ELSE 0 END) AS FLOAT) / 
            NULLIF(COUNT(*), 0) * 100 AS ExitRate
        FROM ScreenSequence
        WHERE ScreenName NOT LIKE 'Admin%'
        GROUP BY ScreenName
        ORDER BY ExitRate DESC`,
        [days]
      );
      return result.recordset || [];
    } catch (error) {
      console.error('Error getting drop-off analytics:', error);
      return [];
    }
  }

  /**
   * Get user journey/flow analytics
   * Excludes Admin screens from analytics
   */
  static async getUserFlowAnalytics(days: number = 30): Promise<any[]> {
    try {
      const result = await dbService.executeQuery(
        `SELECT 
          al.ReferrerScreen AS FromScreen,
          al.ScreenName AS ToScreen,
          COUNT(*) AS TransitionCount,
          COUNT(DISTINCT al.UserID) AS UniqueUsers
        FROM UserActivityLogs al
        INNER JOIN Users u ON al.UserID = u.UserID
        WHERE al.EnteredAt >= DATEADD(DAY, -@param0, GETUTCDATE())
          AND al.ReferrerScreen IS NOT NULL
          AND al.ScreenName NOT LIKE 'Admin%'
          AND al.ReferrerScreen NOT LIKE 'Admin%'
          AND u.UserType != 'Admin'
          AND (u.Phone IS NULL OR u.Phone != '0000000000')
        GROUP BY al.ReferrerScreen, al.ScreenName
        ORDER BY TransitionCount DESC`,
        [days]
      );
      return result.recordset || [];
    } catch (error) {
      console.error('Error getting user flow analytics:', error);
      return [];
    }
  }

  /**
   * Get daily active users trend
   * Excludes Admin screens from analytics
   */
  static async getDailyActiveUsersTrend(days: number = 30): Promise<any[]> {
    try {
      const result = await dbService.executeQuery(
        `SELECT 
          CAST(al.EnteredAt AS DATE) AS Date,
          COUNT(DISTINCT al.UserID) AS ActiveUsers,
          COUNT(*) AS TotalScreenViews,
          COUNT(DISTINCT al.SessionID) AS TotalSessions
        FROM UserActivityLogs al
        INNER JOIN Users u ON al.UserID = u.UserID
        WHERE al.EnteredAt >= DATEADD(DAY, -@param0, GETUTCDATE())
          AND al.ScreenName NOT LIKE 'Admin%'
          AND u.UserType != 'Admin'
          AND (u.Phone IS NULL OR u.Phone != '0000000000')
        GROUP BY CAST(al.EnteredAt AS DATE)
        ORDER BY Date DESC`,
        [days]
      );
      return result.recordset || [];
    } catch (error) {
      console.error('Error getting DAU trend:', error);
      return [];
    }
  }

  /**
   * Get hourly activity pattern
   * Excludes Admin screens from analytics
   */
  static async getHourlyActivityPattern(days: number = 7): Promise<any[]> {
    try {
      const result = await dbService.executeQuery(
        `SELECT 
          DATEPART(HOUR, al.EnteredAt) AS Hour,
          COUNT(*) AS ActivityCount,
          COUNT(DISTINCT al.UserID) AS UniqueUsers
        FROM UserActivityLogs al
        INNER JOIN Users u ON al.UserID = u.UserID
        WHERE al.EnteredAt >= DATEADD(DAY, -@param0, GETUTCDATE())
          AND al.ScreenName NOT LIKE 'Admin%'
          AND u.UserType != 'Admin'
          AND (u.Phone IS NULL OR u.Phone != '0000000000')
        GROUP BY DATEPART(HOUR, al.EnteredAt)
        ORDER BY Hour`,
        [days]
      );
      return result.recordset || [];
    } catch (error) {
      console.error('Error getting hourly pattern:', error);
      return [];
    }
  }

  /**
   * Get device type breakdown (mobile, desktop, tablet)
   */
  static async getDeviceBreakdown(days: number = 30): Promise<any[]> {
    try {
      const result = await dbService.executeQuery(
        `SELECT 
          ISNULL(al.DeviceType, 'unknown') AS DeviceType,
          COUNT(*) AS Count,
          COUNT(DISTINCT al.UserID) AS UniqueUsers
        FROM UserActivityLogs al
        INNER JOIN Users u ON al.UserID = u.UserID
        WHERE al.EnteredAt >= DATEADD(DAY, -@param0, GETUTCDATE())
          AND al.ScreenName NOT LIKE 'Admin%'
          AND u.UserType != 'Admin'
          AND (u.Phone IS NULL OR u.Phone != '0000000000')
        GROUP BY al.DeviceType
        ORDER BY Count DESC`,
        [days]
      );
      return result.recordset || [];
    } catch (error) {
      console.error('Error getting device breakdown:', error);
      return [];
    }
  }

  /**
   * Get browser breakdown (Chrome, Safari, etc.)
   */
  static async getBrowserBreakdown(days: number = 30): Promise<any[]> {
    try {
      const result = await dbService.executeQuery(
        `SELECT 
          ISNULL(al.Browser, 'unknown') AS Browser,
          COUNT(*) AS Count,
          COUNT(DISTINCT al.UserID) AS UniqueUsers
        FROM UserActivityLogs al
        INNER JOIN Users u ON al.UserID = u.UserID
        WHERE al.EnteredAt >= DATEADD(DAY, -@param0, GETUTCDATE())
          AND al.ScreenName NOT LIKE 'Admin%'
          AND u.UserType != 'Admin'
          AND (u.Phone IS NULL OR u.Phone != '0000000000')
        GROUP BY al.Browser
        ORDER BY Count DESC`,
        [days]
      );
      return result.recordset || [];
    } catch (error) {
      console.error('Error getting browser breakdown:', error);
      return [];
    }
  }

  /**
   * Get platform breakdown (web, ios, android)
   */
  static async getPlatformBreakdown(days: number = 30): Promise<any[]> {
    try {
      const result = await dbService.executeQuery(
        `SELECT 
          ISNULL(al.Platform, 'unknown') AS Platform,
          COUNT(*) AS Count,
          COUNT(DISTINCT al.UserID) AS UniqueUsers
        FROM UserActivityLogs al
        INNER JOIN Users u ON al.UserID = u.UserID
        WHERE al.EnteredAt >= DATEADD(DAY, -@param0, GETUTCDATE())
          AND al.ScreenName NOT LIKE 'Admin%'
          AND u.UserType != 'Admin'
          AND (u.Phone IS NULL OR u.Phone != '0000000000')
        GROUP BY al.Platform
        ORDER BY Count DESC`,
        [days]
      );
      return result.recordset || [];
    } catch (error) {
      console.error('Error getting platform breakdown:', error);
      return [];
    }
  }

  /**
   * Get comprehensive analytics dashboard data
   */
  static async getAnalyticsDashboard(days: number = 30): Promise<any> {
    try {
      const [
        activeUsers,
        screenStats,
        dropOffPoints,
        userFlow,
        dailyTrend,
        hourlyPattern,
        allUsersInPeriod,
        deviceBreakdown,
        browserBreakdown,
        platformBreakdown
      ] = await Promise.all([
        this.getActiveUsers(),
        this.getScreenAnalytics(days),
        this.getDropOffAnalytics(days),
        this.getUserFlowAnalytics(days),
        this.getDailyActiveUsersTrend(days),
        this.getHourlyActivityPattern(days),
        this.getAllActiveUsersInPeriod(days),
        this.getDeviceBreakdown(days),
        this.getBrowserBreakdown(days),
        this.getPlatformBreakdown(days)
      ]);

      // Calculate summary metrics - SQL returns PascalCase, so access with PascalCase
      const totalViews = screenStats.reduce((sum: number, s: any) => sum + (s.TotalViews || 0), 0);
      const uniqueUsers = allUsersInPeriod.length;

      return {
        summary: {
          currentlyActive: activeUsers.length,
          totalScreenViews: totalViews,
          avgDailyActiveUsers: Math.round(uniqueUsers / Math.max(days, 1) * 7), // Weekly average
          topScreen: screenStats[0]?.ScreenName || 'N/A',
          highestDropOff: dropOffPoints[0]?.ScreenName || 'N/A',
          totalUniqueUsers: uniqueUsers
        },
        activeUsers,
        allUsersInPeriod: allUsersInPeriod.slice(0, 50), // Top 50 users by activity
        screenStats: screenStats.slice(0, 20),
        dropOffPoints: dropOffPoints.slice(0, 10),
        userFlow: userFlow.slice(0, 20),
        dailyTrend,
        hourlyPattern,
        deviceBreakdown,
        browserBreakdown,
        platformBreakdown
      };
    } catch (error) {
      console.error('Error getting analytics dashboard:', error);
      throw error;
    }
  }
}
