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
type AccessType = 'ai_jobs' | 'profile_views' | 'resume_template' | 'resume_analysis';

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

    if (!accessType || !['ai_jobs', 'profile_views', 'resume_template', 'resume_analysis'].includes(accessType)) {
      return {
        status: 400,
        jsonBody: {
          success: false,
          error: 'Invalid or missing access type',
          message: 'Please provide type parameter: ai_jobs, profile_views, or resume_template'
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

      case 'resume_template':
        const templateSlug = url.searchParams.get('slug') || '';
        if (!templateSlug) {
          return {
            status: 400,
            jsonBody: { success: false, error: 'Missing slug parameter for resume_template access check' }
          };
        }
        // Classic template is always free
        if (templateSlug === 'classic') {
          result = {
            type: 'resume_template',
            hasActiveAccess: true,
            requiresPayment: false,
            cost: 0,
            durationDays: 0,
            message: 'Classic template is free'
          };
          break;
        }
        const rtCost = await PricingService.getResumeBuilderPremiumCost();
        const rtDurationHours = await PricingService.getResumeBuilderPremiumDurationHours();
        const rtDurationDays = Math.floor(rtDurationHours / 24);
        // Check for active access for THIS specific template
        let rtHasAccess = false;
        try {
          const rtResult = await (await import('../services/database.service')).dbService.executeQuery(
            `SELECT TOP 1 wt.CreatedAt
             FROM WalletTransactions wt
             INNER JOIN Wallets w ON wt.WalletID = w.WalletID
             WHERE w.UserID = @param0
               AND wt.Source = @param1
               AND wt.TransactionType = 'Debit'
               AND wt.Amount = @param2
               AND wt.CreatedAt >= DATEADD(HOUR, -@param3, GETUTCDATE())
             ORDER BY wt.CreatedAt DESC`,
            [user.userId, `Resume_Template_${templateSlug}`, rtCost, rtDurationHours]
          );
          rtHasAccess = rtResult.recordset && rtResult.recordset.length > 0;
        } catch (e) {
          rtHasAccess = false;
        }
        result = {
          type: 'resume_template',
          hasActiveAccess: rtHasAccess,
          requiresPayment: !rtHasAccess,
          cost: rtCost,
          durationDays: rtDurationDays,
          message: rtHasAccess
            ? `You have active access to this template (valid for ${rtDurationDays} days)`
            : `Upgrade for ₹${rtCost} to use this premium template for ${rtDurationDays} days`
        };
        break;

      case 'resume_analysis':
        const raCost = await PricingService.getAIResumeAnalysisCost();
        const raFreeUses = await PricingService.getAIResumeFreeUses();
        // Count analyses — each analysis creates a new row, so COUNT(*) is the source of truth
        let raUsageCount = 0;
        try {
          const raResult = await (await import('../services/database.service')).dbService.executeQuery(
            `SELECT COUNT(*) AS cnt FROM ResumeMetadata WHERE UserID = @param0`,
            [user.userId]
          );
          raUsageCount = raResult.recordset?.[0]?.cnt || 0;
        } catch (e) {
          raUsageCount = 0;
        }
        const raIsFree = raUsageCount < raFreeUses;
        result = {
          type: 'resume_analysis',
          hasActiveAccess: raIsFree,
          requiresPayment: !raIsFree,
          cost: raCost,
          durationDays: 0,
          message: raIsFree
            ? `${raFreeUses - raUsageCount} free analyses remaining`
            : `Each analysis costs ₹${raCost}`,
          totalUsed: raUsageCount,
          freeUses: raFreeUses,
          freeRemaining: Math.max(0, raFreeUses - raUsageCount),
        } as any;
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
