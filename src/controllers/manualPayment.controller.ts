/**
 * Manual Payment Controller
 * Handles manual bank/UPI payment submissions
 */

import { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { authenticate } from '../middleware';
import manualPaymentService from '../services/manualPayment.service';
import { dbService } from '../services/database.service';
import { PromoService } from '../services/promo.service';

/**
 * GET /api/manual-payment/settings - Get bank/UPI details (public)
 */
export const getPaymentSettings = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  try {
    const settings = await manualPaymentService.getSettings();
    return {
      status: 200,
      jsonBody: {
        success: true,
        data: settings
      }
    };
  } catch (error: any) {
    console.error('Error getting payment settings:', error);
    return {
      status: 500,
      jsonBody: { success: false, message: 'Failed to get payment settings' }
    };
  }
};

/**
 * POST /api/manual-payment/submit - Submit payment proof
 */
export const submitPaymentProof = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  try {
    const user = authenticate(request);

    const body = await request.json() as any;
    
    // Validate required fields
    if (!body.amount || !body.paymentMethod || !body.referenceNumber || !body.paymentDate) {
      return {
        status: 400,
        jsonBody: { 
          success: false, 
          message: 'Missing required fields: amount, paymentMethod, referenceNumber, paymentDate' 
        }
      };
    }

    const result = await manualPaymentService.submit(user.userId, {
      userId: user.userId,
      amount: parseFloat(body.amount),
      paymentMethod: body.paymentMethod,
      referenceNumber: body.referenceNumber.trim(),
      paymentDate: body.paymentDate,
      proofImageURL: body.proofImageUrl || null,
      userRemarks: body.userRemarks || null,
      packId: body.packId || null,
      promoCode: body.promoCode || null
    });

    return {
      status: result.success ? 200 : 400,
      jsonBody: result
    };

  } catch (error: any) {
    console.error('Error submitting manual payment:', error);
    if (error.name === 'AuthenticationError') {
      return { status: 401, jsonBody: { success: false, message: 'Unauthorized' } };
    }
    return {
      status: 500,
      jsonBody: { success: false, message: error.message || 'Failed to submit payment proof' }
    };
  }
};

/**
 * GET /api/manual-payment/my-submissions - Get user's submissions
 */
export const getMySubmissions = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  try {
    const user = authenticate(request);

    const submissions = await manualPaymentService.getUserPayments(user.userId);

    return {
      status: 200,
      jsonBody: {
        success: true,
        data: submissions
      }
    };

  } catch (error: any) {
    console.error('Error getting user submissions:', error);
    if (error.name === 'AuthenticationError') {
      return { status: 401, jsonBody: { success: false, message: 'Unauthorized' } };
    }
    return {
      status: 500,
      jsonBody: { success: false, message: 'Failed to get submissions' }
    };
  }
};

// ========================================================================
// ADMIN ENDPOINTS - Only accessible by Admin users
// ========================================================================

/**
 * Helper to check if user is admin
 */
const isAdmin = async (userId: string): Promise<boolean> => {
  try {
    const result = await dbService.executeQuery(`
      SELECT UserType FROM Users WHERE UserID = @param0
    `, [userId]);
    return result.recordset?.[0]?.UserType === 'Admin';
  } catch {
    return false;
  }
};

/**
 * GET /api/manual-payment/admin/pending - Get all pending payments (admin only)
 */
export const getAdminPendingPayments = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  try {
    const user = authenticate(request);
    
    // Check admin role
    if (!await isAdmin(user.userId)) {
      return { status: 403, jsonBody: { success: false, message: 'Admin access required' } };
    }

    const submissions = await manualPaymentService.getPending();

    return {
      status: 200,
      jsonBody: {
        success: true,
        data: submissions
      }
    };

  } catch (error: any) {
    console.error('Error getting pending payments:', error);
    if (error.name === 'AuthenticationError') {
      return { status: 401, jsonBody: { success: false, message: 'Unauthorized' } };
    }
    return {
      status: 500,
      jsonBody: { success: false, message: 'Failed to get pending payments' }
    };
  }
};

/**
 * GET /api/manual-payment/admin/all - Get all payments with filters (admin only)
 */
