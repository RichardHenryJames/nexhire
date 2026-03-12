/**
 * User Repository — Single source of truth for User & Applicant DB queries.
 *
 * WHY THIS EXISTS:
 *  - `SELECT ApplicantID FROM Applicants WHERE UserID = ?` was copy-pasted 15+ times
 *  - `SELECT * FROM Users WHERE UserID = ?` returned password hashes to callers that didn't need them
 *  - No single place to add caching for hot-path lookups
 *
 * RULES:
 *  1. Controllers and services should NEVER write raw User/Applicant SQL — use this repository.
 *  2. Methods that return user data for the frontend use SAFE_COLUMNS (no Password).
 *  3. Methods that need password (login, changePassword) use AUTH_COLUMNS.
 */

import { dbService } from '../services/database.service';
import { User } from '../types';
import { NotFoundError } from '../utils/validation';

// ── Column sets ─────────────────────────────────────────────────

/** All columns EXCEPT sensitive tokens — safe to return to frontend */
const USER_SAFE_COLUMNS = `
    UserID, Email, UserType, FirstName, LastName, Phone,
    ProfilePictureURL, DateOfBirth, Gender, EmailVerified, PhoneVerified,
    LastLoginAt, LastActive, ProfileVisibility, CreatedAt, UpdatedAt,
    IsActive, TwoFactorEnabled, LoginAttempts,
    IsVerifiedReferrer, IsVerifiedUser, GoogleId, LoginMethod, ReferredBy, WalletBonusGiven,
    TermsAcceptedAt, TermsVersion, PrivacyPolicyAcceptedAt, PrivacyPolicyVersion
`.replace(/\n/g, ' ');

/** Includes Password + AccountLockoutEnd — only for auth flows */
const USER_AUTH_COLUMNS = `
    UserID, Email, Password, UserType, FirstName, LastName, Phone,
    ProfilePictureURL, DateOfBirth, Gender, EmailVerified, PhoneVerified,
    LastLoginAt, LastActive, ProfileVisibility, CreatedAt, UpdatedAt,
    IsActive, TwoFactorEnabled, LoginAttempts, AccountLockoutEnd,
    IsVerifiedReferrer, IsVerifiedUser, GoogleId, LoginMethod, ReferredBy, WalletBonusGiven,
    TermsAcceptedAt, TermsVersion, PrivacyPolicyAcceptedAt, PrivacyPolicyVersion
`.replace(/\n/g, ' ');

/** Columns returned after INSERT (no password — it was just created) */
const USER_INSERT_RETURN_COLUMNS = USER_SAFE_COLUMNS;

// ── Repository ──────────────────────────────────────────────────

export class UserRepository {

    // ── User lookups ────────────────────────────────────────────

    /**
     * Find user by email — includes Password for login verification.
     */
    static async findByEmail(email: string): Promise<User | null> {
        const query = `SELECT ${USER_AUTH_COLUMNS} FROM Users WHERE Email = @param0 AND IsActive = 1`;
        const result = await dbService.executeQuery<User>(query, [email]);
        return result.recordset?.[0] ?? null;
    }

    /**
     * Find user by ID — includes Password (needed for changePassword, etc.).
     * If you only need safe fields, call `findByIdSafe()`.
     */
    static async findById(userId: string): Promise<User | null> {
        const query = `SELECT ${USER_AUTH_COLUMNS} FROM Users WHERE UserID = @param0 AND IsActive = 1`;
        const result = await dbService.executeQuery<User>(query, [userId]);
        return result.recordset?.[0] ?? null;
    }

    /**
     * Find user by ID — safe columns only (no password, no tokens).
     * Use this when returning user data to frontend.
     */
    static async findByIdSafe(userId: string): Promise<Omit<User, 'Password'> | null> {
        const query = `SELECT ${USER_SAFE_COLUMNS} FROM Users WHERE UserID = @param0 AND IsActive = 1`;
        const result = await dbService.executeQuery(query, [userId]);
        return result.recordset?.[0] ?? null;
    }

    /**
     * Check if a user exists (without fetching all columns).
     */
    static async exists(userId: string): Promise<boolean> {
        const result = await dbService.executeQuery(
            'SELECT TOP 1 1 AS E FROM Users WHERE UserID = @param0 AND IsActive = 1',
            [userId]
        );
        return (result.recordset?.length ?? 0) > 0;
    }

    /**
     * Get the column-set constant for INSERT...SELECT after creating a user.
     * Used by register() and googleRegister().
     */
    static get INSERT_RETURN_COLUMNS(): string {
        return USER_INSERT_RETURN_COLUMNS;
    }

    /** Expose safe columns for UPDATE...SELECT patterns */
    static get SAFE_COLUMNS(): string {
        return USER_SAFE_COLUMNS;
    }

    /** Expose auth columns for internal use */
    static get AUTH_COLUMNS(): string {
        return USER_AUTH_COLUMNS;
    }

    // ── Applicant lookups (the #1 most repeated query in the codebase) ──

    /**
     * Get ApplicantID for a given UserID.
     * Returns null if no applicant profile exists.
     *
     * This replaces the 15+ copy-pasted instances of:
     *   `SELECT ApplicantID FROM Applicants WHERE UserID = @param0`
     */
    static async getApplicantId(userId: string): Promise<string | null> {
        const result = await dbService.executeQuery(
            'SELECT ApplicantID FROM Applicants WHERE UserID = @param0',
            [userId]
        );
        return result.recordset?.[0]?.ApplicantID ?? null;
    }

    /**
     * Get ApplicantID — throws NotFoundError if not found.
     * Convenience wrapper for endpoints that require an applicant profile.
     */
    static async requireApplicantId(userId: string): Promise<string> {
        const applicantId = await this.getApplicantId(userId);
        if (!applicantId) {
            throw new NotFoundError('Applicant profile not found');
        }
        return applicantId;
    }

    /**
     * Get or create an applicant profile (used by saved-jobs, job-application, etc.).
     * Returns the ApplicantID.
     */
    static async ensureApplicantId(userId: string): Promise<string> {
        const existing = await this.getApplicantId(userId);
        if (existing) return existing;

        // Lazy import to avoid circular dependency
        const { AuthService } = await import('../services/auth.service');
        const applicantId = AuthService.generateUniqueId();
        await dbService.executeQuery(`
            INSERT INTO Applicants (
                ApplicantID, UserID, ProfileCompleteness, IsOpenToWork,
                AllowRecruitersToContact, HideCurrentCompany, HideSalaryDetails,
                ImmediatelyAvailable, WillingToRelocate, IsFeatured, OpenToRefer,
                CreatedAt, UpdatedAt
            ) VALUES (
                @param0, @param1, 10, 1, 1, 0, 0, 0, 0, 0, 1,
                GETUTCDATE(), GETUTCDATE()
            )
        `, [applicantId, userId]);
        return applicantId;
    }
}
