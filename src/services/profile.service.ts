import { dbService } from '../services/database.service';
import { AuthService } from '../services/auth.service';
import { ValidationError, NotFoundError } from '../utils/validation';
import { decrypt, maskEmail } from '../utils/encryption';

// Define interfaces for type safety
interface ApplicantFieldMapping {
    [key: string]: string;
}

interface EmployerFieldMapping {
    [key: string]: string;
}

interface OrganizationFieldMapping {
    [key: string]: string;
}

interface ProfileData {
    [key: string]: any;
}

/** Salary component structure for detailed compensation breakdown */
interface SalaryComponent {
    ComponentID: number;
    ComponentName: string;
    ComponentType: string;
    Amount: number;
    CurrencyID: number;
    Frequency?: string;
    Notes?: string;
}

interface SalaryBreakdown {
    current: SalaryComponent[];
    expected: SalaryComponent[];
}

export class ApplicantService {
    // Get applicant profile with extended data
    static async getApplicantProfile(userId: string): Promise<any> {
        try {
            // Check if user exists and is a job seeker
            const userQuery = 'SELECT UserID, UserType FROM Users WHERE UserID = @param0 AND IsActive = 1';
            const userResult = await dbService.executeQuery(userQuery, [userId]);
            
            if (!userResult.recordset || userResult.recordset.length === 0) {
                throw new NotFoundError('User not found');
            }
            
            // Get or create applicant profile with salary data
            let applicantQuery = `
                SELECT 
                    a.*,
                    u.FirstName,
                    u.LastName,
                    u.Email,
                    u.Phone,
                    u.ProfilePictureURL,
                    u.IsVerifiedReferrer,
                    u.IsVerifiedUser,
                    ISNULL(a.ReferralPoints, 0) as ReferralPoints
                FROM Applicants a
                INNER JOIN Users u ON a.UserID = u.UserID
                WHERE a.UserID = @param0
            `;
            
            let applicantResult = await dbService.executeQuery(applicantQuery, [userId]);
            
            // If no applicant profile exists, create one
            if (!applicantResult.recordset || applicantResult.recordset.length === 0) {
                await this.createApplicantProfile(userId);
                
                // Retry query after creation
                applicantResult = await dbService.executeQuery(applicantQuery, [userId]);
            }
            
            if (!applicantResult.recordset || applicantResult.recordset.length === 0) {
                throw new Error('Failed to create or retrieve applicant profile');
            }

            const profile = applicantResult.recordset[0];

            // Compute derived current job fields and total experience from WorkExperiences
            try {
                const experiences = await dbService.executeQuery(
                    `SELECT TOP 1 * FROM WorkExperiences WHERE ApplicantID = @param0 AND (IsActive = 1 OR IsActive IS NULL)
                     ORDER BY CASE WHEN EndDate IS NULL THEN 1 ELSE 0 END DESC, EndDate DESC, StartDate DESC`,
                    [profile.ApplicantID]
                );

                const allExp = await dbService.executeQuery(
                    `SELECT StartDate, EndDate FROM WorkExperiences WHERE ApplicantID = @param0 AND (IsActive = 1 OR IsActive IS NULL)`,
                    [profile.ApplicantID]
                );

                const now = new Date();
                let totalMonths = 0;
                if (allExp.recordset) {
                    for (const row of allExp.recordset) {
                        const start = new Date(row.StartDate);
                        const end = row.EndDate ? new Date(row.EndDate) : now;
                        const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
                        totalMonths += Math.max(0, months);
                    }
                }

                // Attach derived fields for display
                (profile as any).TotalExperienceMonths = profile.TotalExperienceMonths ?? totalMonths;
                if (experiences.recordset && experiences.recordset.length > 0) {
                    const latest = experiences.recordset[0];
                    (profile as any).CurrentJobTitle = latest.JobTitle || profile.CurrentJobTitle;
                    (profile as any).CurrentOrganizationID = latest.OrganizationID;
                    if (latest.OrganizationID) {
                        const org = await dbService.executeQuery('SELECT Name FROM Organizations WHERE OrganizationID = @param0', [latest.OrganizationID]);
                        (profile as any).CurrentCompanyName = org.recordset && org.recordset[0] ? org.recordset[0].Name : (latest.CompanyName || profile.CurrentCompanyName);
                    } else {
                        // Fallback to CompanyName from WorkExperiences or Applicants table
                        (profile as any).CurrentCompanyName = latest.CompanyName || profile.CurrentCompanyName || null;
                    }
                }
            } catch (e) {
                console.warn('Could not compute derived work experience fields:', e);
            }

            // Get referral stats for profile header (AssignedReferrerID = UserID)
            try {
                const referralStatsQuery = `
                    SELECT 
                        COUNT(DISTINCT CASE WHEN rr.AssignedReferrerID = @param0 THEN rr.RequestID END) as TotalReferralsMade,
                        COUNT(DISTINCT CASE WHEN rr.AssignedReferrerID = @param0 AND rr.Status = 'Verified' THEN rr.RequestID END) as VerifiedReferrals,
                        COUNT(DISTINCT CASE WHEN rr.ApplicantID = @param1 THEN rr.RequestID END) as ReferralRequestsMade,
                        ISNULL(SUM(CASE WHEN rw.ReferrerID = @param1 THEN rw.PointsEarned ELSE 0 END), 0) as TotalPointsFromRewards
                    FROM ReferralRequests rr
                    LEFT JOIN ReferralRewards rw ON rr.RequestID = rw.RequestID
                    WHERE (rr.AssignedReferrerID = @param0 OR rr.ApplicantID = @param1)
                `;
                const statsResult = await dbService.executeQuery(referralStatsQuery, [userId, profile.ApplicantID]);  // userId for AssignedReferrerID, ApplicantID for seeker
                
                if (statsResult.recordset && statsResult.recordset.length > 0) {
                    const stats = statsResult.recordset[0];
                    profile.referralStats = {
                        totalReferralsMade: stats.TotalReferralsMade || 0,
                        verifiedReferrals: stats.VerifiedReferrals || 0,
                        referralRequestsMade: stats.ReferralRequestsMade || 0,
                        totalPointsFromRewards: stats.TotalPointsFromRewards || 0
                    };
                }
            } catch (e) {
                console.warn('Could not load referral stats:', e);
                profile.referralStats = {
                    totalReferralsMade: 0,
                    verifiedReferrals: 0,
                    referralRequestsMade: 0,
                    totalPointsFromRewards: 0
                };
            }

            // Get salary breakdown for this applicant
            try {
                const salaryData = await this.getApplicantSalaryBreakdown(profile.ApplicantID);
                profile.salaryBreakdown = salaryData;
            } catch (error) {
                console.warn('Could not load salary data:', error);
                profile.salaryBreakdown = { current: [], expected: [] };
            }

            // Get resumes for this applicant
            try {
                const resumes = await this.getApplicantResumes(profile.ApplicantID);
                profile.resumes = resumes;
                // Set primary resume for backward compatibility
                const primaryResume = resumes.find(r => r.IsPrimary) || resumes[0];
                profile.primaryResumeURL = primaryResume?.ResumeURL || null;
            } catch (error) {
                console.warn('Could not load resumes:', error);
                profile.resumes = [];
                profile.primaryResumeURL = null;
            }

            // Get all work experiences for this applicant
            try {
                const workExpQuery = `
                    SELECT 
                        we.WorkExperienceID,
                        we.CompanyName,
                        we.JobTitle,
                        we.Department,
                        we.EmploymentType,
                        we.StartDate,
                        we.EndDate,
                        we.IsCurrent,
                        we.Location,
                        we.Country,
                        we.Description,
                        we.Skills,
                        we.CompanyEmail,
                        we.CompanyEmailVerified,
                        o.Name as OrganizationName,
                        o.LogoURL as OrganizationLogo
                    FROM WorkExperiences we
                    LEFT JOIN Organizations o ON we.OrganizationID = o.OrganizationID
                    WHERE we.ApplicantID = @param0 AND (we.IsActive = 1 OR we.IsActive IS NULL)
                    ORDER BY we.IsCurrent DESC, we.EndDate DESC, we.StartDate DESC
                `;
                const workExpResult = await dbService.executeQuery(workExpQuery, [profile.ApplicantID]);
                // Remove CompanyEmail from response - not needed in frontend
                profile.workExperiences = (workExpResult.recordset || []).map((we: any) => {
                    const { CompanyEmail, ...rest } = we;
                    return rest;
                });
            } catch (error) {
                console.warn('Could not load work experiences:', error);
                profile.workExperiences = [];
            }
            
            // Recalculate and update profile completeness to ensure it's fresh
            try {
                const { UserService } = await import('./user.service');
                const freshCompleteness = await UserService.recomputeProfileCompletenessByApplicantId(profile.ApplicantID);
                profile.ProfileCompleteness = freshCompleteness;
            } catch (error) {
                console.warn('Could not recalculate profile completeness:', error);
            }
            
            return profile;
        } catch (error) {
            console.error('Error getting applicant profile:', error);
            throw error;
        }
    }

