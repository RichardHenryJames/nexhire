import { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { withAuth } from '../middleware';
import { UserVerificationService } from '../services/user-verification.service';

/**
 * POST /verification/user/college-email/send-otp
 */
export const sendCollegeEmailOTP = withAuth(async (
  request: HttpRequest,
  context: InvocationContext,
  user: any
): Promise<HttpResponseInit> => {
  const body = (await request.json()) as { collegeEmail?: string; collegeName?: string };
  const { collegeEmail, collegeName } = body;

  if (!collegeEmail || !collegeName) {
    return { status: 400, jsonBody: { success: false, error: 'College email and college name are required' } };
  }

  const result = await UserVerificationService.sendCollegeEmailOTP(user.userId, collegeEmail, collegeName);
  return { status: result.success ? 200 : 400, jsonBody: result };
});

/**
 * POST /verification/user/college-email/verify-otp
 */
export const verifyCollegeEmailOTP = withAuth(async (
  request: HttpRequest,
  context: InvocationContext,
  user: any
): Promise<HttpResponseInit> => {
  const body = (await request.json()) as { otp?: string };
  const { otp } = body;

  if (!otp || otp.length !== 4) {
    return { status: 400, jsonBody: { success: false, error: 'Valid 4-digit OTP is required' } };
  }

  const result = await UserVerificationService.verifyCollegeEmailOTP(user.userId, otp);
  return { status: result.success ? 200 : 400, jsonBody: result };
});

/**
 * POST /verification/user/aadhaar/submit
 */
export const submitAadhaarVerification = withAuth(async (
  request: HttpRequest,
  context: InvocationContext,
  user: any
): Promise<HttpResponseInit> => {
  const body = (await request.json()) as { aadhaarPhotoURL?: string; selfiePhotoURL?: string };
  const { aadhaarPhotoURL, selfiePhotoURL } = body;

  if (!aadhaarPhotoURL || !selfiePhotoURL) {
    return { status: 400, jsonBody: { success: false, error: 'Aadhaar photo and selfie are required' } };
  }

  const result = await UserVerificationService.submitAadhaarVerification(user.userId, aadhaarPhotoURL, selfiePhotoURL);
  return { status: result.success ? 200 : 400, jsonBody: result };
});

/**
 * GET /verification/user/status
 */
export const getUserVerificationStatus = withAuth(async (
  request: HttpRequest,
  context: InvocationContext,
  user: any
): Promise<HttpResponseInit> => {
  const result = await UserVerificationService.getVerificationStatus(user.userId);
  return { status: result.success ? 200 : 500, jsonBody: result };
});

/**
 * GET /management/verifications/pending — Admin
 */
export const adminGetPendingVerifications = withAuth(async (
  request: HttpRequest,
  context: InvocationContext,
  user: any
): Promise<HttpResponseInit> => {
  if (user.userType !== 'Admin') {
    return { status: 403, jsonBody: { success: false, error: 'Admin access required' } };
  }
  const result = await UserVerificationService.getAllVerifications();
  return { status: result.success ? 200 : 500, jsonBody: result };
});

/**
 * POST /management/verifications/:verificationId/approve — Admin
 */
export const adminApproveVerification = withAuth(async (
  request: HttpRequest,
  context: InvocationContext,
  user: any
): Promise<HttpResponseInit> => {
  if (user.userType !== 'Admin') {
    return { status: 403, jsonBody: { success: false, error: 'Admin access required' } };
  }
  const verificationId = request.params.verificationId;
  if (!verificationId) {
    return { status: 400, jsonBody: { success: false, error: 'Verification ID is required' } };
  }
  const result = await UserVerificationService.approveVerification(verificationId, user.userId);
  return { status: result.success ? 200 : 400, jsonBody: result };
});

/**
 * POST /management/verifications/:verificationId/reject — Admin
 */
export const adminRejectVerification = withAuth(async (
  request: HttpRequest,
  context: InvocationContext,
  user: any
): Promise<HttpResponseInit> => {
  if (user.userType !== 'Admin') {
    return { status: 403, jsonBody: { success: false, error: 'Admin access required' } };
  }
  const verificationId = request.params.verificationId;
  if (!verificationId) {
    return { status: 400, jsonBody: { success: false, error: 'Verification ID is required' } };
  }
  const body = (await request.json()) as { reason?: string };
  if (!body.reason) {
    return { status: 400, jsonBody: { success: false, error: 'Rejection reason is required' } };
  }
  const result = await UserVerificationService.rejectVerification(verificationId, user.userId, body.reason);
  return { status: result.success ? 200 : 400, jsonBody: result };
});
