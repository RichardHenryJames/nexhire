import { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { registrationEmailVerificationService } from '../services/registrationEmailVerification.service';

/**
 * Registration Email Verification Controller
 * 
 * These endpoints are ANONYMOUS (no JWT required) — called before user exists.
 * 
 * Endpoints:
 * - POST /auth/email/send-otp    — Send OTP to email during registration
 * - POST /auth/email/verify-otp  — Verify the OTP, return verificationId
 */

/**
 * Send OTP to email for registration
 * POST /api/auth/email/send-otp
 */
export const sendRegistrationOTP = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  try {
    const body = await request.json() as any;
    const { email } = body;

    if (!email) {
      return {
        status: 400,
        jsonBody: { success: false, error: 'Email is required' }
      };
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return {
        status: 400,
        jsonBody: { success: false, error: 'Invalid email format' }
      };
    }

    const result = await registrationEmailVerificationService.sendOTP(email);

    return {
      status: result.success ? 200 : 400,
      jsonBody: result
    };

  } catch (error: any) {
    context.error('Error in sendRegistrationOTP:', error);
    return {
      status: 500,
      jsonBody: { success: false, error: 'Internal server error' }
    };
  }
};

/**
 * Verify OTP for registration email
 * POST /api/auth/email/verify-otp
 */
export const verifyRegistrationOTP = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  try {
    const body = await request.json() as any;
    const { email, otp } = body;

    if (!email || !otp) {
      return {
        status: 400,
        jsonBody: { success: false, error: 'Email and OTP are required' }
      };
    }

    // Validate OTP format (4 digits)
    if (!/^\d{4}$/.test(otp)) {
      return {
        status: 400,
        jsonBody: { success: false, error: 'OTP must be 4 digits' }
      };
    }

    const result = await registrationEmailVerificationService.verifyOTP(email, otp);

    return {
      status: result.success ? 200 : 400,
      jsonBody: result
    };

  } catch (error: any) {
    context.error('Error in verifyRegistrationOTP:', error);
    return {
      status: 500,
      jsonBody: { success: false, error: 'Internal server error' }
    };
  }
};