    /** Get salary breakdown (current and expected) for an applicant */
    static async getApplicantSalaryBreakdown(applicantId: string): Promise<SalaryBreakdown> {
        try {
            const query = `
                SELECT 
                    aps.*,
                    sc.ComponentName,
                    sc.ComponentType,
                    c.Code as CurrencyCode,
                    c.Symbol as CurrencySymbol
                FROM ApplicantSalaries aps
                INNER JOIN SalaryComponents sc ON aps.ComponentID = sc.ComponentID
                INNER JOIN Currencies c ON aps.CurrencyID = c.CurrencyID
                WHERE aps.ApplicantID = @param0
                ORDER BY aps.SalaryContext, sc.ComponentID
            `;
            
            const result = await dbService.executeQuery(query, [applicantId]);
            
            const current: SalaryComponent[] = [];
            const expected: SalaryComponent[] = [];
            
            if (result.recordset) {
                result.recordset.forEach((row: any) => {
                    const component: SalaryComponent = {
                        ComponentID: row.ComponentID,
                        ComponentName: row.ComponentName,
                        ComponentType: row.ComponentType,
                        Amount: row.Amount,
                        CurrencyID: row.CurrencyID,
                        Frequency: row.Frequency,
                        Notes: row.Notes
                    };
                    
                    if (row.SalaryContext === 'Current') {
                        current.push(component);
                    } else if (row.SalaryContext === 'Expected') {
                        expected.push(component);
                    }
                });
            }
            
            return { current, expected };
        } catch (error) {
            console.error('Error getting salary breakdown:', error);
            throw error;
        }
    }

