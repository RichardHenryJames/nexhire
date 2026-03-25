import { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { registrationEmailVerificationService } from '../services/registrationEmailVerification.service';

/**
 * Account Email Verification Controller
 * 
 * These endpoints require JWT authentication — called for logged-in users
 * who haven't verified their email yet.
 * 
 * Endpoints:
 * - POST /auth/account/send-verification-otp    — Send OTP to user's email
 * - POST /auth/account/verify-email-otp         — Verify OTP, set EmailVerified = 1
 */

/**
 * Send OTP to logged-in user's email for account verification
 * POST /api/auth/account/send-verification-otp
 * Requires JWT (user object passed by withAuth middleware)
 */
export const sendAccountVerificationOTP = async (
  request: HttpRequest,
  context: InvocationContext,
  user: any
): Promise<HttpResponseInit> => {
  try {
    const userId = user.userId;
    const email = user.email;

    if (!email) {
      return {
        status: 400,
        jsonBody: { success: false, error: 'User email not found in token' }
      };
    }

    const result = await registrationEmailVerificationService.sendAccountOTP(userId, email);

    return {
      status: result.success ? 200 : 400,
      jsonBody: result
    };

  } catch (error: any) {
    context.error('Error in sendAccountVerificationOTP:', error);
    return {
      status: 500,
      jsonBody: { success: false, error: 'Internal server error' }
    };
  }
};

/**
 * Verify OTP for account email verification
 * POST /api/auth/account/verify-email-otp
 * Requires JWT (user object passed by withAuth middleware)
 */
export const verifyAccountEmailOTP = async (
  request: HttpRequest,
  context: InvocationContext,
  user: any
): Promise<HttpResponseInit> => {
  try {
    const body = await request.json() as any;
    const { otp } = body;
    const userId = user.userId;
    const email = user.email;

    if (!otp) {
      return {
        status: 400,
        jsonBody: { success: false, error: 'OTP is required' }
      };
    }

    // Validate OTP format (6 digits)
    if (!/^\d{6}$/.test(otp)) {
      return {
        status: 400,
        jsonBody: { success: false, error: 'OTP must be 6 digits' }
      };
    }

    if (!email) {
      return {
        status: 400,
        jsonBody: { success: false, error: 'User email not found in token' }
      };
    }

    const result = await registrationEmailVerificationService.verifyAccountOTP(userId, email, otp);

    return {
      status: result.success ? 200 : 400,
      jsonBody: result
    };

  } catch (error: any) {
    context.error('Error in verifyAccountEmailOTP:', error);
    return {
      status: 500,
      jsonBody: { success: false, error: 'Internal server error' }
    };
  }
};
