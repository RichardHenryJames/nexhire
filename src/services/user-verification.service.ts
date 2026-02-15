import { dbService } from './database.service';
import { EmailService } from './emailService';
import { encrypt, decrypt, maskEmail } from '../utils/encryption';

/**
 * User Verification Service
 * 
 * Handles "Get Verified" (blue tick) flow with 3 methods:
 * 1. Company Email — reuses BecomeReferrer OTP flow
 * 2. College Email — new OTP flow, purpose = 'USER_VERIFICATION'
 * 3. Aadhaar Card — photo upload + selfie, requires admin approval
 */

const generateOTP = (): string => {
  return Math.floor(1000 + Math.random() * 9000).toString();
};

const OTP_EXPIRY_MINUTES = 10;
const MAX_OTP_ATTEMPTS = 3;

// Personal email domains blocked for college email
const PERSONAL_DOMAINS = [
  // Google
  'gmail.com', 'googlemail.com',
  // Microsoft
  'outlook.com', 'hotmail.com', 'live.com', 'msn.com', 'outlook.in', 'hotmail.co.in', 'live.in',
  // Yahoo
  'yahoo.com', 'yahoo.co.in', 'yahoo.in', 'ymail.com', 'rocketmail.com',
  // Apple
  'icloud.com', 'me.com', 'mac.com',
  // Others
  'aol.com', 'mail.com', 'protonmail.com', 'proton.me', 'zoho.com', 'zoho.in',
  'gmx.com', 'gmx.net', 'fastmail.com', 'tutanota.com', 'hey.com',
  'inbox.com', 'mail.ru', 'yandex.com', 'yandex.ru',
  // India-specific
  'rediffmail.com', 'rediff.com', 'sify.com', 'in.com',
  // Temp/disposable
  'guerrillamail.com', 'tempmail.com', 'throwaway.email', 'mailinator.com',
  'sharklasers.com', 'guerrillamailblock.com', 'grr.la', 'dispostable.com',
];

// Known education email domain patterns
const EDU_DOMAIN_PATTERNS = [
  '.edu', '.edu.in', '.ac.in', '.ac.uk', '.edu.au', '.edu.sg',
  '.iiit.', '.iitb.', '.iitd.', '.iitk.', '.iitm.', '.iitkgp.',
  '.nit.', '.bits-pilani.', '.vit.', '.manipal.', '.amity.',
];

export class UserVerificationService {

