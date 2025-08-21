import { dbService } from '../services/database.service';
import { AuthService } from '../services/auth.service';
import { ValidationError, NotFoundError } from '../utils/validation';

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

export class ApplicantService {
    // Get applicant profile by user ID
    static async getApplicantProfile(userId: string): Promise<any> {
        try {
            // Check if user exists and is a job seeker
            const userQuery = 'SELECT UserID, UserType FROM Users WHERE UserID = @param0 AND IsActive = 1';
            const userResult = await dbService.executeQuery(userQuery, [userId]);
            
            if (!userResult.recordset || userResult.recordset.length === 0) {
                throw new NotFoundError('User not found');
            }
            
            const user = userResult.recordset[0];
            
            // Get or create applicant profile
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
            
            let applicantResult = await dbService.executeQuery(applicantQuery, [userId]);
            
            // If no applicant profile exists, create one
            if (!applicantResult.recordset || applicantResult.recordset.length === 0) {
                console.log('Creating applicant profile for user:', userId);
                await this.createApplicantProfile(userId);
                
                // Retry query after creation
                applicantResult = await dbService.executeQuery(applicantQuery, [userId]);
            }
            
            if (!applicantResult.recordset || applicantResult.recordset.length === 0) {
                throw new Error('Failed to create or retrieve applicant profile');
            }
            
            return applicantResult.recordset[0];
        } catch (error) {
            console.error('Error getting applicant profile:', error);
            throw error;
        }
    }

