/**
 * Notification Controller
 * API endpoints for in-app notifications
 */

import { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { withAuth } from '../middleware';
import { successResponse } from '../utils/validation';
import { InAppNotificationService } from '../services/inAppNotification.service';

/**
 * GET /notifications
 * Get notifications for the current user
 * Query params: page, pageSize, unreadOnly
 */
export const getNotifications = withAuth(async (req: HttpRequest, context: InvocationContext, user): Promise<HttpResponseInit> => {
  try {
    const page = parseInt(req.query.get('page') || '1');
    const pageSize = parseInt(req.query.get('pageSize') || '20');
    const unreadOnly = req.query.get('unreadOnly') === 'true';

    const result = await InAppNotificationService.getNotifications(user.userId, {
      page,
      pageSize,
      unreadOnly
    });

    return {
      status: 200,
      jsonBody: successResponse(result, 'Notifications retrieved')
    };
  } catch (error: any) {
    console.error('Error getting notifications:', error);
    return {
      status: 500,
      jsonBody: { success: false, error: 'Failed to get notifications' }
    };
  }
});

/**
 * GET /notifications/unread-count
 * Get unread notification count
 */
export const getNotificationUnreadCount = withAuth(async (req: HttpRequest, context: InvocationContext, user): Promise<HttpResponseInit> => {
  try {
    const count = await InAppNotificationService.getUnreadCount(user.userId);

    return {
      status: 200,
      jsonBody: successResponse({ count }, 'Unread count retrieved')
    };
  } catch (error: any) {
    console.error('Error getting unread count:', error);
    return {
      status: 500,
      jsonBody: { success: false, error: 'Failed to get unread count' }
    };
  }
});

/**
 * PATCH /notifications/:notificationId/read
 * Mark a single notification as read
 */
export const markNotificationAsRead = withAuth(async (req: HttpRequest, context: InvocationContext, user): Promise<HttpResponseInit> => {
  try {
    const notificationId = (req as any).params?.notificationId;
    if (!notificationId) {
      return { status: 400, jsonBody: { success: false, error: 'Notification ID is required' } };
    }

    const success = await InAppNotificationService.markAsRead(notificationId, user.userId);

    return {
      status: 200,
      jsonBody: successResponse({ success }, success ? 'Notification marked as read' : 'Notification not found')
    };
  } catch (error: any) {
    console.error('Error marking notification as read:', error);
    return {
      status: 500,
      jsonBody: { success: false, error: 'Failed to mark notification as read' }
    };
  }
});

/**
 * PATCH /notifications/read-all
 * Mark all notifications as read
 */
export const markAllNotificationsAsRead = withAuth(async (req: HttpRequest, context: InvocationContext, user): Promise<HttpResponseInit> => {
  try {
    const count = await InAppNotificationService.markAllAsRead(user.userId);

    return {
      status: 200,
      jsonBody: successResponse({ markedCount: count }, `${count} notifications marked as read`)
    };
  } catch (error: any) {
    console.error('Error marking all as read:', error);
    return {
      status: 500,
      jsonBody: { success: false, error: 'Failed to mark all as read' }
    };
  }
});

/**
 * DELETE /notifications/:notificationId
 * Delete a single notification
 */
export const deleteNotification = withAuth(async (req: HttpRequest, context: InvocationContext, user): Promise<HttpResponseInit> => {
  try {
    const notificationId = (req as any).params?.notificationId;
    if (!notificationId) {
      return { status: 400, jsonBody: { success: false, error: 'Notification ID is required' } };
    }

    const success = await InAppNotificationService.deleteNotification(notificationId, user.userId);

    return {
      status: 200,
      jsonBody: successResponse({ success }, success ? 'Notification deleted' : 'Notification not found')
    };
  } catch (error: any) {
    console.error('Error deleting notification:', error);
    return {
      status: 500,
      jsonBody: { success: false, error: 'Failed to delete notification' }
    };
  }
});