    /** Update salary breakdown for an applicant */
    static async updateApplicantSalaryBreakdown(applicantId: string, salaryData: SalaryBreakdown): Promise<void> {
        try {
            // Delete existing salary records for this applicant
            await dbService.executeQuery(
                'DELETE FROM ApplicantSalaries WHERE ApplicantID = @param0',
                [applicantId]
            );
            
            // Insert current salary components
            for (const component of salaryData.current) {
                const salaryId = AuthService.generateUniqueId();
                await dbService.executeQuery(`
                    INSERT INTO ApplicantSalaries (
                        ApplicantSalaryID, ApplicantID, ComponentID, Amount, 
                        CurrencyID, Frequency, SalaryContext, Notes,
                        CreatedAt, UpdatedAt
                    ) VALUES (
                        @param0, @param1, @param2, @param3, @param4, @param5, 
                        'Current', @param6, GETUTCDATE(), GETUTCDATE()
                    )
                `, [salaryId, applicantId, component.ComponentID, component.Amount, 
                    component.CurrencyID, component.Frequency || 'Yearly', component.Notes || '']);
            }
            
            // Insert expected salary components
            for (const component of salaryData.expected) {
                const salaryId = AuthService.generateUniqueId();
                await dbService.executeQuery(`
                    INSERT INTO ApplicantSalaries (
                        ApplicantSalaryID, ApplicantID, ComponentID, Amount, 
                        CurrencyID, Frequency, SalaryContext, Notes,
                        CreatedAt, UpdatedAt
                    ) VALUES (
                        @param0, @param1, @param2, @param3, @param4, @param5, 
                        'Expected', @param6, GETUTCDATE(), GETUTCDATE()
                    )
                `, [salaryId, applicantId, component.ComponentID, component.Amount, 
                    component.CurrencyID, component.Frequency || 'Yearly', component.Notes || '']);
            }
        } catch (error) {
            console.error('Error updating salary breakdown:', error);
            throw error;
        }
    }

