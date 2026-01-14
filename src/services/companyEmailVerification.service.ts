import { dbService } from './database.service';
import { EmailService } from './emailService';
import { encrypt, decrypt, maskEmail } from '../utils/encryption';

/**
 * Company Email Verification Service
 * 
 * Handles the verification of referrers by confirming their company email
 * through OTP (One-Time Password) verification.
 * 
 * Flow:
 * 1. User submits company email for their current work experience
 * 2. System generates 4-digit OTP and sends to company email
 * 3. User enters OTP to verify
 * 4. On success: WorkExperience.CompanyEmailVerified = true, User.IsVerifiedReferrer = true
 * 5. If user adds new work experience: IsVerifiedReferrer = false (must re-verify)
 */

// Generate a random 4-digit OTP
const generateOTP = (): string => {
  return Math.floor(1000 + Math.random() * 9000).toString();
};

// OTP expiry time in minutes
const OTP_EXPIRY_MINUTES = 10;
const MAX_OTP_ATTEMPTS = 3;

export interface SendOTPRequest {
  userId: string;
  workExperienceId: string;
  companyEmail: string;
}

export interface VerifyOTPRequest {
  userId: string;
  workExperienceId: string;
  otp: string;
}

export interface VerificationResult {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
}

/**
 * Send OTP to company email for verification
 */
