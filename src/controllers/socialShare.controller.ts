/**
 * Social Share Controller
 * Handles API endpoints for social share rewards
 */
import { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import * as socialShareService from '../services/socialShare.service';
import { AuthService } from '../services/auth.service';

// Helper to extract user from token
async function getUserFromRequest(request: HttpRequest): Promise<{ userId: string; isAdmin: boolean } | null> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  
  const token = authHeader.substring(7);
  try {
    const decoded = AuthService.verifyToken(token);
    return { 
      userId: decoded.userId, 
      isAdmin: decoded.userType === 'Admin'
    };
  } catch {
    return null;
  }
}

/**
 * GET /social-share/rewards - Get reward amounts for each platform
 */
export async function getRewardsHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const rewards = await socialShareService.getRewardAmounts();
    return {
      status: 200,
      jsonBody: { success: true, data: rewards }
    };
  } catch (error: any) {
    context.error('Error getting reward amounts:', error);
    return {
      status: 500,
      jsonBody: { success: false, error: 'Failed to get reward amounts' }
    };
  }
}

/**
 * GET /social-share/my-claims - Get user's claims
 */
export async function getMyClaimsHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return { status: 401, jsonBody: { success: false, error: 'Unauthorized' } };
    }

    const claims = await socialShareService.getUserClaims(user.userId);
    const rewards = await socialShareService.getRewardAmounts();
    
    return {
      status: 200,
      jsonBody: { success: true, data: { claims, rewards } }
    };
  } catch (error: any) {
    context.error('Error getting user claims:', error);
    return {
      status: 500,
      jsonBody: { success: false, error: 'Failed to get claims' }
    };
  }
}

/**
 * POST /social-share/submit - Submit a new claim
 */
export async function submitClaimHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return { status: 401, jsonBody: { success: false, error: 'Unauthorized' } };
    }

    const body = await request.json() as any;
    const { platform, postUrl, screenshotUrl, postContent } = body;

    if (!platform) {
      return { status: 400, jsonBody: { success: false, error: 'Platform is required' } };
    }

    if (!['LinkedIn', 'Twitter', 'Instagram', 'Facebook'].includes(platform)) {
      return { status: 400, jsonBody: { success: false, error: 'Invalid platform' } };
    }

    if (!postUrl && !screenshotUrl) {
      return { status: 400, jsonBody: { success: false, error: 'Please provide post URL or screenshot' } };
    }

    // Check if user can submit
    const canSubmit = await socialShareService.canSubmitClaim(user.userId, platform);
    if (!canSubmit.canSubmit) {
      return { status: 400, jsonBody: { success: false, error: canSubmit.reason, existingClaim: canSubmit.existingClaim } };
    }

    const result = await socialShareService.submitClaim({
      userId: user.userId,
      platform,
      postUrl,
      screenshotUrl,
      postContent
    });

    if (!result.success) {
      return { status: 400, jsonBody: { success: false, error: result.error } };
    }

    return {
      status: 201,
      jsonBody: { success: true, data: result.claim, message: 'Claim submitted successfully! We will review it within 24 hours.' }
    };
  } catch (error: any) {
    context.error('Error submitting claim:', error);
    return {
      status: 500,
      jsonBody: { success: false, error: 'Failed to submit claim' }
    };
  }
}

/**
 * GET /social-share/can-claim/:platform - Check if user can claim for a platform
 */
export async function canClaimHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return { status: 401, jsonBody: { success: false, error: 'Unauthorized' } };
    }

    const platform = request.params.platform;
    if (!platform) {
      return { status: 400, jsonBody: { success: false, error: 'Platform is required' } };
    }

    const result = await socialShareService.canSubmitClaim(user.userId, platform);
    
    return {
      status: 200,
      jsonBody: { success: true, data: result }
    };
  } catch (error: any) {
    context.error('Error checking can claim:', error);
    return {
      status: 500,
      jsonBody: { success: false, error: 'Failed to check claim eligibility' }
    };
  }
}

// ============== ADMIN ENDPOINTS ==============

/**
 * GET /management/social-share/claims - Get all claims (admin)
 */