  /**
   * Send OTP to college email for verification
   */
  static async sendCollegeEmailOTP(userId: string, collegeEmail: string, collegeName: string): Promise<any> {
    try {
      // Validate email domain
      const domain = collegeEmail.split('@')[1]?.toLowerCase();
      if (!domain) {
        return { success: false, error: 'Invalid email address' };
      }
      if (PERSONAL_DOMAINS.includes(domain)) {
        return { success: false, error: 'Personal emails are not allowed. Please use your college/university email.' };
      }

      // Expire any existing OTPs for this user with USER_VERIFICATION purpose
      await dbService.executeQuery(
        `UPDATE EmailVerificationOTPs SET IsUsed = 1 
         WHERE UserID = @param0 AND Purpose = 'USER_VERIFICATION' AND IsUsed = 0`,
        [userId]
      );

      // Generate and store OTP
      const otpCode = generateOTP();
      const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
      const encryptedEmail = encrypt(collegeEmail);

      await dbService.executeQuery(
        `INSERT INTO EmailVerificationOTPs (UserID, WorkExperienceID, Email, OTPCode, Purpose, ExpiresAt)
         VALUES (@param0, NULL, @param1, @param2, 'USER_VERIFICATION', @param3)`,
        [userId, encryptedEmail, otpCode, expiresAt.toISOString()]
      );

      // Send OTP email
      await EmailService.send({
        to: collegeEmail,
        subject: 'RefOpen - Verify Your College Email',
        html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
          <h2 style="color: #1a1a1a; margin-bottom: 8px;">Verify Your College Email</h2>
          <p style="color: #666; font-size: 15px; margin-bottom: 24px;">
            Use the code below to verify your college email and get your verified badge on RefOpen.
          </p>
          <div style="background: linear-gradient(135deg, #2563EB, #7C3AED); border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
            <p style="color: rgba(255,255,255,0.8); font-size: 13px; margin: 0 0 8px 0;">Your verification code</p>
            <h1 style="color: #fff; font-size: 36px; letter-spacing: 8px; margin: 0;">${otpCode}</h1>
          </div>
          <p style="color: #999; font-size: 13px;">This code expires in ${OTP_EXPIRY_MINUTES} minutes. If you didn't request this, please ignore this email.</p>
        </div>
        `
      });

      // Also create/update the UserVerifications record
      const existing = await dbService.executeQuery(
        `SELECT VerificationID FROM UserVerifications 
         WHERE UserID = @param0 AND Method = 'CollegeEmail' AND Status != 'Approved'`,
        [userId]
      );

      if (existing.recordset.length > 0) {
        await dbService.executeQuery(
          `UPDATE UserVerifications 
           SET CollegeEmail = @param1, CollegeName = @param2, Status = 'Pending', CollegeEmailVerified = 0, UpdatedAt = GETUTCDATE()
           WHERE VerificationID = @param0`,
          [existing.recordset[0].VerificationID, encryptedEmail, collegeName]
        );
      } else {
        await dbService.executeQuery(
          `INSERT INTO UserVerifications (UserID, Method, CollegeEmail, CollegeName)
           VALUES (@param0, 'CollegeEmail', @param1, @param2)`,
          [userId, encryptedEmail, collegeName]
        );
      }

      return {
        success: true,
        message: 'OTP sent successfully',
        data: { email: maskEmail(collegeEmail) }
      };
    } catch (error: any) {
      console.error('Error sending college email OTP:', error);
      return { success: false, error: 'Failed to send OTP' };
    }
  }

  /**
   * Verify college email OTP
   */
  static async verifyCollegeEmailOTP(userId: string, otpCode: string): Promise<any> {
    try {
      // Find the latest unused OTP for this user
      const result = await dbService.executeQuery(
        `SELECT TOP 1 OTPID, OTPCode, Email, ExpiresAt, AttemptCount, MaxAttempts
         FROM EmailVerificationOTPs
         WHERE UserID = @param0 AND Purpose = 'USER_VERIFICATION' AND IsUsed = 0
         ORDER BY CreatedAt DESC`,
        [userId]
      );

      if (result.recordset.length === 0) {
        return { success: false, error: 'No pending OTP found. Please request a new one.' };
      }

      const otp = result.recordset[0];

      // Check expiry
      if (new Date(otp.ExpiresAt) < new Date()) {
        return { success: false, error: 'OTP has expired. Please request a new one.' };
      }

      // Check attempts
      if (otp.AttemptCount >= otp.MaxAttempts) {
        return { success: false, error: 'Too many attempts. Please request a new OTP.' };
      }

      // Increment attempt count
      await dbService.executeQuery(
        `UPDATE EmailVerificationOTPs SET AttemptCount = AttemptCount + 1 WHERE OTPID = @param0`,
        [otp.OTPID]
      );

      // Verify OTP
      if (otp.OTPCode !== otpCode) {
        const remaining = otp.MaxAttempts - otp.AttemptCount - 1;
        return { success: false, error: `Invalid OTP. ${remaining} attempt(s) remaining.` };
      }

      // Mark OTP as used
      await dbService.executeQuery(
        `UPDATE EmailVerificationOTPs SET IsUsed = 1, UsedAt = GETUTCDATE() WHERE OTPID = @param0`,
        [otp.OTPID]
      );

      // Update UserVerifications
      await dbService.executeQuery(
        `UPDATE UserVerifications 
         SET CollegeEmailVerified = 1, Status = 'Approved', UpdatedAt = GETUTCDATE()
         WHERE UserID = @param0 AND Method = 'CollegeEmail' AND Status = 'Pending'`,
        [userId]
      );

      // Set IsVerifiedUser = 1 (permanent blue tick)
      await dbService.executeQuery(
        `UPDATE Users SET IsVerifiedUser = 1, UpdatedAt = GETUTCDATE() WHERE UserID = @param0`,
        [userId]
      );

      return {
        success: true,
        message: 'College email verified successfully! You are now a verified user.',
        data: { isVerifiedUser: true }
      };
    } catch (error: any) {
      console.error('Error verifying college email OTP:', error);
      return { success: false, error: 'Verification failed' };
    }
  }

  /**
   * Submit Aadhaar verification (requires admin approval)
   */
  static async submitAadhaarVerification(userId: string, aadhaarPhotoURL: string, selfiePhotoURL: string): Promise<any> {
    try {
      if (!aadhaarPhotoURL || !selfiePhotoURL) {
        return { success: false, error: 'Both Aadhaar card photo and selfie are required' };
      }

      // Check for existing pending submission
      const existing = await dbService.executeQuery(
        `SELECT VerificationID, Status FROM UserVerifications 
         WHERE UserID = @param0 AND Method = 'Aadhaar' AND Status = 'Pending'`,
        [userId]
      );

      if (existing.recordset.length > 0) {
        return { success: false, error: 'You already have a pending Aadhaar verification. Please wait for admin review.' };
      }

      // Check if already verified via Aadhaar
      const alreadyVerified = await dbService.executeQuery(
        `SELECT VerificationID FROM UserVerifications 
         WHERE UserID = @param0 AND Method = 'Aadhaar' AND Status = 'Approved'`,
        [userId]
      );

      if (alreadyVerified.recordset.length > 0) {
        return { success: false, error: 'You are already verified via Aadhaar.' };
      }

      // Create verification submission
      await dbService.executeQuery(
        `INSERT INTO UserVerifications (UserID, Method, AadhaarPhotoURL, SelfiePhotoURL, Status)
         VALUES (@param0, 'Aadhaar', @param1, @param2, 'Pending')`,
        [userId, aadhaarPhotoURL, selfiePhotoURL]
      );

      return {
        success: true,
        message: 'Aadhaar verification submitted successfully. Our team will review it within 24-48 hours.'
      };
    } catch (error: any) {
      console.error('Error submitting Aadhaar verification:', error);
      return { success: false, error: 'Failed to submit verification' };
    }
  }

  /**
   * Get user's verification status across all methods
   */
  static async getVerificationStatus(userId: string): Promise<any> {
    try {
      const result = await dbService.executeQuery(
        `SELECT VerificationID, Method, Status, CollegeName, CollegeEmailVerified,
                RejectionReason, CreatedAt, UpdatedAt
         FROM UserVerifications
         WHERE UserID = @param0
         ORDER BY CreatedAt DESC`,
        [userId]
      );

      const isVerifiedUser = await dbService.executeQuery(
        `SELECT IsVerifiedUser FROM Users WHERE UserID = @param0`,
        [userId]
      );

      return {
        success: true,
        data: {
          isVerifiedUser: isVerifiedUser.recordset[0]?.IsVerifiedUser || false,
          verifications: result.recordset
        }
      };
    } catch (error: any) {
      console.error('Error getting verification status:', error);
      return { success: false, error: 'Failed to get verification status' };
    }
  }

  /**
   * Admin: Get all pending verifications
   */
  static async getPendingVerifications(): Promise<any> {
    try {
      const result = await dbService.executeQuery(`
        SELECT v.VerificationID, v.UserID, v.Method, v.Status, 
               v.CollegeName, v.AadhaarPhotoURL, v.SelfiePhotoURL,
               v.RejectionReason, v.CreatedAt, v.UpdatedAt,
               u.FirstName, u.LastName, u.Email, u.Phone, u.ProfilePictureURL
        FROM UserVerifications v
        JOIN Users u ON v.UserID = u.UserID
        WHERE v.Status = 'Pending'
        ORDER BY v.CreatedAt ASC
      `);

      return {
        success: true,
        data: result.recordset
      };
    } catch (error: any) {
      console.error('Error getting pending verifications:', error);
      return { success: false, error: 'Failed to get pending verifications' };
    }
  }

  /**
   * Admin: Approve Aadhaar verification
   */
  static async approveVerification(verificationId: string, adminUserId: string): Promise<any> {
    try {
      const verification = await dbService.executeQuery(
        `SELECT VerificationID, UserID, Method, Status FROM UserVerifications WHERE VerificationID = @param0`,
        [verificationId]
      );

      if (verification.recordset.length === 0) {
        return { success: false, error: 'Verification not found' };
      }

      const v = verification.recordset[0];
      if (v.Status !== 'Pending') {
        return { success: false, error: `Verification is already ${v.Status}` };
      }

      // Approve the verification
      await dbService.executeQuery(
        `UPDATE UserVerifications 
         SET Status = 'Approved', ReviewedBy = @param1, ReviewedAt = GETUTCDATE(), UpdatedAt = GETUTCDATE()
         WHERE VerificationID = @param0`,
        [verificationId, adminUserId]
      );

      // Set IsVerifiedUser = 1 (permanent blue tick)
      await dbService.executeQuery(
        `UPDATE Users SET IsVerifiedUser = 1, UpdatedAt = GETUTCDATE() WHERE UserID = @param0`,
        [v.UserID]
      );

      return { success: true, message: 'Verification approved. User now has blue tick.' };
    } catch (error: any) {
      console.error('Error approving verification:', error);
      return { success: false, error: 'Failed to approve verification' };
    }
  }

  /**
   * Admin: Reject Aadhaar verification
   */
  static async rejectVerification(verificationId: string, adminUserId: string, reason: string): Promise<any> {
    try {
      const verification = await dbService.executeQuery(
        `SELECT VerificationID, UserID, Status FROM UserVerifications WHERE VerificationID = @param0`,
        [verificationId]
      );

      if (verification.recordset.length === 0) {
        return { success: false, error: 'Verification not found' };
      }

      if (verification.recordset[0].Status !== 'Pending') {
        return { success: false, error: `Verification is already ${verification.recordset[0].Status}` };
      }

      await dbService.executeQuery(
        `UPDATE UserVerifications 
         SET Status = 'Rejected', ReviewedBy = @param1, ReviewedAt = GETUTCDATE(), 
             RejectionReason = @param2, UpdatedAt = GETUTCDATE()
         WHERE VerificationID = @param0`,
        [verificationId, adminUserId, reason]
      );

      return { success: true, message: 'Verification rejected.' };
    } catch (error: any) {
      console.error('Error rejecting verification:', error);
      return { success: false, error: 'Failed to reject verification' };
    }
  }
}
