/**
 * Push Token Controller
 * API endpoints for registering/unregistering device push tokens
 */

import { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { withAuth } from '../middleware';
import { successResponse } from '../utils/validation';
import { PushTokenService } from '../services/pushToken.service';

/**
 * POST /push-tokens/register
 * Register a device push token for the current user
 * Body: { token, platform, deviceId?, deviceName?, provider? }
 */
export const registerPushToken = withAuth(async (req: HttpRequest, context: InvocationContext, user): Promise<HttpResponseInit> => {
  try {
    const body = await req.json() as any;

    if (!body.token || !body.platform) {
      return {
        status: 400,
        jsonBody: { success: false, error: 'token and platform are required' }
      };
    }

    const result = await PushTokenService.registerToken(
      user.userId,
      body.token,
      body.platform,
      body.deviceId,
      body.deviceName,
      body.provider || 'expo'
    );

    if (!result.success) {
      return {
        status: 500,
        jsonBody: { success: false, error: result.error || 'Failed to register token' }
      };
    }

    return {
      status: 200,
      jsonBody: successResponse({ tokenId: result.tokenId }, 'Push token registered')
    };
  } catch (error: any) {
    console.error('Error registering push token:', error);
    return {
      status: 500,
      jsonBody: { success: false, error: 'Failed to register push token' }
    };
  }
});

/**
 * POST /push-tokens/unregister
 * Deactivate a push token (e.g. on logout)
 * Body: { token }
 */
export const unregisterPushToken = withAuth(async (req: HttpRequest, context: InvocationContext, user): Promise<HttpResponseInit> => {
  try {
    const body = await req.json() as any;

    if (!body.token) {
      return {
        status: 400,
        jsonBody: { success: false, error: 'token is required' }
      };
    }

    const result = await PushTokenService.deactivateToken(body.token);

    return {
      status: 200,
      jsonBody: successResponse(null, 'Push token unregistered')
    };
  } catch (error: any) {
    console.error('Error unregistering push token:', error);
    return {
      status: 500,
      jsonBody: { success: false, error: 'Failed to unregister push token' }
    };
  }
});
