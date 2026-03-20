/**
 * User Activity Tracking Service
 * Tracks screen views, user sessions, and engagement metrics
 */

import { UserActivityRepository } from '../repositories/user-activity.repository';
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
      await UserActivityRepository.touchLastActive(userId);

      // Insert activity log
      await UserActivityRepository.insertLog({
        activityId,
        userId,
        sessionId: activity.sessionId || null,
        screenName: activity.screenName,
        action: activity.action || 'view',
        actionDetails: activity.actionDetails ? JSON.stringify(activity.actionDetails) : null,
        platform: activity.platform || null,
        deviceType: activity.deviceType || null,
        browser: activity.browser || null,
        clientIP: activity.clientIP || null,
        userAgent: activity.userAgent || null,
        referrerScreen: activity.referrerScreen || null
      });

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
      await UserActivityRepository.markScreenExit(activityId, userId);
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
      const rowsAffected = await UserActivityRepository.updateSession(sessionId, userId);

      // If no session exists, create one
      if (rowsAffected === 0) {
        await UserActivityRepository.insertSession({
          sessionId,
          userId,
          platform: activity.platform || null,
          deviceType: activity.deviceType || null,
          browser: activity.browser || null,
          clientIP: activity.clientIP || null
        });
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
      await UserActivityRepository.endSession(sessionId);
    } catch (error) {
      console.error('Error ending session:', error);
    }
  }

  /**
   * Get currently active users (activity in last 5 minutes)
   */
  static async getActiveUsers(): Promise<any[]> {
    try {
      return await UserActivityRepository.findActiveUsers();
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
      return await UserActivityRepository.findAllUsersInPeriod(days);
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
      return await UserActivityRepository.findUserActivity(userId, days);
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
      return await UserActivityRepository.getScreenStats(days);
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
      return await UserActivityRepository.getDropOffStats(days);
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
      return await UserActivityRepository.getUserFlowStats(days);
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
      return await UserActivityRepository.getDailyTrend(days);
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
      return await UserActivityRepository.getHourlyPattern(days);
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
      return await UserActivityRepository.getBreakdown('DeviceType', days);
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
      return await UserActivityRepository.getBreakdown('Browser', days);
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
      return await UserActivityRepository.getBreakdown('Platform', days);
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
