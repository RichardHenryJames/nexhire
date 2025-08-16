import { dbService } from '../services/database.service';
import { AuthService } from '../services/auth.service';
import { User, UserRegistrationRequest, UserLoginRequest } from '../types';
import { 
    ValidationError, 
    NotFoundError, 
    ConflictError,
    validateRequest,
    userRegistrationSchema,
    userLoginSchema
} from '../utils/validation';
import { appConstants } from '../config';

export class UserService {
    // Register new user
    static async register(userData: any): Promise<User> {
        const validatedData = validateRequest<UserRegistrationRequest>(userRegistrationSchema, userData);
        
        // Check if user already exists
        const existingUser = await this.findByEmail(validatedData.email);
        if (existingUser) {
            throw new ConflictError('User with this email already exists');
        }

        // Hash password
        const hashedPassword = await AuthService.hashPassword(validatedData.password);
        
        // Generate user ID
        const userId = AuthService.generateUniqueId();
        
        // Insert user into database
        const query = `
            INSERT INTO Users (
                UserID, Email, Password, UserType, FirstName, LastName, 
                Phone, DateOfBirth, Gender, EmailVerified, PhoneVerified,
                ProfileVisibility, CreatedAt, UpdatedAt, IsActive, 
                TwoFactorEnabled, LoginAttempts
            ) VALUES (
                @param0, @param1, @param2, @param3, @param4, @param5,
                @param6, @param7, @param8, 0, 0,
                'Public', GETUTCDATE(), GETUTCDATE(), 1,
                0, 0
            );
            
            SELECT * FROM Users WHERE UserID = @param0;
        `;

        const parameters = [
            userId,
            validatedData.email,
            hashedPassword,
            validatedData.userType,
            validatedData.firstName,
            validatedData.lastName,
            validatedData.phone || null,
            validatedData.dateOfBirth || null,
            validatedData.gender || null
        ];

        const result = await dbService.executeQuery<User>(query, parameters);
        
        if (!result.recordset || result.recordset.length === 0) {
            throw new Error('Failed to create user');
        }

        const user = result.recordset[0];
        
        // Create applicant profile if user is a job seeker
        if (validatedData.userType === appConstants.userTypes.JOB_SEEKER) {
            await this.createApplicantProfile(userId);
        }

        return user;
    }

    // Login user
    static async login(loginData: any): Promise<{ user: Omit<User, 'Password'>; tokens: any }> {
        const validatedData = validateRequest<UserLoginRequest>(userLoginSchema, loginData);
        
        // Find user by email
        const user = await this.findByEmail(validatedData.email);
        if (!user) {
            throw new NotFoundError('Invalid email or password');
        }

        // Check if account is active
        if (!user.IsActive) {
            throw new ValidationError('Account is deactivated');
        }

        // Check account lockout
        if (user.AccountLockoutEnd && new Date(user.AccountLockoutEnd) > new Date()) {
            throw new ValidationError('Account is temporarily locked');
        }

        // Verify password
        const isPasswordValid = await AuthService.verifyPassword(validatedData.password, user.Password);
        if (!isPasswordValid) {
            await this.incrementLoginAttempts(user.UserID);
            throw new NotFoundError('Invalid email or password');
        }

        // Reset login attempts and update last login
        await this.updateLastLogin(user.UserID);

        // Generate tokens
        const tokens = AuthService.generateAuthTokens(user);

        // Remove password from response
        const { Password, ...userWithoutPassword } = user;

        return {
            user: userWithoutPassword,
            tokens
        };
    }

    // Find user by email
    static async findByEmail(email: string): Promise<User | null> {
        const query = 'SELECT * FROM Users WHERE Email = @param0 AND IsActive = 1';
        const result = await dbService.executeQuery<User>(query, [email]);
        
        return result.recordset && result.recordset.length > 0 ? result.recordset[0] : null;
    }

