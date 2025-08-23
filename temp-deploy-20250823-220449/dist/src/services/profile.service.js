"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmployerService = exports.ApplicantService = void 0;
const database_service_1 = require("../services/database.service");
const auth_service_1 = require("../services/auth.service");
const validation_1 = require("../utils/validation");
class ApplicantService {
    // Get applicant profile by user ID
    static async getApplicantProfile(userId) {
        try {
            // Check if user exists and is a job seeker
            const userQuery = 'SELECT UserID, UserType FROM Users WHERE UserID = @param0 AND IsActive = 1';
            const userResult = await database_service_1.dbService.executeQuery(userQuery, [userId]);
            if (!userResult.recordset || userResult.recordset.length === 0) {
                throw new validation_1.NotFoundError('User not found');
            }
            // Get or create applicant profile - FIXED: Use exact database field names
            let applicantQuery = `
                SELECT 
                    a.*,
                    u.FirstName,
                    u.LastName,
                    u.Email,
                    u.Phone
                FROM Applicants a
                INNER JOIN Users u ON a.UserID = u.UserID
                WHERE a.UserID = @param0
            `;
            let applicantResult = await database_service_1.dbService.executeQuery(applicantQuery, [userId]);
            // If no applicant profile exists, create one
            if (!applicantResult.recordset || applicantResult.recordset.length === 0) {
                console.log('Creating applicant profile for user:', userId);
                await this.createApplicantProfile(userId);
                // Retry query after creation
                applicantResult = await database_service_1.dbService.executeQuery(applicantQuery, [userId]);
            }
            if (!applicantResult.recordset || applicantResult.recordset.length === 0) {
                throw new Error('Failed to create or retrieve applicant profile');
            }
            return applicantResult.recordset[0];
        }
        catch (error) {
            console.error('Error getting applicant profile:', error);
            throw error;
        }
    }
    // Update applicant profile - COMPLETELY REWRITTEN to be dynamic and match exact schema
    static async updateApplicantProfile(userId, profileData) {
        try {
            // First, get existing profile to merge with new data
            const existingProfile = await this.getApplicantProfile(userId);
            const applicantId = existingProfile.ApplicantID;
            if (!applicantId) {
                throw new Error('Could not determine applicant ID');
            }
            // FIXED: Complete field mapping based on your exact database schema
            const fieldMapping = {
                // Personal Information
                'nationality': 'Nationality',
                'currentLocation': 'CurrentLocation',
                'preferredLocations': 'PreferredLocations',
                // Social Profiles
                'linkedInProfile': 'LinkedInProfile',
                'githubProfile': 'GithubProfile',
                // Documents
                'primaryResumeURL': 'PrimaryResumeURL',
                'additionalDocuments': 'AdditionalDocuments',
                // Education (can be updated via this endpoint too)
                'highestEducation': 'HighestEducation',
                'fieldOfStudy': 'FieldOfStudy',
                'institution': 'Institution',
                // Professional Information
                'headline': 'Headline',
                'summary': 'Summary',
                'currentJobTitle': 'CurrentJobTitle',
                'currentCompany': 'CurrentCompany',
                'currentSalary': 'CurrentSalary',
                'currentSalaryUnit': 'CurrentSalaryUnit',
                'currentCurrencyID': 'CurrentCurrencyID',
                'yearsOfExperience': 'YearsOfExperience',
                'noticePeriod': 'NoticePeriod',
                'totalWorkExperience': 'TotalWorkExperience',
                // Job Preferences
                'preferredJobTypes': 'PreferredJobTypes',
                'preferredWorkTypes': 'PreferredWorkTypes',
                'expectedSalaryMin': 'ExpectedSalaryMin',
                'expectedSalaryMax': 'ExpectedSalaryMax',
                'expectedSalaryUnit': 'ExpectedSalaryUnit',
                'preferredRoles': 'PreferredRoles',
                'preferredIndustries': 'PreferredIndustries',
                'preferredMinimumSalary': 'PreferredMinimumSalary',
                // Skills and Experience
                'primarySkills': 'PrimarySkills',
                'secondarySkills': 'SecondarySkills',
                'languages': 'Languages',
                'certifications': 'Certifications',
                'workExperience': 'WorkExperience',
                // Availability and Preferences
                'immediatelyAvailable': 'ImmediatelyAvailable',
                'willingToRelocate': 'WillingToRelocate',
                'jobSearchStatus': 'JobSearchStatus',
                // Privacy Settings
                'allowRecruitersToContact': 'AllowRecruitersToContact',
                'hideCurrentCompany': 'HideCurrentCompany',
                'hideSalaryDetails': 'HideSalaryDetails',
                // Status Fields
                'isOpenToWork': 'IsOpenToWork',
                'isFeatured': 'IsFeatured',
                'featuredUntil': 'FeaturedUntil',
                // Additional
                'tags': 'Tags'
            };
            // Build dynamic update query
            const updateFields = [];
            const parameters = [applicantId];
            let paramIndex = 1;
            // Process each field from frontend data
            Object.keys(profileData).forEach(key => {
                if (key in fieldMapping && profileData[key] !== undefined && profileData[key] !== null) {
                    const dbField = fieldMapping[key];
                    updateFields.push(`${dbField} = @param${paramIndex}`);
                    // Handle data type conversions based on your schema
                    let value = profileData[key];
                    // Integer fields
                    if (['yearsOfExperience', 'noticePeriod', 'currentCurrencyID'].includes(key)) {
                        value = value ? parseInt(value.toString()) : null;
                    }
                    // Decimal fields
                    else if (['currentSalary', 'expectedSalaryMin', 'expectedSalaryMax', 'expectedSalaryUnit', 'preferredMinimumSalary'].includes(key)) {
                        value = value ? parseFloat(value.toString()) : null;
                    }
                    // Boolean fields (convert to bit: 1/0)
                    else if (['immediatelyAvailable', 'willingToRelocate', 'allowRecruitersToContact',
                        'hideCurrentCompany', 'hideSalaryDetails', 'isOpenToWork', 'isFeatured'].includes(key)) {
                        // FIXED: Use frontend value, don't hardcode
                        value = (value === true || value === 1 || value === '1' || value === 'true') ? 1 : 0;
                    }
                    // DateTime fields
                    else if (['featuredUntil'].includes(key)) {
                        value = value ? new Date(value) : null;
                    }
                    // String fields - keep as is, but handle empty strings
                    else if (typeof value === 'string') {
                        value = value.trim() || null;
                    }
                    parameters.push(value);
                    paramIndex++;
                }
            });
            // If no valid fields to update, throw error
            if (updateFields.length === 0) {
                throw new validation_1.ValidationError('No valid fields provided for update');
            }
            // Calculate profile completeness dynamically
            const completenessFields = [
                'Headline', 'CurrentJobTitle', 'YearsOfExperience', 'PrimarySkills',
                'Summary', 'CurrentLocation', 'PreferredJobTypes', 'HighestEducation'
            ];
            // Count how many key fields are filled
            const completenessLogic = completenessFields.map(field => `CASE WHEN ${field} IS NOT NULL AND LEN(TRIM(CAST(${field} AS NVARCHAR(MAX)))) > 0 THEN 1 ELSE 0 END`).join(' + ');
            updateFields.push(`ProfileCompleteness = (${completenessLogic}) * 100 / ${completenessFields.length}`);
            // Build and execute update query
            const updateQuery = `
                UPDATE Applicants 
                SET ${updateFields.join(', ')}
                WHERE ApplicantID = @param0;
                
                -- Return updated profile with user data
                SELECT 
                    a.*,
                    u.FirstName,
                    u.LastName,
                    u.Email,
                    u.Phone
                FROM Applicants a
                INNER JOIN Users u ON a.UserID = u.UserID
                WHERE a.ApplicantID = @param0;
            `;
            const result = await database_service_1.dbService.executeQuery(updateQuery, parameters);
            if (!result.recordset || result.recordset.length === 0) {
                throw new Error('Failed to update applicant profile');
            }
            console.log(`? Updated applicant profile for user ${userId}:`, {
                fieldsUpdated: Object.keys(profileData).filter(key => key in fieldMapping),
                applicantId: applicantId,
                updateCount: updateFields.length - 1, // Exclude ProfileCompleteness
                newCompleteness: result.recordset[0].ProfileCompleteness
            });
            return result.recordset[0];
        }
        catch (error) {
            console.error('? Error updating applicant profile:', error);
            throw error;
        }
    }
    // Create new applicant profile - FIXED: Remove hardcoded values
    static async createApplicantProfile(userId) {
        const applicantId = auth_service_1.AuthService.generateUniqueId();
        // FIXED: Only set essential defaults, keep everything else NULL
        const query = `
            INSERT INTO Applicants (
                ApplicantID, 
                UserID, 
                ProfileCompleteness, 
                IsOpenToWork,
                AllowRecruitersToContact, 
                HideCurrentCompany, 
                HideSalaryDetails,
                ImmediatelyAvailable, 
                WillingToRelocate, 
                IsFeatured
            ) VALUES (
                @param0, @param1, 10, 1, 1, 0, 0, 0, 0, 0
            )
        `;
        await database_service_1.dbService.executeQuery(query, [applicantId, userId]);
        console.log(`? Created minimal applicant profile ${applicantId} for user ${userId}`);
        return applicantId;
    }
}
exports.ApplicantService = ApplicantService;
class EmployerService {
    // Get employer profile by user ID
    static async getEmployerProfile(userId) {
        try {
            const query = `
                SELECT 
                    e.*,
                    o.Name as OrganizationName,
                    o.Industry as OrganizationIndustry,
                    o.Size as OrganizationSize,
                    o.Location as OrganizationLocation,
                    o.Website as OrganizationWebsite,
                    u.FirstName,
                    u.LastName,
                    u.Email,
                    u.Phone
                FROM Employers e
                INNER JOIN Organizations o ON e.OrganizationID = o.OrganizationID
                INNER JOIN Users u ON e.UserID = u.UserID
                WHERE e.UserID = @param0
            `;
            const result = await database_service_1.dbService.executeQuery(query, [userId]);
            if (!result.recordset || result.recordset.length === 0) {
                throw new validation_1.NotFoundError('Employer profile not found');
            }
            return result.recordset[0];
        }
        catch (error) {
            console.error('Error getting employer profile:', error);
            throw error;
        }
    }
    // Update employer profile
    static async updateEmployerProfile(userId, profileData) {
        try {
            // Get employer and organization IDs
            const employerQuery = `
                SELECT e.EmployerID, e.OrganizationID 
                FROM Employers e 
                WHERE e.UserID = @param0
            `;
            const employerResult = await database_service_1.dbService.executeQuery(employerQuery, [userId]);
            if (!employerResult.recordset || employerResult.recordset.length === 0) {
                throw new validation_1.NotFoundError('Employer profile not found');
            }
            const { EmployerID: employerId, OrganizationID: organizationId } = employerResult.recordset[0];
            // Update employer fields
            const employerFields = {
                'jobTitle': 'JobTitle',
                'department': 'Department',
                'canPostJobs': 'CanPostJobs',
                'canManageApplications': 'CanViewApplications',
                'canViewAnalytics': 'CanScheduleInterviews',
                'recruitmentFocus': 'Bio',
                'linkedInProfile': 'LinkedInProfile',
                'bio': 'Bio'
            };
            const employerUpdates = [];
            const employerParams = [employerId];
            let employerParamIndex = 1;
            Object.keys(profileData).forEach(key => {
                if (key in employerFields && profileData[key] !== undefined) {
                    const dbField = employerFields[key];
                    employerUpdates.push(`${dbField} = @param${employerParamIndex}`);
                    let value = profileData[key];
                    if (key.startsWith('can')) {
                        value = value ? 1 : 0;
                    }
                    employerParams.push(value);
                    employerParamIndex++;
                }
            });
            // Update organization fields
            const orgFields = {
                'organizationName': 'Name',
                'organizationSize': 'Size',
                'industry': 'Industry'
            };
            const orgUpdates = [];
            const orgParams = [organizationId];
            let orgParamIndex = 1;
            Object.keys(profileData).forEach(key => {
                if (key in orgFields && profileData[key] !== undefined) {
                    const dbField = orgFields[key];
                    orgUpdates.push(`${dbField} = @param${orgParamIndex}`);
                    orgParams.push(profileData[key]);
                    orgParamIndex++;
                }
            });
            // Execute updates
            if (employerUpdates.length > 0) {
                const employerUpdateQuery = `
                    UPDATE Employers 
                    SET ${employerUpdates.join(', ')}, LastUpdatedAt = GETUTCDATE()
                    WHERE EmployerID = @param0
                `;
                await database_service_1.dbService.executeQuery(employerUpdateQuery, employerParams);
            }
            if (orgUpdates.length > 0) {
                const orgUpdateQuery = `
                    UPDATE Organizations 
                    SET ${orgUpdates.join(', ')}, UpdatedAt = GETUTCDATE()
                    WHERE OrganizationID = @param0
                `;
                await database_service_1.dbService.executeQuery(orgUpdateQuery, orgParams);
            }
            // Return updated profile
            return await this.getEmployerProfile(userId);
        }
        catch (error) {
            console.error('Error updating employer profile:', error);
            throw error;
        }
    }
}
exports.EmployerService = EmployerService;
//# sourceMappingURL=profile.service.js.map