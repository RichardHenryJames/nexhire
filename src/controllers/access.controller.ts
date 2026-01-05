/**
 * Unified Access Controller
 * Common API for checking access status for different features
 */

import { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { withAuth } from '../middleware';
import { successResponse } from '../utils/validation';
import { PricingService } from '../services/pricing.service';
import { AIJobRecommendationService } from '../services/ai-job-recommendation.service';
import { MessagingService } from '../services/messaging.service';

// Supported access types
type AccessType = 'ai_jobs' | 'profile_views';

interface AccessStatusResult {
  type: AccessType;
  hasActiveAccess: boolean;
  requiresPayment: boolean;
  cost: number;
  durationDays: number;
  message: string;
}

/**
 * GET /api/access/status?type=ai_jobs|profile_views
 * Unified API to check access status for different features
 */
export const checkAccessStatus = withAuth(async (req: HttpRequest, context: InvocationContext, user): Promise<HttpResponseInit> => {
  try {
    const url = new URL(req.url);
    const accessType = url.searchParams.get('type') as AccessType;

    if (!accessType || !['ai_jobs', 'profile_views'].includes(accessType)) {
      return {
        status: 400,
        jsonBody: {
          success: false,
          error: 'Invalid or missing access type',
          message: 'Please provide type parameter: ai_jobs or profile_views'
        }
      };
    }

    let result: AccessStatusResult;

    switch (accessType) {
      case 'ai_jobs':
        const aiHasAccess = await AIJobRecommendationService.hasActiveAIAccess(user.userId);
        const aiCost = await PricingService.getAIJobsCost();
        const aiDurationHours = await PricingService.getAIAccessDurationHours();
        const aiDurationDays = Math.floor(aiDurationHours / 24);
        
        result = {
          type: 'ai_jobs',
          hasActiveAccess: aiHasAccess,
          requiresPayment: !aiHasAccess,
          cost: aiCost,
          durationDays: aiDurationDays,
          message: aiHasAccess
            ? `You have active AI access (valid for ${aiDurationDays} days)`
            : 'Payment required for AI recommendations'
        };
        break;

      case 'profile_views':
        const pvHasAccess = await MessagingService.hasActiveProfileViewAccess(user.userId);
        const pvCost = await PricingService.getProfileViewCost();
        const pvDurationHours = await PricingService.getProfileViewAccessDurationHours();
        const pvDurationDays = Math.floor(pvDurationHours / 24);
        
        result = {
          type: 'profile_views',
          hasActiveAccess: pvHasAccess,
          requiresPayment: !pvHasAccess,
          cost: pvCost,
          durationDays: pvDurationDays,
          message: pvHasAccess
            ? `You have active profile view access (valid for ${pvDurationDays} days)`
            : 'Payment required to see who viewed your profile'
        };
        break;

      default:
        return {
          status: 400,
          jsonBody: {
            success: false,
            error: 'Invalid access type'
          }
        };
    }

    return {
      status: 200,
      jsonBody: successResponse(result, 'Access status retrieved successfully')
    };
  } catch (error: any) {
    console.error('Error in checkAccessStatus:', error);
    return {
      status: 500,
      jsonBody: {
        success: false,
        error: 'Failed to check access status',
        message: error?.message || 'Internal server error'
      }
    };
  }
}, ['read:profile']);
