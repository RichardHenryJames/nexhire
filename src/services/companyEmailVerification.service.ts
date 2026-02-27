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

// Shared email footer for OTP emails (simple version, no logo)
const OTP_EMAIL_FOOTER = `
                    <!-- Footer -->
                    <tr>
                        <td style="background: #F8FAFC; padding: 32px 40px; border-top: 1px solid #E2E8F0; text-align: center;">
                            <img src="https://www.refopen.com/refopen-logo.png" alt="RefOpen" width="100" style="margin-bottom: 16px;">
                            <p style="margin: 0 0 8px 0; color: #64748B; font-size: 12px;">
                                This is a security email from RefOpen.
                            </p>
                            <p style="margin: 0; color: #64748B; font-size: 12px;">
                                <a href="https://www.refopen.com/support" style="color: #4F46E5; text-decoration: none;">Help Center</a>
                                <span style="color: #CBD5E1; margin: 0 8px;">|</span>
                                <a href="https://www.refopen.com" style="color: #4F46E5; text-decoration: none;">RefOpen</a>
                            </p>
                        </td>
                    </tr>`;

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

    // 2. Validate email domain matches company
    const emailDomain = companyEmail.split('@')[1]?.toLowerCase();
    if (emailDomain && workExp.CompanyName) {
      const domainCompany = emailDomain.split('.')[0];
      let normalized = workExp.CompanyName.toLowerCase().replace(/[^a-z0-9]/g, '');
      // Strip common company suffixes
      const suffixes = ['inc', 'llc', 'ltd', 'pvtltd', 'pvt', 'corp', 'corporation', 'limited', 'company', 'technologies', 'tech', 'software', 'solutions', 'services', 'group', 'india', 'global'];
      suffixes.forEach(s => {
        normalized = normalized.replace(new RegExp(s + '$', 'i'), '');
      });
      const domainMatchesCompany = domainCompany === normalized ||
        normalized.startsWith(domainCompany) ||
        (normalized.length >= 3 && emailDomain.split('.').some(part => part === normalized));
      if (!domainMatchesCompany) {
        return {
          success: false,
          message: `Email domain "${emailDomain}" does not match company "${workExp.CompanyName}". Please use your ${workExp.CompanyName} work email.`,
          error: 'DOMAIN_MISMATCH'
        };
      }
    }

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
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5; -webkit-font-smoothing: antialiased;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
                    
                    <!-- Header -->
                    <tr>
                        <td style="background: #4F46E5; padding: 40px; text-align: center;">
                            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600; letter-spacing: -0.5px;">Verify Your Company Email</h1>
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td style="padding: 40px;">
                            <p style="color: #1a1a1a; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                                Hello,
                            </p>
                            <p style="color: #4a4a4a; font-size: 15px; line-height: 1.7; margin: 0 0 24px 0;">
                                You requested to verify your company email for <strong>${workExp.CompanyName}</strong> on RefOpen.
                            </p>
                            
                            <p style="color: #64748B; font-size: 14px; margin: 0 0 12px 0;">Your verification code is:</p>
                            
                            <!-- OTP Code -->
                            <table width="100%" cellpadding="0" cellspacing="0" style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; margin: 0 0 24px 0;">
                                <tr>
                                    <td style="padding: 24px; text-align: center;">
                                        <span style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #4F46E5;">${otp}</span>
                                    </td>
                                </tr>
                            </table>
                            
                            <p style="color: #64748B; font-size: 14px; line-height: 1.6; margin: 0 0 16px 0;">
                                This code will expire in <strong style="color: #1a1a1a;">${OTP_EXPIRY_MINUTES} minutes</strong>.
                            </p>
                            
                            <p style="color: #64748B; font-size: 14px; line-height: 1.6; margin: 0;">
                                If you didn't request this verification, please ignore this email.
                            </p>
                        </td>
                    </tr>
                    
${OTP_EMAIL_FOOTER}
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
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

    // 9. VerifiedReferrersCount is handled by nightly reconciliation timer
    // No manual increment needed - timer recalculates from actual data daily

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
