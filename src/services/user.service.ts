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
    // FIXED: Register new user with organization creation for employers (now fully transactional)
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
        
        // Start transaction for user and organization/applicant creation
        const tx = await dbService.beginTransaction();
        try {
            // Insert user into database
            const userQuery = `
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

            const userParameters = [
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

            const userResult = await dbService.executeTransactionQuery<User>(tx, userQuery, userParameters);
            
            if (!userResult.recordset || userResult.recordset.length === 0) {
                throw new Error('Failed to create user');
            }

            const user = userResult.recordset[0];
            
            // Create organization and employer profile if user is an employer
            if (validatedData.userType === appConstants.userTypes.EMPLOYER) {
                await this.createEmployerProfileWithOrganizationTx(tx, userId, validatedData);
            }
            // Create applicant profile if user is a job seeker
            else if (validatedData.userType === appConstants.userTypes.JOB_SEEKER) {
                await this.createApplicantProfileTx(tx, userId);
            }

            await tx.commit();
            return user;
        } catch (error) {
            try { await tx.rollback(); } catch {}
            console.error('Error during user registration (rolled back):', error);
            if (error instanceof ConflictError) throw error;
            throw new Error('Registration failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
        }
    }

    // FIXED: Create employer profile with organization during registration (transactional)
    private static async createEmployerProfileWithOrganizationTx(tx: any, userId: string, userData: any): Promise<{ organizationId: string; employerId: string }> {
        // Generate IDs
        const organizationId = AuthService.generateUniqueId();
        const employerId = AuthService.generateUniqueId();
        
        // Updated organization creation to match actual database schema
        const orgQuery = `
            INSERT INTO Organizations (
                OrganizationID, Name, Description, Industry, Size, Location, 
                Website, Type, EstablishedDate, CreatedAt, UpdatedAt
            ) VALUES (
                @param0, @param1, @param2, @param3, @param4, @param5,
                @param6, @param7, @param8, GETUTCDATE(), GETUTCDATE()
            )
        `;

        const orgParameters = [
            organizationId,
            userData.organizationName || `${userData.firstName} ${userData.lastName}'s Company`,
            userData.organizationDescription || `Organization for ${userData.firstName} ${userData.lastName}`,
            userData.organizationIndustry || 'Technology',
            userData.organizationSize || 'Small',
            userData.organizationLocation || 'Remote',
            userData.organizationWebsite || '',
            userData.organizationType || 'Company',
            userData.establishedDate || null
        ];

        await dbService.executeTransactionQuery(tx, orgQuery, orgParameters);
        
        // Employer profile creation
        const employerQuery = `
            INSERT INTO Employers (
                EmployerID, UserID, OrganizationID, CanPostJobs, CanViewApplications,
                CanScheduleInterviews, CanSendMessages, JoinedAt
            ) VALUES (
                @param0, @param1, @param2, 1, 1, 1, 1, GETUTCDATE()
            )
        `;

        await dbService.executeTransactionQuery(tx, employerQuery, [employerId, userId, organizationId]);
        
        console.log(`? (TX) Created organization ${organizationId} and employer profile ${employerId} for user ${userId}`);
        return { organizationId, employerId };
    }

    // Legacy non-transactional helper (kept for backward compatibility; prefer the TX version)
    private static async createEmployerProfileWithOrganization(userId: string, userData: any): Promise<{ organizationId: string; employerId: string }> {
        const tx = await dbService.beginTransaction();
        try {
            const res = await this.createEmployerProfileWithOrganizationTx(tx, userId, userData);
            await tx.commit();
            return res;
        } catch (error) {
            try { await tx.rollback(); } catch {}
            throw error;
        }
    }

    // Create applicant profile (transactional)
    private static async createApplicantProfileTx(tx: any, userId: string): Promise<void> {
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
        await dbService.executeTransactionQuery(tx, query, [applicantId, userId]);
    }

    // Legacy non-transactional applicant helper
    private static async createApplicantProfile(userId: string): Promise<void> {
        const tx = await dbService.beginTransaction();
        try {
            await this.createApplicantProfileTx(tx, userId);
            await tx.commit();
        } catch (error) {
            try { await tx.rollback(); } catch {}
            throw error;
        }
    }

    // NEW: Initialize employer profile for an existing authenticated user (transactional)
    static async initializeEmployerProfile(userId: string, data: any): Promise<{ organizationId: string; employerId: string }> {
        const user = await this.findById(userId);
        if (!user) {
            throw new NotFoundError('User not found');
        }

        // Prevent duplicate employer creation if already employer and record exists
        if (user.UserType === appConstants.userTypes.EMPLOYER) {
            const existing = await dbService.executeQuery(
                'SELECT EmployerID FROM Employers WHERE UserID = @param0',
                [userId]
            );
            if (existing.recordset && existing.recordset.length > 0) {
                throw new ConflictError('Employer profile already exists');
            }
        }

        const tx = await dbService.beginTransaction();
        try {
            // Upgrade user type to Employer if needed
            if (user.UserType !== appConstants.userTypes.EMPLOYER) {
                await dbService.executeTransactionQuery(tx,
                    `UPDATE Users SET UserType = 'Employer', UpdatedAt = GETUTCDATE() WHERE UserID = @param0`,
                    [userId]
                );
            }
            // Create org + employer under same transaction
            const result = await this.createEmployerProfileWithOrganizationTx(tx, userId, data);
            await tx.commit();
            return result;
        } catch (error) {
            try { await tx.rollback(); } catch {}
            throw error;
        }
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

    // Update applicant education data - FIXED: Now maps to ALL relevant Applicants table fields
    static async updateEducation(userId: string, educationData: any) {
        const user = await this.findById(userId);
        if (!user) {
            throw new NotFoundError('User not found');
        }
        // Ensure user is a job seeker
        if (user.UserType !== appConstants.userTypes.JOB_SEEKER) {
            throw new ValidationError('Only job seekers can update education data');
        }
        // Get applicant ID
        const applicantQuery = 'SELECT ApplicantID FROM Applicants WHERE UserID = @param0';
        const applicantResult = await dbService.executeQuery(applicantQuery, [userId]);
        if (!applicantResult.recordset || applicantResult.recordset.length === 0) {
            throw new NotFoundError('Applicant profile not found');
        }
        const applicantId = applicantResult.recordset[0].ApplicantID;
        
        // Build education JSON object from the frontend data
        const educationRecord = {
            college: educationData.college || null,
            customCollege: educationData.customCollege || '',
            degreeType: educationData.degreeType || '',
            fieldOfStudy: educationData.fieldOfStudy || '',
            yearInCollege: educationData.yearInCollege || '',
            selectedCountry: educationData.selectedCountry || 'India',
            updatedAt: new Date().toISOString()
        };

        // FIXED: Extract Institution name from college data
        const institutionName = educationData.college?.name || educationData.customCollege || null;
        
        // FIXED: Update the Applicants table with ALL education-related fields
        const updateQuery = `
            UPDATE Applicants 
            SET 
                HighestEducation = @param1,
                FieldOfStudy = @param2,
                Institution = @param3,
                Education = @param4,
                ProfileCompleteness = CASE 
                    WHEN ProfileCompleteness < 40 THEN 40 
                    ELSE ProfileCompleteness 
                END
            WHERE ApplicantID = @param0;
            
            -- Return updated applicant profile
            SELECT 
                a.*,
                u.FirstName,
                u.LastName,
                u.Email
            FROM Applicants a
            INNER JOIN Users u ON a.UserID = u.UserID
            WHERE a.ApplicantID = @param0;
        `;
        
        const parameters = [
            applicantId,
            educationData.degreeType || null, // HighestEducation
            educationData.fieldOfStudy || null, // FieldOfStudy
            institutionName, // Institution - FIXED: Now properly mapped
            JSON.stringify(educationRecord) // Education (complete JSON)
        ];
        
        const result = await dbService.executeQuery(updateQuery, parameters);
        if (!result.recordset || result.recordset.length === 0) {
            throw new Error('Failed to update education data');
        }
        console.log(`? Updated education data for user ${userId}:`, {
            institution: institutionName,
            college: educationData.college?.name || educationData.customCollege,
            degreeType: educationData.degreeType,
            fieldOfStudy: educationData.fieldOfStudy,
            country: educationData.selectedCountry
        });
        return result.recordset[0];
    }

    // NEW: Update job preferences and work types in Applicants table
    static async updateJobPreferences(userId: string, jobPreferencesData: any) {
        const user = await this.findById(userId);
        if (!user) {
            throw new NotFoundError('User not found');
        }
        // Ensure user is a job seeker
        if (user.UserType !== appConstants.userTypes.JOB_SEEKER) {
            throw new ValidationError('Only job seekers can update job preferences');
        }
        // Get applicant ID
        const applicantQuery = 'SELECT ApplicantID FROM Applicants WHERE UserID = @param0';
        const applicantResult = await dbService.executeQuery(applicantQuery, [userId]);
        if (!applicantResult.recordset || applicantResult.recordset.length === 0) {
            throw new NotFoundError('Applicant profile not found');
        }
        const applicantId = applicantResult.recordset[0].ApplicantID;

        // Transform job preferences data for database storage
        const preferredJobTypesString = Array.isArray(jobPreferencesData.preferredJobTypes)
            ? jobPreferencesData.preferredJobTypes.map((jt: any) => jt.Type || jt).join(', ')
            : '';
        
        const workplaceTypeMapping: { [key: string]: string } = {
            'remote': 'Remote',
            'hybrid': 'Hybrid',
            'onsite': 'On-site',
            'on-site': 'On-site'
        };
        const preferredWorkType = workplaceTypeMapping[jobPreferencesData.workplaceType?.toLowerCase()] || jobPreferencesData.workplaceType || '';
        
        // Update the Applicants table with job preferences
        const updateQuery = `
            UPDATE Applicants 
            SET 
                PreferredJobTypes = @param1,
                PreferredWorkTypes = @param2,
                PreferredLocations = @param3,
                ProfileCompleteness = CASE 
                    WHEN ProfileCompleteness < 60 THEN 60 
                    ELSE ProfileCompleteness 
                END
            WHERE ApplicantID = @param0;
            
            -- Return updated applicant profile
            SELECT 
                a.*,
                u.FirstName,
                u.LastName,
                u.Email
            FROM Applicants a
            INNER JOIN Users u ON a.UserID = u.UserID
            WHERE a.ApplicantID = @param0;
        `;
        
        const parameters = [
            applicantId,
            preferredJobTypesString, // PreferredJobTypes
            preferredWorkType, // PreferredWorkTypes  
            jobPreferencesData.preferredLocations || '' // PreferredLocations
        ];
        
        const result = await dbService.executeQuery(updateQuery, parameters);
        if (!result.recordset || result.recordset.length === 0) {
            throw new Error('Failed to update job preferences');
        }
        console.log(`? Updated job preferences for user ${userId}:`, {
            preferredJobTypes: preferredJobTypesString,
            preferredWorkTypes: preferredWorkType,
            preferredLocations: jobPreferencesData.preferredLocations || 'Not specified'
        });
        return result.recordset[0];
    }
}