export async function adminGetClaimsHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const user = await getUserFromRequest(request);
    if (!user?.isAdmin) {
      return { status: 403, jsonBody: { success: false, error: 'Admin access required' } };
    }

    const url = new URL(request.url);
    const status = url.searchParams.get('status') || undefined;
    const platform = url.searchParams.get('platform') || undefined;
    const page = parseInt(url.searchParams.get('page') || '1');
    const pageSize = parseInt(url.searchParams.get('pageSize') || '20');

    const result = await socialShareService.getAllClaims({ status, platform, page, pageSize });
    
    return {
      status: 200,
      jsonBody: { success: true, data: result }
    };
  } catch (error: any) {
    context.error('Error getting all claims:', error);
    return {
      status: 500,
      jsonBody: { success: false, error: 'Failed to get claims' }
    };
  }
}

/**
 * POST /management/social-share/claims/:claimId/approve - Approve a claim (admin)
 */
export async function adminApproveClaimHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const user = await getUserFromRequest(request);
    if (!user?.isAdmin) {
      return { status: 403, jsonBody: { success: false, error: 'Admin access required' } };
    }

    const claimId = request.params.claimId;
    if (!claimId) {
      return { status: 400, jsonBody: { success: false, error: 'Claim ID is required' } };
    }

    const body = await request.json().catch(() => ({})) as any;
    const bonusAmount = body.bonusAmount || 0;

    const result = await socialShareService.approveClaim(claimId, user.userId, bonusAmount);

    if (!result.success) {
      return { status: 400, jsonBody: { success: false, error: result.error } };
    }

    // 🔔 Notify user about approval (async)
    (async () => {
      try {
        const { InAppNotificationService } = await import('../services/inAppNotification.service');
        const { dbService } = await import('../services/database.service');
        const claimInfo = await dbService.executeQuery(
          'SELECT UserID, Platform, RewardAmount FROM SocialShareClaims WHERE ClaimID = @param0', [claimId]
        );
        const c = claimInfo.recordset[0];
        if (c) {
          await InAppNotificationService.notifySocialShareApproved(c.UserID, c.Platform, c.RewardAmount + (bonusAmount || 0), claimId);
        }
      } catch (e: any) { console.error('Notification error:', e.message); }
    })();

    return {
      status: 200,
      jsonBody: { success: true, message: 'Claim approved and reward credited to user wallet' }
    };
  } catch (error: any) {
    context.error('Error approving claim:', error);
    return {
      status: 500,
      jsonBody: { success: false, error: 'Failed to approve claim' }
    };
  }
}

/**
 * POST /management/social-share/claims/:claimId/reject - Reject a claim (admin)
 */
export async function adminRejectClaimHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const user = await getUserFromRequest(request);
    if (!user?.isAdmin) {
      return { status: 403, jsonBody: { success: false, error: 'Admin access required' } };
    }

    const claimId = request.params.claimId;
    if (!claimId) {
      return { status: 400, jsonBody: { success: false, error: 'Claim ID is required' } };
    }

    const body = await request.json() as any;
    const reason = body.reason;
    
    if (!reason) {
      return { status: 400, jsonBody: { success: false, error: 'Rejection reason is required' } };
    }

    const result = await socialShareService.rejectClaim(claimId, user.userId, reason);

    if (!result.success) {
      return { status: 400, jsonBody: { success: false, error: result.error } };
    }

    // 🔔 Notify user about rejection (async)
    (async () => {
      try {
        const { InAppNotificationService } = await import('../services/inAppNotification.service');
        const { dbService } = await import('../services/database.service');
        const claimInfo = await dbService.executeQuery(
          'SELECT UserID, Platform FROM SocialShareClaims WHERE ClaimID = @param0', [claimId]
        );
        const c = claimInfo.recordset[0];
        if (c) {
          await InAppNotificationService.notifySocialShareRejected(c.UserID, c.Platform, reason, claimId);
        }
      } catch (e: any) { console.error('Notification error:', e.message); }
    })();

    return {
      status: 200,
      jsonBody: { success: true, message: 'Claim rejected' }
    };
  } catch (error: any) {
    context.error('Error rejecting claim:', error);
    return {
      status: 500,
      jsonBody: { success: false, error: 'Failed to reject claim' }
    };
  }
}

/**
 * GET /management/social-share/stats - Get social share stats (admin)
 */
export async function adminGetStatsHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const user = await getUserFromRequest(request);
    if (!user?.isAdmin) {
      return { status: 403, jsonBody: { success: false, error: 'Admin access required' } };
    }

    const stats = await socialShareService.getSocialShareStats();
    
    return {
      status: 200,
      jsonBody: { success: true, data: stats }
    };
  } catch (error: any) {
    context.error('Error getting stats:', error);
    return {
      status: 500,
      jsonBody: { success: false, error: 'Failed to get stats' }
    };
  }
}
