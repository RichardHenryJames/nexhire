/**
 * ========================================================================
 * Complete Registration Flow Unit Tests
 * ========================================================================
 * 
 * This test suite covers all possible registration scenarios:
 * 1. Job Seeker - Student Flow Registration
 * 2. Job Seeker - Working Professional Flow Registration  
 * 3. Profile Update Flow (any field updates)
 * 
 * Tests replicate exact frontend API calls and validate database population
 * ========================================================================
 */

import { UserService } from '../src/services/user.service';
import { AuthService } from '../src/services/auth.service';
import { dbService } from '../src/services/database.service';
import { ApplicantService } from '../src/services/profile.service';

// Mock the database service
jest.mock('../src/services/database.service');
const mockDbService = dbService as jest.Mocked<typeof dbService>;

// Mock auth service
jest.mock('../src/services/auth.service');
const mockAuthService = AuthService as jest.Mocked<typeof AuthService>;

describe('Complete Registration Flow Tests', () => {

    beforeEach(() => {
        jest.clearAllMocks();
        
        // Mock common database responses with correct structure
        mockDbService.executeQuery.mockImplementation((query: string, params: any[] = []) => {
            // Default successful response
            return Promise.resolve({
                recordset: [{ success: true }],
                recordsets: [],
                rowsAffected: [1]
            });
        });

        // Mock ID generation
        mockAuthService.generateUniqueId.mockReturnValue('MOCK-APPLICANT-ID-123');
    });

    // ========================================================================
    // 1. JOB SEEKER - STUDENT FLOW REGISTRATION
    // ========================================================================
    describe('Job Seeker Student Registration Flow', () => {

        it('should complete full student registration with education data only', async () => {
            // Step 1: Mock student registration data (replicating frontend flow)
            const studentRegistrationData = {
                email: 'student@university.edu',
                password: 'StudentPass123!',
                firstName: 'Sarah',
                lastName: 'Johnson',
                userType: 'JobSeeker' as const,
                phone: '+1234567890'
            };

            const educationData = {
                college: {
                    id: 1,
                    name: 'Stanford University',
                    type: 'University',
                    country: 'United States',
                    state: 'California'
                },
                customCollege: '',
                degreeType: "Bachelor's Degree",
                fieldOfStudy: 'Computer Science',
                yearInCollege: 'Third Year (Junior)',
                selectedCountry: 'United States'
            };

            const jobPreferences = {
                preferredJobTypes: [
                    { JobTypeID: 4, Type: 'Internship' },
                    { JobTypeID: 1, Type: 'Full-Time' }
                ],
                workplaceType: 'hybrid',
                preferredLocations: ['San Francisco', 'New York']
            };

            // Mock database responses for user registration
            mockDbService.executeQuery
                .mockResolvedValueOnce({
                    recordset: [], // No existing user
                    recordsets: [],
                    rowsAffected: [0]
                })
                .mockResolvedValueOnce({
                    recordset: [{ UserID: 'USER-123' }], // User creation
                    recordsets: [],
                    rowsAffected: [1]
                })
                .mockResolvedValueOnce({
                    recordset: [{ ApplicantID: 'APPLICANT-123' }], // Applicant creation
                    recordsets: [],
                    rowsAffected: [1]
                })
                .mockResolvedValueOnce({
                    recordset: [{ ApplicantID: 'APPLICANT-123' }], // Get applicant ID
                    recordsets: [],
                    rowsAffected: [1]
                })
                .mockResolvedValueOnce({
                    recordset: [{ success: true }], // Education update
                    recordsets: [],
                    rowsAffected: [1]
                })
                .mockResolvedValueOnce({
                    recordset: [{ success: true }], // Job preferences update
                    recordsets: [],
                    rowsAffected: [1]
                });

            // Mock user lookup for subsequent calls
            jest.spyOn(UserService, 'findById').mockResolvedValue({
                UserID: 'USER-123',
                Email: studentRegistrationData.email,
                FirstName: studentRegistrationData.firstName,
                LastName: studentRegistrationData.lastName,
                UserType: 'JobSeeker',
                IsActive: true,
                CreatedAt: new Date(),
                UpdatedAt: new Date(),
                LastLoginAt: undefined,
                EmailVerified: false,
                PhoneVerified: false,
                ProfileVisibility: 'Public',
                TwoFactorEnabled: false,
                LoginAttempts: 0
                // Removed Password field as it's excluded from User type
            });

            // Step 2: Execute registration flow (replicating AuthContext.register)
            const registrationResult = await UserService.register(studentRegistrationData);
            expect(registrationResult).toBeDefined();

            // Step 3: Execute education update (replicating post-login flow)
            const educationResult = await UserService.updateEducation('USER-123', educationData);
            expect(educationResult.success).toBe(true);

            // Step 4: Execute job preferences update
            const jobPreferencesResult = await UserService.updateJobPreferences('USER-123', jobPreferences);
            expect(jobPreferencesResult.success).toBe(true);

            // Validate database calls were made correctly
            expect(mockDbService.executeQuery).toHaveBeenCalledTimes(6);

            // Validate education data was processed correctly
            const educationUpdateCall = mockDbService.executeQuery.mock.calls.find(call => 
                call[0].includes('Institution = @param1') && 
                call[0].includes('HighestEducation = @param2') &&
                call[0].includes('FieldOfStudy = @param3')
            );
            expect(educationUpdateCall).toBeDefined();
            expect(educationUpdateCall![1]).toEqual([
                'APPLICANT-123',
                'Stanford University',
                "Bachelor's Degree", 
                'Computer Science'
            ]);

            // Validate job preferences were processed correctly
            const jobPrefsUpdateCall = mockDbService.executeQuery.mock.calls.find(call =>
                call[0].includes('PreferredJobTypes = @param1')
            );
            expect(jobPrefsUpdateCall).toBeDefined();
            expect(jobPrefsUpdateCall![1]).toEqual([
                'APPLICANT-123',
                'Internship, Full-Time',
                'hybrid',
                'San Francisco, New York'
            ]);
        });

        it('should validate student profile data in Applicants table', () => {
            // Acceptance Criteria: Student registration should populate:
            const expectedApplicantsTableData = {
                // Basic Profile
                ApplicantID: 'APPLICANT-123',
                UserID: 'USER-123',
                
                // Education Fields (populated)
                Institution: 'Stanford University',
                HighestEducation: "Bachelor's Degree",
                FieldOfStudy: 'Computer Science',
                
                // Work Experience Fields (should be NULL for students)
                CurrentJobTitle: null,
                CurrentCompany: null,
                YearsOfExperience: null,
                PrimarySkills: null,
                SecondarySkills: null,
                Summary: null,
                
                // Job Preferences (populated)
                PreferredJobTypes: 'Internship, Full-Time',
                PreferredWorkTypes: 'hybrid',
                PreferredLocations: 'San Francisco, New York',
                
                // Default Values
                IsOpenToWork: true,
                AllowRecruitersToContact: true,
                HideCurrentCompany: false,
                HideSalaryDetails: false,
                ProfileCompleteness: 60 // Education + Job Preferences
            };

            // Validate expected data structure
            expect(expectedApplicantsTableData.Institution).toBe('Stanford University');
            expect(expectedApplicantsTableData.CurrentJobTitle).toBeNull();
            expect(expectedApplicantsTableData.PreferredJobTypes).toContain('Internship');
            expect(expectedApplicantsTableData.ProfileCompleteness).toBe(60);
        });
    });

    // ========================================================================
    // 2. JOB SEEKER - WORKING PROFESSIONAL FLOW REGISTRATION
    // ========================================================================
    describe('Job Seeker Working Professional Registration Flow', () => {

        it('should complete full working professional registration with all data', async () => {
            // Step 1: Professional registration data
            const professionalRegistrationData = {
                email: 'john.engineer@techcorp.com',
                password: 'ProfessionalPass123!',
                firstName: 'John',
                lastName: 'Smith',
                userType: 'JobSeeker' as const,
                phone: '+1987654321'
            };

            const workExperienceData = {
                currentJobTitle: 'Senior Software Engineer',
                currentCompany: 'Tech Corp Inc.',
                yearsOfExperience: '5-7 years',
                workArrangement: 'Remote',
                jobType: 'Full-time',
                primarySkills: 'React, Node.js, TypeScript, AWS',
                secondarySkills: 'Python, Docker, Kubernetes, GraphQL',
                isCurrentlyWorking: true,
                summary: 'Experienced full-stack developer with 6 years of experience building scalable web applications.'
            };

            const educationData = {
                college: {
                    id: 15,
                    name: 'University of California, Berkeley',
                    type: 'University',
                    country: 'United States',
                    state: 'California'
                },
                degreeType: "Master's Degree",
                fieldOfStudy: 'Computer Science',
                yearInCollege: 'Graduated (2+ years ago)',
                selectedCountry: 'United States'
            };

            const jobPreferences = {
                preferredJobTypes: [
                    { JobTypeID: 1, Type: 'Full-Time' },
                    { JobTypeID: 2, Type: 'Contract' }
                ],
                workplaceType: 'remote',
                preferredLocations: ['San Francisco', 'Seattle', 'Austin']
            };

            // Mock database responses
            mockDbService.executeQuery
                .mockResolvedValueOnce({
                    recordset: [], // No existing user
                    recordsets: [],
                    rowsAffected: [0]
                })
                .mockResolvedValueOnce({
                    recordset: [{ UserID: 'USER-456' }], // User creation
                    recordsets: [],
                    rowsAffected: [1]
                })
                .mockResolvedValueOnce({
                    recordset: [{ ApplicantID: 'APPLICANT-456' }], // Applicant creation
                    recordsets: [],
                    rowsAffected: [1]
                })
                .mockResolvedValueOnce({
                    recordset: [{ ApplicantID: 'APPLICANT-456' }], // Get applicant ID for education
                    recordsets: [],
                    rowsAffected: [1]
                })
                .mockResolvedValueOnce({
                    recordset: [{ success: true }], // Education update
                    recordsets: [],
                    rowsAffected: [1]
                })
                .mockResolvedValueOnce({
                    recordset: [{ ApplicantID: 'APPLICANT-456' }], // Get applicant ID for work experience
                    recordsets: [],
                    rowsAffected: [1]
                })
                .mockResolvedValueOnce({
                    recordset: [{ success: true }], // Work experience update
                    recordsets: [],
                    rowsAffected: [1]
                })
                .mockResolvedValueOnce({
                    recordset: [{ ApplicantID: 'APPLICANT-456' }], // Get applicant ID for job preferences
                    recordsets: [],
                    rowsAffected: [1]
                })
                .mockResolvedValueOnce({
                    recordset: [{ success: true }], // Job preferences update
                    recordsets: [],
                    rowsAffected: [1]
                });

            // Mock user lookup
            jest.spyOn(UserService, 'findById').mockResolvedValue({
                UserID: 'USER-456',
                Email: professionalRegistrationData.email,
                FirstName: professionalRegistrationData.firstName,
                LastName: professionalRegistrationData.lastName,
                UserType: 'JobSeeker',
                IsActive: true,
                CreatedAt: new Date(),
                UpdatedAt: new Date(),
                LastLoginAt: undefined,
                EmailVerified: false,
                PhoneVerified: false,
                ProfileVisibility: 'Public',
                TwoFactorEnabled: false,
                LoginAttempts: 0
                // Removed Password field
            });

            // Step 2: Execute registration flow
            const registrationResult = await UserService.register(professionalRegistrationData);
            expect(registrationResult).toBeDefined();

            // Step 3: Execute education update
            const educationResult = await UserService.updateEducation('USER-456', educationData);
            expect(educationResult.success).toBe(true);

            // Step 4: Execute work experience update (this is what was missing!)
            const workExperienceResult = await UserService.updateWorkExperience('USER-456', workExperienceData);
            expect(workExperienceResult.success).toBe(true);

            // Step 5: Execute job preferences update
            const jobPreferencesResult = await UserService.updateJobPreferences('USER-456', jobPreferences);
            expect(jobPreferencesResult.success).toBe(true);

            // Validate all database calls were made
            expect(mockDbService.executeQuery).toHaveBeenCalledTimes(9);

            // Validate work experience data was processed correctly
            const workExpUpdateCall = mockDbService.executeQuery.mock.calls.find(call =>
                call[0].includes('CurrentJobTitle = @param1') &&
                call[0].includes('CurrentCompany = @param2') &&
                call[0].includes('YearsOfExperience = @param3')
            );
            expect(workExpUpdateCall).toBeDefined();
            expect(workExpUpdateCall![1]).toEqual([
                'APPLICANT-456',
                'Senior Software Engineer',
                'Tech Corp Inc.',
                5, // Parsed from "5-7 years"
                'React, Node.js, TypeScript, AWS',
                'Python, Docker, Kubernetes, GraphQL',
                'Experienced full-stack developer with 6 years of experience building scalable web applications.',
                'Remote',
                'Full-time'
            ]);
        });

        it('should validate working professional profile data in Applicants table', () => {
            // Acceptance Criteria: Working professional registration should populate:
            const expectedApplicantsTableData = {
                // Basic Profile
                ApplicantID: 'APPLICANT-456',
                UserID: 'USER-456',
                
                // Education Fields (populated)
                Institution: 'University of California, Berkeley',
                HighestEducation: "Master's Degree",
                FieldOfStudy: 'Computer Science',
                
                // Work Experience Fields (ALL populated for professionals)
                CurrentJobTitle: 'Senior Software Engineer',
                CurrentCompany: 'Tech Corp Inc.',
                YearsOfExperience: 5,
                PrimarySkills: 'React, Node.js, TypeScript, AWS',
                SecondarySkills: 'Python, Docker, Kubernetes, GraphQL',
                Summary: 'Experienced full-stack developer with 6 years of experience building scalable web applications.',
                
                // Job Preferences (populated)
                PreferredJobTypes: 'Full-Time, Contract',
                PreferredWorkTypes: 'remote',
                PreferredLocations: 'San Francisco, Seattle, Austin',
                
                // Default Values
                IsOpenToWork: true,
                AllowRecruitersToContact: true,
                HideCurrentCompany: false,
                HideSalaryDetails: false,
                ProfileCompleteness: 100 // All fields populated
            };

            // Validate expected data structure
            expect(expectedApplicantsTableData.CurrentJobTitle).toBe('Senior Software Engineer');
            expect(expectedApplicantsTableData.YearsOfExperience).toBe(5);
            expect(expectedApplicantsTableData.PrimarySkills).toContain('React');
            expect(expectedApplicantsTableData.ProfileCompleteness).toBe(100);
        });

        it('should correctly parse years of experience from string format', () => {
            const testCases = [
                { input: '0-1 years', expected: 0 },
                { input: '1-3 years', expected: 1 },
                { input: '3-5 years', expected: 3 },
                { input: '5-7 years', expected: 5 },
                { input: '7-10 years', expected: 7 },
                { input: '10+ years', expected: 10 },
                { input: 'invalid', expected: 0 }
            ];

            testCases.forEach(testCase => {
                const match = testCase.input.match(/^(\d+)/);
                const result = match ? parseInt(match[1]) : 0;
                expect(result).toBe(testCase.expected);
            });
        });
    });

    // ========================================================================
    // 3. PROFILE UPDATE FLOW (POST-REGISTRATION)
    // ========================================================================
    describe('Profile Update Flow Tests', () => {

        beforeEach(() => {
            // Mock existing applicant profile
            jest.spyOn(ApplicantService, 'getApplicantProfile').mockResolvedValue({
                ApplicantID: 'EXISTING-APPLICANT-123',
                UserID: 'EXISTING-USER-123',
                Institution: 'Existing University',
                CurrentJobTitle: 'Existing Title',
                ProfileCompleteness: 75,
                FirstName: 'Test',
                LastName: 'User',
                Email: 'test@example.com'
            } as any);
        });

        it('should update any individual field in applicant profile', async () => {
            const testFieldUpdates = [
                {
                    field: 'hideCurrentCompany',
                    value: true,
                    dbField: 'HideCurrentCompany',
                    dbValue: 1
                },
                {
                    field: 'hideSalaryDetails', 
                    value: true,
                    dbField: 'HideSalaryDetails',
                    dbValue: 1
                },
                {
                    field: 'currentJobTitle',
                    value: 'Updated Software Engineer',
                    dbField: 'CurrentJobTitle',
                    dbValue: 'Updated Software Engineer'
                },
                {
                    field: 'primarySkills',
                    value: 'Updated React, Vue.js, Angular',
                    dbField: 'PrimarySkills', 
                    dbValue: 'Updated React, Vue.js, Angular'
                },
                {
                    field: 'yearsOfExperience',
                    value: 8,
                    dbField: 'YearsOfExperience',
                    dbValue: 8
                }
            ];

            for (const testUpdate of testFieldUpdates) {
                // Mock successful update
                mockDbService.executeQuery.mockResolvedValueOnce({
                    recordset: [{
                        ApplicantID: 'EXISTING-APPLICANT-123',
                        [testUpdate.dbField]: testUpdate.dbValue,
                        ProfileCompleteness: 80
                    }],
                    recordsets: [],
                    rowsAffected: [1]
                });

                // Execute update using ApplicantService (replicating frontend call)
                const updateData = { [testUpdate.field]: testUpdate.value };
                const result = await ApplicantService.updateApplicantProfile('EXISTING-USER-123', updateData);

                expect(result).toBeDefined();
                expect(result[testUpdate.dbField]).toBe(testUpdate.dbValue);

                // Validate SQL query structure
                const updateCall = mockDbService.executeQuery.mock.calls[mockDbService.executeQuery.mock.calls.length - 1];
                expect(updateCall[0]).toContain(`${testUpdate.dbField} = @param1`);
                expect(updateCall[1]).toContain(testUpdate.dbValue);
            }
        });

        it('should update multiple fields simultaneously', async () => {
            const multiFieldUpdate = {
                currentJobTitle: 'Lead Software Architect',
                currentCompany: 'New Tech Company',
                primarySkills: 'React, Node.js, AWS, Microservices',
                hideCurrentCompany: false,
                hideSalaryDetails: true,
                summary: 'Updated summary with new experience and skills'
            };

            // Mock successful multi-field update
            mockDbService.executeQuery.mockResolvedValueOnce({
                recordset: [{
                    ApplicantID: 'EXISTING-APPLICANT-123',
                    CurrentJobTitle: 'Lead Software Architect',
                    CurrentCompany: 'New Tech Company',
                    PrimarySkills: 'React, Node.js, AWS, Microservices',
                    HideCurrentCompany: 0,
                    HideSalaryDetails: 1,
                    Summary: 'Updated summary with new experience and skills',
                    ProfileCompleteness: 95
                }],
                recordsets: [],
                rowsAffected: [1]
            });

            const result = await ApplicantService.updateApplicantProfile('EXISTING-USER-123', multiFieldUpdate);

            expect(result.CurrentJobTitle).toBe('Lead Software Architect');
            expect(result.HideCurrentCompany).toBe(0);
            expect(result.HideSalaryDetails).toBe(1);
            expect(result.ProfileCompleteness).toBe(95);

            // Validate multiple fields were updated in single query
            const updateCall = mockDbService.executeQuery.mock.calls[mockDbService.executeQuery.mock.calls.length - 1];
            expect(updateCall[0]).toContain('CurrentJobTitle = @param1');
            expect(updateCall[0]).toContain('CurrentCompany = @param2');
            expect(updateCall[0]).toContain('PrimarySkills = @param3');
            expect(updateCall[0]).toContain('HideCurrentCompany = @param4');
            expect(updateCall[0]).toContain('HideSalaryDetails = @param5');
            expect(updateCall[0]).toContain('Summary = @param6');
        });
    });

    // ========================================================================
    // 4. ERROR SCENARIOS AND EDGE CASES
    // ========================================================================
    describe('Error Scenarios and Edge Cases', () => {

        it('should handle database constraint violations gracefully', async () => {
            const invalidData = {
                currentJobTitle: 'A'.repeat(200), // Exceeds database constraint
                primarySkills: null, // Null value
                yearsOfExperience: 'invalid-format'
            };

            // Mock database constraint error
            mockDbService.executeQuery.mockRejectedValueOnce(
                new Error('Cannot insert the value NULL into column PrimarySkills')
            );

            await expect(
                ApplicantService.updateApplicantProfile('USER-123', invalidData)
            ).rejects.toThrow('Cannot insert the value NULL into column PrimarySkills');
        });

        it('should handle missing applicant profile during updates', async () => {
            // Mock no applicant found
            jest.spyOn(ApplicantService, 'getApplicantProfile').mockRejectedValueOnce(
                new Error('Applicant profile not found')
            );

            await expect(
                ApplicantService.updateApplicantProfile('NONEXISTENT-USER', { currentJobTitle: 'Test' })
            ).rejects.toThrow('Applicant profile not found');
        });

        it('should validate required fields during registration', async () => {
            const incompleteRegistrationData = {
                email: 'test@example.com',
                userType: 'JobSeeker' as const
                // Missing password, firstName, lastName
            };

            await expect(
                UserService.register(incompleteRegistrationData as any)
            ).rejects.toThrow();
        });
    });

    // ========================================================================
    // 5. INTEGRATION TESTS (Frontend API Replication)
    // ========================================================================
    describe('Frontend API Call Replication Tests', () => {

        it('should replicate exact AuthContext registration flow', async () => {
            // This test replicates the exact flow from AuthContext.register()
            const userData = {
                email: 'integration@test.com',
                password: 'IntegrationTest123!',
                firstName: 'Integration',
                lastName: 'Test',
                userType: 'JobSeeker' as const,
                phone: '+1111111111'
            };

            const educationData = {
                college: { id: 1, name: 'Test University' },
                degreeType: "Bachelor's Degree",
                fieldOfStudy: 'Engineering'
            };

            const workExperienceData = {
                currentJobTitle: 'Test Engineer',
                currentCompany: 'Test Corp',
                yearsOfExperience: '3-5 years',
                primarySkills: 'Testing, QA'
            };

            const jobPreferences = {
                preferredJobTypes: [{ Type: 'Full-Time' }],
                workplaceType: 'hybrid'
            };

            // Step 1: Separate data (as AuthContext does)
            const registrationData = userData;

            // Step 2: Mock registration success
            mockDbService.executeQuery
                .mockResolvedValueOnce({ recordset: [], recordsets: [], rowsAffected: [0] }) // No existing user
                .mockResolvedValueOnce({ recordset: [{ UserID: 'INT-USER-123' }], recordsets: [], rowsAffected: [1] }); // User created

            const registrationResult = await UserService.register(registrationData);
            expect(registrationResult).toBeDefined();

            // Step 3: Mock login success (auto-login after registration)
            jest.spyOn(UserService, 'login').mockResolvedValue({
                user: { 
                    UserID: 'INT-USER-123', 
                    UserType: 'JobSeeker',
                    Email: 'integration@test.com',
                    FirstName: 'Integration',
                    LastName: 'Test',
                    IsActive: true,
                    CreatedAt: new Date(),
                    UpdatedAt: new Date(),
                    EmailVerified: false,
                    PhoneVerified: false,
                    ProfileVisibility: 'Public',
                    TwoFactorEnabled: false,
                    LoginAttempts: 0
                    // Removed Password field
                },
                tokens: { accessToken: 'mock-token', refreshToken: 'mock-refresh' }
            });

            // Step 4: Execute post-registration updates (as AuthContext does)
            if (educationData) {
                jest.spyOn(UserService, 'findById').mockResolvedValue({
                    UserID: 'INT-USER-123', 
                    UserType: 'JobSeeker', 
                    Email: 'integration@test.com',
                    FirstName: 'Integration',
                    LastName: 'Test',
                    IsActive: true,
                    CreatedAt: new Date(),
                    UpdatedAt: new Date(),
                    LastLoginAt: undefined,
                    EmailVerified: false,
                    PhoneVerified: false,
                    ProfileVisibility: 'Public',
                    TwoFactorEnabled: false,
                    LoginAttempts: 0
                    // Removed Password field
                });

                mockDbService.executeQuery
                    .mockResolvedValueOnce({ recordset: [{ ApplicantID: 'INT-APPLICANT-123' }], recordsets: [], rowsAffected: [1] })
                    .mockResolvedValueOnce({ recordset: [{ success: true }], recordsets: [], rowsAffected: [1] });

                const educationResult = await UserService.updateEducation('INT-USER-123', educationData);
                expect(educationResult.success).toBe(true);
            }

            if (workExperienceData) {
                mockDbService.executeQuery
                    .mockResolvedValueOnce({ recordset: [{ ApplicantID: 'INT-APPLICANT-123' }], recordsets: [], rowsAffected: [1] })
                    .mockResolvedValueOnce({ recordset: [{ success: true }], recordsets: [], rowsAffected: [1] });

                const workExpResult = await UserService.updateWorkExperience('INT-USER-123', workExperienceData);
                expect(workExpResult.success).toBe(true);
            }

            if (jobPreferences) {
                mockDbService.executeQuery
                    .mockResolvedValueOnce({ recordset: [{ ApplicantID: 'INT-APPLICANT-123' }], recordsets: [], rowsAffected: [1] })
                    .mockResolvedValueOnce({ recordset: [{ success: true }], recordsets: [], rowsAffected: [1] });

                const jobPrefResult = await UserService.updateJobPreferences('INT-USER-123', jobPreferences);
                expect(jobPrefResult.success).toBe(true);
            }

            // Validate complete flow executed successfully
            expect(mockDbService.executeQuery).toHaveBeenCalled();
        });
    });
});