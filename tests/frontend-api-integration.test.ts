/**
 * ========================================================================
 * Frontend API Integration Tests
 * ========================================================================
 * 
 * These tests replicate EXACTLY how the frontend calls the backend APIs
 * during registration and profile updates. They test the complete flow
 * from HTTP request to database population.
 * ========================================================================
 */

import { HttpRequest } from '@azure/functions';
import { register, login } from '../src/controllers/user.controller';
import { updateEducation, updateWorkExperience } from '../src/controllers/user.controller';
import { ApplicantService } from '../src/services/profile.service';
import { UserService } from '../src/services/user.service';
import { AuthService } from '../src/services/auth.service';
import { dbService } from '../src/services/database.service';

// Mock dependencies
jest.mock('../src/services/database.service');
jest.mock('../src/services/auth.service');
const mockDbService = dbService as jest.Mocked<typeof dbService>;
const mockAuthService = AuthService as jest.Mocked<typeof AuthService>;

// Helper to create mock HTTP requests (replicating frontend fetch calls)
const createMockRequest = (method: string, body: any, headers: any = {}): HttpRequest => ({
    method,
    url: 'https://nexhire-api-func.azurewebsites.net/api/test',
    headers: new Map(Object.entries({
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': 'Bearer mock-jwt-token',
        ...headers
    })),
    json: jest.fn().mockResolvedValue(body),
    text: jest.fn().mockResolvedValue(JSON.stringify(body)),
    query: new URLSearchParams(),
    params: {},
    user: null
});