    // Find user by ID
    static async findById(userId: string): Promise<User | null> {
        const query = 'SELECT * FROM Users WHERE UserID = @param0 AND IsActive = 1';
        const result = await dbService.executeQuery<User>(query, [userId]);
        
        return result.recordset && result.recordset.length > 0 ? result.recordset[0] : null;
    }

    // Update user profile - FIXED: Handle camelCase to PascalCase mapping
    static async updateProfile(userId: string, updateData: any): Promise<User> {
        const user = await this.findById(userId);
        if (!user) {
            throw new NotFoundError('User not found');
        }

        // Map camelCase API fields to PascalCase database fields
        const fieldMapping: { [key: string]: string } = {
            'firstName': 'FirstName',
            'lastName': 'LastName',
            'phone': 'Phone',
            'dateOfBirth': 'DateOfBirth',
            'gender': 'Gender',
            'profilePictureURL': 'ProfilePictureURL',
            'profileVisibility': 'ProfileVisibility',
            'FirstName': 'FirstName',  // Also allow direct database field names
            'LastName': 'LastName',
            'Phone': 'Phone',
            'DateOfBirth': 'DateOfBirth',
            'Gender': 'Gender',
            'ProfilePictureURL': 'ProfilePictureURL',
            'ProfileVisibility': 'ProfileVisibility'
        };

        const allowedFields = Object.values(fieldMapping);

        // Map input fields and filter valid ones
        const mappedUpdateData: { [key: string]: any } = {};
        Object.keys(updateData).forEach(key => {
            const mappedKey = fieldMapping[key];
            if (mappedKey && allowedFields.includes(mappedKey)) {
                mappedUpdateData[mappedKey] = updateData[key];
            }
        });

        if (Object.keys(mappedUpdateData).length === 0) {
            throw new ValidationError('No valid fields to update. Valid fields are: firstName, lastName, phone, dateOfBirth, gender, profilePictureURL, profileVisibility');
        }

        const updateFields = Object.keys(mappedUpdateData)
            .map((key, index) => `${key} = @param${index + 1}`)
            .join(', ');

        const values = Object.values(mappedUpdateData);

        const query = `
            UPDATE Users 
            SET ${updateFields}, UpdatedAt = GETUTCDATE()
            WHERE UserID = @param0;
            
            SELECT * FROM Users WHERE UserID = @param0;
        `;

        const parameters = [userId, ...values];
        const result = await dbService.executeQuery<User>(query, parameters);

        if (!result.recordset || result.recordset.length === 0) {
            throw new Error('Failed to update user profile');
        }

        return result.recordset[0];
    }

    // Change password
    static async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
        const user = await this.findById(userId);
        if (!user) {
            throw new NotFoundError('User not found');
        }

        // Verify current password
        const isCurrentPasswordValid = await AuthService.verifyPassword(currentPassword, user.Password);
        if (!isCurrentPasswordValid) {
            throw new ValidationError('Current password is incorrect');
        }

        // Hash new password
        const hashedNewPassword = await AuthService.hashPassword(newPassword);

        // Update password
        const query = `
            UPDATE Users 
            SET Password = @param1, UpdatedAt = GETUTCDATE()
            WHERE UserID = @param0
        `;

