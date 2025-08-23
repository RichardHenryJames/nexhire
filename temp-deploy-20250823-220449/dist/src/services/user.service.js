"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserService = void 0;
const database_service_1 = require("../services/database.service");
const auth_service_1 = require("../services/auth.service");
const validation_1 = require("../utils/validation");
const config_1 = require("../config");
class UserService {
    // FIXED: Register new user with organization creation for employers (now fully transactional)
    static async register(userData) {
        const validatedData = (0, validation_1.validateRequest)(validation_1.userRegistrationSchema, userData);
        // Check if user already exists
        const existingUser = await this.findByEmail(validatedData.email);
        if (existingUser) {
            throw new validation_1.ConflictError('User with this email already exists');
        }
        // Hash password
        const hashedPassword = await auth_service_1.AuthService.hashPassword(validatedData.password);
        // Generate user ID
        const userId = auth_service_1.AuthService.generateUniqueId();
        // Start transaction for user and organization/applicant creation
        const tx = await database_service_1.dbService.beginTransaction();
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
            const userResult = await database_service_1.dbService.executeTransactionQuery(tx, userQuery, userParameters);
            if (!userResult.recordset || userResult.recordset.length === 0) {
                throw new Error('Failed to create user');
            }
            const user = userResult.recordset[0];
            // Create organization and employer profile if user is an employer
            if (validatedData.userType === config_1.appConstants.userTypes.EMPLOYER) {
                await this.createEmployerProfileWithOrganizationTx(tx, userId, validatedData);
            }
            // Create applicant profile if user is a job seeker
            else if (validatedData.userType === config_1.appConstants.userTypes.JOB_SEEKER) {
                await this.createApplicantProfileTx(tx, userId);
            }
            await tx.commit();
            return user;
        }
        catch (error) {
            try {
                await tx.rollback();
            }
            catch { }
            console.error('Error during user registration (rolled back):', error);
            if (error instanceof validation_1.ConflictError)
                throw error;
            throw new Error('Registration failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
        }
    }
    // FIXED: Create employer profile with organization during registration (transactional)
    static async createEmployerProfileWithOrganizationTx(tx, userId, userData) {
        // Generate IDs
        const organizationId = auth_service_1.AuthService.generateUniqueId();
        const employerId = auth_service_1.AuthService.generateUniqueId();
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
        await database_service_1.dbService.executeTransactionQuery(tx, orgQuery, orgParameters);
        // Employer profile creation
        const employerQuery = `
            INSERT INTO Employers (
                EmployerID, UserID, OrganizationID, CanPostJobs, CanViewApplications,
                CanScheduleInterviews, CanSendMessages, JoinedAt
            ) VALUES (
                @param0, @param1, @param2, 1, 1, 1, 1, GETUTCDATE()
            )
        `;
        await database_service_1.dbService.executeTransactionQuery(tx, employerQuery, [employerId, userId, organizationId]);
        console.log(`? (TX) Created organization ${organizationId} and employer profile ${employerId} for user ${userId}`);
        return { organizationId, employerId };
    }
    // Legacy non-transactional helper (kept for backward compatibility; prefer the TX version)
    static async createEmployerProfileWithOrganization(userId, userData) {
        const tx = await database_service_1.dbService.beginTransaction();
        try {
            const res = await this.createEmployerProfileWithOrganizationTx(tx, userId, userData);
            await tx.commit();
            return res;
        }
        catch (error) {
            try {
                await tx.rollback();
            }
            catch { }
            throw error;
        }
    }
    // Create applicant profile (transactional)
    static async createApplicantProfileTx(tx, userId) {
        const applicantId = auth_service_1.AuthService.generateUniqueId();
        const query = `
            INSERT INTO Applicants (
                ApplicantID, UserID, ProfileCompleteness, IsOpenToWork,
                AllowRecruitersToContact, HideCurrentCompany, HideSalaryDetails,
                ImmediatelyAvailable, WillingToRelocate, IsFeatured
            ) VALUES (
                @param0, @param1, 10, 1, 1, 0, 0, 0, 0, 0
            )
        `;
        await database_service_1.dbService.executeTransactionQuery(tx, query, [applicantId, userId]);
    }
    // Legacy non-transactional applicant helper
    static async createApplicantProfile(userId) {
        const tx = await database_service_1.dbService.beginTransaction();
        try {
            await this.createApplicantProfileTx(tx, userId);
            await tx.commit();
        }
        catch (error) {
            try {
                await tx.rollback();
            }
            catch { }
            throw error;
        }
    }
    // NEW: Initialize employer profile for an existing authenticated user (transactional)
    static async initializeEmployerProfile(userId, data) {
        const user = await this.findById(userId);
        if (!user) {
            throw new validation_1.NotFoundError('User not found');
        }
        // Prevent duplicate employer creation if already employer and record exists
        if (user.UserType === config_1.appConstants.userTypes.EMPLOYER) {
            const existing = await database_service_1.dbService.executeQuery('SELECT EmployerID FROM Employers WHERE UserID = @param0', [userId]);
            if (existing.recordset && existing.recordset.length > 0) {
                throw new validation_1.ConflictError('Employer profile already exists');
            }
        }
        const tx = await database_service_1.dbService.beginTransaction();
        try {
            // Upgrade user type to Employer if needed
            if (user.UserType !== config_1.appConstants.userTypes.EMPLOYER) {
                await database_service_1.dbService.executeTransactionQuery(tx, `UPDATE Users SET UserType = 'Employer', UpdatedAt = GETUTCDATE() WHERE UserID = @param0`, [userId]);
            }
            // Create org + employer under same transaction
            const result = await this.createEmployerProfileWithOrganizationTx(tx, userId, data);
            await tx.commit();
            return result;
        }
        catch (error) {
            try {
                await tx.rollback();
            }
            catch { }
            throw error;
        }
    }
    // Login user
    static async login(loginData) {
        const validatedData = (0, validation_1.validateRequest)(validation_1.userLoginSchema, loginData);
        // Find user by email
        const user = await this.findByEmail(validatedData.email);
        if (!user) {
            throw new validation_1.NotFoundError('Invalid email or password');
        }
        // Check if account is active
        if (!user.IsActive) {
            throw new validation_1.ValidationError('Account is deactivated');
        }
        // Check account lockout
        if (user.AccountLockoutEnd && new Date(user.AccountLockoutEnd) > new Date()) {
            throw new validation_1.ValidationError('Account is temporarily locked');
        }
        // Verify password
        const isPasswordValid = await auth_service_1.AuthService.verifyPassword(validatedData.password, user.Password);
        if (!isPasswordValid) {
            await this.incrementLoginAttempts(user.UserID);
            throw new validation_1.NotFoundError('Invalid email or password');
        }
        // Reset login attempts and update last login
        await this.updateLastLogin(user.UserID);
        // Generate tokens
        const tokens = auth_service_1.AuthService.generateAuthTokens(user);
        // Remove password from response
        const { Password, ...userWithoutPassword } = user;
        return {
            user: userWithoutPassword,
            tokens
        };
    }
    // Find user by email
    static async findByEmail(email) {
        const query = 'SELECT * FROM Users WHERE Email = @param0 AND IsActive = 1';
        const result = await database_service_1.dbService.executeQuery(query, [email]);
        return result.recordset && result.recordset.length > 0 ? result.recordset[0] : null;
    }
    // Find user by ID
    static async findById(userId) {
        const query = 'SELECT * FROM Users WHERE UserID = @param0 AND IsActive = 1';
        const result = await database_service_1.dbService.executeQuery(query, [userId]);
        return result.recordset && result.recordset.length > 0 ? result.recordset[0] : null;
    }
    // Update user profile - FIXED: Handle camelCase to PascalCase mapping
    static async updateProfile(userId, updateData) {
        const user = await this.findById(userId);
        if (!user) {
            throw new validation_1.NotFoundError('User not found');
        }
        // Map camelCase API fields to PascalCase database fields
        const fieldMapping = {
            'firstName': 'FirstName',
            'lastName': 'LastName',
            'phone': 'Phone',
            'dateOfBirth': 'DateOfBirth',
            'gender': 'Gender',
            'profilePictureURL': 'ProfilePictureURL',
            'profileVisibility': 'ProfileVisibility',
            'FirstName': 'FirstName', // Also allow direct database field names
            'LastName': 'LastName',
            'Phone': 'Phone',
            'DateOfBirth': 'DateOfBirth',
            'Gender': 'Gender',
            'ProfilePictureURL': 'ProfilePictureURL',
            'ProfileVisibility': 'ProfileVisibility'
        };
        const allowedFields = Object.values(fieldMapping);
        // Map input fields and filter valid ones
        const mappedUpdateData = {};
        Object.keys(updateData).forEach(key => {
            const mappedKey = fieldMapping[key];
            if (mappedKey && allowedFields.includes(mappedKey)) {
                mappedUpdateData[mappedKey] = updateData[key];
            }
        });
        if (Object.keys(mappedUpdateData).length === 0) {
            throw new validation_1.ValidationError('No valid fields to update. Valid fields are: firstName, lastName, phone, dateOfBirth, gender, profilePictureURL, profileVisibility');
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
        const result = await database_service_1.dbService.executeQuery(query, parameters);
        if (!result.recordset || result.recordset.length === 0) {
            throw new Error('Failed to update user profile');
        }
        return result.recordset[0];
    }
    // Change password
    static async changePassword(userId, currentPassword, newPassword) {
        const user = await this.findById(userId);
        if (!user) {
            throw new validation_1.NotFoundError('User not found');
        }
        // Verify current password
        const isCurrentPasswordValid = await auth_service_1.AuthService.verifyPassword(currentPassword, user.Password);
        if (!isCurrentPasswordValid) {
            throw new validation_1.ValidationError('Current password is incorrect');
        }
        // Hash new password
        const hashedNewPassword = await auth_service_1.AuthService.hashPassword(newPassword);
        // Update password
        const query = `
            UPDATE Users 
            SET Password = @param1, UpdatedAt = GETUTCDATE()
            WHERE UserID = @param0
        `;
        await database_service_1.dbService.executeQuery(query, [userId, hashedNewPassword]);
    }
    // Verify email
    static async verifyEmail(userId) {
        const query = `
            UPDATE Users 
            SET EmailVerified = 1, UpdatedAt = GETUTCDATE()
            WHERE UserID = @param0
        `;
        await database_service_1.dbService.executeQuery(query, [userId]);
    }
    // Deactivate user account
    static async deactivateAccount(userId) {
        const query = `
            UPDATE Users 
            SET IsActive = 0, UpdatedAt = GETUTCDATE()
            WHERE UserID = @param0
        `;
        await database_service_1.dbService.executeQuery(query, [userId]);
    }
    // Get user dashboard stats
    static async getDashboardStats(userId) {
        const user = await this.findById(userId);
        if (!user) {
            throw new validation_1.NotFoundError('User not found');
        }
        if (user.UserType === config_1.appConstants.userTypes.JOB_SEEKER) {
            return await this.getJobSeekerStats(userId);
        }
        else if (user.UserType === config_1.appConstants.userTypes.EMPLOYER) {
            return await this.getEmployerStats(userId);
        }
        return {};
    }
    // Private helper methods
    static async incrementLoginAttempts(userId) {
        const query = `
            UPDATE Users 
            SET LoginAttempts = LoginAttempts + 1,
                AccountLockoutEnd = CASE 
                    WHEN LoginAttempts >= 4 THEN DATEADD(MINUTE, 30, GETUTCDATE())
                    ELSE AccountLockoutEnd
                END
            WHERE UserID = @param0
        `;
        await database_service_1.dbService.executeQuery(query, [userId]);
    }
    static async updateLastLogin(userId) {
        const query = `
            UPDATE Users 
            SET LastLoginAt = GETUTCDATE(), 
                LastActive = GETUTCDATE(),
                LoginAttempts = 0,
                AccountLockoutEnd = NULL
            WHERE UserID = @param0
        `;
        await database_service_1.dbService.executeQuery(query, [userId]);
    }
    static async getJobSeekerStats(userId) {
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
        const result = await database_service_1.dbService.executeQuery(query, [userId]);
        return result.recordset[0] || {};
    }
    static async getEmployerStats(userId) {
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
        const result = await database_service_1.dbService.executeQuery(query, [userId]);
        return result.recordset[0] || {};
    }
    // Update applicant education data - FIXED: Use only existing database fields
    static async updateEducation(userId, educationData) {
        const user = await this.findById(userId);
        if (!user) {
            throw new validation_1.NotFoundError('User not found');
        }
        // Ensure user is a job seeker
        if (user.UserType !== config_1.appConstants.userTypes.JOB_SEEKER) {
            throw new validation_1.ValidationError('Only job seekers can update education data');
        }
        // Get applicant ID
        const applicantQuery = 'SELECT ApplicantID FROM Applicants WHERE UserID = @param0';
        const applicantResult = await database_service_1.dbService.executeQuery(applicantQuery, [userId]);
        if (!applicantResult.recordset || applicantResult.recordset.length === 0) {
            throw new validation_1.NotFoundError('Applicant profile not found');
        }
        const applicantId = applicantResult.recordset[0].ApplicantID;
        // FIXED: Extract Institution name from college data
        const institutionName = educationData.college?.name || '';
        const degreeType = educationData.degreeType || '';
        const fieldOfStudy = educationData.fieldOfStudy || '';
        // FIXED: Only update education-related fields in Applicants table
        const query = `
            UPDATE Applicants 
            SET Institution = @param1,
                HighestEducation = @param2,
                FieldOfStudy = @param3,
                ProfileCompleteness = CASE 
                    WHEN Institution IS NOT NULL AND HighestEducation IS NOT NULL AND FieldOfStudy IS NOT NULL 
                    THEN 60 
                    ELSE 40 
                END
            WHERE ApplicantID = @param0
        `;
        console.log('?? Updating applicant education data:', {
            applicantId,
            institutionName,
            degreeType,
            fieldOfStudy
        });
        await database_service_1.dbService.executeQuery(query, [applicantId, institutionName, degreeType, fieldOfStudy]);
        return { success: true, message: 'Education updated successfully' };
    }
    // NEW: Update applicant work experience data - Dedicated endpoint
    static async updateWorkExperience(userId, workExperienceData) {
        const user = await this.findById(userId);
        if (!user) {
            throw new validation_1.NotFoundError('User not found');
        }
        // Ensure user is a job seeker
        if (user.UserType !== config_1.appConstants.userTypes.JOB_SEEKER) {
            throw new validation_1.ValidationError('Only job seekers can update work experience data');
        }
        // Get applicant ID
        const applicantQuery = 'SELECT ApplicantID FROM Applicants WHERE UserID = @param0';
        const applicantResult = await database_service_1.dbService.executeQuery(applicantQuery, [userId]);
        if (!applicantResult.recordset || applicantResult.recordset.length === 0) {
            throw new validation_1.NotFoundError('Applicant profile not found');
        }
        const applicantId = applicantResult.recordset[0].ApplicantID;
        // Build update fields dynamically
        const updateFields = [];
        const parameters = [applicantId];
        let paramIndex = 1;
        // Map work experience fields to database columns
        if (workExperienceData.currentJobTitle) {
            updateFields.push(`CurrentJobTitle = @param${paramIndex}`);
            parameters.push(workExperienceData.currentJobTitle);
            paramIndex++;
        }
        if (workExperienceData.currentCompany) {
            updateFields.push(`CurrentCompany = @param${paramIndex}`);
            parameters.push(workExperienceData.currentCompany);
            paramIndex++;
        }
        if (workExperienceData.yearsOfExperience) {
            // Parse years of experience string to number (e.g., "3-5 years" -> 3)
            const yearsMatch = workExperienceData.yearsOfExperience.match(/^(\d+)/);
            const years = yearsMatch ? parseInt(yearsMatch[1]) : 0;
            updateFields.push(`YearsOfExperience = @param${paramIndex}`);
            parameters.push(years);
            paramIndex++;
        }
        if (workExperienceData.primarySkills) {
            updateFields.push(`PrimarySkills = @param${paramIndex}`);
            parameters.push(workExperienceData.primarySkills);
            paramIndex++;
        }
        if (workExperienceData.secondarySkills) {
            updateFields.push(`SecondarySkills = @param${paramIndex}`);
            parameters.push(workExperienceData.secondarySkills);
            paramIndex++;
        }
        if (workExperienceData.summary) {
            updateFields.push(`Summary = @param${paramIndex}`);
            parameters.push(workExperienceData.summary);
            paramIndex++;
        }
        if (workExperienceData.workArrangement) {
            updateFields.push(`PreferredWorkTypes = @param${paramIndex}`);
            parameters.push(workExperienceData.workArrangement);
            paramIndex++;
        }
        if (workExperienceData.jobType) {
            updateFields.push(`PreferredJobTypes = @param${paramIndex}`);
            parameters.push(workExperienceData.jobType);
            paramIndex++;
        }
        if (updateFields.length === 0) {
            throw new validation_1.ValidationError('No work experience data provided');
        }
        // Calculate profile completeness including work experience fields
        const completenessFields = [
            'Institution', 'HighestEducation', 'FieldOfStudy',
            'CurrentJobTitle', 'CurrentCompany', 'YearsOfExperience', 'PrimarySkills', 'Summary'
        ];
        const completenessLogic = completenessFields.map(field => `CASE WHEN ${field} IS NOT NULL AND LEN(TRIM(CAST(${field} AS NVARCHAR(MAX)))) > 0 THEN 1 ELSE 0 END`).join(' + ');
        updateFields.push(`ProfileCompleteness = (${completenessLogic}) * 100 / ${completenessFields.length}`);
        const query = `
            UPDATE Applicants 
            SET ${updateFields.join(', ')}
            WHERE ApplicantID = @param0
        `;
        console.log('?? Updating applicant work experience data:', {
            applicantId,
            fieldsToUpdate: updateFields.length - 1, // Exclude ProfileCompleteness
            workExperienceData: Object.keys(workExperienceData)
        });
        const result = await database_service_1.dbService.executeQuery(query, parameters);
        return { success: true, message: 'Work experience updated successfully' };
    }
    // NEW: Update job preferences data - Dedicated endpoint
    static async updateJobPreferences(userId, jobPreferencesData) {
        const user = await this.findById(userId);
        if (!user) {
            throw new validation_1.NotFoundError('User not found');
        }
        // Ensure user is a job seeker
        if (user.UserType !== config_1.appConstants.userTypes.JOB_SEEKER) {
            throw new validation_1.ValidationError('Only job seekers can update job preferences data');
        }
        // Get applicant ID
        const applicantQuery = 'SELECT ApplicantID FROM Applicants WHERE UserID = @param0';
        const applicantResult = await database_service_1.dbService.executeQuery(applicantQuery, [userId]);
        if (!applicantResult.recordset || applicantResult.recordset.length === 0) {
            throw new validation_1.NotFoundError('Applicant profile not found');
        }
        const applicantId = applicantResult.recordset[0].ApplicantID;
        // Build update fields dynamically
        const updateFields = [];
        const parameters = [applicantId];
        let paramIndex = 1;
        // Map job preferences fields to database columns
        if (jobPreferencesData.preferredJobTypes) {
            // Handle array of job types
            const jobTypes = Array.isArray(jobPreferencesData.preferredJobTypes)
                ? jobPreferencesData.preferredJobTypes.map((jt) => jt.Type || jt).join(', ')
                : jobPreferencesData.preferredJobTypes;
            updateFields.push(`PreferredJobTypes = @param${paramIndex}`);
            parameters.push(jobTypes);
            paramIndex++;
        }
        if (jobPreferencesData.workplaceType) {
            updateFields.push(`PreferredWorkTypes = @param${paramIndex}`);
            parameters.push(jobPreferencesData.workplaceType);
            paramIndex++;
        }
        if (jobPreferencesData.preferredLocations) {
            const locations = Array.isArray(jobPreferencesData.preferredLocations)
                ? jobPreferencesData.preferredLocations.join(', ')
                : jobPreferencesData.preferredLocations;
            updateFields.push(`PreferredLocations = @param${paramIndex}`);
            parameters.push(locations);
            paramIndex++;
        }
        if (updateFields.length === 0) {
            throw new validation_1.ValidationError('No job preferences data provided');
        }
        // Calculate profile completeness including job preferences
        const completenessFields = [
            'Institution', 'HighestEducation', 'FieldOfStudy',
            'CurrentJobTitle', 'CurrentCompany', 'YearsOfExperience', 'PrimarySkills',
            'Summary', 'PreferredJobTypes', 'PreferredWorkTypes'
        ];
        const completenessLogic = completenessFields.map(field => `CASE WHEN ${field} IS NOT NULL AND LEN(TRIM(CAST(${field} AS NVARCHAR(MAX)))) > 0 THEN 1 ELSE 0 END`).join(' + ');
        updateFields.push(`ProfileCompleteness = (${completenessLogic}) * 100 / ${completenessFields.length}`);
        const query = `
            UPDATE Applicants 
            SET ${updateFields.join(', ')}
            WHERE ApplicantID = @param0
        `;
        console.log('?? Updating applicant job preferences data:', {
            applicantId,
            fieldsToUpdate: updateFields.length - 1, // Exclude ProfileCompleteness
            jobPreferencesData: Object.keys(jobPreferencesData)
        });
        const result = await database_service_1.dbService.executeQuery(query, parameters);
        return { success: true, message: 'Job preferences updated successfully' };
    }
}
exports.UserService = UserService;
//# sourceMappingURL=user.service.js.map