    // Update applicant profile
    static async updateApplicantProfile(userId: string, profileData: ProfileData): Promise<any> {
        try {
            // Verify user exists and get applicant ID
            const applicantQuery = 'SELECT ApplicantID FROM Applicants WHERE UserID = @param0';
            const applicantResult = await dbService.executeQuery(applicantQuery, [userId]);
            
            if (!applicantResult.recordset || applicantResult.recordset.length === 0) {
                // Create applicant profile if it doesn't exist
                await this.createApplicantProfile(userId);
                const newApplicantResult = await dbService.executeQuery(applicantQuery, [userId]);
                if (!newApplicantResult.recordset || newApplicantResult.recordset.length === 0) {
                    throw new Error('Failed to create applicant profile');
                }
            }
            
            const applicantId = applicantResult.recordset?.[0]?.ApplicantID || 
                               (await dbService.executeQuery(applicantQuery, [userId]))?.recordset?.[0]?.ApplicantID;
            
            if (!applicantId) {
                throw new Error('Could not determine applicant ID');
            }

            // Build update query dynamically based on provided fields
            const allowedFields: ApplicantFieldMapping = {
                'headline': 'Headline',
                'currentJobTitle': 'CurrentJobTitle', 
                'currentCompany': 'CurrentCompany',
                'yearsOfExperience': 'YearsOfExperience',
                'expectedSalary': 'ExpectedSalary',
                'currencyPreference': 'CurrencyPreference',
                'location': 'Location',
                'relocatable': 'WillingToRelocate',
                'remotePreference': 'RemotePreference',
                'primarySkills': 'PrimarySkills',
                'secondarySkills': 'SecondarySkills',
                'workAuthorization': 'WorkAuthorization',
                'noticePeriod': 'NoticePeriod',
                'resumeURL': 'ResumeURL',
                'portfolioURL': 'PortfolioURL',
                'linkedInProfile': 'LinkedInProfile',
                'githubProfile': 'GithubProfile',
                'personalWebsite': 'PersonalWebsite',
                'bio': 'Bio',
                'isOpenToWork': 'IsOpenToWork',
                'allowRecruitersToContact': 'AllowRecruitersToContact',
                'hideCurrentCompany': 'HideCurrentCompany',
                'preferredJobTypes': 'PreferredJobTypes',
                'industries': 'Industries'
            };

            const updateFields: string[] = [];
            const parameters: any[] = [applicantId]; // First parameter is always applicantId
            let paramIndex = 1;

            // Process each field in the profile data
            Object.keys(profileData).forEach(key => {
                if (key in allowedFields && profileData[key] !== undefined) {
                    const dbField = allowedFields[key];
                    updateFields.push(`${dbField} = @param${paramIndex}`);
                    
                    // Handle special data type conversions
                    let value = profileData[key];
                    if (key === 'yearsOfExperience' || key === 'expectedSalary') {
                        value = value ? parseInt(value.toString()) : 0;
                    } else if (key === 'relocatable' || key === 'isOpenToWork' || 
                               key === 'allowRecruitersToContact' || key === 'hideCurrentCompany') {
                        value = value ? 1 : 0;
                    }
                    
                    parameters.push(value);
                    paramIndex++;
                }
            });

            if (updateFields.length === 0) {
                throw new ValidationError('No valid fields provided for update');
            }

            // Calculate profile completeness
            const completenessFields = ['Headline', 'CurrentJobTitle', 'YearsOfExperience', 'PrimarySkills', 'Bio', 'Location'];
            const completenessCheck = completenessFields.map(field => 
                `CASE WHEN ${field} IS NOT NULL AND LEN(TRIM(CAST(${field} AS NVARCHAR(MAX)))) > 0 THEN 1 ELSE 0 END`
            ).join(' + ');
            
            updateFields.push(`ProfileCompleteness = (${completenessCheck}) * 100 / ${completenessFields.length}`);

            const updateQuery = `
                UPDATE Applicants 
                SET ${updateFields.join(', ')}, 
                    LastUpdatedAt = GETUTCDATE()
                WHERE ApplicantID = @param0;
                
                -- Return updated profile
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

            const result = await dbService.executeQuery(updateQuery, parameters);
            
            if (!result.recordset || result.recordset.length === 0) {
                throw new Error('Failed to update applicant profile');
            }

            console.log(`? Updated applicant profile for user ${userId}:`, {
                fields: Object.keys(profileData),
                applicantId: applicantId
            });

            return result.recordset[0];
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
                ApplicantID, UserID, ProfileCompleteness, IsOpenToWork,
                AllowRecruitersToContact, HideCurrentCompany, HideSalaryDetails,
                ImmediatelyAvailable, WillingToRelocate, IsFeatured,
                CreatedAt, LastUpdatedAt
            ) VALUES (
                @param0, @param1, 10, 1, 1, 0, 0, 0, 0, 0,
                GETUTCDATE(), GETUTCDATE()
            )
        `;
        
        await dbService.executeQuery(query, [applicantId, userId]);
        console.log(`? Created applicant profile ${applicantId} for user ${userId}`);
        
        return applicantId;
    }
}

export class EmployerService {
    // Get employer profile by user ID
    static async getEmployerProfile(userId: string): Promise<any> {
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

            // Update employer fields
            const employerFields: EmployerFieldMapping = {
                'jobTitle': 'JobTitle',
                'department': 'Department', 
                'canPostJobs': 'CanPostJobs',
                'canManageApplications': 'CanViewApplications',
                'canViewAnalytics': 'CanScheduleInterviews',
                'recruitmentFocus': 'Bio',
                'linkedInProfile': 'LinkedInProfile',
                'bio': 'Bio'
            };

            const employerUpdates: string[] = [];
            const employerParams: any[] = [employerId];
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
            const orgFields: OrganizationFieldMapping = {
                'organizationName': 'Name',
                'organizationSize': 'Size',
                'industry': 'Industry'
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
                    SET ${employerUpdates.join(', ')}, LastUpdatedAt = GETUTCDATE()
                    WHERE EmployerID = @param0
                `;
                await dbService.executeQuery(employerUpdateQuery, employerParams);
            }

            if (orgUpdates.length > 0) {
                const orgUpdateQuery = `
                    UPDATE Organizations 
                    SET ${orgUpdates.join(', ')}, UpdatedAt = GETUTCDATE()
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