    // Update applicant profile - ENHANCED: Removed old salary fields, added salary breakdown handling
    static async updateApplicantProfile(userId: string, profileData: ProfileData): Promise<any> {
        try {
            // First, get existing profile to merge with new data
            const existingProfile = await this.getApplicantProfile(userId);
            const applicantId = existingProfile.ApplicantID;
            
            if (!applicantId) {
                throw new Error('Could not determine applicant ID');
            }

            // Field mapping (excludes removed columns: CurrentCompany, CurrentJobTitle, YearsOfExperience, WorkExperience)
            const fieldMapping: ApplicantFieldMapping = {
                // Personal Information
                'nationality': 'Nationality',
                'currentLocation': 'CurrentLocation',
                'preferredLocations': 'PreferredLocations',
                
                // Social Profiles
                'linkedInProfile': 'LinkedInProfile',
                'githubProfile': 'GithubProfile',
                
                // Documents - REMOVED: primaryResumeURL (handled via ApplicantResumes table, not Applicants column)
                'additionalDocuments': 'AdditionalDocuments',
                
                // Education (? Enhanced with GraduationYear and GPA)
                'highestEducation': 'HighestEducation',
                'fieldOfStudy': 'FieldOfStudy',
                'institution': 'Institution',
                'graduationYear': 'GraduationYear',
                'gpa': 'GPA',
                
                // Professional Information
                'headline': 'Headline',
                'summary': 'Summary',
                'noticePeriod': 'NoticePeriod',
                
                // Job Preferences
                'preferredJobTypes': 'PreferredJobTypes',
                'preferredWorkTypes': 'PreferredWorkTypes',
                'preferredRoles': 'PreferredRoles',
                'preferredIndustries': 'PreferredIndustries',
                'minimumSalary': 'MinimumSalary',
                'preferredCompanySize': 'PreferredCompanySize',
                
                // Skills and Experience
                'primarySkills': 'PrimarySkills',
                'secondarySkills': 'SecondarySkills',
                'languages': 'Languages',
                'certifications': 'Certifications',
                
                // Availability and Preferences
                'immediatelyAvailable': 'ImmediatelyAvailable',
                'willingToRelocate': 'WillingToRelocate',
                'jobSearchStatus': 'JobSearchStatus',
                
                // Privacy Settings
                'allowRecruitersToContact': 'AllowRecruitersToContact',
                'hideCurrentCompany': 'HideCurrentCompany',
                'hideSalaryDetails': 'HideSalaryDetails',
                'openToRefer': 'OpenToRefer',

                // Status Fields
                'isOpenToWork': 'IsOpenToWork',
                'isFeatured': 'IsFeatured',
                'featuredUntil': 'FeaturedUntil',
                
                // Additional Fields
                'tags': 'Tags'
            };

            // Handle salary breakdown separately if provided
            let salaryUpdated = false;
            if (profileData.salaryBreakdown) {
                await this.updateApplicantSalaryBreakdown(applicantId, profileData.salaryBreakdown);
                salaryUpdated = true;
                delete profileData.salaryBreakdown; // Remove from regular profile update
            }

            // Build dynamic update query
            const updateFields: string[] = [];
            const parameters: any[] = [applicantId];
            let paramIndex = 1;

            // Process each field from frontend data
            Object.keys(profileData).forEach(key => {
                if (key in fieldMapping && profileData[key] !== undefined && profileData[key] !== null) {
                    const dbField = fieldMapping[key];
                    updateFields.push(`${dbField} = @param${paramIndex}`);
                    
                    // Handle data type conversions based on your schema
                    let value = profileData[key];
                    
                    // Integer fields
                    if (['noticePeriod'].includes(key)) {
                        value = value ? parseInt(value.toString()) : null;
                    }
                    // Decimal fields (? UPDATED: Only MinimumSalary remains)
                    else if (['minimumSalary'].includes(key)) {
                        value = value ? parseFloat(value.toString()) : null;
                    }
                    // Boolean fields (convert to bit: 1/0)
                    else if (['immediatelyAvailable', 'willingToRelocate', 'allowRecruitersToContact', 
                             'hideCurrentCompany', 'hideSalaryDetails', 'openToRefer', 'isOpenToWork', 'isFeatured'].includes(key)) {
                        value = (value === true || value === 1 || value === '1' || value === 'true') ? 1 : 0;
                    }
                    // String fields - keep as is, but handle empty strings
                    else if (typeof value === 'string') {
                        value = value.trim() || null;
                    }
                    
                    parameters.push(value);
                    paramIndex++;
                }
            });

            // Allow salary-only updates (no profile field changes)
            if (updateFields.length === 0 && !salaryUpdated) {
                throw new ValidationError('No valid fields provided for update');
            }

            // If there are fields to update, update the main profile
            if (updateFields.length > 0) {
                // Calculate profile completeness dynamically (exclude removed columns)
                const completenessFields = [
                    'Headline', 'PrimarySkills', 
                    'Summary', 'CurrentLocation', 'PreferredJobTypes', 'HighestEducation'
                ];
                
                const completenessLogic = completenessFields.map(field => 
                    `CASE WHEN ${field} IS NOT NULL AND LEN(TRIM(CAST(${field} AS NVARCHAR(MAX)))) > 0 THEN 1 ELSE 0 END`
                ).join(' + ');
                
                updateFields.push(`ProfileCompleteness = (${completenessLogic}) * 100 / ${completenessFields.length}`);
                updateFields.push(`UpdatedAt = GETUTCDATE()`);

                // Build and execute update query
                const updateQuery = `
                    UPDATE Applicants 
                    SET ${updateFields.join(', ')}
                    WHERE ApplicantID = @param0
                `;

                await dbService.executeQuery(updateQuery, parameters);
            }

            // Return updated profile with salary breakdown
            return await this.getApplicantProfile(userId);
        } catch (error) {
            console.error('Error updating applicant profile:', error);
            throw error;
        }
    }