        await dbService.executeQuery(query, [userId, hashedNewPassword]);
    }

    // Verify email
    static async verifyEmail(userId: string): Promise<void> {
        const query = `
            UPDATE Users 
            SET EmailVerified = 1, UpdatedAt = GETUTCDATE()
            WHERE UserID = @param0
        `;

        await dbService.executeQuery(query, [userId]);
    }

    // Deactivate user account
    static async deactivateAccount(userId: string): Promise<void> {
        const query = `
            UPDATE Users 
            SET IsActive = 0, UpdatedAt = GETUTCDATE()
            WHERE UserID = @param0
        `;

        await dbService.executeQuery(query, [userId]);
    }

    // Get user dashboard stats
    static async getDashboardStats(userId: string): Promise<any> {
        const user = await this.findById(userId);
        if (!user) {
            throw new NotFoundError('User not found');
        }

        if (user.UserType === appConstants.userTypes.JOB_SEEKER) {
            return await this.getJobSeekerStats(userId);
        } else if (user.UserType === appConstants.userTypes.EMPLOYER) {
            return await this.getEmployerStats(userId);
        }

        return {};
    }

    // Private helper methods
    private static async createApplicantProfile(userId: string): Promise<void> {
        const applicantId = AuthService.generateUniqueId();
        
        const query = `
            INSERT INTO Applicants (
                ApplicantID, UserID, ProfileCompleteness, IsOpenToWork,
                AllowRecruitersToContact, HideCurrentCompany, HideSalaryDetails,
                ImmediatelyAvailable, WillingToRelocate, IsFeatured
            ) VALUES (
                @param0, @param1, 10, 1, 1, 0, 0, 0, 0, 0
            )
        `;

        await dbService.executeQuery(query, [applicantId, userId]);
    }

    private static async incrementLoginAttempts(userId: string): Promise<void> {
        const query = `
            UPDATE Users 
            SET LoginAttempts = LoginAttempts + 1,
                AccountLockoutEnd = CASE 
                    WHEN LoginAttempts >= 4 THEN DATEADD(MINUTE, 30, GETUTCDATE())
                    ELSE AccountLockoutEnd
                END
            WHERE UserID = @param0
        `;

        await dbService.executeQuery(query, [userId]);
    }

    private static async updateLastLogin(userId: string): Promise<void> {
        const query = `
            UPDATE Users 
            SET LastLoginAt = GETUTCDATE(), 
                LastActive = GETUTCDATE(),
                LoginAttempts = 0,
                AccountLockoutEnd = NULL
            WHERE UserID = @param0
        `;

        await dbService.executeQuery(query, [userId]);
    }

    private static async getJobSeekerStats(userId: string): Promise<any> {
        const query = `
            SELECT 
                (SELECT COUNT(*) FROM JobApplications ja 
                 INNER JOIN Applicants a ON ja.ApplicantID = a.ApplicantID 
                 WHERE a.UserID = @param0) as TotalApplications,
                (SELECT COUNT(*) FROM JobApplications ja 
                 INNER JOIN Applicants a ON ja.ApplicantID = a.ApplicantID 
                 WHERE a.UserID = @param0 AND ja.StatusID = 3) as ShortlistedApplications,
                (SELECT COUNT(*) FROM JobApplications ja 
                 INNER JOIN Applicants a ON ja.ApplicantID = a.ApplicantID 
                 WHERE a.UserID = @param0 AND ja.StatusID IN (4, 5)) as InterviewsScheduled,
                (SELECT ProfileCompleteness FROM Applicants WHERE UserID = @param0) as ProfileCompleteness
        `;

        const result = await dbService.executeQuery(query, [userId]);
        return result.recordset[0] || {};
    }

    private static async getEmployerStats(userId: string): Promise<any> {
        const query = `
            SELECT 
                (SELECT COUNT(*) FROM Jobs WHERE PostedByUserID = @param0) as TotalJobsPosted,
                (SELECT COUNT(*) FROM Jobs WHERE PostedByUserID = @param0 AND Status = 'Published') as ActiveJobs,
                (SELECT COUNT(*) FROM JobApplications ja 
                 INNER JOIN Jobs j ON ja.JobID = j.JobID 
                 WHERE j.PostedByUserID = @param0) as TotalApplicationsReceived,
                (SELECT COUNT(*) FROM JobApplications ja 
                 INNER JOIN Jobs j ON ja.JobID = j.JobID 
                 WHERE j.PostedByUserID = @param0 AND ja.StatusID = 1) as PendingApplications
        `;

        const result = await dbService.executeQuery(query, [userId]);
        return result.recordset[0] || {};
    }
}