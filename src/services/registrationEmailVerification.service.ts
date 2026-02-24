import { dbService } from './database.service';
import { EmailService } from './emailService';

/**
 * Registration Email Verification Service
 * 
 * Handles email OTP verification during user registration (pre-auth, anonymous).
 * Unlike company email verification, this does NOT require a JWT token.
 * 
 * Flow:
 * 1. User enters email on registration form
 * 2. Clicks "Verify Email" → POST /auth/email/send-otp (anonymous)
 * 3. System generates 4-digit OTP, stores in EmailVerificationOTPs table, sends email
 * 4. User enters OTP → POST /auth/email/verify-otp (anonymous)
 * 5. System verifies OTP, returns verificationId (OTPID)
 * 6. Frontend stores verificationId, sends it with registration payload
 * 7. Backend registration: checks verificationId matches email → sets EmailVerified = 1
 */

// Generate a random 4-digit OTP
const generateOTP = (): string => {
  return Math.floor(1000 + Math.random() * 9000).toString();
};

// OTP expiry time in minutes
const OTP_EXPIRY_MINUTES = 10;
const MAX_OTP_ATTEMPTS = 3;

// Shared email footer
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

export interface RegistrationOTPResult {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
}

/**
 * Send OTP to email for registration verification (anonymous - no JWT)
 */
export const sendRegistrationEmailOTP = async (email: string): Promise<RegistrationOTPResult> => {
  try {
    const normalizedEmail = email.trim().toLowerCase();

    // 1. Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return { success: false, message: 'Invalid email format', error: 'INVALID_EMAIL' };
    }

    // 2. Check if email is already registered
    const existingUser = await dbService.executeQuery(
      `SELECT TOP 1 UserID FROM Users WHERE Email = @param0 AND IsActive = 1`,
      [normalizedEmail]
    );
    if (existingUser.recordset.length > 0) {
      return {
        success: false,
        message: 'An account with this email already exists. Please sign in instead.',
        error: 'EMAIL_ALREADY_REGISTERED'
      };
    }

    // 3. Check for recent OTP (rate limiting - 1 minute cooldown)
    const recentOTP = await dbService.executeQuery(`
      SELECT TOP 1 OTPID, CreatedAt
      FROM EmailVerificationOTPs
      WHERE Email = @param0
        AND Purpose = 'REGISTRATION_EMAIL_VERIFICATION'
        AND IsUsed = 0
        AND ExpiresAt > GETUTCDATE()
      ORDER BY CreatedAt DESC
    `, [normalizedEmail]);

    if (recentOTP.recordset.length > 0) {
      const createdAt = new Date(recentOTP.recordset[0].CreatedAt);
      const now = new Date();
      const secondsSince = (now.getTime() - createdAt.getTime()) / 1000;
      if (secondsSince < 60) {
        return {
          success: false,
          message: `Please wait ${Math.ceil(60 - secondsSince)} seconds before requesting a new code`,
          error: 'OTP_COOLDOWN'
        };
      }
    }

    // 4. Generate OTP
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    // 5. Invalidate any existing OTPs for this email
    await dbService.executeQuery(`
      UPDATE EmailVerificationOTPs
      SET IsUsed = 1
      WHERE Email = @param0
        AND Purpose = 'REGISTRATION_EMAIL_VERIFICATION'
        AND IsUsed = 0
    `, [normalizedEmail]);

    // 6. Store new OTP (no UserID since user doesn't exist yet, WorkExperienceID = NULL)
    await dbService.executeQuery(`
      INSERT INTO EmailVerificationOTPs 
      (UserID, WorkExperienceID, Email, OTPCode, ExpiresAt, Purpose)
      VALUES 
      (NULL, NULL, @param0, @param1, @param2, 'REGISTRATION_EMAIL_VERIFICATION')
    `, [normalizedEmail, otp, expiresAt]);

    // 7. Send OTP email
    const emailResult = await EmailService.send({
      to: normalizedEmail,
      subject: 'RefOpen - Verify Your Email Address',
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
                            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600; letter-spacing: -0.5px;">Verify Your Email</h1>
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td style="padding: 40px;">
                            <p style="color: #1a1a1a; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                                Welcome to RefOpen!
                            </p>
                            <p style="color: #4a4a4a; font-size: 15px; line-height: 1.7; margin: 0 0 24px 0;">
                                Please use the verification code below to confirm your email address and complete your registration.
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
                                If you didn't request this, please ignore this email.
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
      console.error('Failed to send registration OTP email:', emailResult.error);
      return { success: false, message: 'Failed to send verification email. Please try again.', error: 'EMAIL_SEND_FAILED' };
    }

    return {
      success: true,
      message: `Verification code sent to ${normalizedEmail}. Please check your inbox.`,
      data: { expiresInMinutes: OTP_EXPIRY_MINUTES }
    };

  } catch (error: any) {
    console.error('Error sending registration email OTP:', error);
    return { success: false, message: 'An error occurred while sending verification code', error: error.message };
  }
};

