/**
 * ========================================================================
 * Test Runner Script - Complete Registration Flow Tests
 * ========================================================================
 * 
 * This script runs all registration flow tests and validates:
 * 1. Student registration flow
 * 2. Working professional registration flow  
 * 3. Profile update flows
 * 4. Database population validation
 * ========================================================================
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

interface TestSuite {
    name: string;
    file: string;
    description: string;
    acceptanceCriteria: string[];
}

const testSuites: TestSuite[] = [
    {
        name: 'Complete Registration Flow Tests',
        file: 'tests/complete-registration-flow.test.ts',
        description: 'Tests complete registration flows for students and working professionals',
        acceptanceCriteria: [
            'Student registration saves basic info + education data to Users and Applicants tables',
            'Professional registration saves basic info + education + work experience to tables',
            'Work experience fields are NULL for students',
            'All work experience fields are populated for professionals',
            'Profile completeness is calculated correctly',
            'Registration flow matches frontend API calls exactly'
        ]
    },
    {
        name: 'Profile Update Flow Tests', 
        file: 'tests/profile-update-flow.test.ts',
        description: 'Tests all profile update scenarios after registration',
        acceptanceCriteria: [
            'Privacy settings (hideCurrentCompany, hideSalaryDetails) can be updated',
            'Work experience fields can be updated individually or in bulk',
            'Education can be updated via dedicated endpoint',
            'Job preferences can be updated via dedicated endpoint',
            'Multiple fields can be updated simultaneously',
            'Boolean values are correctly converted to database bits (0/1)',
            'Null and empty values are handled correctly'
        ]
    },
    {
        name: 'Frontend API Integration Tests',
        file: 'tests/frontend-api-integration.test.ts', 
        description: 'Tests that replicate exact frontend API calls',
        acceptanceCriteria: [
            'HTTP requests are processed correctly',
            'Authentication middleware works properly',
            'Request/response format matches frontend expectations',
            'Error scenarios return proper HTTP status codes',
            'Database calls match expected SQL patterns',
            'API endpoints handle all required parameters'
        ]
    }
];

const runTestSuite = (testSuite: TestSuite): boolean => {
    process.stdout.write(`\n${'='.repeat(80)}\n`);
    process.stdout.write(`🔬 Running: ${testSuite.name}\n`);
    process.stdout.write(`📝 Description: ${testSuite.description}\n`);
    process.stdout.write(`${'='.repeat(80)}\n`);
    
    process.stdout.write('\n📋 Acceptance Criteria:\n');
    testSuite.acceptanceCriteria.forEach((criteria, index) => {
        process.stdout.write(`   ${index + 1}. ${criteria}\n`);
    });
    
    process.stdout.write('\n🚀 Executing tests...\n\n');
    
    try {
        const result = execSync(`npx jest ${testSuite.file} --verbose --coverage`, {
            encoding: 'utf8',
            stdio: 'inherit'
        });
        
        process.stdout.write(`\n✅ ${testSuite.name} - PASSED\n`);
        return true;
    } catch (error) {
        process.stdout.write(`\n❌ ${testSuite.name} - FAILED\n`);
        process.stderr.write(`${error}\n`);
        return false;
    }
};

const generateTestReport = (results: { name: string; passed: boolean }[]) => {
    const report = {
        testRun: {
            timestamp: new Date().toISOString(),
            totalSuites: results.length,
            passedSuites: results.filter(r => r.passed).length,
            failedSuites: results.filter(r => !r.passed).length
        },
        results: results,
        acceptanceCriteria: {
            studentRegistration: {
                description: 'Student registration flow should populate Users and Applicants tables correctly',
                expectedDatabaseState: {
                    Users: {
                        UserID: 'Generated UUID',
                        Email: 'student@university.edu',
                        FirstName: 'Sarah',
                        LastName: 'Johnson',
                        UserType: 'JobSeeker',
                        IsActive: true,
                        EmailVerified: false
                    },
                    Applicants: {
                        ApplicantID: 'Generated UUID',
                        UserID: 'Matches Users.UserID',
                        Institution: 'Stanford University',
                        HighestEducation: "Bachelor's Degree",
                        FieldOfStudy: 'Computer Science',
                        CurrentJobTitle: null,
                        CurrentCompany: null,
                        YearsOfExperience: null,
                        PrimarySkills: null,
                        SecondarySkills: null,
                        Summary: null,
                        PreferredJobTypes: 'Internship, Full-Time',
                        PreferredWorkTypes: 'hybrid',
                        IsOpenToWork: true,
                        AllowRecruitersToContact: true,
                        HideCurrentCompany: false,
                        HideSalaryDetails: false,
                        ProfileCompleteness: 60
                    }
                }
            },
            professionalRegistration: {
                description: 'Working professional registration should populate all fields',
                expectedDatabaseState: {
                    Users: {
                        UserID: 'Generated UUID',
                        Email: 'john.engineer@techcorp.com',
                        FirstName: 'John',
                        LastName: 'Smith',
                        UserType: 'JobSeeker',
                        IsActive: true,
                        EmailVerified: false
                    },
                    Applicants: {
                        ApplicantID: 'Generated UUID',
                        UserID: 'Matches Users.UserID',
                        Institution: 'University of California, Berkeley',
                        HighestEducation: "Master's Degree",
                        FieldOfStudy: 'Computer Science',
                        CurrentJobTitle: 'Senior Software Engineer',
                        CurrentCompany: 'Tech Corp Inc.',
                        YearsOfExperience: 5,
                        PrimarySkills: 'React, Node.js, TypeScript, AWS',
                        SecondarySkills: 'Python, Docker, Kubernetes, GraphQL',
                        Summary: 'Experienced full-stack developer...',
                        PreferredJobTypes: 'Full-Time, Contract',
                        PreferredWorkTypes: 'remote',
                        IsOpenToWork: true,
                        AllowRecruitersToContact: true,
                        HideCurrentCompany: false,
                        HideSalaryDetails: false,
                        ProfileCompleteness: 100
                    }
                }
            },
            profileUpdate: {
                description: 'Profile updates should modify specific fields without affecting others',
                examples: [
                    {
                        updateData: { hideCurrentCompany: true, hideSalaryDetails: true },
                        expectedChanges: { HideCurrentCompany: 1, HideSalaryDetails: 1 },
                        unchangedFields: ['CurrentJobTitle', 'PrimarySkills', 'Institution']
                    },
                    {
                        updateData: { currentJobTitle: 'Principal Engineer', primarySkills: 'Leadership, Architecture' },
                        expectedChanges: { CurrentJobTitle: 'Principal Engineer', PrimarySkills: 'Leadership, Architecture' },
                        unchangedFields: ['HideCurrentCompany', 'Institution', 'FieldOfStudy']
                    }
                ]
            }
        }
    };
    
    const reportPath = join(process.cwd(), 'test-results.json');
    writeFileSync(reportPath, JSON.stringify(report, null, 2));
    process.stdout.write(`\n📊 Test report saved to: ${reportPath}\n`);
    
    return report;
};

const main = async () => {
    process.stdout.write('NexHire Registration Flow Test Suite\n');
    process.stdout.write('Testing all registration and profile update scenarios\n\n');
    
    const results: { name: string; passed: boolean }[] = [];
    
    // Run all test suites
    for (const testSuite of testSuites) {
        const passed = runTestSuite(testSuite);
        results.push({ name: testSuite.name, passed });
    }
    
    // Generate summary
    process.stdout.write('\n' + '='.repeat(80) + '\n');
    process.stdout.write('TEST SUMMARY\n');
    process.stdout.write('='.repeat(80) + '\n');
    
    const totalTests = results.length;
    const passedTests = results.filter(r => r.passed).length;
    const failedTests = totalTests - passedTests;
    
    process.stdout.write(`\n📊 Overall Results:\n`);
    process.stdout.write(`   Total Test Suites: ${totalTests}\n`);
    process.stdout.write(`   ✅ Passed: ${passedTests}\n`);
    process.stdout.write(`   ❌ Failed: ${failedTests}\n`);
    process.stdout.write(`   🎯 Success Rate: ${Math.round((passedTests / totalTests) * 100)}%\n`);
    
    process.stdout.write('\n📋 Detailed Results:\n');
    results.forEach((result, index) => {
        const status = result.passed ? 'PASS' : 'FAIL';
        process.stdout.write(`   ${index + 1}. ${result.name}: ${status}\n`);
    });
    
    // Generate and save report
    const report = generateTestReport(results);
    
    if (failedTests === 0) {
        process.stdout.write('\n🎉 All tests passed! Registration flows are working correctly.\n');
        process.stdout.write('\n✅ Acceptance Criteria Met:\n');
        process.stdout.write('   • Student registration populates Users + Applicants tables correctly\n');
        process.stdout.write('   • Professional registration includes all work experience data\n');
        process.stdout.write('   • Profile updates work for individual and bulk field changes\n');
        process.stdout.write('   • Privacy settings (hideCurrentCompany, hideSalaryDetails) update properly\n');
        process.stdout.write('   • API endpoints match frontend call patterns exactly\n');
        process.exit(0);
    } else {
        process.stdout.write('\n⚠️  Some tests failed. Please review the errors above.\n');
        process.stdout.write('\n🔧 Next Steps:\n');
        process.stdout.write('   1. Check database connection and schema\n');
        process.stdout.write('   2. Verify service method implementations\n');
        process.stdout.write('   3. Validate API endpoint configurations\n');
        process.stdout.write('   4. Review field mapping between frontend and backend\n');
        process.exit(1);
    }
};

// Run the test suite
if (require.main === module) {
    main().catch(error => {
        process.stderr.write(`Test runner failed: ${error}\n`);
        process.exit(1);
    });
}

export { main as runRegistrationFlowTests };