export const sendCompanyEmailOTP = async (request: SendOTPRequest): Promise<VerificationResult> => {
  const { userId, workExperienceId, companyEmail } = request;

  try {
    // 1. Validate the work experience belongs to the user and is current
    const workExpResult = await dbService.executeQuery(`
      SELECT 
        we.WorkExperienceID,
        we.ApplicantID,
        we.IsCurrent,
        we.CompanyName,
        we.OrganizationID,
        a.UserID
      FROM WorkExperiences we
      INNER JOIN Applicants a ON we.ApplicantID = a.ApplicantID
      WHERE we.WorkExperienceID = @param0
        AND a.UserID = @param1
        AND we.IsActive = 1
    `, [workExperienceId, userId]);

    if (workExpResult.recordset.length === 0) {
      return {
        success: false,
        message: 'Work experience not found or does not belong to user',
        error: 'WORK_EXP_NOT_FOUND'
      };
    }

    const workExp = workExpResult.recordset[0];

    if (!workExp.IsCurrent) {
      return {
        success: false,
        message: 'Can only verify company email for current employment',
        error: 'NOT_CURRENT_JOB'
      };
    }

    // 2. Validate email domain matches company (optional but recommended)
    // For now, we'll trust the user's input but you can add domain validation

    // 3. Check if there's a recent unexpired OTP (prevent spam)
    const recentOTPResult = await dbService.executeQuery(`
      SELECT TOP 1 OTPID, CreatedAt, ExpiresAt
      FROM EmailVerificationOTPs
      WHERE UserID = @param0
        AND WorkExperienceID = @param1
        AND IsUsed = 0
        AND ExpiresAt > GETUTCDATE()
      ORDER BY CreatedAt DESC
    `, [userId, workExperienceId]);

    if (recentOTPResult.recordset.length > 0) {
      const recentOTP = recentOTPResult.recordset[0];
      const createdAt = new Date(recentOTP.CreatedAt);
      const now = new Date();
      const minutesSinceCreation = (now.getTime() - createdAt.getTime()) / (1000 * 60);
      
      if (minutesSinceCreation < 1) {
        return {
          success: false,
          message: 'Please wait at least 1 minute before requesting a new OTP',
          error: 'OTP_COOLDOWN'
        };
      }
    }

    // 4. Generate new OTP
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    // 5. Invalidate any existing OTPs for this work experience
    await dbService.executeQuery(`
      UPDATE EmailVerificationOTPs
      SET IsUsed = 1
      WHERE UserID = @param0
        AND WorkExperienceID = @param1
        AND IsUsed = 0
    `, [userId, workExperienceId]);

    // 6. Store new OTP
    await dbService.executeQuery(`
      INSERT INTO EmailVerificationOTPs 
      (UserID, WorkExperienceID, Email, OTPCode, ExpiresAt, Purpose)
      VALUES 
      (@param0, @param1, @param2, @param3, @param4, 'COMPANY_EMAIL_VERIFICATION')
    `, [userId, workExperienceId, companyEmail, otp, expiresAt]);

    // 7. Update company email in work experience (not verified yet) - ENCRYPTED
    const encryptedEmail = encrypt(companyEmail);
    await dbService.executeQuery(`
      UPDATE WorkExperiences
      SET CompanyEmail = @param1,
          CompanyEmailVerified = 0,
          UpdatedAt = GETUTCDATE()
      WHERE WorkExperienceID = @param0
    `, [workExperienceId, encryptedEmail]);

    // 8. Send OTP email
    const emailResult = await EmailService.send({
      to: companyEmail,
      subject: 'RefOpen - Verify Your Company Email',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #6366F1;">Verify Your Company Email</h2>
          <p>Hello,</p>
          <p>You requested to verify your company email for <strong>${workExp.CompanyName}</strong> on RefOpen.</p>
          <p>Your verification code is:</p>
          <div style="background: #F3F4F6; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #6366F1;">${otp}</span>
          </div>
          <p>This code will expire in <strong>${OTP_EXPIRY_MINUTES} minutes</strong>.</p>
          <p>If you didn't request this verification, please ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 20px 0;">
          <p style="color: #6B7280; font-size: 12px;">
            This email was sent by RefOpen. 
            <br>© ${new Date().getFullYear()} RefOpen. All rights reserved.
          </p>
        </div>
      `,
      text: `Your RefOpen verification code is: ${otp}. This code expires in ${OTP_EXPIRY_MINUTES} minutes.`
    });

    if (!emailResult.success) {
      console.error('Failed to send OTP email:', emailResult.error);
      return {
        success: false,
        message: 'Failed to send verification email. Please try again.',
        error: 'EMAIL_SEND_FAILED'
      };
    }

    return {
      success: true,
      message: `Verification code sent to ${companyEmail}. Please check your inbox.`,
      data: {
        expiresInMinutes: OTP_EXPIRY_MINUTES,
        email: maskEmail(companyEmail) // Use our mask function
      }
    };

  } catch (error: any) {
    console.error('Error sending company email OTP:', error);
    return {
      success: false,
      message: 'An error occurred while sending verification code',
      error: error.message
    };
  }
};

/**
 * Verify OTP and mark referrer as verified
 */
export const verifyCompanyEmailOTP = async (request: VerifyOTPRequest): Promise<VerificationResult> => {
  const { userId, workExperienceId, otp } = request;

  try {
    // 1. Find the OTP record
    const otpResult = await dbService.executeQuery(`
      SELECT TOP 1 
        OTPID, OTPCode, Email, ExpiresAt, IsUsed, AttemptCount, MaxAttempts
      FROM EmailVerificationOTPs
      WHERE UserID = @param0
        AND WorkExperienceID = @param1
        AND IsUsed = 0
      ORDER BY CreatedAt DESC
    `, [userId, workExperienceId]);

    if (otpResult.recordset.length === 0) {
      return {
        success: false,
        message: 'No pending verification found. Please request a new code.',
        error: 'NO_PENDING_OTP'
      };
    }

    const otpRecord = otpResult.recordset[0];

    // 2. Check if OTP is expired
    if (new Date(otpRecord.ExpiresAt) < new Date()) {
      return {
        success: false,
        message: 'Verification code has expired. Please request a new one.',
        error: 'OTP_EXPIRED'
      };
    }

    // 3. Check attempt count
    if (otpRecord.AttemptCount >= otpRecord.MaxAttempts) {
      // Mark OTP as used (exhausted attempts)
      await dbService.executeQuery(`
        UPDATE EmailVerificationOTPs
        SET IsUsed = 1
        WHERE OTPID = @param0
      `, [otpRecord.OTPID]);

      return {
        success: false,
        message: 'Too many failed attempts. Please request a new code.',
        error: 'MAX_ATTEMPTS_EXCEEDED'
      };
    }

    // 4. Verify OTP
    if (otpRecord.OTPCode !== otp) {
      // Increment attempt count
      await dbService.executeQuery(`
        UPDATE EmailVerificationOTPs
        SET AttemptCount = AttemptCount + 1
        WHERE OTPID = @param0
      `, [otpRecord.OTPID]);

      const remainingAttempts = otpRecord.MaxAttempts - otpRecord.AttemptCount - 1;
      return {
        success: false,
        message: `Invalid code. ${remainingAttempts} attempt(s) remaining.`,
        error: 'INVALID_OTP',
        data: { remainingAttempts }
      };
    }

    // 5. OTP is correct! Mark as used
    await dbService.executeQuery(`
      UPDATE EmailVerificationOTPs
      SET IsUsed = 1, UsedAt = GETUTCDATE()
      WHERE OTPID = @param0
    `, [otpRecord.OTPID]);

    // 6. Get the OrganizationID and check if user already has a verified entry for this org
    const workExpResult = await dbService.executeQuery(`
      SELECT we.OrganizationID, a.UserID, a.ApplicantID
      FROM WorkExperiences we
      INNER JOIN Applicants a ON we.ApplicantID = a.ApplicantID
      WHERE we.WorkExperienceID = @param0
    `, [workExperienceId]);

    const organizationId = workExpResult.recordset[0]?.OrganizationID;
    const applicantId = workExpResult.recordset[0]?.ApplicantID;

    // Check if user already has a verified entry for this organization (to avoid double counting)
    let userAlreadyVerifiedForOrg = false;
    if (organizationId) {
      const existingVerifiedResult = await dbService.executeQuery(`
        SELECT COUNT(*) as VerifiedCount
        FROM WorkExperiences we
        INNER JOIN Applicants a ON we.ApplicantID = a.ApplicantID
        WHERE a.UserID = @param0
          AND we.OrganizationID = @param1
          AND we.CompanyEmailVerified = 1
          AND we.IsActive = 1
          AND we.WorkExperienceID != @param2
      `, [userId, organizationId, workExperienceId]);
      
      userAlreadyVerifiedForOrg = existingVerifiedResult.recordset[0]?.VerifiedCount > 0;
    }

    // 7. Update WorkExperience as verified - ENCRYPTED
    const encryptedVerifiedEmail = encrypt(otpRecord.Email);
    await dbService.executeQuery(`
      UPDATE WorkExperiences
      SET CompanyEmail = @param1,
          CompanyEmailVerified = 1,
          CompanyEmailVerifiedAt = GETUTCDATE(),
          UpdatedAt = GETUTCDATE()
      WHERE WorkExperienceID = @param0
    `, [workExperienceId, encryptedVerifiedEmail]);

    // 8. Update User as verified referrer
    await dbService.executeQuery(`
      UPDATE Users
      SET IsVerifiedReferrer = 1,
          IsVerifiedUser = 1,
          UpdatedAt = GETUTCDATE()
      WHERE UserID = @param0
    `, [userId]);

    // 9. Increment VerifiedReferrersCount in Organizations table
    // Only increment if user doesn't already have another verified entry for this same organization
    if (organizationId && !userAlreadyVerifiedForOrg) {
      await dbService.executeQuery(`
        UPDATE Organizations
        SET VerifiedReferrersCount = ISNULL(VerifiedReferrersCount, 0) + 1,
            UpdatedAt = GETUTCDATE()
        WHERE OrganizationID = @param0
      `, [organizationId]);
      console.log(`Incremented VerifiedReferrersCount for OrganizationID ${organizationId}`);
    }

    return {
      success: true,
      message: 'Company email verified successfully! You are now a verified referrer.',
      data: {
        isVerifiedReferrer: true,
        isVerifiedUser: true,
        verifiedEmail: otpRecord.Email
      }
    };

  } catch (error: any) {
    console.error('Error verifying company email OTP:', error);
    return {
      success: false,
      message: 'An error occurred while verifying code',
      error: error.message
    };
  }
};

/**
 * Get user's verification status
 */
export const getVerificationStatus = async (userId: string): Promise<VerificationResult> => {
  try {
    const result = await dbService.executeQuery(`
      SELECT 
        u.UserID,
        u.IsVerifiedReferrer,
        u.IsVerifiedUser,
        we.WorkExperienceID,
        we.CompanyName,
        we.CompanyEmail,
        we.CompanyEmailVerified,
        we.CompanyEmailVerifiedAt,
        we.OrganizationID,
        o.Name as OrganizationName
      FROM Users u
      LEFT JOIN Applicants a ON u.UserID = a.UserID
      LEFT JOIN WorkExperiences we ON a.ApplicantID = we.ApplicantID 
        AND we.IsCurrent = 1 
        AND we.IsActive = 1
      LEFT JOIN Organizations o ON we.OrganizationID = o.OrganizationID
      WHERE u.UserID = @param0
    `, [userId]);

    if (result.recordset.length === 0) {
      return {
        success: false,
        message: 'User not found',
        error: 'USER_NOT_FOUND'
      };
    }

    const user = result.recordset[0];

    return {
      success: true,
      message: 'Verification status retrieved',
      data: {
        isVerifiedReferrer: user.IsVerifiedReferrer || false,
        isVerifiedUser: user.IsVerifiedUser || false,
        currentWorkExperience: user.WorkExperienceID ? {
          workExperienceId: user.WorkExperienceID,
          companyName: user.CompanyName || user.OrganizationName,
          companyEmail: decrypt(user.CompanyEmail), // Decrypt for display
          companyEmailMasked: maskEmail(decrypt(user.CompanyEmail) || ''), // Masked version for UI
          isEmailVerified: user.CompanyEmailVerified || false,
          verifiedAt: user.CompanyEmailVerifiedAt
        } : null
      }
    };

  } catch (error: any) {
    console.error('Error getting verification status:', error);
    return {
      success: false,
      message: 'An error occurred',
      error: error.message
    };
  }
};

/**
 * Reset verification status when user adds new work experience
 * This should be called when a new work experience is added with IsCurrent = true
 */
export const resetVerificationOnNewJob = async (userId: string): Promise<void> => {
  try {
    await dbService.executeQuery(`
      UPDATE Users
      SET IsVerifiedReferrer = 0,
          UpdatedAt = GETUTCDATE()
      WHERE UserID = @param0
    `, [userId]);

    console.log(`Reset verification status for user ${userId} due to new job`);

  } catch (error: any) {
    console.error('Error resetting verification status:', error);
  }
};

export const companyEmailVerificationService = {
  sendOTP: sendCompanyEmailOTP,
  verifyOTP: verifyCompanyEmailOTP,
  getStatus: getVerificationStatus,
  resetOnNewJob: resetVerificationOnNewJob
};

export default companyEmailVerificationService;
