import { ProfileRepository } from '../repositories/profile.repository';
import { AuthService } from '../services/auth.service';
import { ValidationError, NotFoundError } from '../utils/validation';
import { decrypt, maskEmail } from '../utils/encryption';
import { ResumeStorageService } from './resume-upload.service';

// SECURITY: Lazy-init SAS URL generator for private blob access
let _resumeSasHelper: ResumeStorageService | null = null;
function getResumeSasHelper(): ResumeStorageService {
    if (!_resumeSasHelper) {
        try { _resumeSasHelper = new ResumeStorageService(); } catch { }
    }
    return _resumeSasHelper!;
}

/** Wrap a raw blob URL with a time-limited SAS token (for private containers) */
function signResumeUrl(url: string | null | undefined, expiryMinutes = 30): string | null {
    if (!url) return null;
    try {
        return getResumeSasHelper()?.generateSasUrl(url, expiryMinutes) || url;
    } catch {
        return url; // Fallback to raw URL if SAS generation fails
    }
}

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
            const user = await ProfileRepository.findActiveUser(userId);
            
            if (!user) {
                throw new NotFoundError('User not found');
            }
            
            // Get or create applicant profile with salary data
            let profile = await ProfileRepository.findApplicantProfile(userId);
            
            // If no applicant profile exists, create one
            if (!profile) {
                await this.createApplicantProfile(userId);
                profile = await ProfileRepository.findApplicantProfile(userId);
            }
            
            if (!profile) {
                throw new Error('Failed to create or retrieve applicant profile');
            }

            // PERF: Run all independent profile-enrichment queries in parallel
            // (was 7-8 sequential DB round-trips — now 4 parallel groups)
            const [workExpData, referralStatsData, salaryData, resumesData] = await Promise.all([
                // Group 1: Work experience
                ProfileRepository.findWorkExperiences(profile.ApplicantID)
                    .catch(e => { console.warn('Could not load work experiences:', e); return []; }),

                // Group 2: Referral stats
                ProfileRepository.getReferralStats(userId, profile.ApplicantID)
                    .catch(e => { console.warn('Could not load referral stats:', e); return {}; }),

                // Group 3: Salary breakdown
                this.getApplicantSalaryBreakdown(profile.ApplicantID)
                    .catch(e => { console.warn('Could not load salary data:', e); return { current: [], expected: [] }; }),

                // Group 4: Resumes
                this.getApplicantResumes(profile.ApplicantID)
                    .catch(e => { console.warn('Could not load resumes:', e); return []; }),
            ]);

            // ── Process work experiences ────────────────────────────
            const allWorkExp = workExpData as any[];
            
            // Compute total months from all experiences
            const now = new Date();
            let totalMonths = 0;
            for (const row of allWorkExp) {
                const start = new Date(row.StartDate);
                const end = row.EndDate ? new Date(row.EndDate) : now;
                const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
                totalMonths += Math.max(0, months);
            }
            (profile as any).TotalExperienceMonths = profile.TotalExperienceMonths ?? totalMonths;

            // Derive current job from latest work experience
            if (allWorkExp.length > 0) {
                const latest = allWorkExp[0]; // Already sorted by IsCurrent DESC, EndDate DESC
                (profile as any).CurrentJobTitle = latest.JobTitle || profile.CurrentJobTitle;
                (profile as any).CurrentOrganizationID = latest.OrganizationID;
                (profile as any).CurrentCompanyName = latest.OrganizationName || latest.CompanyName || profile.CurrentCompanyName || null;
                (profile as any).organizationTier = latest.OrganizationTier || 'Standard';
            }

            // Strip CompanyEmail from response and attach
            profile.workExperiences = allWorkExp.map((we: any) => {
                const { CompanyEmail, ...rest } = we;
                return rest;
            });

            // ── Process referral stats ──────────────────────────────
            const stats = referralStatsData as any;
            profile.referralStats = {
                totalReferralsMade: stats.TotalReferralsMade || 0,
                verifiedReferrals: stats.VerifiedReferrals || 0,
                referralRequestsMade: stats.ReferralRequestsMade || 0,
                totalPointsFromRewards: stats.TotalPointsFromRewards || 0,
            };

            // ── Process salary ──────────────────────────────────────
            profile.salaryBreakdown = salaryData;

            // ── Process resumes ─────────────────────────────────────
            const resumes = resumesData as any[];
            profile.resumes = resumes.map((r: any) => ({ ...r, ResumeURL: signResumeUrl(r.ResumeURL) }));
            const primaryResume = resumes.find((r: any) => r.IsPrimary) || resumes[0];
            profile.primaryResumeURL = signResumeUrl(primaryResume?.ResumeURL);
            
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
            const rows = await ProfileRepository.findSalaryBreakdown(applicantId);
            
            const current: SalaryComponent[] = [];
            const expected: SalaryComponent[] = [];
            
            if (rows.length > 0) {
                rows.forEach((row: any) => {
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
            await ProfileRepository.deleteSalaries(applicantId);
            
            // Insert current salary components
            for (const component of salaryData.current) {
                const salaryId = AuthService.generateUniqueId();
                await ProfileRepository.insertSalary({
                    salaryId, applicantId,
                    componentId: component.ComponentID,
                    amount: component.Amount,
                    currencyId: component.CurrencyID,
                    frequency: component.Frequency || 'Yearly',
                    context: 'Current',
                    notes: component.Notes || ''
                });
            }
            
            // Insert expected salary components
            for (const component of salaryData.expected) {
                const salaryId = AuthService.generateUniqueId();
                await ProfileRepository.insertSalary({
                    salaryId, applicantId,
                    componentId: component.ComponentID,
                    amount: component.Amount,
                    currencyId: component.CurrencyID,
                    frequency: component.Frequency || 'Yearly',
                    context: 'Expected',
                    notes: component.Notes || ''
                });
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
                'portfolioURL': 'PortfolioURL',
                
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
                // SECURITY FIX: Removed 'isFeatured' and 'featuredUntil' — admin-only fields, prevents self-featuring privilege escalation
                
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
                             'hideCurrentCompany', 'hideSalaryDetails', 'openToRefer', 'isOpenToWork'].includes(key)) {
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

                await ProfileRepository.updateApplicant(updateQuery, parameters);
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
        await ProfileRepository.insertApplicant(applicantId, userId);
        return applicantId;
    }

    /** Get available salary components for frontend dropdown — delegates to ReferenceRepository (cached, 30 min TTL) */
    static async getSalaryComponents(): Promise<any[]> {
        try {
            const { ReferenceRepository } = await import('../repositories/reference.repository');
            return ReferenceRepository.getSalaryComponents();
        } catch (error) {
            console.error('Error getting salary components:', error);
            throw error;
        }
    }

    /** Get all resumes for an applicant (excludes soft-deleted) */
    static async getApplicantResumes(applicantId: string): Promise<any[]> {
        try {
            const resumes = await ProfileRepository.findResumes(applicantId);
            return resumes.map((r: any) => ({ ...r, ResumeURL: signResumeUrl(r.ResumeURL) }));
        } catch (error) {
            console.error('Error getting applicant resumes:', error);
            throw error;
        }
    }

    /** Get resume for historical viewing (includes soft-deleted for application history) */
    static async getResumeForViewing(resumeId: string): Promise<any | null> {
        try {
            const resume = await ProfileRepository.findResumeById(resumeId);
            // SECURITY: Sign URL for private blob access
            if (resume?.ResumeURL) resume.ResumeURL = signResumeUrl(resume.ResumeURL);
            return resume;
        } catch (error) {
            console.error('Error getting resume for viewing:', error);
            return null;
        }
    }

    /** Get primary resume for an applicant */
    static async getPrimaryResume(applicantId: string): Promise<any | null> {
        try {
            const resume = await ProfileRepository.findPrimaryResume(applicantId);
            // SECURITY: Sign URL for private blob access
            if (resume?.ResumeURL) resume.ResumeURL = signResumeUrl(resume.ResumeURL);
            return resume;
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
                await ProfileRepository.clearPrimaryResumes(applicantId);
            }

            // Check resume limit (max 3 resumes per applicant)
            const currentCount = await ProfileRepository.countResumes(applicantId);

            if (currentCount >= 3) {
                const oldestResume = await ProfileRepository.findOldestNonPrimary(applicantId);
                
                if (oldestResume) {
                    await ProfileRepository.deleteResume(oldestResume.ResumeID);
                    
                    // Delete file from storage too
                    try {
                        const { ResumeStorageService } = await import('../services/resume-upload.service');
                        const storageService = new ResumeStorageService();
                        const userId = await ProfileRepository.getUserIdFromApplicant(applicantId);
                        
                        if (userId && oldestResume.ResumeURL) {
                            await storageService.deleteOldResume(userId, oldestResume.ResumeURL);
                        }
                    } catch (storageError) {
                        console.warn('Failed to delete old resume from storage:', storageError);
                    }
                }
            }

            // Insert new resume
            await ProfileRepository.insertResume({
                resumeId,
                applicantId,
                label: resumeData.resumeLabel,
                url: resumeData.resumeURL,
                isPrimary: resumeData.isPrimary ? 1 : 0,
                parsedText: resumeData.parsedResumeText?.trim() || null
            });

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
            const resumeResult = await ProfileRepository.findResumeForDelete(resumeId, applicantId);
            if (!resumeResult) {
                throw new NotFoundError('Resume not found');
            }
            const resume = resumeResult;
            if (resume.IsDeleted) {
                throw new ValidationError('Resume has already been deleted');
            }

            const { Total, PrimaryCount } = await ProfileRepository.getActiveResumeCounts(applicantId);
            if (Total <=1) {
                throw new ValidationError('Cannot delete the last resume. Upload a new resume first.');
            }
            if (resume.IsPrimary && PrimaryCount <=1) {
                throw new ValidationError('Cannot delete the primary resume. Set another resume as primary first.');
            }

            // Check usage
            const { ApplicationCount, ReferralCount } = await ProfileRepository.getResumeUsage(resumeId);
            const isUsed = ApplicationCount > 0 || ReferralCount > 0;

            if (isUsed) {
                await ProfileRepository.softDeleteResume(resumeId, applicantId);
                return {
                    success: true,
                    softDelete: true,
                    message: `Resume archived. It is referenced by ${ApplicationCount} application(s) and ${ReferralCount} referral request(s).`,
                    applicationCount: ApplicationCount,
                    referralCount: ReferralCount
                };
            }

            // Hard delete
            await ProfileRepository.hardDeleteResume(resumeId, applicantId);

            return { success: true, softDelete: false, message: 'Resume permanently deleted.' };
        } catch (error) {
            console.error('Error deleting applicant resume:', error);
            throw error;
        }
    }

    /** Set a resume as primary (cannot set deleted resume as primary) */
    static async setPrimaryResume(applicantId: string, resumeId: string): Promise<void> {
        try {
            const resumeResult = await ProfileRepository.findResumeForDelete(resumeId, applicantId);
            if (!resumeResult) {
                throw new NotFoundError('Resume not found');
            }
            if (resumeResult.IsDeleted) {
                throw new ValidationError('Cannot set a deleted resume as primary');
            }
            await ProfileRepository.clearPrimaryResumes(applicantId);
            await ProfileRepository.setPrimary(resumeId);
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
            await ProfileRepository.touchLastJobApplied(userId);
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
            
            await ProfileRepository.updateSearchScore(userId, searchScore);
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
            const profile = await ProfileRepository.findEmployerProfile(userId);
            
            if (!profile) {
                throw new NotFoundError('Employer profile not found');
            }
            
            return profile;
        } catch (error) {
            console.error('Error getting employer profile:', error);
            throw error;
        }
    }

    // Update employer profile
    static async updateEmployerProfile(userId: string, profileData: ProfileData): Promise<any> {
        try {
            // Get employer and organization IDs
            const ids = await ProfileRepository.findEmployerIds(userId);
            
            if (!ids) {
                throw new NotFoundError('Employer profile not found');
            }
            
            const { EmployerID: employerId, OrganizationID: organizationId } = ids;

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
                await ProfileRepository.updateEmployer(employerUpdateQuery, employerParams);
            }

            if (orgUpdates.length > 0) {
                orgUpdates.push('UpdatedAt = GETUTCDATE()');
                const orgUpdateQuery = `
                    UPDATE Organizations 
                    SET ${orgUpdates.join(', ')}
                    WHERE OrganizationID = @param0
                `;
                await ProfileRepository.updateOrganization(orgUpdateQuery, orgParams);
            }

            // Return updated profile
            return await this.getEmployerProfile(userId);
        } catch (error) {
            console.error('Error updating employer profile:', error);
            throw error;
        }
    }
}