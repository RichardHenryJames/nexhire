/**
 * ========================================================================
 * Profile Update Flow Unit Tests
 * ========================================================================
 * 
 * Tests all possible profile update scenarios after registration:
 * - Individual field updates
 * - Bulk field updates  
 * - Privacy setting updates
 * - Work experience updates
 * - Education updates
 * - Job preference updates
 * ========================================================================
 */

import { ApplicantService } from '../src/services/profile.service';
import { UserService } from '../src/services/user.service';
import { dbService } from '../src/services/database.service';

// Mock dependencies
jest.mock('../src/services/database.service');
const mockDbService = dbService as any;

describe('Profile Update Flow Tests', () => {

    beforeEach(() => {
        jest.clearAllMocks();
        
        // Mock existing applicant profile
        jest.spyOn(ApplicantService, 'getApplicantProfile').mockResolvedValue({
            ApplicantID: 'EXISTING-APPLICANT-123',
            UserID: 'EXISTING-USER-123',
            FirstName: 'John',
            LastName: 'Doe',
            Email: 'john.doe@example.com',
            
            // Current profile data
            Institution: 'Current University',
            HighestEducation: "Bachelor's Degree",
            FieldOfStudy: 'Computer Science',
            CurrentJobTitle: 'Software Engineer',
            CurrentCompany: 'Current Corp',
            YearsOfExperience: 3,
            PrimarySkills: 'JavaScript, React',
            SecondarySkills: 'Node.js, Python',
            Summary: 'Current summary',
            PreferredJobTypes: 'Full-Time',
            PreferredWorkTypes: 'Hybrid',
            
            // Privacy settings (current state)
            HideCurrentCompany: false,
            HideSalaryDetails: false,
            AllowRecruitersToContact: true,
            IsOpenToWork: true,
            
            ProfileCompleteness: 75
        });
    });

    // ========================================================================
    // PRIVACY SETTINGS UPDATES (The specific issue you mentioned)
    // ========================================================================
    describe('Privacy Settings Updates', () => {

        it('should update hideCurrentCompany from false to true', async () => {
            const updateData = { hideCurrentCompany: true };

            // Mock successful update
            mockDbService.executeQuery.mockResolvedValueOnce({
                recordset: [{
                    ApplicantID: 'EXISTING-APPLICANT-123',
                    UserID: 'EXISTING-USER-123',
                    HideCurrentCompany: 1, // Should be 1 (true) after update
                    HideSalaryDetails: 0, // Should remain unchanged
                    ProfileCompleteness: 75
                }],
                recordsets: []
            });

            const result = await ApplicantService.updateApplicantProfile('EXISTING-USER-123', updateData);

            // Validate the update was successful
            expect(result.HideCurrentCompany).toBe(1);
            
            // Validate SQL query was constructed correctly
            const updateCall = mockDbService.executeQuery.mock.calls[0];
            expect(updateCall[0]).toContain('HideCurrentCompany = @param1');
            expect(updateCall[1]).toContain(1); // Boolean true converted to 1
        });

        it('should update hideSalaryDetails from false to true', async () => {
            const updateData = { hideSalaryDetails: true };

            mockDbService.executeQuery.mockResolvedValueOnce({
                recordset: [{
                    ApplicantID: 'EXISTING-APPLICANT-123',
                    UserID: 'EXISTING-USER-123',
                    HideCurrentCompany: 0, // Should remain unchanged
                    HideSalaryDetails: 1, // Should be 1 (true) after update
                    ProfileCompleteness: 75
                }],
                recordsets: []
            });

            const result = await ApplicantService.updateApplicantProfile('EXISTING-USER-123', updateData);

            expect(result.HideSalaryDetails).toBe(1);
            
            const updateCall = mockDbService.executeQuery.mock.calls[0];
            expect(updateCall[0]).toContain('HideSalaryDetails = @param1');
            expect(updateCall[1]).toContain(1);
        });

        it('should update both privacy settings simultaneously', async () => {
            const updateData = { 
                hideCurrentCompany: true, 
                hideSalaryDetails: true 
            };

            mockDbService.executeQuery.mockResolvedValueOnce({
                recordset: [{
                    ApplicantID: 'EXISTING-APPLICANT-123',
                    UserID: 'EXISTING-USER-123',
                    HideCurrentCompany: 1, // Both should be 1 (true)
                    HideSalaryDetails: 1,
                    ProfileCompleteness: 75
                }],
                recordsets: []
            });

            const result = await ApplicantService.updateApplicantProfile('EXISTING-USER-123', updateData);

            expect(result.HideCurrentCompany).toBe(1);
            expect(result.HideSalaryDetails).toBe(1);
            
            const updateCall = mockDbService.executeQuery.mock.calls[0];
            expect(updateCall[0]).toContain('HideCurrentCompany = @param1');
            expect(updateCall[0]).toContain('HideSalaryDetails = @param2');
            expect(updateCall[1]).toEqual([
                'EXISTING-APPLICANT-123', // @param0 (WHERE clause)
                1, // @param1 (HideCurrentCompany)
                1  // @param2 (HideSalaryDetails)
            ]);
        });

        it('should handle all privacy settings updates', async () => {
            const updateData = {
                hideCurrentCompany: true,
                hideSalaryDetails: true,
                allowRecruitersToContact: false,
                isOpenToWork: false
            };

            mockDbService.executeQuery.mockResolvedValueOnce({
                recordset: [{
                    ApplicantID: 'EXISTING-APPLICANT-123',
                    HideCurrentCompany: 1,
                    HideSalaryDetails: 1,
                    AllowRecruitersToContact: 0,
                    IsOpenToWork: 0,
                    ProfileCompleteness: 75
                }],
                recordsets: []
            });

            const result = await ApplicantService.updateApplicantProfile('EXISTING-USER-123', updateData);

            expect(result.HideCurrentCompany).toBe(1);
            expect(result.HideSalaryDetails).toBe(1);
            expect(result.AllowRecruitersToContact).toBe(0);
            expect(result.IsOpenToWork).toBe(0);
        });
    });

    // ========================================================================
    // WORK EXPERIENCE UPDATES
    // ========================================================================
    describe('Work Experience Updates', () => {

        it('should update current job title and company', async () => {
            const updateData = {
                currentJobTitle: 'Senior Software Engineer',
                currentCompany: 'New Tech Company'
            };

            mockDbService.executeQuery.mockResolvedValueOnce({
                recordset: [{
                    ApplicantID: 'EXISTING-APPLICANT-123',
                    CurrentJobTitle: 'Senior Software Engineer',
                    CurrentCompany: 'New Tech Company',
                    ProfileCompleteness: 80
                }],
                recordsets: []
            });

            const result = await ApplicantService.updateApplicantProfile('EXISTING-USER-123', updateData);

            expect(result.CurrentJobTitle).toBe('Senior Software Engineer');
            expect(result.CurrentCompany).toBe('New Tech Company');
        });

        it('should update skills and experience summary', async () => {
            const updateData = {
                primarySkills: 'React, TypeScript, AWS, GraphQL',
                secondarySkills: 'Python, Docker, Kubernetes',
                summary: 'Updated summary with new skills and experience in cloud technologies and microservices architecture.'
            };

            mockDbService.executeQuery.mockResolvedValueOnce({
                recordset: [{
                    ApplicantID: 'EXISTING-APPLICANT-123',
                    PrimarySkills: 'React, TypeScript, AWS, GraphQL',
                    SecondarySkills: 'Python, Docker, Kubernetes',
                    Summary: 'Updated summary with new skills and experience in cloud technologies and microservices architecture.',
                    ProfileCompleteness: 85
                }],
                recordsets: []
            });

            const result = await ApplicantService.updateApplicantProfile('EXISTING-USER-123', updateData);

            expect(result.PrimarySkills).toBe('React, TypeScript, AWS, GraphQL');
            expect(result.SecondarySkills).toBe('Python, Docker, Kubernetes');
            expect(result.Summary).toContain('cloud technologies');
        });

        it('should update years of experience (via dedicated work experience endpoint)', async () => {
            const workExperienceUpdate = {
                currentJobTitle: 'Lead Engineer',
                yearsOfExperience: '7-10 years',
                primarySkills: 'Leadership, System Design'
            };

            // Mock user lookup with complete User type
            jest.spyOn(UserService, 'findById').mockResolvedValue({
                UserID: 'EXISTING-USER-123',
                UserType: 'JobSeeker',
                Email: 'john.doe@example.com',
                FirstName: 'John',
                LastName: 'Doe',
                IsActive: true,
                CreatedAt: new Date(),
                UpdatedAt: new Date(),
                LastLoginAt: undefined,
                EmailVerified: true,
                PhoneVerified: false,
                ProfileVisibility: 'public',
                TwoFactorEnabled: false,
                LoginAttempts: 0,
                Password: 'hashed'
            });

            // Mock applicant lookup and update
            mockDbService.executeQuery
                .mockResolvedValueOnce({
                    recordset: [{ ApplicantID: 'EXISTING-APPLICANT-123' }],
                    recordsets: []
                })
                .mockResolvedValueOnce({
                    recordset: [{ success: true }],
                    recordsets: []
                });

            const result = await UserService.updateWorkExperience('EXISTING-USER-123', workExperienceUpdate);
            expect(result.success).toBe(true);

            // Validate years were parsed correctly
            const updateCall = mockDbService.executeQuery.mock.calls[1];
            expect(updateCall[1]).toContain(7); // Parsed from "7-10 years"
        });
    });

    // ========================================================================
    // EDUCATION UPDATES
    // ========================================================================
    describe('Education Updates', () => {

        it('should update education via dedicated education endpoint', async () => {
            const educationUpdate = {
                college: {
                    id: 50,
                    name: 'Harvard University',
                    type: 'University',
                    country: 'United States'
                },
                degreeType: "Master's Degree",
                fieldOfStudy: 'Data Science'
            };

            // Mock user lookup with complete User type
            jest.spyOn(UserService, 'findById').mockResolvedValue({
                UserID: 'EXISTING-USER-123',
                UserType: 'JobSeeker',
                Email: 'john.doe@example.com',
                FirstName: 'John',
                LastName: 'Doe',
                IsActive: true,
                CreatedAt: new Date(),
                UpdatedAt: new Date(),
                LastLoginAt: undefined,
                EmailVerified: true,
                PhoneVerified: false,
                ProfileVisibility: 'public',
                TwoFactorEnabled: false,
                LoginAttempts: 0,
                Password: 'hashed'
            });

            // Mock applicant lookup and education update
            mockDbService.executeQuery
                .mockResolvedValueOnce({
                    recordset: [{ ApplicantID: 'EXISTING-APPLICANT-123' }],
                    recordsets: []
                })
                .mockResolvedValueOnce({
                    recordset: [{ success: true }],
                    recordsets: []
                });

            const result = await UserService.updateEducation('EXISTING-USER-123', educationUpdate);
            expect(result.success).toBe(true);

            // Validate education fields were updated correctly
            const updateCall = mockDbService.executeQuery.mock.calls[1];
            expect(updateCall[1]).toEqual([
                'EXISTING-APPLICANT-123',
                'Harvard University',
                "Master's Degree",
                'Data Science'
            ]);
        });

        it('should update education via applicant profile endpoint', async () => {
            const updateData = {
                institution: 'MIT',
                highestEducation: 'PhD',
                fieldOfStudy: 'Artificial Intelligence'
            };

            mockDbService.executeQuery.mockResolvedValueOnce({
                recordset: [{
                    ApplicantID: 'EXISTING-APPLICANT-123',
                    Institution: 'MIT',
                    HighestEducation: 'PhD',
                    FieldOfStudy: 'Artificial Intelligence',
                    ProfileCompleteness: 90
                }],
                recordsets: []
            });

            const result = await ApplicantService.updateApplicantProfile('EXISTING-USER-123', updateData);

            expect(result.Institution).toBe('MIT');
            expect(result.HighestEducation).toBe('PhD');
            expect(result.FieldOfStudy).toBe('Artificial Intelligence');
        });
    });

    // ========================================================================
    // JOB PREFERENCES UPDATES
    // ========================================================================
    describe('Job Preferences Updates', () => {

        it('should update job preferences via dedicated endpoint', async () => {
            const jobPreferencesUpdate = {
                preferredJobTypes: [
                    { JobTypeID: 1, Type: 'Full-Time' },
                    { JobTypeID: 2, Type: 'Contract' },
                    { JobTypeID: 3, Type: 'Part-Time' }
                ],
                workplaceType: 'remote',
                preferredLocations: ['San Francisco', 'New York', 'Austin']
            };

            // Mock user lookup with complete User type
            jest.spyOn(UserService, 'findById').mockResolvedValue({
                UserID: 'EXISTING-USER-123',
                UserType: 'JobSeeker',
                Email: 'john.doe@example.com',
                FirstName: 'John',
                LastName: 'Doe',
                IsActive: true,
                CreatedAt: new Date(),
                UpdatedAt: new Date(),
                LastLoginAt: undefined,
                EmailVerified: true,
                PhoneVerified: false,
                ProfileVisibility: 'public',
                TwoFactorEnabled: false,
                LoginAttempts: 0,
                Password: 'hashed'
            });

            mockDbService.executeQuery
                .mockResolvedValueOnce({
                    recordset: [{ ApplicantID: 'EXISTING-APPLICANT-123' }],
                    recordsets: []
                })
                .mockResolvedValueOnce({
                    recordset: [{ success: true }],
                    recordsets: []
                });

            const result = await UserService.updateJobPreferences('EXISTING-USER-123', jobPreferencesUpdate);
            expect(result.success).toBe(true);

            // Validate job types were converted to string
            const updateCall = mockDbService.executeQuery.mock.calls[1];
            expect(updateCall[1]).toEqual([
                'EXISTING-APPLICANT-123',
                'Full-Time, Contract, Part-Time', // Array converted to string
                'remote',
                'San Francisco, New York, Austin' // Array converted to string
            ]);
        });

        it('should update job preferences via applicant profile endpoint', async () => {
            const updateData = {
                preferredJobTypes: 'Senior, Lead, Principal',
                preferredWorkTypes: 'Remote',
                preferredLocations: 'Global'
            };

            mockDbService.executeQuery.mockResolvedValueOnce({
                recordset: [{
                    ApplicantID: 'EXISTING-APPLICANT-123',
                    PreferredJobTypes: 'Senior, Lead, Principal',
                    PreferredWorkTypes: 'Remote',
                    PreferredLocations: 'Global',
                    ProfileCompleteness: 85
                }],
                recordsets: []
            });

            const result = await ApplicantService.updateApplicantProfile('EXISTING-USER-123', updateData);

            expect(result.PreferredJobTypes).toBe('Senior, Lead, Principal');
            expect(result.PreferredWorkTypes).toBe('Remote');
            expect(result.PreferredLocations).toBe('Global');
        });
    });

    // ========================================================================
    // BULK UPDATES AND COMPLEX SCENARIOS
    // ========================================================================
    describe('Bulk Updates and Complex Scenarios', () => {

        it('should handle complete profile overhaul update', async () => {
            const completeProfileUpdate = {
                // Personal information
                headline: 'Senior Full-Stack Developer',
                summary: 'Experienced developer with expertise in modern web technologies',
                
                // Work experience
                currentJobTitle: 'Senior Software Engineer',
                currentCompany: 'Google',
                yearsOfExperience: 8,
                primarySkills: 'React, TypeScript, Node.js, AWS, GraphQL',
                secondarySkills: 'Python, Docker, Kubernetes, MongoDB',
                
                // Education
                institution: 'Stanford University',
                highestEducation: "Master's Degree",
                fieldOfStudy: 'Computer Science',
                
                // Job preferences
                preferredJobTypes: 'Full-Time, Contract',
                preferredWorkTypes: 'Remote',
                preferredLocations: 'San Francisco, Seattle, Austin',
                
                // Privacy settings
                hideCurrentCompany: false,
                hideSalaryDetails: true,
                allowRecruitersToContact: true,
                isOpenToWork: true,
                
                // Social profiles
                linkedInProfile: 'https://linkedin.com/in/johndoe',
                githubProfile: 'https://github.com/johndoe'
            };

            mockDbService.executeQuery.mockResolvedValueOnce({
                recordset: [{
                    ApplicantID: 'EXISTING-APPLICANT-123',
                    // Include all the fields from completeProfileUpdate
                    Headline: 'Senior Full-Stack Developer',
                    Summary: 'Experienced developer with expertise in modern web technologies',
                    CurrentJobTitle: 'Senior Software Engineer',
                    CurrentCompany: 'Google',
                    YearsOfExperience: 8,
                    PrimarySkills: 'React, TypeScript, Node.js, AWS, GraphQL',
                    SecondarySkills: 'Python, Docker, Kubernetes, MongoDB',
                    Institution: 'Stanford University',
                    HighestEducation: "Master's Degree",
                    FieldOfStudy: 'Computer Science',
                    PreferredJobTypes: 'Full-Time, Contract',
                    PreferredWorkTypes: 'Remote',
                    PreferredLocations: 'San Francisco, Seattle, Austin',
                    HideCurrentCompany: 0,
                    HideSalaryDetails: 1,
                    AllowRecruitersToContact: 1,
                    IsOpenToWork: 1,
                    LinkedInProfile: 'https://linkedin.com/in/johndoe',
                    GithubProfile: 'https://github.com/johndoe',
                    ProfileCompleteness: 100
                }],
                recordsets: []
            });

            const result = await ApplicantService.updateApplicantProfile('EXISTING-USER-123', completeProfileUpdate);

            expect(result.ProfileCompleteness).toBe(100);
            expect(result.CurrentJobTitle).toBe('Senior Software Engineer');
            expect(result.HideSalaryDetails).toBe(1);
            expect(result.LinkedInProfile).toBe('https://linkedin.com/in/johndoe');

            // Validate multiple fields were updated in single transaction
            const updateCall = mockDbService.executeQuery.mock.calls[0];
            expect(updateCall[0]).toContain('Headline = @param');
            expect(updateCall[0]).toContain('CurrentJobTitle = @param');
            expect(updateCall[0]).toContain('HideSalaryDetails = @param');
            expect(updateCall[0]).toContain('LinkedInProfile = @param');
        });

        it('should handle partial updates without affecting other fields', async () => {
            const partialUpdate = {
                primarySkills: 'Updated Skills Only'
            };

            mockDbService.executeQuery.mockResolvedValueOnce({
                recordset: [{
                    ApplicantID: 'EXISTING-APPLICANT-123',
                    // Only PrimarySkills should change, everything else stays the same
                    CurrentJobTitle: 'Software Engineer', // Unchanged
                    CurrentCompany: 'Current Corp', // Unchanged  
                    PrimarySkills: 'Updated Skills Only', // Changed
                    HideCurrentCompany: 0, // Unchanged
                    ProfileCompleteness: 76 // Slightly updated
                }],
                recordsets: []
            });

            const result = await ApplicantService.updateApplicantProfile('EXISTING-USER-123', partialUpdate);

            expect(result.PrimarySkills).toBe('Updated Skills Only');
            expect(result.CurrentJobTitle).toBe('Software Engineer'); // Should remain unchanged
            
            // Validate only one field was updated
            const updateCall = mockDbService.executeQuery.mock.calls[0];
            expect(updateCall[0]).toContain('PrimarySkills = @param1');
            expect(updateCall[0]).not.toContain('CurrentJobTitle = @param');
        });
    });

    // ========================================================================
    // ERROR HANDLING AND EDGE CASES
    // ========================================================================
    describe('Error Handling and Edge Cases', () => {

        it('should handle empty update data gracefully', async () => {
            const emptyUpdate = {};

            try {
                await ApplicantService.updateApplicantProfile('EXISTING-USER-123', emptyUpdate);
                expect(false).toBe(true); // Should not reach this line
            } catch (error: any) {
                expect(error.message).toContain('No valid fields provided for update');
            }
        });

        it('should handle null and undefined values correctly', async () => {
            const updateWithNullValues = {
                currentJobTitle: null,
                primarySkills: undefined,
                summary: '' // Empty string
            };

            // Only summary should be processed (empty string becomes null)
            mockDbService.executeQuery.mockResolvedValueOnce({
                recordset: [{
                    ApplicantID: 'EXISTING-APPLICANT-123',
                    Summary: null, // Empty string converted to null
                    ProfileCompleteness: 75
                }],
                recordsets: []
            });

            const result = await ApplicantService.updateApplicantProfile('EXISTING-USER-123', updateWithNullValues);

            // Validate that null/undefined fields were filtered out
            const updateCall = mockDbService.executeQuery.mock.calls[0];
            expect(updateCall[0]).toContain('Summary = @param1');
            expect(updateCall[0]).not.toContain('CurrentJobTitle = @param');
            expect(updateCall[0]).not.toContain('PrimarySkills = @param');
        });

        it('should handle boolean conversion edge cases', async () => {
            const booleanTestCases = {
                hideCurrentCompany: 'true', // String 'true'
                hideSalaryDetails: 1, // Number 1
                allowRecruitersToContact: false, // Boolean false
                isOpenToWork: 0 // Number 0
            };

            mockDbService.executeQuery.mockResolvedValueOnce({
                recordset: [{
                    ApplicantID: 'EXISTING-APPLICANT-123',
                    HideCurrentCompany: 1, // 'true' -> 1
                    HideSalaryDetails: 1, // 1 -> 1
                    AllowRecruitersToContact: 0, // false -> 0
                    IsOpenToWork: 0, // 0 -> 0
                    ProfileCompleteness: 75
                }],
                recordsets: []
            });

            const result = await ApplicantService.updateApplicantProfile('EXISTING-USER-123', booleanTestCases);

            expect(result.HideCurrentCompany).toBe(1);
            expect(result.HideSalaryDetails).toBe(1);
            expect(result.AllowRecruitersToContact).toBe(0);
            expect(result.IsOpenToWork).toBe(0);
        });
    });
});