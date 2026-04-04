/**
 * Blind Review Controller
 * 
 * Endpoints:
 *   POST /api/tools/blind-review/submit      — Applicant submits profile for review
 *   GET  /api/tools/blind-review/status/:id   — Check status + get results
 *   GET  /api/tools/blind-review/history      — Applicant's past reviews
 *   GET  /api/tools/blind-review/pending      — Referrer: see profiles to review
 *   POST /api/tools/blind-review/respond/:id  — Referrer: submit review feedback
 * 
 * Auth required. First N uses free, then wallet debit.
 */

import { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { BlindReviewService } from '../services/blind-review.service';
import { corsHeaders, authenticate } from '../middleware';
import { PricingService } from '../services/pricing.service';
import { WalletService } from '../services/wallet.service';
import { dbService } from '../services/database.service';

// ── Submit a blind review request ──────────────────────────────

export async function submitBlindReview(req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  if (req.method === 'OPTIONS') {
    return { status: 200, headers: corsHeaders };
  }

  try {
    // Auth
    let user: any;
    try {
      user = authenticate(req);
    } catch {
      return {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        jsonBody: { success: false, error: 'Authentication required. Please sign in to use Blind Review.' },
      };
    }
    const userId = user.userId || user.sub;

    // Parse body
    const body = await req.json() as any;
    const { organizationId, targetRole, sourceType, resumeId } = body;

    if (!organizationId || !targetRole?.trim()) {
      return {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        jsonBody: { success: false, error: 'Please select a target company and enter the role you want reviewed for.' },
      };
    }

    if (sourceType === 'resume' && !resumeId) {
      return {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        jsonBody: { success: false, error: 'Please select a resume to submit for review.' },
      };
    }

    // Get applicantId
    const appResult = await dbService.executeQuery(
      `SELECT ApplicantID FROM Applicants WHERE UserID = @param0`,
      [userId]
    );
    if (!appResult.recordset?.length) {
      return {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        jsonBody: { success: false, error: 'Please complete your profile first.' },
      };
    }
    const applicantId = appResult.recordset[0].ApplicantID;

    // Free-use / wallet check
    const freeUses = (await PricingService.getSetting('BLIND_REVIEW_FREE_USES')) || 1;
    const costPerUse = (await PricingService.getSetting('BLIND_REVIEW_COST')) || 49;

    const usageResult = await dbService.executeQuery(
      `SELECT COUNT(*) AS cnt FROM BlindReviewUsage WHERE UserID = @param0`,
      [userId]
    );
    const usageCount = usageResult.recordset?.[0]?.cnt || 0;
    const isFreeTier = usageCount < freeUses;

    if (!isFreeTier) {
      try {
        const wallet = await WalletService.getOrCreateWallet(userId);
        if (wallet.Balance < costPerUse) {
          return {
            status: 402,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            jsonBody: {
              success: false,
              error: `Insufficient balance. Blind Review costs ₹${costPerUse}. Please recharge your wallet.`,
              requiresPayment: true,
              cost: costPerUse,
              freeUsesRemaining: 0,
            },
          };
        }
      } catch (walletErr: any) {
        throw walletErr;
      }
    }

    context.log(`Blind review: user ${userId}, use #${usageCount + 1}, free=${isFreeTier}`);

    // Submit the review
    const result = await BlindReviewService.submitReview({
      userId,
      applicantId,
      organizationId: Number(organizationId),
      targetRole: targetRole.trim(),
      sourceType: sourceType || 'resume',
      resumeId: resumeId || undefined,
    });

    // Debit wallet AFTER success
    if (!isFreeTier) {
      try {
        await WalletService.debitWallet(
          userId,
          costPerUse,
          'Blind_Review',
          `Blind profile review (use #${usageCount + 1})`
        );
      } catch (debitErr: any) {
        context.error('Post-review wallet debit failed (non-critical):', debitErr.message);
      }
    }

    // Record usage
    try {
      await dbService.executeQuery(
        `INSERT INTO BlindReviewUsage (UserID, RequestID, OrganizationID, AIScore, CreatedAt)
         VALUES (@param0, @param1, @param2, @param3, GETUTCDATE())`,
        [userId, result.requestId, organizationId, result.aiScore?.score || 0]
      );
    } catch (usageErr: any) {
      context.error('Usage recording failed (non-critical):', usageErr.message);
    }

    // Check if there are referrers at this company; if not, trigger AI-only review
    const referrerCheck = await BlindReviewService.hasReferrersAtCompany(Number(organizationId));
    if (!referrerCheck.hasReferrers) {
      context.log(`No referrers at org ${organizationId}, generating AI-only review...`);
      // Fire and forget — don't block the response
      BlindReviewService.generateAIOnlyReview(result.requestId).catch(err => {
        context.error('AI-only review generation failed:', err.message);
      });
    }

    return {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      jsonBody: {
        success: true,
        data: result,
        hasReferrers: referrerCheck.hasReferrers,
        referrerCount: referrerCheck.count,
        usageInfo: {
          totalUsed: usageCount + 1,
          freeUses,
          freeRemaining: Math.max(0, freeUses - (usageCount + 1)),
          costPerUse,
          wasFree: isFreeTier,
        },
        message: referrerCheck.hasReferrers
          ? `Profile submitted! ${referrerCheck.count} verified referrer(s) at this company can review your profile.`
          : 'Profile submitted! AI review will be generated shortly (no verified referrers at this company yet).',
      },
    };
  } catch (error: any) {
    context.error('Blind review submit error:', error.message, error.stack?.substring(0, 300));

    const isValidation =
      error.message?.includes('Resume not found') ||
      error.message?.includes('too little information') ||
      error.message?.includes('complete your profile') ||
      error.message?.includes('not found');

    return {
      status: isValidation ? 400 : 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      jsonBody: { success: false, error: isValidation ? error.message : 'Something went wrong. Please try again.' },
    };
  }
}

// ── Get review status + results ────────────────────────────────

export async function getBlindReviewStatus(req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  if (req.method === 'OPTIONS') {
    return { status: 200, headers: corsHeaders };
  }

  try {
    let user: any;
    try {
      user = authenticate(req);
    } catch {
      return {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        jsonBody: { success: false, error: 'Authentication required.' },
      };
    }
    const userId = user.userId || user.sub;
    const requestId = req.params.id;

    if (!requestId) {
      return {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        jsonBody: { success: false, error: 'Request ID is required.' },
      };
    }

    const data = await BlindReviewService.getRequestStatus(requestId, userId);

    return {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      jsonBody: { success: true, data },
    };
  } catch (error: any) {
    return {
      status: error.message?.includes('not found') ? 404 : 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      jsonBody: { success: false, error: error.message || 'Something went wrong.' },
    };
  }
}

// ── Get review history ─────────────────────────────────────────

export async function getBlindReviewHistory(req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  if (req.method === 'OPTIONS') {
    return { status: 200, headers: corsHeaders };
  }

  try {
    let user: any;
    try {
      user = authenticate(req);
    } catch {
      return {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        jsonBody: { success: false, error: 'Authentication required.' },
      };
    }
    const userId = user.userId || user.sub;

    const data = await BlindReviewService.getHistory(userId);

    return {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      jsonBody: { success: true, data },
    };
  } catch (error: any) {
    return {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      jsonBody: { success: false, error: 'Something went wrong.' },
    };
  }
}

// ── Referrer: get pending reviews ──────────────────────────────

export async function getBlindReviewPending(req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  if (req.method === 'OPTIONS') {
    return { status: 200, headers: corsHeaders };
  }

  try {
    let user: any;
    try {
      user = authenticate(req);
    } catch {
      return {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        jsonBody: { success: false, error: 'Authentication required.' },
      };
    }
    const userId = user.userId || user.sub;

    const data = await BlindReviewService.getPendingForReferrer(userId);

    return {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      jsonBody: { success: true, data, count: data.length },
    };
  } catch (error: any) {
    return {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      jsonBody: { success: false, error: 'Something went wrong.' },
    };
  }
}

// ── Referrer: submit review response ───────────────────────────

export async function submitBlindReviewResponse(req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  if (req.method === 'OPTIONS') {
    return { status: 200, headers: corsHeaders };
  }

  try {
    let user: any;
    try {
      user = authenticate(req);
    } catch {
      return {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        jsonBody: { success: false, error: 'Authentication required.' },
      };
    }
    const userId = user.userId || user.sub;
    const requestId = req.params.id;

    if (!requestId) {
      return {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        jsonBody: { success: false, error: 'Request ID is required.' },
      };
    }

    const body = await req.json() as any;
    const { wouldRefer, overallRating, strengthsFeedback, weaknessesFeedback, suggestions, profileFit } = body;

    if (wouldRefer === undefined || !overallRating) {
      return {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        jsonBody: { success: false, error: 'Please provide your rating and whether you would refer this person.' },
      };
    }

    const result = await BlindReviewService.submitResponse(requestId, userId, {
      wouldRefer: !!wouldRefer,
      overallRating: Number(overallRating),
      strengthsFeedback: strengthsFeedback?.trim() || undefined,
      weaknessesFeedback: weaknessesFeedback?.trim() || undefined,
      suggestions: suggestions?.trim() || undefined,
      profileFit: profileFit ? Number(profileFit) : undefined,
    });

    return {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      jsonBody: result,
    };
  } catch (error: any) {
    context.error('Blind review respond error:', error.message);

    const isValidation =
      error.message?.includes('Rating must') ||
      error.message?.includes('cannot review your own') ||
      error.message?.includes('only review profiles') ||
      error.message?.includes('already reviewed') ||
      error.message?.includes('not found') ||
      error.message?.includes('expired');

    return {
      status: isValidation ? 400 : 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      jsonBody: { success: false, error: isValidation ? error.message : 'Something went wrong.' },
    };
  }
}
