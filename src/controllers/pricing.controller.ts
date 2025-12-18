/**
 * Pricing Controller
 * API endpoint to expose pricing settings to frontend
 */

import { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { PricingService } from '../services/pricing.service';

/**
 * GET /api/pricing
 * Returns all active pricing settings
 * Public endpoint - no auth required (prices are not sensitive)
 */
async function getPricing(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const settings = await PricingService.getAllSettings();
    
    return {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300' // Cache for 5 minutes
      },
      body: JSON.stringify({
        success: true,
        data: {
          aiJobsCost: settings.AI_JOBS_COST,
          aiAccessDurationHours: settings.AI_ACCESS_DURATION_HOURS,
          aiAccessDurationDays: Math.floor(settings.AI_ACCESS_DURATION_HOURS / 24),
          referralRequestCost: settings.REFERRAL_REQUEST_COST,
          jobPublishCost: settings.JOB_PUBLISH_COST,
          welcomeBonus: settings.WELCOME_BONUS,
          referralSignupBonus: settings.REFERRAL_SIGNUP_BONUS
        }
      })
    };
  } catch (error) {
    context.error('Error fetching pricing:', error);
    return {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: 'Failed to fetch pricing settings'
      })
    };
  }
}

export { getPricing };