/**
 * Verify OTP for registration email (anonymous - no JWT)
 * Returns verificationId (OTPID) on success for use during registration
 */
export const verifyRegistrationEmailOTP = async (email: string, otp: string): Promise<RegistrationOTPResult> => {
  try {
    const normalizedEmail = email.trim().toLowerCase();

    // 1. Find the OTP record
    const otpResult = await dbService.executeQuery(`
      SELECT TOP 1 
        OTPID, OTPCode, Email, ExpiresAt, IsUsed, AttemptCount, MaxAttempts
      FROM EmailVerificationOTPs
      WHERE Email = @param0
        AND Purpose = 'REGISTRATION_EMAIL_VERIFICATION'
        AND IsUsed = 0
      ORDER BY CreatedAt DESC
    `, [normalizedEmail]);

    if (otpResult.recordset.length === 0) {
      return { success: false, message: 'No pending verification found. Please request a new code.', error: 'NO_PENDING_OTP' };
    }

    const otpRecord = otpResult.recordset[0];

    // 2. Check if OTP is expired
    if (new Date(otpRecord.ExpiresAt) < new Date()) {
      return { success: false, message: 'Verification code has expired. Please request a new one.', error: 'OTP_EXPIRED' };
    }

    // 3. Check attempt count
    if (otpRecord.AttemptCount >= otpRecord.MaxAttempts) {
      await dbService.executeQuery(`UPDATE EmailVerificationOTPs SET IsUsed = 1 WHERE OTPID = @param0`, [otpRecord.OTPID]);
      return { success: false, message: 'Too many failed attempts. Please request a new code.', error: 'MAX_ATTEMPTS_EXCEEDED' };
    }

    // 4. Verify OTP
    if (otpRecord.OTPCode !== otp) {
      await dbService.executeQuery(`UPDATE EmailVerificationOTPs SET AttemptCount = AttemptCount + 1 WHERE OTPID = @param0`, [otpRecord.OTPID]);
      const remaining = otpRecord.MaxAttempts - otpRecord.AttemptCount - 1;
      return { success: false, message: `Invalid code. ${remaining} attempt(s) remaining.`, error: 'INVALID_OTP', data: { remainingAttempts: remaining } };
    }

    // 5. OTP correct! Mark as used
    await dbService.executeQuery(`
      UPDATE EmailVerificationOTPs
      SET IsUsed = 1, UsedAt = GETUTCDATE()
      WHERE OTPID = @param0
    `, [otpRecord.OTPID]);

    return {
      success: true,
      message: 'Email verified successfully!',
      data: { verificationId: otpRecord.OTPID }
    };

  } catch (error: any) {
    console.error('Error verifying registration email OTP:', error);
    return { success: false, message: 'An error occurred while verifying code', error: error.message };
  }
};

/**
 * Validate a verificationId during registration
 * Called by user.service.ts during register() to confirm email was verified
 */
export const validateEmailVerification = async (email: string, verificationId: string): Promise<boolean> => {
  try {
    const normalizedEmail = email.trim().toLowerCase();
    const result = await dbService.executeQuery(`
      SELECT TOP 1 OTPID
      FROM EmailVerificationOTPs
      WHERE OTPID = @param0
        AND Email = @param1
        AND Purpose = 'REGISTRATION_EMAIL_VERIFICATION'
        AND IsUsed = 1
        AND UsedAt IS NOT NULL
    `, [verificationId, normalizedEmail]);

    return result.recordset.length > 0;
  } catch (error: any) {
    console.error('Error validating email verification:', error);
    return false;
  }
};

export const registrationEmailVerificationService = {
  sendOTP: sendRegistrationEmailOTP,
  verifyOTP: verifyRegistrationEmailOTP,
  validate: validateEmailVerification
};

export default registrationEmailVerificationService;