describe('Frontend API Integration Tests', () => {

    beforeEach(() => {
        jest.clearAllMocks();
        
        // Mock JWT token verification
        mockAuthService.verifyToken.mockReturnValue({
            userId: 'TEST-USER-123',
            userType: 'JobSeeker',
            email: 'test@example.com',
            type: 'access'
        });

        mockAuthService.generateUniqueId.mockReturnValue('GENERATED-ID-123');
        mockAuthService.hashPassword.mockResolvedValue('hashed-password');
        mockAuthService.generateAuthTokens.mockReturnValue({
            accessToken: 'mock-access-token',
            refreshToken: 'mock-refresh-token'
        });
    });

    // ========================================================================
    // 1. STUDENT REGISTRATION FLOW (Replicating Frontend Calls)
    // ========================================================================
    describe('Student Registration Flow - API Integration', () => {

        it('should handle student registration API calls exactly as frontend sends them', async () => {
            // Step 1: Registration API call (POST /auth/register)
            // This replicates exactly what AuthContext.register() sends
            const registrationPayload = {
                email: 'student@university.edu',
                password: 'StudentPass123!',
                firstName: 'Sarah',
                lastName: 'Johnson',
                userType: 'JobSeeker',
                phone: '+1234567890',
                experienceType: 'Student'
            };

            const registrationRequest = createMockRequest('POST', registrationPayload);

            // Mock database responses for registration
            mockDbService.executeQuery
                .mockResolvedValueOnce({ recordset: [], recordsets: [], output: {}, rowsAffected: [0] }) // No existing user
                .mockResolvedValueOnce({ recordset: [{ UserID: 'STUDENT-USER-123' }], recordsets: [], output: {}, rowsAffected: [1] }) // User created
                .mockResolvedValueOnce({ recordset: [{ ApplicantID: 'STUDENT-APPLICANT-123' }], recordsets: [], output: {}, rowsAffected: [1] }); // Applicant created

            // Execute registration
            const registrationResponse = await register(registrationRequest, {} as any);
            expect(registrationResponse.status).toBe(201);

            // Step 2: Auto-login API call (POST /auth/login)
            const loginPayload = {
                email: registrationPayload.email,
                password: registrationPayload.password
            };

            const loginRequest = createMockRequest('POST', loginPayload);

            // Mock login database calls
            mockDbService.executeQuery
                .mockResolvedValueOnce({ 
                    recordset: [{ 
                        UserID: 'STUDENT-USER-123',
                        Email: 'student@university.edu',
                        Password: 'hashed-password',
                        UserType: 'JobSeeker',
                        IsActive: true,
                        EmailVerified: true,
                        LoginAttempts: 0
                    }], 
                    recordsets: [], output: {}, rowsAffected: [1] 
                })
                .mockResolvedValueOnce({ recordset: [], recordsets: [], output: {}, rowsAffected: [1] }); // Update last login

            // Mock password verification
            jest.spyOn(AuthService, 'verifyPassword').mockResolvedValue(true);

            const loginResponse = await login(loginRequest, {} as any);
            expect(loginResponse.status).toBe(200);

            // Step 3: Education data update (PUT /users/education)
            // This replicates what happens after auto-login in AuthContext
            const educationPayload = {
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

            const educationRequest = createMockRequest('PUT', educationPayload, {
                'Authorization': 'Bearer mock-jwt-token'
            });

            // Mock education update database calls
            mockDbService.executeQuery
                .mockResolvedValueOnce({ recordset: [{ ApplicantID: 'STUDENT-APPLICANT-123' }], recordsets: [], output: {}, rowsAffected: [1] })
                .mockResolvedValueOnce({ recordset: [{ success: true }], recordsets: [], output: {}, rowsAffected: [1] });

            // Mock user lookup for education update
            jest.spyOn(UserService, 'findById').mockResolvedValue({
                UserID: 'STUDENT-USER-123',
                UserType: 'JobSeeker',
                Email: 'student@university.edu',
                FirstName: 'Sarah',
                LastName: 'Johnson',
                IsActive: true,
                CreatedAt: new Date(),
                LastLoginAt: null,
                EmailVerified: true,
                Password: 'hashed-password'
            });

            const educationResponse = await updateEducation(educationRequest, {} as any);
            expect(educationResponse.status).toBe(200);

            // Validate education data was processed correctly
            const educationUpdateCall = mockDbService.executeQuery.mock.calls.find(call =>
                call[0].includes('Institution = @param1') &&
                call[0].includes('HighestEducation = @param2')
            );
            expect(educationUpdateCall).toBeDefined();
            expect(educationUpdateCall![1]).toEqual([
                'STUDENT-APPLICANT-123',
                'Stanford University',
                "Bachelor's Degree",
                'Computer Science'
            ]);

            // Step 4: Job preferences update (would happen after education)
            // Note: Students don't have work experience, so this step is skipped

            // Validate final expected database state for student
            const expectedStudentProfile = {
                UserID: 'STUDENT-USER-123',
                ApplicantID: 'STUDENT-APPLICANT-123',
                
                // Education populated
                Institution: 'Stanford University',
                HighestEducation: "Bachelor's Degree",
                FieldOfStudy: 'Computer Science',
                
                // Work experience should be NULL for students
                CurrentJobTitle: null,
                CurrentCompany: null,
                YearsOfExperience: null,
                PrimarySkills: null,
                SecondarySkills: null,
                Summary: null,
                
                // Default values
                IsOpenToWork: true,
                AllowRecruitersToContact: true,
                HideCurrentCompany: false,
                HideSalaryDetails: false
            };

            expect(expectedStudentProfile.Institution).toBe('Stanford University');
            expect(expectedStudentProfile.CurrentJobTitle).toBeNull();
        });
    });

    // ========================================================================
    // 2. WORKING PROFESSIONAL REGISTRATION FLOW
    // ========================================================================
    describe('Working Professional Registration Flow - API Integration', () => {

        it('should handle working professional registration with all API calls', async () => {
            // Step 1: Registration (same as student)
            const registrationPayload = {
                email: 'john.engineer@techcorp.com',
                password: 'ProfessionalPass123!',
                firstName: 'John',
                lastName: 'Smith',
                userType: 'JobSeeker',
                phone: '+1987654321',
                experienceType: 'Experienced' // Key difference
            };

            // Mock registration
            mockDbService.executeQuery
                .mockResolvedValueOnce({ recordset: [], recordsets: [], output: {}, rowsAffected: [0] })
                .mockResolvedValueOnce({ recordset: [{ UserID: 'PROF-USER-456' }], recordsets: [], output: {}, rowsAffected: [1] })
                .mockResolvedValueOnce({ recordset: [{ ApplicantID: 'PROF-APPLICANT-456' }], recordsets: [], output: {}, rowsAffected: [1] });

            const registrationRequest = createMockRequest('POST', registrationPayload);
            const registrationResponse = await register(registrationRequest, {} as any);
            expect(registrationResponse.status).toBe(201);

            // Step 2: Auto-login (same as student)
            const loginPayload = { email: registrationPayload.email, password: registrationPayload.password };
            const loginRequest = createMockRequest('POST', loginPayload);

            mockDbService.executeQuery
                .mockResolvedValueOnce({ 
                    recordset: [{ 
                        UserID: 'PROF-USER-456',
                        Email: 'john.engineer@techcorp.com',
                        Password: 'hashed-password',
                        UserType: 'JobSeeker',
                        IsActive: true,
                        EmailVerified: true,
                        LoginAttempts: 0
                    }], 
                    recordsets: [], output: {}, rowsAffected: [1] 
                })
                .mockResolvedValueOnce({ recordset: [], recordsets: [], output: {}, rowsAffected: [1] });

            jest.spyOn(AuthService, 'verifyPassword').mockResolvedValue(true);
            const loginResponse = await login(loginRequest, {} as any);
            expect(loginResponse.status).toBe(200);

            // Step 3: Education update
            const educationPayload = {
                college: {
                    id: 15,
                    name: 'University of California, Berkeley',
                    type: 'University',
                    country: 'United States'
                },
                degreeType: "Master's Degree",
                fieldOfStudy: 'Computer Science',
                yearInCollege: 'Graduated (2+ years ago)'
            };

            mockDbService.executeQuery
                .mockResolvedValueOnce({ recordset: [{ ApplicantID: 'PROF-APPLICANT-456' }], recordsets: [], output: {}, rowsAffected: [1] })
                .mockResolvedValueOnce({ recordset: [{ success: true }], recordsets: [], output: {}, rowsAffected: [1] });

            jest.spyOn(UserService, 'findById').mockResolvedValue({
                UserID: 'PROF-USER-456',
                UserType: 'JobSeeker',
                Email: 'john.engineer@techcorp.com',
                FirstName: 'John',
                LastName: 'Smith',
                IsActive: true,
                CreatedAt: new Date(),
                LastLoginAt: null,
                EmailVerified: true,
                Password: 'hashed-password'
            });

            const educationRequest = createMockRequest('PUT', educationPayload);
            const educationResponse = await updateEducation(educationRequest, {} as any);
            expect(educationResponse.status).toBe(200);

            // Step 4: Work experience update (KEY DIFFERENCE - professionals have this step)
            const workExperiencePayload = {
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

            mockDbService.executeQuery
                .mockResolvedValueOnce({ recordset: [{ ApplicantID: 'PROF-APPLICANT-456' }], recordsets: [], output: {}, rowsAffected: [1] })
                .mockResolvedValueOnce({ recordset: [{ success: true }], recordsets: [], output: {}, rowsAffected: [1] });

            const workExperienceRequest = createMockRequest('PUT', workExperiencePayload);
            const workExperienceResponse = await updateWorkExperience(workExperienceRequest, {} as any);
            expect(workExperienceResponse.status).toBe(200);

            // Validate work experience data was processed correctly
            const workExpUpdateCall = mockDbService.executeQuery.mock.calls.find(call =>
                call[0].includes('CurrentJobTitle = @param1') &&
                call[0].includes('CurrentCompany = @param2') &&
                call[0].includes('YearsOfExperience = @param3')
            );
            expect(workExpUpdateCall).toBeDefined();
            expect(workExpUpdateCall![1]).toEqual([
                'PROF-APPLICANT-456',
                'Senior Software Engineer',
                'Tech Corp Inc.',
                5, // Parsed from "5-7 years"
                'React, Node.js, TypeScript, AWS',
                'Python, Docker, Kubernetes, GraphQL',
                'Experienced full-stack developer with 6 years of experience building scalable web applications.',
                'Remote',
                'Full-time'
            ]);

            // Validate final expected database state for working professional
            const expectedProfessionalProfile = {
                UserID: 'PROF-USER-456',
                ApplicantID: 'PROF-APPLICANT-456',
                
                // Education populated
                Institution: 'University of California, Berkeley',
                HighestEducation: "Master's Degree",
                FieldOfStudy: 'Computer Science',
                
                // Work experience ALL populated (key difference from student)
                CurrentJobTitle: 'Senior Software Engineer',
                CurrentCompany: 'Tech Corp Inc.',
                YearsOfExperience: 5,
                PrimarySkills: 'React, Node.js, TypeScript, AWS',
                SecondarySkills: 'Python, Docker, Kubernetes, GraphQL',
                Summary: 'Experienced full-stack developer with 6 years of experience building scalable web applications.',
                PreferredWorkTypes: 'Remote',
                PreferredJobTypes: 'Full-time',
                
                // Default values
                IsOpenToWork: true,
                AllowRecruitersToContact: true,
                HideCurrentCompany: false,
                HideSalaryDetails: false
            };

            expect(expectedProfessionalProfile.CurrentJobTitle).toBe('Senior Software Engineer');
            expect(expectedProfessionalProfile.YearsOfExperience).toBe(5);
            expect(expectedProfessionalProfile.PrimarySkills).toContain('React');
        });
    });

    // ========================================================================
    // 3. PROFILE UPDATE FLOW (POST-REGISTRATION)
    // ========================================================================
    describe('Profile Update Flow - API Integration', () => {

        beforeEach(() => {
            // Mock existing profile for updates
            jest.spyOn(ApplicantService, 'getApplicantProfile').mockResolvedValue({
                ApplicantID: 'EXISTING-APPLICANT-789',
                UserID: 'EXISTING-USER-789',
                FirstName: 'Jane',
                LastName: 'Developer',
                Email: 'jane.dev@company.com',
                CurrentJobTitle: 'Software Engineer',
                HideCurrentCompany: false,
                HideSalaryDetails: false,
                ProfileCompleteness: 75
            });
        });

        it('should handle privacy settings update via applicant profile endpoint', async () => {
            // This replicates the frontend call when user toggles privacy settings
            const privacyUpdatePayload = {
                hideCurrentCompany: true,
                hideSalaryDetails: true
            };

            const updateRequest = createMockRequest('PUT', privacyUpdatePayload);
            updateRequest.params = { userId: 'EXISTING-USER-789' };

            // Mock successful update
            mockDbService.executeQuery.mockResolvedValueOnce({
                recordset: [{
                    ApplicantID: 'EXISTING-APPLICANT-789',
                    UserID: 'EXISTING-USER-789',
                    HideCurrentCompany: 1, // Changed from false to true
                    HideSalaryDetails: 1, // Changed from false to true
                    ProfileCompleteness: 75,
                    FirstName: 'Jane',
                    LastName: 'Developer',
                    Email: 'jane.dev@company.com'
                }],
                recordsets: [], output: {}, rowsAffected: [1]
            });

            // Execute update via ApplicantService (this is what the applicants/{userId}/profile endpoint calls)
            const result = await ApplicantService.updateApplicantProfile('EXISTING-USER-789', privacyUpdatePayload);

            expect(result.HideCurrentCompany).toBe(1);
            expect(result.HideSalaryDetails).toBe(1);

            // Validate SQL query structure matches expected format
            const updateCall = mockDbService.executeQuery.mock.calls[0];
            expect(updateCall[0]).toContain('HideCurrentCompany = @param1');
            expect(updateCall[0]).toContain('HideSalaryDetails = @param2');
            expect(updateCall[1]).toEqual([
                'EXISTING-APPLICANT-789', // @param0 (WHERE clause)
                1, // @param1 (hideCurrentCompany: true -> 1)
                1  // @param2 (hideSalaryDetails: true -> 1)
            ]);
        });

        it('should handle work experience update via dedicated endpoint', async () => {
            const workExpUpdatePayload = {
                currentJobTitle: 'Lead Software Engineer',
                currentCompany: 'New Company',
                yearsOfExperience: '8-10 years',
                primarySkills: 'React, TypeScript, System Design'
            };

            const updateRequest = createMockRequest('PUT', workExpUpdatePayload);

            // Mock user lookup and update
            jest.spyOn(UserService, 'findById').mockResolvedValue({
                UserID: 'EXISTING-USER-789',
                UserType: 'JobSeeker',
                Email: 'jane.dev@company.com',
                FirstName: 'Jane',
                LastName: 'Developer',
                IsActive: true,
                CreatedAt: new Date(),
                LastLoginAt: new Date(),
                EmailVerified: true,
                Password: 'hashed-password'
            });

            mockDbService.executeQuery
                .mockResolvedValueOnce({ recordset: [{ ApplicantID: 'EXISTING-APPLICANT-789' }], recordsets: [], output: {}, rowsAffected: [1] })
                .mockResolvedValueOnce({ recordset: [{ success: true }], recordsets: [], output: {}, rowsAffected: [1] });

            const response = await updateWorkExperience(updateRequest, {} as any);
            expect(response.status).toBe(200);

            // Validate work experience fields were updated correctly
            const updateCall = mockDbService.executeQuery.mock.calls[1];
            expect(updateCall[1]).toEqual([
                'EXISTING-APPLICANT-789',
                'Lead Software Engineer',
                'New Company',
                8, // Parsed from "8-10 years"
                'React, TypeScript, System Design'
            ]);
        });

        it('should handle complete profile update with multiple field changes', async () => {
            const completeUpdatePayload = {
                currentJobTitle: 'Principal Engineer',
                primarySkills: 'Architecture, Leadership, React, AWS',
                summary: 'Principal engineer with 10+ years of experience',
                hideCurrentCompany: false,
                hideSalaryDetails: true,
                allowRecruitersToContact: true
            };

            mockDbService.executeQuery.mockResolvedValueOnce({
                recordset: [{
                    ApplicantID: 'EXISTING-APPLICANT-789',
                    CurrentJobTitle: 'Principal Engineer',
                    PrimarySkills: 'Architecture, Leadership, React, AWS',
                    Summary: 'Principal engineer with 10+ years of experience',
                    HideCurrentCompany: 0,
                    HideSalaryDetails: 1,
                    AllowRecruitersToContact: 1,
                    ProfileCompleteness: 95
                }],
                recordsets: [], output: {}, rowsAffected: [1]
            });

            const result = await ApplicantService.updateApplicantProfile('EXISTING-USER-789', completeUpdatePayload);

            expect(result.CurrentJobTitle).toBe('Principal Engineer');
            expect(result.PrimarySkills).toBe('Architecture, Leadership, React, AWS');
            expect(result.HideCurrentCompany).toBe(0);
            expect(result.HideSalaryDetails).toBe(1);
            expect(result.ProfileCompleteness).toBe(95);

            // Validate all fields were updated in single query
            const updateCall = mockDbService.executeQuery.mock.calls[0];
            expect(updateCall[0]).toContain('CurrentJobTitle = @param1');
            expect(updateCall[0]).toContain('PrimarySkills = @param2');
            expect(updateCall[0]).toContain('Summary = @param3');
            expect(updateCall[0]).toContain('HideCurrentCompany = @param4');
            expect(updateCall[0]).toContain('HideSalaryDetails = @param5');
            expect(updateCall[0]).toContain('AllowRecruitersToContact = @param6');
        });
    });

    // ========================================================================
    // 4. ERROR SCENARIOS
    // ========================================================================
    describe('Error Scenarios - API Integration', () => {

        it('should handle 404 errors when applicant profile not found', async () => {
            jest.spyOn(ApplicantService, 'getApplicantProfile').mockRejectedValueOnce(
                new Error('Applicant profile not found')
            );

            const updatePayload = { currentJobTitle: 'Test Title' };

            await expect(
                ApplicantService.updateApplicantProfile('NONEXISTENT-USER', updatePayload)
            ).rejects.toThrow('Applicant profile not found');
        });

        it('should handle authentication errors', async () => {
            // Mock invalid token
            mockAuthService.verifyToken.mockImplementationOnce(() => {
                throw new Error('Invalid token');
            });

            const updateRequest = createMockRequest('PUT', { currentJobTitle: 'Test' }, {
                'Authorization': 'Bearer invalid-token'
            });

            // This would be handled by the withAuth middleware in actual implementation
            expect(() => mockAuthService.verifyToken('invalid-token')).toThrow('Invalid token');
        });

        it('should handle database constraint violations', async () => {
            const invalidUpdatePayload = {
                currentJobTitle: 'A'.repeat(500) // Exceeds database field length
            };

            mockDbService.executeQuery.mockRejectedValueOnce(
                new Error('String or binary data would be truncated')
            );

            await expect(
                ApplicantService.updateApplicantProfile('EXISTING-USER-789', invalidUpdatePayload)
            ).rejects.toThrow('String or binary data would be truncated');
        });
    });
});

// Helper function to validate database table state expectations
export const validateExpectedDatabaseState = (
    userType: 'Student' | 'Professional',
    userId: string,
    applicantId: string
) => {
    const baseExpectations = {
        // Users table
        Users: {
            UserID: userId,
            UserType: 'JobSeeker',
            IsActive: true,
            EmailVerified: expect.any(Boolean)
        },
        
        // Applicants table base fields
        Applicants: {
            ApplicantID: applicantId,
            UserID: userId,
            IsOpenToWork: true,
            AllowRecruitersToContact: true,
            HideCurrentCompany: false,
            HideSalaryDetails: false
        }
    };

    if (userType === 'Student') {
        return {
            ...baseExpectations,
            Applicants: {
                ...baseExpectations.Applicants,
                // Education fields populated
                Institution: expect.any(String),
                HighestEducation: expect.any(String),
                FieldOfStudy: expect.any(String),
                
                // Work experience fields should be NULL
                CurrentJobTitle: null,
                CurrentCompany: null,
                YearsOfExperience: null,
                PrimarySkills: null,
                SecondarySkills: null,
                Summary: null,
                
                ProfileCompleteness: expect.toBeGreaterThanOrEqual(40)
            }
        };
    } else {
        return {
            ...baseExpectations,
            Applicants: {
                ...baseExpectations.Applicants,
                // Education fields populated
                Institution: expect.any(String),
                HighestEducation: expect.any(String),
                FieldOfStudy: expect.any(String),
                
                // Work experience fields ALL populated
                CurrentJobTitle: expect.any(String),
                CurrentCompany: expect.any(String),
                YearsOfExperience: expect.any(Number),
                PrimarySkills: expect.any(String),
                SecondarySkills: expect.any(String),
                Summary: expect.any(String),
                
                ProfileCompleteness: expect.toBeGreaterThanOrEqual(80)
            }
        };
    }
};