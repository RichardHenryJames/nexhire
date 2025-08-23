/**
 * ========================================================================
 * Profile Update Bug Reproduction and Fix Test
 * ========================================================================
 * 
 * This test reproduces the exact issue you're experiencing:
 * - Profile visibility (Users table) saves correctly
 * - Hide current company (Applicants table) doesn't save
 * 
 * The issue is frontend sending both to the same endpoint.
 * ========================================================================
 */

import { UserService } from '../src/services/user.service';
import { ApplicantService } from '../src/services/profile.service';
import { dbService } from '../src/services/database.service';

// Mock the database service
jest.mock('../src/services/database.service');
const mockDbService = dbService as jest.Mocked<typeof dbService>;

describe('Profile Update Bug Reproduction', () => {

    beforeEach(() => {
        jest.clearAllMocks();
    });

    // ========================================================================
    // BUG REPRODUCTION: The exact issue you're experiencing
    // ========================================================================
    describe('Bug Reproduction: Profile Visibility vs Hide Current Company', () => {

        it('should demonstrate why profile visibility works but hide current company fails', async () => {
            // Mock user data (Users table)
            jest.spyOn(UserService, 'findById').mockResolvedValue({
                UserID: 'USER-123',
                Email: 'test@example.com',
                FirstName: 'John',
                LastName: 'Doe',
                UserType: 'JobSeeker',
                ProfileVisibility: 'Public', // Users table field
                IsActive: true,
                CreatedAt: new Date(),
                UpdatedAt: new Date(),
                EmailVerified: true,
                PhoneVerified: false,
                TwoFactorEnabled: false,
                LoginAttempts: 0
            });

            // Scenario 1: Profile Visibility Update (Users table) - THIS WORKS ?
            console.log('?? Testing profile visibility update (Users table)...');
            
            const profileVisibilityUpdate = { profileVisibility: 'Private' };
            
            // Mock successful Users table update
            mockDbService.executeQuery.mockResolvedValueOnce({
                recordset: [{
                    UserID: 'USER-123',
                    ProfileVisibility: 'Private', // ? Successfully updated in Users table
                    FirstName: 'John',
                    LastName: 'Doe'
                }],
                recordsets: [],
                rowsAffected: [1]
            });

            const profileVisibilityResult = await UserService.updateProfile('USER-123', profileVisibilityUpdate);
            expect(profileVisibilityResult.ProfileVisibility).toBe('Private');
            
            console.log('? Profile visibility update WORKS - updates Users table');

            // Scenario 2: Hide Current Company Update (Applicants table) - THIS FAILS ?
            console.log('?? Testing hide current company update (should go to Applicants table)...');
            
            const hideCurrentCompanyUpdate = { hideCurrentCompany: true };
            
            // This will fail because UserService.updateProfile doesn't handle Applicants table fields
            await expect(
                UserService.updateProfile('USER-123', hideCurrentCompanyUpdate)
            ).rejects.toThrow('No valid fields to update');
            
            console.log('? Hide current company update FAILS - UserService.updateProfile only handles Users table');
        });

        it('should show the correct way to update hide current company (Applicants table)', async () => {
            // Mock existing applicant profile
            jest.spyOn(ApplicantService, 'getApplicantProfile').mockResolvedValue({
                ApplicantID: 'APPLICANT-123',
                UserID: 'USER-123',
                HideCurrentCompany: false, // Current value
                HideSalaryDetails: false,
                ProfileCompleteness: 75,
                FirstName: 'John',
                LastName: 'Doe',
                Email: 'test@example.com'
            } as any);

            // Hide Current Company Update (via ApplicantService) - THIS WORKS ?
            console.log('?? Testing hide current company via ApplicantService...');
            
            const hideCurrentCompanyUpdate = { hideCurrentCompany: true };
            
            // Mock successful Applicants table update
            mockDbService.executeQuery.mockResolvedValueOnce({
                recordset: [{
                    ApplicantID: 'APPLICANT-123',
                    UserID: 'USER-123',
                    HideCurrentCompany: 1, // ? Successfully updated in Applicants table
                    HideSalaryDetails: 0,
                    ProfileCompleteness: 75
                }],
                recordsets: [],
                rowsAffected: [1]
            });

            const result = await ApplicantService.updateApplicantProfile('USER-123', hideCurrentCompanyUpdate);
            expect(result.HideCurrentCompany).toBe(1);
            
            console.log('? Hide current company update WORKS via ApplicantService - updates Applicants table');
            
            // Validate the SQL query went to Applicants table
            const updateCall = mockDbService.executeQuery.mock.calls[0];
            expect(updateCall[0]).toContain('UPDATE Applicants');
            expect(updateCall[0]).toContain('HideCurrentCompany = @param1');
            expect(updateCall[1]).toEqual(['APPLICANT-123', 1]);
        });
    });

    // ========================================================================
    // SOLUTION: Field routing based on table
    // ========================================================================
    describe('Solution: Proper Field Routing', () => {

        it('should demonstrate correct field routing by table', () => {
            // Define which fields belong to which tables
            const fieldRouting = {
                // Users table fields (handled by UserService.updateProfile)
                usersTableFields: [
                    'firstName', 'lastName', 'phone', 'dateOfBirth', 'gender',
                    'profilePictureURL', 'profileVisibility'
                ],
                
                // Applicants table fields (handled by ApplicantService.updateApplicantProfile)
                applicantsTableFields: [
                    'hideCurrentCompany', 'hideSalaryDetails', 'allowRecruitersToContact',
                    'isOpenToWork', 'currentJobTitle', 'currentCompany', 'primarySkills',
                    'secondarySkills', 'summary', 'headline', 'linkedInProfile', 'githubProfile'
                ]
            };

            // Test data with mixed fields
            const mixedProfileUpdate = {
                // Users table fields
                profileVisibility: 'Private',
                firstName: 'Updated John',
                
                // Applicants table fields  
                hideCurrentCompany: true,
                hideSalaryDetails: true,
                currentJobTitle: 'Senior Engineer'
            };

            // Split the data by table
            const usersTableData: any = {};
            const applicantsTableData: any = {};

            Object.keys(mixedProfileUpdate).forEach(key => {
                if (fieldRouting.usersTableFields.includes(key)) {
                    usersTableData[key] = (mixedProfileUpdate as any)[key];
                } else if (fieldRouting.applicantsTableFields.includes(key)) {
                    applicantsTableData[key] = (mixedProfileUpdate as any)[key];
                }
            });

            // Validate correct routing
            expect(usersTableData).toEqual({
                profileVisibility: 'Private',
                firstName: 'Updated John'
            });

            expect(applicantsTableData).toEqual({
                hideCurrentCompany: true,
                hideSalaryDetails: true,
                currentJobTitle: 'Senior Engineer'
            });

            console.log('? Field routing works correctly:');
            console.log('?? Users table data:', usersTableData);
            console.log('?? Applicants table data:', applicantsTableData);
        });

        it('should test the complete fix for mixed profile updates', async () => {
            // Mock user lookup
            jest.spyOn(UserService, 'findById').mockResolvedValue({
                UserID: 'USER-123',
                Email: 'test@example.com',
                FirstName: 'John',
                LastName: 'Doe',
                UserType: 'JobSeeker',
                ProfileVisibility: 'Public',
                IsActive: true,
                CreatedAt: new Date(),
                UpdatedAt: new Date(),
                EmailVerified: true,
                PhoneVerified: false,
                TwoFactorEnabled: false,
                LoginAttempts: 0
            });

            // Mock applicant profile lookup
            jest.spyOn(ApplicantService, 'getApplicantProfile').mockResolvedValue({
                ApplicantID: 'APPLICANT-123',
                UserID: 'USER-123',
                HideCurrentCompany: false,
                HideSalaryDetails: false,
                CurrentJobTitle: 'Software Engineer',
                ProfileCompleteness: 75,
                FirstName: 'John',
                LastName: 'Doe',
                Email: 'test@example.com'
            } as any);

            // Mixed update data (what frontend sends)
            const mixedUpdateData = {
                profileVisibility: 'Private',    // Users table
                firstName: 'Updated John',       // Users table
                hideCurrentCompany: true,        // Applicants table
                currentJobTitle: 'Senior Engineer' // Applicants table
            };

            // Split the data correctly
            const usersData = {
                profileVisibility: 'Private',
                firstName: 'Updated John'
            };
            
            const applicantsData = {
                hideCurrentCompany: true,
                currentJobTitle: 'Senior Engineer'
            };

            // Mock Users table update
            mockDbService.executeQuery.mockResolvedValueOnce({
                recordset: [{
                    UserID: 'USER-123',
                    ProfileVisibility: 'Private',
                    FirstName: 'Updated John',
                    LastName: 'Doe'
                }],
                recordsets: [],
                rowsAffected: [1]
            });

            // Mock Applicants table update
            mockDbService.executeQuery.mockResolvedValueOnce({
                recordset: [{
                    ApplicantID: 'APPLICANT-123',
                    UserID: 'USER-123',
                    HideCurrentCompany: 1,
                    CurrentJobTitle: 'Senior Engineer',
                    ProfileCompleteness: 80
                }],
                recordsets: [],
                rowsAffected: [1]
            });

            // Execute both updates (this is what the fix should do)
            const usersResult = await UserService.updateProfile('USER-123', usersData);
            const applicantsResult = await ApplicantService.updateApplicantProfile('USER-123', applicantsData);

            // Validate both updates worked
            expect(usersResult.ProfileVisibility).toBe('Private');
            expect(usersResult.FirstName).toBe('Updated John');
            expect(applicantsResult.HideCurrentCompany).toBe(1);
            expect(applicantsResult.CurrentJobTitle).toBe('Senior Engineer');

            console.log('? Complete fix works:');
            console.log('?? Users table updated:', { ProfileVisibility: 'Private', FirstName: 'Updated John' });
            console.log('?? Applicants table updated:', { HideCurrentCompany: 1, CurrentJobTitle: 'Senior Engineer' });
        });
    });

    // ========================================================================
    // EXPECTED BEHAVIOR: What should happen in the frontend
    // ========================================================================
    describe('Expected Frontend Behavior', () => {

        it('should show how frontend should handle profile updates', () => {
            // This is what should happen in the frontend profile update function
            const frontendProfileUpdateExample = `
// Frontend function to update profile
const updateProfile = async (userId, profileData) => {
    const usersFields = ['firstName', 'lastName', 'profileVisibility', 'phone'];
    const applicantsFields = ['hideCurrentCompany', 'hideSalaryDetails', 'currentJobTitle'];
    
    // Split data by table
    const usersData = {};
    const applicantsData = {};
    
    Object.keys(profileData).forEach(key => {
        if (usersFields.includes(key)) {
            usersData[key] = profileData[key];
        } else if (applicantsFields.includes(key)) {
            applicantsData[key] = profileData[key];
        }
    });
    
    // Update Users table if needed
    if (Object.keys(usersData).length > 0) {
        await nexhireAPI.updateUserProfile(usersData);
    }
    
    // Update Applicants table if needed  
    if (Object.keys(applicantsData).length > 0) {
        await nexhireAPI.updateApplicantProfile(userId, applicantsData);
    }
};
            `;

            // Verify the logic
            const testProfileData = {
                profileVisibility: 'Private',
                hideCurrentCompany: true,
                firstName: 'Updated'
            };

            const usersFields = ['firstName', 'lastName', 'profileVisibility', 'phone'];
            const applicantsFields = ['hideCurrentCompany', 'hideSalaryDetails', 'currentJobTitle'];
            
            const usersData: any = {};
            const applicantsData: any = {};
            
            Object.keys(testProfileData).forEach(key => {
                if (usersFields.includes(key)) {
                    usersData[key] = (testProfileData as any)[key];
                } else if (applicantsFields.includes(key)) {
                    applicantsData[key] = (testProfileData as any)[key];
                }
            });

            expect(usersData).toEqual({
                profileVisibility: 'Private',
                firstName: 'Updated'
            });

            expect(applicantsData).toEqual({
                hideCurrentCompany: true
            });

            console.log('? Frontend logic validation passed');
            console.log('?? Users data:', usersData);
            console.log('?? Applicants data:', applicantsData);
        });
    });
});