/**
 * Referral API Routes Registration
 * Azure Functions HTTP Triggers for Referral System
 */

import { app } from '@azure/functions';
import { withErrorHandling } from './src/middleware';
import {
    getReferralPlans,
    purchaseReferralPlan,
    createReferralRequest,
    getMyReferralRequests,
    getAvailableRequests,
    claimReferralRequest,
    getReferralAnalytics,
    checkReferralEligibility,
    getReferrerStats,
    getCurrentSubscription,
    getMyReferrerRequests,
    verifyReferralCompletion,
    logReferralStatus,
    getReferralStatusHistory
} from './src/controllers/referral.controller';

// ===== REFERRAL PLANS =====

/**
 * Get all available referral plans
 * GET /api/referral/plans
 */
app.http('referral-plans', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'referral/plans',
    handler: withErrorHandling(getReferralPlans)
});

/**
 * Purchase a referral plan
 * POST /api/referral/plans/purchase
 */
app.http('referral-plans-purchase', {
    methods: ['POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'referral/plans/purchase',
    handler: withErrorHandling(purchaseReferralPlan)
});

/**
 * Get current subscription
 * GET /api/referral/subscription
 */
app.http('referral-subscription', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'referral/subscription',
    handler: withErrorHandling(getCurrentSubscription)
});

// ===== REFERRAL REQUESTS =====

/**
 * Create a new referral request
 * POST /api/referral/requests
 */
app.http('referral-requests-create', {
    methods: ['POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'referral/requests',
    handler: withErrorHandling(createReferralRequest)
});

/**
 * Get my referral requests (as seeker)
 * GET /api/referral/my-requests
 */
app.http('referral-my-requests', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'referral/my-requests',
    handler: withErrorHandling(getMyReferralRequests)
});

/**
 * Get available referral requests (as referrer)
 * GET /api/referral/available
 */
app.http('referral-available', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'referral/available',
    handler: withErrorHandling(getAvailableRequests)
});

/**
 * Claim a referral request
 * POST /api/referral/requests/{requestId}/claim
 */
app.http('referral-claim', {
    methods: ['POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'referral/requests/{requestId}/claim',
    handler: withErrorHandling(claimReferralRequest)
});

/**
 * Get my requests as referrer (completed requests)
 * GET /api/referral/my-referrer-requests
 */
app.http('referral-my-referrer-requests', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'referral/my-referrer-requests',
    handler: withErrorHandling(getMyReferrerRequests)
});

/**
 * Verify referral completion
 * POST /api/referral/requests/{requestId}/verify
 */
app.http('referral-verify', {
    methods: ['POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'referral/requests/{requestId}/verify',
    handler: withErrorHandling(verifyReferralCompletion)
});

// ===== ANALYTICS & STATS =====

/**
 * Get referral analytics/dashboard
 * GET /api/referral/analytics
 */
app.http('referral-analytics', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'referral/analytics',
    handler: withErrorHandling(getReferralAnalytics)
});

/**
 * Check referral eligibility
 * GET /api/referral/eligibility
 */
app.http('referral-eligibility', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'referral/eligibility',
    handler: withErrorHandling(checkReferralEligibility)
});

/**
 * Get referrer stats (badge counts)
 * GET /api/referral/stats
 */
app.http('referral-stats', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'referral/stats',
    handler: withErrorHandling(getReferrerStats)
});

// ===== STATUS TRACKING =====

/**
 * Log status change for tracking (Viewed, Claimed)
 * POST /api/referral/requests/{requestId}/status
 */
app.http('referral-log-status', {
    methods: ['POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'referral/requests/{requestId}/status',
    handler: withErrorHandling(logReferralStatus)
});

/**
 * Get status history for tracking screen
 * GET /api/referral/requests/{requestId}/history
 */
app.http('referral-status-history', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'referral/requests/{requestId}/history',
    handler: withErrorHandling(getReferralStatusHistory)
});

console.log('Referral System API endpoints registered:');
console.log('   GET  /api/referral/plans');
console.log('   POST /api/referral/plans/purchase');
console.log('   GET  /api/referral/subscription');
console.log('   POST /api/referral/requests');
console.log('   GET  /api/referral/my-requests');
console.log('   GET  /api/referral/available');
console.log('   POST /api/referral/requests/{requestId}/claim');
console.log('   GET  /api/referral/my-referrer-requests');
console.log('   POST /api/referral/requests/{requestId}/verify');
console.log('   GET  /api/referral/analytics');
console.log('   GET  /api/referral/eligibility');
console.log('   GET  /api/referral/stats');

/*
 * ========================================================================
 * REFERRAL SYSTEM API ENDPOINT LIST (11 endpoints):
 * ========================================================================
 *
 * REFERRAL PLANS (3 endpoints):
 * GET    /api/referral/plans                     - Get all referral plans
 * POST   /api/referral/plans/purchase            - Purchase a referral plan  
 * GET    /api/referral/subscription              - Get current subscription
 *
 * REFERRAL REQUESTS (5 endpoints):
 * POST   /api/referral/requests                  - Create referral request
 * GET    /api/referral/my-requests               - Get my requests (seeker)
 * GET    /api/referral/available                 - Get available requests (referrer)
 * POST   /api/referral/requests/{id}/claim       - Claim a request
 * GET    /api/referral/my-referrer-requests      - Get my referrer requests
 * POST   /api/referral/requests/{id}/verify      - Verify referral completion
 *
 * ANALYTICS & STATS (3 endpoints):
 * GET    /api/referral/analytics                 - Get referral dashboard
 * GET    /api/referral/eligibility               - Check eligibility
 * GET    /api/referral/stats                     - Get referrer badge stats
 *
 * ========================================================================
 * AUTHENTICATION:
 * - All endpoints require authentication except /plans (public view)
 * - Uses existing JWT middleware from RefOpen auth system
 * - Role-based permissions: 'read:referral', 'create:referral', etc.
 *
 * FEATURES:
 * - Daily quota management based on subscriptions
 * - Organization-based referral matching
 * - Real-time badge notifications via ReferrerStats
 * - Comprehensive analytics dashboard
 * - Payment integration ready (placeholder for payment tokens)
 * ========================================================================
 */