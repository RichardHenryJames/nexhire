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
                ImmediatelyAvailable, WillingToRelocate, IsFeatured, OpenToRefer,
                CreatedAt, UpdatedAt
            ) VALUES (
                @param0, @param1, 10, 1, 1, 0, 0, 0, 0, 0, 1,
                GETUTCDATE(), GETUTCDATE()
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

    // Get user dashboard stats - ENHANCED with comprehensive analytics
    static async getDashboardStats(userId: string): Promise<any> {
        const user = await this.findById(userId);
        if (!user) {
            throw new NotFoundError('User not found');
        }

        if (user.UserType === appConstants.userTypes.JOB_SEEKER) {
            return await this.getEnhancedJobSeekerStats(userId);
        } else if (user.UserType === appConstants.userTypes.EMPLOYER) {
            return await this.getEnhancedEmployerStats(userId);
        }

        return {};
    }

    // Restore: Update applicant education data (wrapper) + completeness recalculation
    static async updateEducation(userId: string, educationData: any) {
        const user = await this.findById(userId);
        if (!user) throw new NotFoundError('User not found');
        if (user.UserType !== appConstants.userTypes.JOB_SEEKER) throw new ValidationError('Only job seekers can update education data');

        const applicantRes = await dbService.executeQuery('SELECT ApplicantID FROM Applicants WHERE UserID = @param0', [userId]);
        if (!applicantRes.recordset || applicantRes.recordset.length === 0) {
            throw new NotFoundError('Applicant profile not found');
        }
        const applicantId = applicantRes.recordset[0].ApplicantID;
        const institutionName = educationData.college?.name || educationData.institution || '';
        const degreeType = educationData.degreeType || educationData.highestEducation || '';
        const fieldOfStudy = educationData.fieldOfStudy || '';
        const graduationYear = educationData.graduationYear || '';
        const gpa = educationData.gpa || '';

        await dbService.executeQuery(`UPDATE Applicants SET Institution=@param1, HighestEducation=@param2, FieldOfStudy=@param3, GraduationYear=@param4, GPA=@param5, UpdatedAt=GETUTCDATE() WHERE ApplicantID=@param0`, [applicantId, institutionName, degreeType, fieldOfStudy, graduationYear, gpa]);
        const completeness = await this.recomputeProfileCompletenessByApplicantId(applicantId);
        return { success: true, message: 'Education updated successfully', profileCompleteness: completeness };
    }

    // Restore: Update work experience wrapper (adds record + preference fields) + completeness recalculation
    static async updateWorkExperience(userId: string, workExperienceData: any) {
        const user = await this.findById(userId);
        if (!user) throw new NotFoundError('User not found');
        if (user.UserType !== appConstants.userTypes.JOB_SEEKER) throw new ValidationError('Only job seekers can update work experience data');

        const applicantRes = await dbService.executeQuery('SELECT ApplicantID FROM Applicants WHERE UserID = @param0', [userId]);
        if (!applicantRes.recordset || applicantRes.recordset.length === 0) {
            throw new NotFoundError('Applicant profile not found');
        }
        const applicantId = applicantRes.recordset[0].ApplicantID;

        const hasExperienceDetails = workExperienceData.companyName || workExperienceData.organizationId || workExperienceData.jobTitle || workExperienceData.startDate;
        if (hasExperienceDetails) {
            const { WorkExperienceService } = await import('./work-experience.service');
            const payload: any = {
                organizationId: workExperienceData.organizationId ?? null,
                companyName: workExperienceData.companyName,
                jobTitle: workExperienceData.currentJobTitle || workExperienceData.jobTitle,
                startDate: workExperienceData.startDate || workExperienceData.start_date,
                endDate: workExperienceData.endDate || workExperienceData.end_date || null,
                salaryFrequency: workExperienceData.salaryFrequency || null,
                managerName: workExperienceData.managerName || null,
                managerContact: workExperienceData.managerContact || null,
                canContact: workExperienceData.canContact ?? null
            };
            if (!payload.jobTitle || !payload.startDate) throw new ValidationError('jobTitle and startDate are required for work experience');
            await WorkExperienceService.createWorkExperience(applicantId, payload);
        }

        const updateFields: string[] = [];
        const params: any[] = [applicantId];
        let idx = 1;
        if (workExperienceData.primarySkills) { updateFields.push(`PrimarySkills=@param${idx}`); params.push(workExperienceData.primarySkills); idx++; }
        if (workExperienceData.secondarySkills) { updateFields.push(`SecondarySkills=@param${idx}`); params.push(workExperienceData.secondarySkills); idx++; }
        if (workExperienceData.summary) { updateFields.push(`Summary=@param${idx}`); params.push(workExperienceData.summary); idx++; }
        if (workExperienceData.workArrangement) { updateFields.push(`PreferredWorkTypes=@param${idx}`); params.push(workExperienceData.workArrangement); idx++; }
        if (workExperienceData.jobType) { updateFields.push(`PreferredJobTypes=@param${idx}`); params.push(workExperienceData.jobType); idx++; }
        if (workExperienceData.preferredLocations) { updateFields.push(`PreferredLocations=@param${idx}`); params.push(workExperienceData.preferredLocations); idx++; }
        if (updateFields.length) {
            updateFields.push('UpdatedAt=GETUTCDATE()');
            await dbService.executeQuery(`UPDATE Applicants SET ${updateFields.join(', ')} WHERE ApplicantID=@param0`, params);
        }
        const completeness = await this.recomputeProfileCompletenessByApplicantId(applicantId);
        return { success: true, message: 'Work experience data processed successfully', profileCompleteness: completeness };
    }

    // Restore: Update job preferences wrapper + completeness recalculation
    static async updateJobPreferences(userId: string, jobPreferencesData: any) {
        const user = await this.findById(userId);
        if (!user) throw new NotFoundError('User not found');
        if (user.UserType !== appConstants.userTypes.JOB_SEEKER) throw new ValidationError('Only job seekers can update job preferences data');

        const applicantRes = await dbService.executeQuery('SELECT ApplicantID FROM Applicants WHERE UserID = @param0', [userId]);
        if (!applicantRes.recordset?.length) throw new NotFoundError('Applicant profile not found');
        const applicantId = applicantRes.recordset[0].ApplicantID;

        const updateFields: string[] = [];
        const params: any[] = [applicantId];
        let idx = 1;
        if (jobPreferencesData.preferredJobTypes) {
            const jobTypes = Array.isArray(jobPreferencesData.preferredJobTypes) ? jobPreferencesData.preferredJobTypes.map((jt: any) => jt.Type || jt).join(', ') : jobPreferencesData.preferredJobTypes;
            updateFields.push(`PreferredJobTypes=@param${idx}`); params.push(jobTypes); idx++; }
        if (jobPreferencesData.workplaceType) { updateFields.push(`PreferredWorkTypes=@param${idx}`); params.push(jobPreferencesData.workplaceType); idx++; }
        if (jobPreferencesData.preferredLocations) { const locations = Array.isArray(jobPreferencesData.preferredLocations) ? jobPreferencesData.preferredLocations.join(', ') : jobPreferencesData.preferredLocations; updateFields.push(`PreferredLocations=@param${idx}`); params.push(locations); idx++; }
        if (!updateFields.length) throw new ValidationError('No job preferences data provided');
        updateFields.push('UpdatedAt=GETUTCDATE()');
        await dbService.executeQuery(`UPDATE Applicants SET ${updateFields.join(', ')} WHERE ApplicantID=@param0`, params);
        const completeness = await this.recomputeProfileCompletenessByApplicantId(applicantId);
        return { success: true, message: 'Job preferences updated successfully', profileCompleteness: completeness };
    }

    // ENHANCED: Comprehensive job seeker stats
    private static async getEnhancedJobSeekerStats(userId: string): Promise<any> {
        try {
            // Get applicant ID
            const applicantQuery = 'SELECT ApplicantID FROM Applicants WHERE UserID = @param0';
            const applicantResult = await dbService.executeQuery(applicantQuery, [userId]);
            
            if (!applicantResult.recordset || applicantResult.recordset.length === 0) {
                return this.getBasicJobSeekerStats(userId);
            }
            
            const applicantId = applicantResult.recordset[0].ApplicantID;

            const statsQuery = `
                -- Core Application Stats (excluding withdrawn)
                SELECT 
                    -- Application Statistics
                    (SELECT COUNT(*) 
                     FROM JobApplications ja 
                     INNER JOIN Applicants a ON ja.ApplicantID = a.ApplicantID 
                     WHERE a.UserID = @param0 AND ja.StatusID != 6) as TotalApplications,
                    
                    (SELECT COUNT(*) 
                     FROM JobApplications ja 
                     INNER JOIN Applicants a ON ja.ApplicantID = a.ApplicantID 
                     WHERE a.UserID = @param0 AND ja.StatusID = 1) as PendingApplications,
                    
                    (SELECT COUNT(*) 
                     FROM JobApplications ja 
                     INNER JOIN Applicants a ON ja.ApplicantID = a.ApplicantID 
                     WHERE a.UserID = @param0 AND ja.StatusID = 2) as UnderReviewApplications,
                    
                    (SELECT COUNT(*) 
                     FROM JobApplications ja 
                     INNER JOIN Applicants a ON ja.ApplicantID = a.ApplicantID 
                     WHERE a.UserID = @param0 AND ja.StatusID = 3) as ShortlistedApplications,
                    
                    (SELECT COUNT(*) 
                     FROM JobApplications ja 
                     INNER JOIN Applicants a ON ja.ApplicantID = a.ApplicantID 
                     WHERE a.UserID = @param0 AND ja.StatusID IN (4, 5)) as InterviewsScheduled,
                    
                    (SELECT COUNT(*) 
                     FROM JobApplications ja 
                     INNER JOIN Applicants a ON ja.ApplicantID = a.ApplicantID 
                     WHERE a.UserID = @param0 AND ja.StatusID = 5) as OffersReceived,
                    
                    -- Saved Jobs
                    (SELECT COUNT(*) 
                     FROM SavedJobs sj 
                     INNER JOIN Applicants a ON sj.ApplicantID = a.ApplicantID 
                     WHERE a.UserID = @param0) as SavedJobs,
                    
                    -- Profile Information
                    (SELECT ISNULL(ProfileCompleteness, 0) 
                     FROM Applicants WHERE UserID = @param0) as ProfileCompleteness,

                    -- Aggregated Profile Views (Option 3: on-demand aggregation)
                    (SELECT COUNT(*) FROM ApplicantProfileViews apv 
                        INNER JOIN Applicants a ON apv.ApplicantID = a.ApplicantID 
                        WHERE a.UserID = @param0) as ProfileViews,
                    
                    -- Recent Activity (Last 30 days)
                    (SELECT COUNT(*) 
                     FROM JobApplications ja 
                     INNER JOIN Applicants a ON ja.ApplicantID = a.ApplicantID 
                     WHERE a.UserID = @param0 AND ja.SubmittedAt >= DATEADD(DAY, -30, GETUTCDATE())
                     AND ja.StatusID != 6) as ApplicationsLast30Days,
                    
                    (SELECT COUNT(*) 
                     FROM SavedJobs sj 
                     INNER JOIN Applicants a ON sj.ApplicantID = a.ApplicantID 
                     WHERE a.UserID = @param0 AND sj.SavedAt >= DATEADD(DAY, -30, GETUTCDATE())) as SavedJobsLast30Days,
                    
                    -- Application Success Rate
                    (SELECT 
                        CASE 
                            WHEN COUNT(*) > 0 
                            THEN CAST((COUNT(CASE WHEN ja.StatusID IN (3, 4, 5) THEN 1 END) * 100.0 / COUNT(*)) AS DECIMAL(5,2))
                            ELSE 0 
                        END
                     FROM JobApplications ja 
                     INNER JOIN Applicants a ON ja.ApplicantID = a.ApplicantID 
                     WHERE a.UserID = @param0 AND ja.StatusID != 6) as ApplicationSuccessRate,
                    
                    -- Average Response Time (in days)
                    (SELECT 
                        ISNULL(AVG(CAST(DATEDIFF(HOUR, ja.SubmittedAt, ja.LastUpdatedAt) AS FLOAT) / 24.0), 0)
                     FROM JobApplications ja 
                     INNER JOIN Applicants a ON ja.ApplicantID = a.ApplicantID 
                     WHERE a.UserID = @param0 AND ja.StatusID > 1 AND ja.StatusID != 6) as AverageResponseTimeInDays
            `;

            const result = await dbService.executeQuery(statsQuery, [userId]);
            const baseStats = result.recordset[0] || {};

            // Get referral statistics
            const referralStats = await this.getReferralStats(applicantId);
            
            // Get resume statistics
            const resumeStats = await this.getResumeStats(applicantId);
            
            // Get recent applications breakdown
            const recentActivityStats = await this.getRecentActivityStats(userId);
            
            // Get skills and preferences info
            const profileInsights = await this.getProfileInsights(applicantId);

            return {
                // Core application metrics
                totalApplications: baseStats.TotalApplications || 0,
                pendingApplications: baseStats.PendingApplications || 0,
                underReviewApplications: baseStats.UnderReviewApplications || 0,
                shortlistedApplications: baseStats.ShortlistedApplications || 0,
                interviewsScheduled: baseStats.InterviewsScheduled || 0,
                offersReceived: baseStats.OffersReceived || 0,
                
                // Job management
                savedJobs: baseStats.SavedJobs || 0,
                
                // Profile metrics
                profileCompleteness: baseStats.ProfileCompleteness || 0,
                profileViews: baseStats.ProfileViews || 0,
                
                // Performance metrics
                applicationSuccessRate: baseStats.ApplicationSuccessRate || 0,
                averageResponseTime: Math.round((baseStats.AverageResponseTimeInDays || 0) * 10) / 10,
                
                // Recent activity
                applicationsLast30Days: baseStats.ApplicationsLast30Days || 0,
                savedJobsLast30Days: baseStats.SavedJobsLast30Days || 0,
                
                // Referral metrics
                referralRequestsMade: referralStats.referralRequestsMade || 0,
                referralRequestsReceived: referralStats.referralRequestsReceived || 0,
                completedReferrals: referralStats.completedReferrals || 0,
                totalReferralPoints: referralStats.totalReferralPoints || 0,
                referralSuccessRate: referralStats.referralSuccessRate || 0,
                
                // Resume metrics
                totalResumes: resumeStats.totalResumes || 0,
                primaryResumeSet: resumeStats.primaryResumeSet || false,
                
                // Activity insights
                recentActivity: recentActivityStats,
                
                // Profile insights
                profileInsights: profileInsights,
                
                // Recommendations
                recommendations: await this.getJobSeekerRecommendations(userId, baseStats),
                
                // Summary metrics for quick overview
                summary: {
                    isActiveJobSeeker: (baseStats.ApplicationsLast30Days || 0) > 0,
                    profileStrength: this.calculateProfileStrength(baseStats.ProfileCompleteness || 0, resumeStats.totalResumes || 0),
                    needsAttention: this.getJobSeekerAttentionItems(baseStats, referralStats, resumeStats)
                }
            };

        } catch (error) {
            console.error('Error getting enhanced job seeker stats:', error);
            return this.getBasicJobSeekerStats(userId);
        }
    }

    // ENHANCED: Comprehensive employer stats
    private static async getEnhancedEmployerStats(userId: string): Promise<any> {
        try {
            const statsQuery = `
                -- Core Job and Application Stats
                SELECT 
                    -- Job Statistics
                    (SELECT COUNT(*) FROM Jobs WHERE PostedByUserID = @param0) as TotalJobsPosted,
                    (SELECT COUNT(*) FROM Jobs WHERE PostedByUserID = @param0 AND Status = 'Published') as ActiveJobs,
                    (SELECT COUNT(*) FROM Jobs WHERE PostedByUserID = @param0 AND Status = 'Draft') as DraftJobs,
                    (SELECT COUNT(*) FROM Jobs WHERE PostedByUserID = @param0 AND Status = 'Closed') as ClosedJobs,
                    
                    -- Application Statistics
                    (SELECT COUNT(*) 
                     FROM JobApplications ja 
                     INNER JOIN Jobs j ON ja.JobID = j.JobID 
                     WHERE j.PostedByUserID = @param0) as TotalApplicationsReceived,
                    
                    (SELECT COUNT(*) 
                     FROM JobApplications ja 
                     INNER JOIN Jobs j ON ja.JobID = j.JobID 
                     WHERE j.PostedByUserID = @param0 AND ja.StatusID = 1) as PendingApplications,
                    
                    (SELECT COUNT(*) 
                     FROM JobApplications ja 
                     INNER JOIN Jobs j ON ja.JobID = j.JobID 
                     WHERE j.PostedByUserID = @param0 AND ja.StatusID = 2) as UnderReviewApplications,
                    
                    (SELECT COUNT(*) 
                     FROM JobApplications ja 
                     INNER JOIN Jobs j ON ja.JobID = j.JobID 
                     WHERE j.PostedByUserID = @param0 AND ja.StatusID = 3) as ShortlistedApplications,
                    
                    (SELECT COUNT(*) 
                     FROM JobApplications ja 
                     INNER JOIN Jobs j ON ja.JobID = j.JobID 
                     WHERE j.PostedByUserID = @param0 AND ja.StatusID IN (4, 5)) as InterviewsInProgress,
                    
                    (SELECT COUNT(*) 
                     FROM JobApplications ja 
                     INNER JOIN Jobs j ON ja.JobID = j.JobID 
                     WHERE j.PostedByUserID = @param0 AND ja.StatusID = 5) as OffersExtended,
                    
                    -- Recent Activity (Last 30 days)
                    (SELECT COUNT(*) 
                     FROM Jobs WHERE PostedByUserID = @param0 AND CreatedAt >= DATEADD(DAY, -30, GETUTCDATE())) as JobsPostedLast30Days,
                    
                    (SELECT COUNT(*) 
                     FROM JobApplications ja 
                     INNER JOIN Jobs j ON ja.JobID = j.JobID 
                     WHERE j.PostedByUserID = @param0 AND ja.SubmittedAt >= DATEADD(DAY, -30, GETUTCDATE())) as ApplicationsReceivedLast30Days,
                    
                    -- Performance Metrics
                    (SELECT 
                        CASE 
                            WHEN COUNT(*) > 0 
                            THEN CAST(AVG(CAST(j.CurrentApplications AS FLOAT)) AS DECIMAL(10,2))
                            ELSE 0 
                        END
                     FROM Jobs j WHERE j.PostedByUserID = @param0 AND j.Status = 'Published') as AverageApplicationsPerJob,
                    
                    -- Hiring Success Rate
                    (SELECT 
                        CASE 
                            WHEN COUNT(*) > 0 
                            THEN CAST((COUNT(CASE WHEN ja.StatusID = 5 THEN 1 END) * 100.0 / COUNT(*)) AS DECIMAL(5,2))
                            ELSE 0 
                        END
                     FROM JobApplications ja 
                     INNER JOIN Jobs j ON ja.JobID = j.JobID 
                     WHERE j.PostedByUserID = @param0 AND ja.StatusID IN (3, 4, 5, 6)) as HiringSuccessRate,
                    
                    -- Average Response Time
                    (SELECT 
                        ISNULL(AVG(CAST(DATEDIFF(HOUR, ja.SubmittedAt, ja.LastUpdatedAt) AS FLOAT) / 24.0), 0)
                     FROM JobApplications ja 
                     INNER JOIN Jobs j ON ja.JobID = j.JobID 
                     WHERE j.PostedByUserID = @param0 AND ja.StatusID > 1) as AverageResponseTimeInDays
            `;

            const result = await dbService.executeQuery(statsQuery, [userId]);
            const baseStats = result.recordset[0] || {};

            // Get employer-specific referral stats
            const employerReferralStats = await this.getEmployerReferralStats(userId);
            
            // Get top performing jobs
            const topJobs = await this.getTopPerformingJobs(userId);
            
            // Get hiring pipeline insights
            const pipelineInsights = await this.getHiringPipelineInsights(userId);
            
            // Get organization metrics (if applicable)
            const organizationMetrics = await this.getOrganizationMetrics(userId);

            return {
                // Core job metrics
                totalJobsPosted: baseStats.TotalJobsPosted || 0,
                activeJobs: baseStats.ActiveJobs || 0,
                draftJobs: baseStats.DraftJobs || 0,
                closedJobs: baseStats.ClosedJobs || 0,
                
                // Application metrics
                totalApplicationsReceived: baseStats.TotalApplicationsReceived || 0,
                pendingApplications: baseStats.PendingApplications || 0,
                underReviewApplications: baseStats.UnderReviewApplications || 0,
                shortlistedApplications: baseStats.ShortlistedApplications || 0,
                interviewsInProgress: baseStats.InterviewsInProgress || 0,
                offersExtended: baseStats.OffersExtended || 0,
                
                // Performance metrics
                averageApplicationsPerJob: baseStats.AverageApplicationsPerJob || 0,
                hiringSuccessRate: baseStats.HiringSuccessRate || 0,
                averageResponseTime: Math.round((baseStats.AverageResponseTimeInDays || 0) * 10) / 10,
                
                // Recent activity
                jobsPostedLast30Days: baseStats.JobsPostedLast30Days || 0,
                applicationsReceivedLast30Days: baseStats.ApplicationsReceivedLast30Days || 0,
                
                // Referral network metrics
                referralNetwork: employerReferralStats,
                
                // Job performance insights
                topPerformingJobs: topJobs,
                
                // Hiring pipeline
                pipelineInsights: pipelineInsights,
                
                // Organization metrics
                organizationMetrics: organizationMetrics,
                
                // Recommendations
                recommendations: await this.getEmployerRecommendations(userId, baseStats),
                
                // Summary metrics
                summary: {
                    isActiveHiring: (baseStats.JobsPostedLast30Days || 0) > 0,
                    hiringVelocity: this.calculateHiringVelocity(baseStats),
                    needsAttention: this.getEmployerAttentionItems(baseStats)
                }
            };

        } catch (error) {
            console.error('Error getting enhanced employer stats:', error);
            return this.getBasicEmployerStats(userId);
        }
    }

    // Helper methods for enhanced analytics

    private static async getReferralStats(applicantId: string): Promise<any> {
        try {
            const query = `
                SELECT 
                    (SELECT COUNT(*) FROM ReferralRequests WHERE ApplicantID = @param0) as ReferralRequestsMade,
                    (SELECT COUNT(*) FROM ReferralRequests WHERE AssignedReferrerID = @param0) as ReferralRequestsReceived,
                    (SELECT COUNT(*) FROM ReferralRequests WHERE AssignedReferrerID = @param0 AND Status IN ('Completed', 'Verified')) as CompletedReferrals,
                    (SELECT ISNULL(SUM(PointsEarned), 0) FROM ReferralRewards WHERE ReferrerID = @param0) as TotalReferralPoints,
                    (SELECT 
                        CASE 
                            WHEN COUNT(*) > 0 
                            THEN CAST((COUNT(CASE WHEN Status IN ('Completed', 'Verified') THEN 1 END) * 100.0 / COUNT(*)) AS DECIMAL(5,2))
                            ELSE 0 
                        END
                     FROM ReferralRequests WHERE AssignedReferrerID = @param0) as ReferralSuccessRate
            `;
            
            const result = await dbService.executeQuery(query, [applicantId]);
            return result.recordset[0] || {};
        } catch (error) {
            console.error('Error getting referral stats:', error);
            return {};
        }
    }

    private static async getResumeStats(applicantId: string): Promise<any> {
        try {
            const query = `
                SELECT 
                    COUNT(*) as TotalResumes,
                    CASE WHEN EXISTS(SELECT 1 FROM ApplicantResumes WHERE ApplicantID = @param0 AND IsPrimary = 1) 
                         THEN 1 ELSE 0 END as PrimaryResumeSet
                FROM ApplicantResumes 
                WHERE ApplicantID = @param0
            `;
            
            const result = await dbService.executeQuery(query, [applicantId]);
            return result.recordset[0] || { totalResumes: 0, primaryResumeSet: false };
        } catch (error) {
            console.error('Error getting resume stats:', error);
            return { totalResumes: 0, primaryResumeSet: false };
        }
    }

    private static async getRecentActivityStats(userId: string): Promise<any[]> {
        try {
            const query = `
                SELECT TOP 10
                    'application' as ActivityType,
                    j.Title as JobTitle,
                    o.Name as CompanyName,
                    ja.SubmittedAt as ActivityDate,
                    aps.Status as CurrentStatus
                FROM JobApplications ja
                INNER JOIN Applicants a ON ja.ApplicantID = a.ApplicantID
                INNER JOIN Jobs j ON ja.JobID = j.JobID
                INNER JOIN Organizations o ON j.OrganizationID = o.OrganizationID
                INNER JOIN ApplicationStatuses aps ON ja.StatusID = aps.StatusID
                WHERE a.UserID = @param0 AND ja.StatusID != 6
                ORDER BY ja.SubmittedAt DESC
            `;
            
            const result = await dbService.executeQuery(query, [userId]);
            return result.recordset || [];
        } catch (error) {
            console.error('Error getting recent activity stats:', error);
            return [];
        }
    }

    private static async getProfileInsights(applicantId: string): Promise<any> {
        try {
            const query = `
                SELECT 
                    PrimarySkills,
                    SecondarySkills,
                    PreferredJobTypes,
                    PreferredWorkTypes,
                    PreferredLocations,
                    CurrentJobTitle,
                    ISNULL(TotalExperienceMonths, 0) as TotalExperienceMonths,
                    LinkedInProfile,
                    IsOpenToWork,
                    AllowRecruitersToContact
                FROM Applicants 
                WHERE ApplicantID = @param0
            `;
            
            const result = await dbService.executeQuery(query, [applicantId]);
            const profile = result.recordset[0] || {};
            
            return {
                hasSkills: !!(profile.PrimarySkills || profile.SecondarySkills),
                hasPreferences: !!(profile.PreferredJobTypes || profile.PreferredWorkTypes),
                experienceYears: Math.floor((profile.TotalExperienceMonths || 0) / 12),
                isOpenToWork: profile.IsOpenToWork || false,
                allowsRecruiterContact: profile.AllowRecruitersToContact || false,
                hasLinkedIn: !!profile.LinkedInProfile
            };
        } catch (error) {
            console.error('Error getting profile insights:', error);
            return {};
        }
    }

    private static async getEmployerReferralStats(userId: string): Promise<any> {
        try {
            const query = `
                SELECT 
                    (SELECT COUNT(DISTINCT rr.RequestID)
                     FROM ReferralRequests rr
                     INNER JOIN Jobs j ON rr.JobID = j.JobID
                     WHERE j.PostedByUserID = @param0) as ReferralsForMyJobs,
                    
                    (SELECT COUNT(DISTINCT rr.RequestID)
                     FROM ReferralRequests rr
                     INNER JOIN Jobs j ON rr.JobID = j.JobID
                     WHERE j.PostedByUserID = @param0 AND rr.Status IN ('Completed', 'Verified')) as CompletedReferralsForMyJobs
            `;
            
            const result = await dbService.executeQuery(query, [userId]);
            return result.recordset[0] || {};
        } catch (error) {
            console.error('Error getting employer referral stats:', error);
            return {};
        }
    }

    private static async getTopPerformingJobs(userId: string): Promise<any[]> {
        try {
            const query = `
                SELECT TOP 5
                    j.JobID,
                    j.Title,
                    j.Status,
                    j.CreatedAt,
                    ISNULL(j.CurrentApplications, 0) as ApplicationCount,
                    (SELECT COUNT(*) FROM JobApplications ja WHERE ja.JobID = j.JobID AND ja.StatusID = 3) as ShortlistedCount,
                    (SELECT COUNT(*) FROM JobApplications ja WHERE ja.JobID = j.JobID AND ja.StatusID = 5) as HiredCount
                FROM Jobs j
                WHERE j.PostedByUserID = @param0
                ORDER BY ISNULL(j.CurrentApplications, 0) DESC, j.CreatedAt DESC
            `;
            
            const result = await dbService.executeQuery(query, [userId]);
            return result.recordset || [];
        } catch (error) {
            console.error('Error getting top performing jobs:', error);
            return [];
        }
    }

    private static async getHiringPipelineInsights(userId: string): Promise<any> {
        try {
            const query = `
                SELECT 
                    COUNT(CASE WHEN ja.StatusID = 1 THEN 1 END) as Applied,
                    COUNT(CASE WHEN ja.StatusID = 2 THEN 1 END) as Reviewing,
                    COUNT(CASE WHEN ja.StatusID = 3 THEN 1 END) as Shortlisted,
                    COUNT(CASE WHEN ja.StatusID = 4 THEN 1 END) as Interview,
                    COUNT(CASE WHEN ja.StatusID = 5 THEN 1 END) as Hired,
                    COUNT(CASE WHEN ja.StatusID = 6 THEN 1 END) as Rejected
                FROM JobApplications ja
                INNER JOIN Jobs j ON ja.JobID = j.JobID
                WHERE j.PostedByUserID = @param0
            `;
            
            const result = await dbService.executeQuery(query, [userId]);
            const pipeline = result.recordset[0] || {};
            
            // Calculate conversion rates
            const total = Object.values(pipeline).reduce((sum: number, count: any) => sum + (count || 0), 0);
            
            return {
                pipeline,
                conversions: {
                    appliedToReviewing: total > 0 ? Math.round(((pipeline.Reviewing || 0) / total) * 100) : 0,
                    reviewingToShortlisted: (pipeline.Reviewing || 0) > 0 ? Math.round(((pipeline.Shortlisted || 0) / (pipeline.Reviewing || 0)) * 100) : 0,
                    shortlistedToHired: (pipeline.Shortlisted || 0) > 0 ? Math.round(((pipeline.Hired || 0) / (pipeline.Shortlisted || 0)) * 100) : 0
                }
            };
        } catch (error) {
            console.error('Error getting hiring pipeline insights:', error);
            return { pipeline: {}, conversions: {} };
        }
    }

    private static async getOrganizationMetrics(userId: string): Promise<any> {
        try {
            // Get employer's organization
            const orgQuery = `
                SELECT o.OrganizationID, o.Name, o.Size, o.Industry
                FROM Employers e
                INNER JOIN Organizations o ON e.OrganizationID = o.OrganizationID
                WHERE e.UserID = @param0
            `;
            
            const orgResult = await dbService.executeQuery(orgQuery, [userId]);
            if (!orgResult.recordset || orgResult.recordset.length === 0) {
                return {};
            }
            
            const org = orgResult.recordset[0];
            
            // Get organization-wide metrics
            const metricsQuery = `
                SELECT 
                    COUNT(DISTINCT e.EmployerID) as TotalEmployers,
                    COUNT(DISTINCT j.JobID) as TotalJobs,
                    COUNT(DISTINCT ja.ApplicationID) as TotalApplications
                FROM Organizations o
                LEFT JOIN Employers e ON o.OrganizationID = e.OrganizationID
                LEFT JOIN Jobs j ON o.OrganizationID = j.OrganizationID
                LEFT JOIN JobApplications ja ON j.JobID = ja.JobID
                WHERE o.OrganizationID = @param0
            `;
            
            const metricsResult = await dbService.executeQuery(metricsQuery, [org.OrganizationID]);
            const metrics = metricsResult.recordset[0] || {};
            
            return {
                organizationName: org.Name,
                organizationSize: org.Size,
                industry: org.Industry,
                totalEmployers: metrics.TotalEmployers || 0,
                totalJobs: metrics.TotalJobs || 0,
                totalApplications: metrics.TotalApplications || 0
            };
        } catch (error) {
            console.error('Error getting organization metrics:', error);
            return {};
        }
    }

    private static calculateProfileStrength(completeness: number, resumeCount: number): string {
        const score = completeness + (resumeCount > 0 ? 10 : 0);
        if (score >= 80) return 'Strong';
        if (score >= 60) return 'Good';
        if (score >= 40) return 'Fair';
        return 'Weak';
    }

    private static calculateHiringVelocity(stats: any): string {
        const recentJobs = stats.JobsPostedLast30Days || 0;
        const recentApps = stats.ApplicationsReceivedLast30Days || 0;
        
        if (recentJobs >= 3 && recentApps >= 10) return 'High';
        if (recentJobs >= 1 && recentApps >= 5) return 'Medium';
        if (recentJobs >= 1 || recentApps >= 1) return 'Low';
        return 'Inactive';
    }

    private static getJobSeekerAttentionItems(baseStats: any, referralStats: any, resumeStats: any): string[] {
        const items: string[] = [];
        
        if ((baseStats.ProfileCompleteness || 0) < 80) {
            items.push('Complete your profile to increase visibility');
        }
        
        if ((resumeStats.totalResumes || 0) === 0) {
            items.push('Upload your resume to start applying');
        } else if (!resumeStats.primaryResumeSet) {
            items.push('Set a primary resume for quicker applications');
        }
        
        if ((baseStats.ApplicationsLast30Days || 0) === 0) {
            items.push('No recent applications - explore new opportunities');
        }
        
        if ((baseStats.PendingApplications || 0) > 5) {
            items.push('Several applications pending - consider following up');
        }
        
        return items;
    }

    private static getEmployerAttentionItems(baseStats: any): string[] {
        const items: string[] = [];
        
        if ((baseStats.PendingApplications || 0) > 10) {
            items.push('Many applications need review');
        }
        
        if ((baseStats.ActiveJobs || 0) === 0) {
            items.push('No active job postings');
        }
        
        if ((baseStats.AverageResponseTimeInDays || 0) > 7) {
            items.push('Consider faster response times to improve candidate experience');
        }
        
        if ((baseStats.DraftJobs || 0) > 0) {
            items.push('You have unpublished draft jobs');
        }
        
        return items;
    }

    private static async getJobSeekerRecommendations(userId: string, stats: any): Promise<string[]> {
        const recommendations: string[] = [];
        
        if ((stats.ApplicationSuccessRate || 0) < 20) {
            recommendations.push('Consider improving your profile and tailoring applications');
        }
        
        if ((stats.SavedJobs || 0) > 10 && (stats.ApplicationsLast30Days || 0) < 5) {
            recommendations.push('You have many saved jobs - consider applying to some');
        }
        
        if ((stats.ProfileViews || 0) < 5) {
            recommendations.push('Optimize your profile keywords to increase visibility');
        }
        
        return recommendations;
    }

    private static async getEmployerRecommendations(userId: string, stats: any): Promise<string[]> {
        const recommendations: string[] = [];
        
        if ((stats.HiringSuccessRate || 0) < 10) {
            recommendations.push('Consider reviewing your job requirements and hiring process');
        }
        
        if ((stats.AverageApplicationsPerJob || 0) < 5) {
            recommendations.push('Improve job descriptions to attract more candidates');
        }
        
        if ((stats.InterviewsInProgress || 0) > 0) {
            recommendations.push('Schedule interviews with shortlisted candidates');
        }
        
        return recommendations;
    }

    // Fallback methods for basic stats (in case enhanced queries fail)
    private static async getBasicJobSeekerStats(userId: string): Promise<any> {
        const query = `
            SELECT 
                (SELECT COUNT(*) FROM JobApplications ja 
                 INNER JOIN Applicants a ON ja.ApplicantID = a.ApplicantID 
                 WHERE a.UserID = @param0 AND ja.StatusID != 6) as TotalApplications,
                (SELECT COUNT(*) FROM JobApplications ja 
                 INNER JOIN Applicants a ON ja.ApplicantID = a.ApplicantID 
                 WHERE a.UserID = @param0 AND ja.StatusID = 3) as ShortlistedApplications,
                (SELECT COUNT(*) FROM JobApplications ja 
                 INNER JOIN Applicants a ON ja.ApplicantID = a.ApplicantID 
                 WHERE a.UserID = @param0 AND ja.StatusID IN (4, 5)) as InterviewsScheduled,
                (SELECT ISNULL(ProfileCompleteness, 0) FROM Applicants WHERE UserID = @param0) as ProfileCompleteness
        `;

        const result = await dbService.executeQuery(query, [userId]);
        return result.recordset[0] || {};
    }

    private static async getBasicEmployerStats(userId: string): Promise<any> {
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

    // Keep original method names for backward compatibility
    private static async getJobSeekerStats(userId: string): Promise<any> {
        return await this.getEnhancedJobSeekerStats(userId);
    }

    private static async getEmployerStats(userId: string): Promise<any> {
        return await this.getEnhancedEmployerStats(userId);
    }

    // Centralized profile completeness recalculation (enhanced with more factors)
    private static async recalculateApplicantProfileCompleteness(applicantId: string): Promise<number> {
        const query = `
            SELECT 
                a.Institution, a.HighestEducation, a.FieldOfStudy,
                a.PrimarySkills, a.SecondarySkills, a.Summary,
                a.PreferredJobTypes, a.PreferredWorkTypes, a.PreferredLocations,
                a.CurrentJobTitle, a.LinkedInProfile,
                (SELECT COUNT(*) FROM ApplicantResumes r WHERE r.ApplicantID = a.ApplicantID) AS ResumeCount,
                (SELECT COUNT(*) FROM WorkExperiences w WHERE w.ApplicantID = a.ApplicantID AND w.IsActive = 1) AS WorkExpCount,
                u.ProfilePictureURL
            FROM Applicants a
            INNER JOIN Users u ON a.UserID = u.UserID
            WHERE a.ApplicantID = @param0
        `;
        const result = await dbService.executeQuery(query, [applicantId]);
        if (!result.recordset || result.recordset.length === 0) {
            throw new NotFoundError('Applicant not found for completeness recalculation');
        }
        const row: any = result.recordset[0];
        const hasValue = (v: any) => v !== null && v !== undefined && String(v).trim().length > 0;

        // Components (10)
        const educationComplete = hasValue(row.Institution) && hasValue(row.HighestEducation) && hasValue(row.FieldOfStudy) ? 1 : 0; // 1
        const primarySkills = hasValue(row.PrimarySkills) ? 1 : 0; //2
        const secondarySkills = hasValue(row.SecondarySkills) ? 1 : 0; //3
        const summaryPresent = hasValue(row.Summary) ? 1 : 0; //4
        const jobPrefsPresent = (hasValue(row.PreferredJobTypes) || hasValue(row.PreferredWorkTypes) || hasValue(row.PreferredLocations)) ? 1 : 0; //5
        const resumePresent = (row.ResumeCount || 0) > 0 ? 1 : 0; //6
        const workExpPresent = (row.WorkExpCount || 0) > 0 ? 1 : 0; //7
        const profilePicPresent = hasValue(row.ProfilePictureURL) ? 1 : 0; //8
        const linkedInPresent = hasValue(row.LinkedInProfile) ? 1 : 0; //9
        const currentJobTitlePresent = hasValue(row.CurrentJobTitle) ? 1 : 0; //10

        const achieved = educationComplete + primarySkills + secondarySkills + summaryPresent + jobPrefsPresent + resumePresent + workExpPresent + profilePicPresent + linkedInPresent + currentJobTitlePresent;
        const completeness = Math.min(100, Math.max(0, Math.round((achieved * 100) / 10)));

        await dbService.executeQuery(
            `UPDATE Applicants SET ProfileCompleteness = @param1, UpdatedAt = GETUTCDATE() WHERE ApplicantID = @param0`,
            [applicantId, completeness]
        );
        return completeness;
    }

    // Public wrapper to allow other services to trigger recomputation
    static async recomputeProfileCompletenessByApplicantId(applicantId: string): Promise<number> {
        return this.recalculateApplicantProfileCompleteness(applicantId);
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
}