export const getAdminAllPayments = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  try {
    const user = authenticate(request);
    
    // Check admin role
    if (!await isAdmin(user.userId)) {
      return { status: 403, jsonBody: { success: false, message: 'Admin access required' } };
    }

    const status = request.query.get('status') || null;
    const submissions = await manualPaymentService.getAll(status);

    return {
      status: 200,
      jsonBody: {
        success: true,
        data: submissions
      }
    };

  } catch (error: any) {
    console.error('Error getting all payments:', error);
    if (error.name === 'AuthenticationError') {
      return { status: 401, jsonBody: { success: false, message: 'Unauthorized' } };
    }
    return {
      status: 500,
      jsonBody: { success: false, message: 'Failed to get payments' }
    };
  }
};

/**
 * POST /api/manual-payment/admin/approve/:submissionId - Approve payment
 */
export const approvePayment = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  try {
    const user = authenticate(request);
    
    // Check admin role
    if (!await isAdmin(user.userId)) {
      return { status: 403, jsonBody: { success: false, message: 'Admin access required' } };
    }

    const submissionId = request.params.submissionId;
    if (!submissionId) {
      return { status: 400, jsonBody: { success: false, message: 'Submission ID required' } };
    }

    const body = await request.json().catch(() => ({})) as any;

    const result = await manualPaymentService.approve(
      submissionId,
      user.userId,
      body.adminRemarks
    );

    return {
      status: result.success ? 200 : 400,
      jsonBody: result
    };

  } catch (error: any) {
    console.error('Error approving payment:', error);
    if (error.name === 'AuthenticationError') {
      return { status: 401, jsonBody: { success: false, message: 'Unauthorized' } };
    }
    return {
      status: 500,
      jsonBody: { success: false, message: 'Failed to approve payment' }
    };
  }
};

/**
 * POST /api/manual-payment/admin/reject/:submissionId - Reject payment
 */
export const rejectPayment = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  try {
    const user = authenticate(request);
    
    // Check admin role
    if (!await isAdmin(user.userId)) {
      return { status: 403, jsonBody: { success: false, message: 'Admin access required' } };
    }

    const submissionId = request.params.submissionId;
    if (!submissionId) {
      return { status: 400, jsonBody: { success: false, message: 'Submission ID required' } };
    }

    const body = await request.json() as any;

    if (!body.adminRemarks) {
      return {
        status: 400,
        jsonBody: { success: false, message: 'Please provide a reason for rejection' }
      };
    }

    const result = await manualPaymentService.reject(
      submissionId,
      user.userId,
      body.adminRemarks
    );

    return {
      status: result.success ? 200 : 400,
      jsonBody: result
    };

  } catch (error: any) {
    console.error('Error rejecting payment:', error);
    if (error.name === 'AuthenticationError') {
      return { status: 401, jsonBody: { success: false, message: 'Unauthorized' } };
    }
    return {
      status: 500,
      jsonBody: { success: false, message: 'Failed to reject payment' }
    };
  }
};

/**
 * GET /api/wallet/bonus-packs - Get active bonus packs (public)
 */
export const getBonusPacks = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  try {
    const packs = await PromoService.getBonusPacks();
    return {
      status: 200,
      jsonBody: { success: true, data: packs }
    };
  } catch (error: any) {
    console.error('Error getting bonus packs:', error);
    return {
      status: 500,
      jsonBody: { success: false, message: 'Failed to get bonus packs' }
    };
  }
};

/**
 * POST /api/wallet/validate-promo - Validate a promo code
 */
export const validatePromoCode = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  try {
    const user = authenticate(request);
    const body = await request.json() as any;

    if (!body.code) {
      return {
        status: 400,
        jsonBody: { success: false, message: 'Promo code is required' }
      };
    }

    const result = await PromoService.validatePromoCode(
      body.code,
      user.userId,
      parseFloat(body.amount) || 0
    );

    return {
      status: 200,
      jsonBody: { success: true, data: result }
    };
  } catch (error: any) {
    console.error('Error validating promo code:', error);
    if (error.name === 'AuthenticationError') {
      return { status: 401, jsonBody: { success: false, message: 'Unauthorized' } };
    }
    return {
      status: 500,
      jsonBody: { success: false, message: 'Failed to validate promo code' }
    };
  }
};