    // Create new applicant profile
    private static async createApplicantProfile(userId: string): Promise<string> {
        const applicantId = AuthService.generateUniqueId();
        
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
                IsFeatured,
                OpenToRefer,
                CreatedAt,
                UpdatedAt
            ) VALUES (
                @param0, @param1, 10, 1, 1, 0, 0, 0, 0, 0, 1,
                GETUTCDATE(), GETUTCDATE()
            )
        `;
        
        await dbService.executeQuery(query, [applicantId, userId]);
        return applicantId;
    }

    /** Get available salary components for frontend dropdown */
    static async getSalaryComponents(): Promise<any[]> {
        try {
            const query = 'SELECT * FROM SalaryComponents WHERE IsActive = 1 ORDER BY ComponentID';
            const result = await dbService.executeQuery(query, []);
            return result.recordset || [];
        } catch (error) {
            console.error('Error getting salary components:', error);
            throw error;
        }
    }

    /** Get all resumes for an applicant (excludes soft-deleted) */
    static async getApplicantResumes(applicantId: string): Promise<any[]> {
        try {
            const query = `
                SELECT 
                    ResumeID,
                    ResumeLabel,
                    ResumeURL,
                    IsPrimary,
                    IsDeleted,
                    DeletedAt,
                    CreatedAt,
                    UpdatedAt
                FROM ApplicantResumes 
                WHERE ApplicantID = @param0 AND (IsDeleted =0 OR IsDeleted IS NULL)
                ORDER BY IsPrimary DESC, CreatedAt DESC
            `;
            const result = await dbService.executeQuery(query, [applicantId]);
            return result.recordset || [];
        } catch (error) {
            console.error('Error getting applicant resumes:', error);
            throw error;
        }
    }

    /** Get resume for historical viewing (includes soft-deleted for application history) */
    static async getResumeForViewing(resumeId: string): Promise<any | null> {
        try {
            const query = `
                SELECT 
                    ResumeID,
                    ResumeLabel,
                    ResumeURL,
                    IsPrimary,
                    IsDeleted,
                    DeletedAt,
                    CreatedAt,
                    UpdatedAt
                FROM ApplicantResumes 
                WHERE ResumeID = @param0
            `;
            const result = await dbService.executeQuery(query, [resumeId]);
            return result.recordset && result.recordset.length >0 ? result.recordset[0] : null;
        } catch (error) {
            console.error('Error getting resume for viewing:', error);
            return null;
        }
    }

    /** Get primary resume for an applicant */
    static async getPrimaryResume(applicantId: string): Promise<any | null> {
        try {
            const query = `
                SELECT TOP 1
                    ResumeID,
                    ResumeLabel,
                    ResumeURL,
                    IsPrimary,
                    CreatedAt,
                    UpdatedAt
                FROM ApplicantResumes 
                WHERE ApplicantID = @param0 AND IsPrimary =1 AND (IsDeleted =0 OR IsDeleted IS NULL)
                ORDER BY CreatedAt DESC
            `;
            const result = await dbService.executeQuery(query, [applicantId]);
            return result.recordset && result.recordset.length >0 ? result.recordset[0] : null;
        } catch (error) {
            console.error('Error getting primary resume:', error);
            return null;
        }
    }

    /** Save a new resume for an applicant (max 3 resumes) */
    static async saveApplicantResume(applicantId: string, resumeData: any): Promise<string> {
        try {
            const resumeId = AuthService.generateUniqueId();

            // If this is being set as primary, unset other primary resumes
            if (resumeData.isPrimary) {
                await dbService.executeQuery(
                    'UPDATE ApplicantResumes SET IsPrimary = 0 WHERE ApplicantID = @param0',
                    [applicantId]
                );
            }

            // Check resume limit (max 3 resumes per applicant)
            const countQuery = 'SELECT COUNT(*) as ResumeCount FROM ApplicantResumes WHERE ApplicantID = @param0';
            const countResult = await dbService.executeQuery(countQuery, [applicantId]);
            const currentCount = countResult.recordset[0]?.ResumeCount || 0;

            if (currentCount >= 3) {
                // Get the oldest non-primary resume details before deleting
                const oldestResumeQuery = `
                    SELECT TOP 1 ResumeID, ResumeURL FROM ApplicantResumes 
                    WHERE ApplicantID = @param0 AND IsPrimary = 0
                    ORDER BY CreatedAt ASC
                `;
                const oldestResult = await dbService.executeQuery(oldestResumeQuery, [applicantId]);
                
                if (oldestResult.recordset && oldestResult.recordset.length > 0) {
                    const oldestResume = oldestResult.recordset[0];
                    
                    // Delete from database first
                    await dbService.executeQuery(
                        'DELETE FROM ApplicantResumes WHERE ResumeID = @param0',
                        [oldestResume.ResumeID]
                    );
                    
                    // Delete file from storage too
                    try {
                        const { ResumeStorageService } = await import('../services/resume-upload.service');
                        const storageService = new ResumeStorageService();
                        
                        // Extract userId from applicantId (need to get from Users table)
                        const userQuery = 'SELECT UserID FROM Applicants WHERE ApplicantID = @param0';
                        const userResult = await dbService.executeQuery(userQuery, [applicantId]);
                        const userId = userResult.recordset[0]?.UserID;
                        
                        if (userId && oldestResume.ResumeURL) {
                            await storageService.deleteOldResume(userId, oldestResume.ResumeURL);
                        }
                    } catch (storageError) {
                        console.warn('Failed to delete old resume from storage:', storageError);
                        // Continue - database cleanup succeeded
                    }
                }
            }

            // Insert new resume
            const insertQuery = `
                INSERT INTO ApplicantResumes (
                    ResumeID, ApplicantID, ResumeLabel, ResumeURL, 
                    IsPrimary, CreatedAt, UpdatedAt
                ) VALUES (
                    @param0, @param1, @param2, @param3, @param4, 
                    GETUTCDATE(), GETUTCDATE()
                )
            `;

            await dbService.executeQuery(insertQuery, [
                resumeId,
                applicantId,
                resumeData.resumeLabel,
                resumeData.resumeURL,
                resumeData.isPrimary ? 1 : 0
            ]);

            return resumeId;
        } catch (error) {
            console.error('Error saving applicant resume:', error);
            throw error;
        }
    }

    /** Delete a resume (soft delete if referenced by applications/referrals, hard delete otherwise) */
    static async deleteApplicantResume(applicantId: string, resumeId: string): Promise<{ success: boolean; softDelete: boolean; message: string; applicationCount?: number; referralCount?: number; }> {
        try {
            // Verify resume exists
            const resumeQuery = `SELECT IsPrimary, IsDeleted, ResumeURL FROM ApplicantResumes WHERE ResumeID = @param0 AND ApplicantID = @param1`;
            const resumeResult = await dbService.executeQuery(resumeQuery, [resumeId, applicantId]);
            if (!resumeResult.recordset || resumeResult.recordset.length ===0) {
                throw new NotFoundError('Resume not found');
            }
            const resume = resumeResult.recordset[0];
            if (resume.IsDeleted) {
                throw new ValidationError('Resume has already been deleted');
            }

            // Active (non-deleted) resume counts
            const activeResumesQuery = `SELECT COUNT(*) as Total, SUM(CAST(IsPrimary as INT)) as PrimaryCount FROM ApplicantResumes WHERE ApplicantID = @param0 AND (IsDeleted =0 OR IsDeleted IS NULL)`;
            const activeResumesResult = await dbService.executeQuery(activeResumesQuery, [applicantId]);
            const { Total, PrimaryCount } = activeResumesResult.recordset[0];
            if (Total <=1) {
                throw new ValidationError('Cannot delete the last resume. Upload a new resume first.');
            }
            if (resume.IsPrimary && PrimaryCount <=1) {
                throw new ValidationError('Cannot delete the primary resume. Set another resume as primary first.');
            }

            // Check usage
            const usageQuery = `
            SELECT 
                (SELECT COUNT(*) FROM JobApplications WHERE ResumeID = @param0) as ApplicationCount,
                (SELECT COUNT(*) FROM ReferralRequests WHERE ResumeID = @param0) as ReferralCount
            `;
            const usageResult = await dbService.executeQuery(usageQuery, [resumeId]);
            const { ApplicationCount, ReferralCount } = usageResult.recordset[0];
            const isUsed = ApplicationCount >0 || ReferralCount >0;

            if (isUsed) {
                // Soft delete
                await dbService.executeQuery(
                    `UPDATE ApplicantResumes SET IsDeleted =1, DeletedAt = GETUTCDATE(), UpdatedAt = GETUTCDATE() WHERE ResumeID = @param0 AND ApplicantID = @param1`,
                    [resumeId, applicantId]
                );
                return {
                    success: true,
                    softDelete: true,
                    message: `Resume archived. It is referenced by ${ApplicationCount} application(s) and ${ReferralCount} referral request(s).`,
                    applicationCount: ApplicationCount,
                    referralCount: ReferralCount
                };
            }

            // Hard delete
            await dbService.executeQuery(
                'DELETE FROM ApplicantResumes WHERE ResumeID = @param0 AND ApplicantID = @param1',
                [resumeId, applicantId]
            );

            return { success: true, softDelete: false, message: 'Resume permanently deleted.' };
        } catch (error) {
            console.error('Error deleting applicant resume:', error);
            throw error;
        }
    }

    /** Set a resume as primary (cannot set deleted resume as primary) */
    static async setPrimaryResume(applicantId: string, resumeId: string): Promise<void> {
        try {
            const resumeQuery = 'SELECT ResumeID, IsDeleted FROM ApplicantResumes WHERE ResumeID = @param0 AND ApplicantID = @param1';
            const resumeResult = await dbService.executeQuery(resumeQuery, [resumeId, applicantId]);
            if (!resumeResult.recordset || resumeResult.recordset.length ===0) {
                throw new NotFoundError('Resume not found');
            }
            if (resumeResult.recordset[0].IsDeleted) {
                throw new ValidationError('Cannot set a deleted resume as primary');
            }
            await dbService.executeQuery('UPDATE ApplicantResumes SET IsPrimary =0 WHERE ApplicantID = @param0', [applicantId]);
            await dbService.executeQuery('UPDATE ApplicantResumes SET IsPrimary =1, UpdatedAt = GETUTCDATE() WHERE ResumeID = @param0', [resumeId]);
        } catch (error) {
            console.error('Error setting primary resume:', error);
            throw error;
        }
    }

    // SYSTEM-MANAGED FIELD UPDATES (not exposed to frontend)
    
    /**
     * Update LastJobAppliedAt when user applies for a job
     * Called automatically by job application service
     */
    static async updateLastJobAppliedAt(userId: string): Promise<void> {
        try {
            const query = `
                UPDATE Applicants 
                SET LastJobAppliedAt = GETUTCDATE(), UpdatedAt = GETUTCDATE()
                WHERE UserID = @param0
            `;
            
            await dbService.executeQuery(query, [userId]);
        } catch (error) {
            console.error('Error updating LastJobAppliedAt:', error);
            // Don't throw - this is non-critical
        }
    }

    /**
     * Update SearchScore based on profile completeness and other factors
     * Called automatically by background job or when profile changes
     */
    static async calculateAndUpdateSearchScore(userId: string): Promise<void> {
        try {
            // Get current profile data
            const profile = await this.getApplicantProfile(userId);
            
            // Calculate search score based on multiple factors
            let searchScore = 0;
            
            // Profile completeness (40% weight)
            searchScore += (profile.ProfileCompleteness || 0) * 0.4;
            
            // Skills presence (20% weight) - use PrimarySkills and SecondarySkills if present
            if (profile.PrimarySkills) searchScore += 20;
            if (profile.SecondarySkills) searchScore += 10;
            
            // Experience level (20% weight) - use TotalExperienceMonths if present
            const totalMonths = (profile.TotalExperienceMonths || 0);
            const years = Math.floor(totalMonths / 12);
            if (years > 0) searchScore += Math.min(years * 2, 20);
            
            // Professional info (10% weight)
            if (profile.CurrentJobTitle) searchScore += 5;
            if (profile.Summary) searchScore += 5;
            
            // Social presence (10% weight)
            if (profile.LinkedInProfile) searchScore += 5;
            if (profile.GithubProfile) searchScore += 5;
            
            // Ensure score is between 0-100
            searchScore = Math.max(0, Math.min(100, searchScore));
            
            const query = `
                UPDATE Applicants 
                SET SearchScore = @param1, UpdatedAt = GETUTCDATE()
                WHERE UserID = @param0
            `;
            
            await dbService.executeQuery(query, [userId, searchScore]);
        } catch (error) {
            console.error('Error calculating search score:', error);
            // Don't throw - this is non-critical
        }
    }
}

export class EmployerService {
    // Get employer profile by user ID
    static async getEmployerProfile(userId: string): Promise<any> {
        try {
            const query = `
                SELECT 
                    e.EmployerID,
                    e.UserID,
                    e.OrganizationID,
                    e.Role,
                    e.IsVerified,
                    e.JoinedAt,
                    o.Name as OrganizationName,
                    o.Industry as OrganizationIndustry,
                    o.Size as OrganizationSize,
                    o.Headquarters as OrganizationHeadquarters,
                    o.Website as OrganizationWebsite,
                    o.Description as OrganizationDescription,
                    o.LogoURL as OrganizationLogoURL,
                    u.FirstName,
                    u.LastName,
                    u.Email,
                    u.Phone,
                    u.ProfilePictureURL
                FROM Employers e
                INNER JOIN Organizations o ON e.OrganizationID = o.OrganizationID
                INNER JOIN Users u ON e.UserID = u.UserID
                WHERE e.UserID = @param0
            `;
            
            const result = await dbService.executeQuery(query, [userId]);
            
            if (!result.recordset || result.recordset.length === 0) {
                throw new NotFoundError('Employer profile not found');
            }
            
            return result.recordset[0];
        } catch (error) {
            console.error('Error getting employer profile:', error);
            throw error;
        }
    }

    // Update employer profile
    static async updateEmployerProfile(userId: string, profileData: ProfileData): Promise<any> {
        try {
            // Get employer and organization IDs
            const employerQuery = `
                SELECT e.EmployerID, e.OrganizationID 
                FROM Employers e 
                WHERE e.UserID = @param0
            `;
            
            const employerResult = await dbService.executeQuery(employerQuery, [userId]);
            
            if (!employerResult.recordset || employerResult.recordset.length === 0) {
                throw new NotFoundError('Employer profile not found');
            }
            
            const { EmployerID: employerId, OrganizationID: organizationId } = employerResult.recordset[0];

            // Update employer fields (only Role is user-updatable in Employers table)
            const employerFields: EmployerFieldMapping = {
                'role': 'Role'
            };

            const employerUpdates: string[] = [];
            const employerParams: any[] = [employerId];
            let employerParamIndex = 1;

            Object.keys(profileData).forEach(key => {
                if (key in employerFields && profileData[key] !== undefined) {
                    const dbField = employerFields[key];
                    employerUpdates.push(`${dbField} = @param${employerParamIndex}`);
                    employerParams.push(profileData[key]);
                    employerParamIndex++;
                }
            });

            // Update organization fields
            const orgFields: OrganizationFieldMapping = {
                'organizationName': 'Name',
                'organizationSize': 'Size',
                'industry': 'Industry',
                'headquarters': 'Headquarters',
                'website': 'Website',
                'description': 'Description',
                'linkedInProfile': 'LinkedInProfile',
                'contactEmail': 'ContactEmail',
                'contactPhone': 'ContactPhone'
            };

            const orgUpdates: string[] = [];
            const orgParams: any[] = [organizationId];
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
                    SET ${employerUpdates.join(', ')}
                    WHERE EmployerID = @param0
                `;
                await dbService.executeQuery(employerUpdateQuery, employerParams);
            }

            if (orgUpdates.length > 0) {
                orgUpdates.push('UpdatedAt = GETUTCDATE()');
                const orgUpdateQuery = `
                    UPDATE Organizations 
                    SET ${orgUpdates.join(', ')}
                    WHERE OrganizationID = @param0
                `;
                await dbService.executeQuery(orgUpdateQuery, orgParams);
            }

            // Return updated profile
            return await this.getEmployerProfile(userId);
        } catch (error) {
            console.error('Error updating employer profile:', error);
            throw error;
        }
    }
}