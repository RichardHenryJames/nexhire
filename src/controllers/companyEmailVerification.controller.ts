import { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { companyEmailVerificationService } from '../services/companyEmailVerification.service';

/**
 * Company Email Verification Controller
 * 
 * Endpoints:
 * - POST /verification/company-email/send-otp - Send OTP to company email
 * - POST /verification/company-email/verify-otp - Verify OTP
 * - GET /verification/status - Get verification status
 */

// Helper to extract user ID from JWT token
const getUserIdFromRequest = (request: HttpRequest): string | null => {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  try {
    const token = authHeader.substring(7);
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    return payload.userId || payload.sub || null;
  } catch (error) {
    return null;
  }
};

/**
 * Send OTP to company email
 * POST /api/verification/company-email/send-otp
 */
export const sendCompanyEmailOTP = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  try {
    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return {
        status: 401,
        jsonBody: { success: false, error: 'Authentication required' }
      };
    }

    const body = await request.json() as any;
    const { workExperienceId, companyEmail } = body;

    if (!workExperienceId || !companyEmail) {
      return {
        status: 400,
        jsonBody: { 
          success: false, 
          error: 'workExperienceId and companyEmail are required' 
        }
      };
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(companyEmail)) {
      return {
        status: 400,
        jsonBody: { success: false, error: 'Invalid email format' }
      };
    }

    // Don't allow personal email domains for company verification
    const personalDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'live.com', 'icloud.com', 'mail.com', 'protonmail.com', 'ymail.com', 'aol.com', 'zoho.com', 'rediffmail.com'];
    const emailDomain = companyEmail.split('@')[1].toLowerCase();
    if (personalDomains.includes(emailDomain)) {
      return {
        status: 400,
        jsonBody: { 
          success: false, 
          error: 'Please use your official company email address, not personal email' 
        }
      };
    }

    const result = await companyEmailVerificationService.sendOTP({
      userId,
      workExperienceId,
      companyEmail
    });

    return {
      status: result.success ? 200 : 400,
      jsonBody: result
    };

  } catch (error: any) {
    context.error('Error in sendCompanyEmailOTP:', error);
    return {
      status: 500,
      jsonBody: { success: false, error: 'Internal server error' }
    };
  }
};

/**
 * Verify OTP
 * POST /api/verification/company-email/verify-otp
 */
export const verifyCompanyEmailOTP = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  try {
    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return {
        status: 401,
        jsonBody: { success: false, error: 'Authentication required' }
      };
    }

    const body = await request.json() as any;
    const { workExperienceId, otp } = body;

    if (!workExperienceId || !otp) {
      return {
        status: 400,
        jsonBody: { 
          success: false, 
          error: 'workExperienceId and otp are required' 
        }
      };
    }

    // Validate OTP format (4 digits)
    if (!/^\d{4}$/.test(otp)) {
      return {
        status: 400,
        jsonBody: { success: false, error: 'OTP must be 4 digits' }
      };
    }

    const result = await companyEmailVerificationService.verifyOTP({
      userId,
      workExperienceId,
      otp
    });

    return {
      status: result.success ? 200 : 400,
      jsonBody: result
    };

  } catch (error: any) {
    context.error('Error in verifyCompanyEmailOTP:', error);
    return {
      status: 500,
      jsonBody: { success: false, error: 'Internal server error' }
    };
  }
};

/**
 * Get verification status
 * GET /api/verification/status
 */
export const getVerificationStatus = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  try {
    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return {
        status: 401,
        jsonBody: { success: false, error: 'Authentication required' }
      };
    }

    const result = await companyEmailVerificationService.getStatus(userId);

    return {
      status: result.success ? 200 : 400,
      jsonBody: result
    };

  } catch (error: any) {
    context.error('Error in getVerificationStatus:', error);
    return {
      status: 500,
      jsonBody: { success: false, error: 'Internal server error' }
    };
  }
};

export default {
  sendCompanyEmailOTP,
  verifyCompanyEmailOTP,
  getVerificationStatus
};
