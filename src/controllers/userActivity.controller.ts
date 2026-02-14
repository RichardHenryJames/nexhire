/**
 * User Activity Controller
 * API endpoints for tracking user activity and analytics
 */

import { HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { withAuth } from "../middleware";
import { UserActivityService } from "../services/userActivity.service";

// Verify admin role helper
const verifyAdmin = (user: any): HttpResponseInit | null => {
  if (user.userType !== 'Admin') {
    return { status: 403, jsonBody: { success: false, error: 'Admin access required' } };
  }
  return null;
};

const successResponse = (data: any, message: string) => ({
  success: true,
  data,
  message
});

/**
 * Log user activity (screen view, action, etc.)
 * POST /activity/log
 */
export const logActivity = withAuth(async (
  req: HttpRequest,
  context: InvocationContext,
  user
): Promise<HttpResponseInit> => {
  try {
    const body = await req.json() as {
      screenName: string;
      action?: string;
      actionDetails?: any;
      platform?: string;
      deviceType?: string;
      browser?: string;
      sessionId?: string;
      referrerScreen?: string;
    };

    if (!body.screenName) {
      return { status: 400, jsonBody: { success: false, error: 'screenName is required' } };
    }

    // Get client info from headers
    const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0] || 
                     req.headers.get('x-real-ip') || 
                     'unknown';
    const userAgent = req.headers.get('user-agent') || '';

    const result = await UserActivityService.logActivity(user.userId, {
      screenName: body.screenName,
      action: body.action,
      actionDetails: body.actionDetails,
      platform: body.platform,
      deviceType: body.deviceType,
      browser: body.browser,
      sessionId: body.sessionId,
      referrerScreen: body.referrerScreen,
      clientIP,
      userAgent
    });

    return {
      status: 200,
      jsonBody: successResponse(result, 'Activity logged')
    };
  } catch (error) {
    console.error('Error logging activity:', error);
    return { status: 500, jsonBody: { success: false, error: 'Failed to log activity' } };
  }
});

/**
 * Log screen exit (to calculate duration)
 * POST /activity/exit
 */
export const logScreenExit = withAuth(async (
  req: HttpRequest,
  context: InvocationContext,
  user
): Promise<HttpResponseInit> => {
  try {
    const body = await req.json() as { activityId: string };

    if (!body.activityId) {
      return { status: 400, jsonBody: { success: false, error: 'activityId is required' } };
    }

    await UserActivityService.logScreenExit(user.userId, body.activityId);

    return {
      status: 200,
      jsonBody: successResponse(null, 'Screen exit logged')
    };
  } catch (error) {
    console.error('Error logging screen exit:', error);
    return { status: 500, jsonBody: { success: false, error: 'Failed to log screen exit' } };
  }
});

/**
 * End user session
 * POST /activity/end-session
 */
export const endSession = withAuth(async (
  req: HttpRequest,
  context: InvocationContext,
  user
): Promise<HttpResponseInit> => {
  try {
    const body = await req.json() as { sessionId: string };

    if (!body.sessionId) {
      return { status: 400, jsonBody: { success: false, error: 'sessionId is required' } };
    }

    await UserActivityService.endSession(body.sessionId);

    return {
      status: 200,
      jsonBody: successResponse(null, 'Session ended')
    };
  } catch (error) {
    console.error('Error ending session:', error);
    return { status: 500, jsonBody: { success: false, error: 'Failed to end session' } };
  }
});

/**
 * Get currently active users (Admin only)
 * GET /management/activity/active-users
 */
export const getActiveUsers = withAuth(async (
  req: HttpRequest,
  context: InvocationContext,
  user
): Promise<HttpResponseInit> => {
  try {
    const adminCheck = verifyAdmin(user);
    if (adminCheck) return adminCheck;

    const activeUsers = await UserActivityService.getActiveUsers();

    return {
      status: 200,
      jsonBody: successResponse({ 
        activeUsers,
        count: activeUsers.length
      }, 'Active users retrieved')
    };
  } catch (error) {
    console.error('Error getting active users:', error);
    return { status: 500, jsonBody: { success: false, error: 'Failed to get active users' } };
  }
});

/**
 * Get user activity history (Admin only)
 * GET /management/activity/user/{userId}
 */
export const getUserActivityHistory = withAuth(async (
  req: HttpRequest,
  context: InvocationContext,
  user
): Promise<HttpResponseInit> => {
  try {
    const adminCheck = verifyAdmin(user);
    if (adminCheck) return adminCheck;

    const userId = req.params.userId;
    if (!userId) {
      return { status: 400, jsonBody: { success: false, error: 'userId is required' } };
    }

    const url = new URL(req.url);
    const days = parseInt(url.searchParams.get('days') || '7');

    const activity = await UserActivityService.getUserActivity(userId, days);

    return {
      status: 200,
      jsonBody: successResponse({ activity }, 'User activity retrieved')
    };
  } catch (error) {
    console.error('Error getting user activity:', error);
    return { status: 500, jsonBody: { success: false, error: 'Failed to get user activity' } };
  }
});

/**
 * Get analytics dashboard (Admin only)
 * GET /management/activity/analytics
 */
export const getAnalyticsDashboard = withAuth(async (
  req: HttpRequest,
  context: InvocationContext,
  user
): Promise<HttpResponseInit> => {
  try {
    const adminCheck = verifyAdmin(user);
    if (adminCheck) return adminCheck;

    const url = new URL(req.url);
    const days = parseInt(url.searchParams.get('days') || '30');

    const analytics = await UserActivityService.getAnalyticsDashboard(days);

    return {
      status: 200,
      jsonBody: successResponse(analytics, 'Analytics retrieved')
    };
  } catch (error) {
    console.error('Error getting analytics:', error);
    return { status: 500, jsonBody: { success: false, error: 'Failed to get analytics' } };
  }
});

/**
 * Get screen-specific analytics (Admin only)
 * GET /management/activity/screens
 */
export const getScreenAnalytics = withAuth(async (
  req: HttpRequest,
  context: InvocationContext,
  user
): Promise<HttpResponseInit> => {
  try {
    const adminCheck = verifyAdmin(user);
    if (adminCheck) return adminCheck;

    const url = new URL(req.url);
    const days = parseInt(url.searchParams.get('days') || '30');

    const screenStats = await UserActivityService.getScreenAnalytics(days);
    const dropOffPoints = await UserActivityService.getDropOffAnalytics(days);
    const userFlow = await UserActivityService.getUserFlowAnalytics(days);

    return {
      status: 200,
      jsonBody: successResponse({ 
        screenStats, 
        dropOffPoints,
        userFlow 
      }, 'Screen analytics retrieved')
    };
  } catch (error) {
    console.error('Error getting screen analytics:', error);
    return { status: 500, jsonBody: { success: false, error: 'Failed to get screen analytics' } };
  }
});
