# Registration Flow Unit Tests Documentation

## Overview

This document describes the comprehensive unit test suite for all NexHire registration flows and profile update scenarios. The tests validate that the backend correctly handles frontend API calls and populates the database as expected.

## Test Structure

### 1. Complete Registration Flow Tests (`tests/complete-registration-flow.test.ts`)

Tests the end-to-end registration process for different user types:

#### Job Seeker - Student Flow
- **Input**: Basic user info + education data only
- **Expected Database State**:
  ```sql
  -- Users Table
  UserID: Generated UUID
  Email: 'student@university.edu'
  FirstName: 'Sarah'
  LastName: 'Johnson'
  UserType: 'JobSeeker'
  IsActive: true
  
  -- Applicants Table
  ApplicantID: Generated UUID
  Institution: 'Stanford University'
  HighestEducation: "Bachelor's Degree"
  FieldOfStudy: 'Computer Science'
  CurrentJobTitle: NULL
  CurrentCompany: NULL
  YearsOfExperience: NULL
  PrimarySkills: NULL
  SecondarySkills: NULL
  Summary: NULL
  PreferredJobTypes: 'Internship, Full-Time'
  ProfileCompleteness: 60
  ```

#### Job Seeker - Working Professional Flow
- **Input**: Basic user info + education data + work experience data
- **Expected Database State**:
  ```sql
  -- Users Table (same as student)
  
  -- Applicants Table (ALL fields populated)
  ApplicantID: Generated UUID
  Institution: 'University of California, Berkeley'
  HighestEducation: "Master's Degree"
  FieldOfStudy: 'Computer Science'
  CurrentJobTitle: 'Senior Software Engineer'
  CurrentCompany: 'Tech Corp Inc.'
  YearsOfExperience: 5
  PrimarySkills: 'React, Node.js, TypeScript, AWS'
  SecondarySkills: 'Python, Docker, Kubernetes, GraphQL'
  Summary: 'Experienced full-stack developer...'
  PreferredJobTypes: 'Full-Time, Contract'
  PreferredWorkTypes: 'remote'
  ProfileCompleteness: 100
  ```

### 2. Profile Update Flow Tests (`tests/profile-update-flow.test.ts`)

Tests all possible profile update scenarios after registration:

#### Privacy Settings Updates
```typescript
// Test Case: Update privacy settings
const updateData = { 
  hideCurrentCompany: true, 
  hideSalaryDetails: true 
};

// Expected Database Changes
HideCurrentCompany: 0 ? 1
HideSalaryDetails: 0 ? 1
// All other fields remain unchanged
```

#### Work Experience Updates
```typescript
// Test Case: Update work experience
const updateData = {
  currentJobTitle: 'Senior Software Engineer',
  currentCompany: 'New Tech Company',
  primarySkills: 'React, TypeScript, AWS, GraphQL'
};

// Expected Database Changes
CurrentJobTitle: 'Software Engineer' ? 'Senior Software Engineer'
CurrentCompany: 'Current Corp' ? 'New Tech Company'
PrimarySkills: 'JavaScript, React' ? 'React, TypeScript, AWS, GraphQL'
```

#### Education Updates
```typescript
// Test Case: Update education via dedicated endpoint
const updateData = {
  college: { name: 'Harvard University' },
  degreeType: 'PhD',
  fieldOfStudy: 'Artificial Intelligence'
};

// Expected Database Changes
Institution: 'Current University' ? 'Harvard University'
HighestEducation: "Master's Degree" ? 'PhD'
FieldOfStudy: 'Computer Science' ? 'Artificial Intelligence'
```

### 3. Frontend API Integration Tests (`tests/frontend-api-integration.test.ts`)

Tests that replicate exact frontend API calls:

#### HTTP Request Simulation
```typescript
// Replicates frontend fetch() calls
const registrationRequest = createMockRequest('POST', {
  email: 'student@university.edu',
  password: 'StudentPass123!',
  firstName: 'Sarah',
  lastName: 'Johnson',
  userType: 'JobSeeker'
});

// Tests actual controller methods
const response = await register(registrationRequest, mockContext);
expect(response.status).toBe(201);
```

## API Endpoints Tested

### Registration Flow Endpoints
1. `POST /auth/register` - User registration
2. `POST /auth/login` - Auto-login after registration
3. `PUT /users/education` - Education data update
4. `PUT /users/work-experience` - Work experience update
5. `PUT /users/job-preferences` - Job preferences update

### Profile Update Endpoints
1. `PUT /applicants/{userId}/profile` - Applicant profile updates
2. `PUT /users/education` - Education updates
3. `PUT /users/work-experience` - Work experience updates
4. `PUT /users/job-preferences` - Job preferences updates

## Test Data Validation

### Field Mapping Validation
```typescript
// Frontend ? Backend field mapping
const fieldMapping = {
  'hideCurrentCompany': 'HideCurrentCompany',
  'hideSalaryDetails': 'HideSalaryDetails',
  'currentJobTitle': 'CurrentJobTitle',
  'primarySkills': 'PrimarySkills',
  'yearsOfExperience': 'YearsOfExperience' // String ? Number conversion
};
```

### Boolean Conversion Testing
```typescript
// Test all boolean conversion scenarios
const booleanTestCases = {
  hideCurrentCompany: 'true', // String 'true' ? 1
  hideSalaryDetails: 1,       // Number 1 ? 1
  allowRecruitersToContact: false, // Boolean false ? 0
  isOpenToWork: 0           // Number 0 ? 0
};
```

### Years of Experience Parsing
```typescript
// Test years parsing from frontend strings
const testCases = [
  { input: '0-1 years', expected: 0 },
  { input: '3-5 years', expected: 3 },
  { input: '10+ years', expected: 10 }
];
```

## Running the Tests

### Individual Test Suites
```bash
# Run complete registration flow tests
npm run test:registration-only

# Run profile update tests
npm run test:profile-update

# Run API integration tests
npm run test:api-integration
```

### All Tests
```bash
# Run all registration flow tests
npm run test:all-flows

# Run with coverage
npm run test:coverage

# Run test runner with report generation
npm run test:registration
```

### Test Output
```bash
?? Running: Complete Registration Flow Tests
?? Description: Tests complete registration flows for students and working professionals

?? Acceptance Criteria:
   1. Student registration saves basic info + education data to Users and Applicants tables
   2. Professional registration saves basic info + education + work experience to tables
   3. Work experience fields are NULL for students
   4. All work experience fields are populated for professionals
   5. Profile completeness is calculated correctly
   6. Registration flow matches frontend API calls exactly

?? Executing tests...

? Complete Registration Flow Tests - PASSED
```

## Acceptance Criteria

### Student Registration
- ? User record created in Users table
- ? Applicant record created in Applicants table
- ? Education fields populated (Institution, HighestEducation, FieldOfStudy)
- ? Work experience fields are NULL
- ? Job preferences populated if provided
- ? ProfileCompleteness ? 40%

### Working Professional Registration
- ? User record created in Users table
- ? Applicant record created in Applicants table
- ? Education fields populated
- ? ALL work experience fields populated
- ? Job preferences populated
- ? ProfileCompleteness ? 80%

### Profile Updates
- ? Individual field updates work correctly
- ? Privacy settings (hideCurrentCompany, hideSalaryDetails) toggle properly
- ? Boolean values convert to database bits (0/1)
- ? Multiple fields can be updated simultaneously
- ? Unchanged fields remain unaffected
- ? Profile completeness recalculated after updates

### API Integration
- ? HTTP requests processed correctly
- ? Authentication middleware works
- ? Request/response format matches frontend
- ? Error scenarios return proper status codes
- ? Database calls match expected SQL patterns

## Error Scenarios Tested

1. **Missing Required Fields**
   - Empty registration data
   - Missing education fields
   - Invalid user types

2. **Database Constraints**
   - Field length violations
   - NULL constraint violations
   - Foreign key violations

3. **Authentication Errors**
   - Invalid JWT tokens
   - Expired tokens
   - Missing authorization headers

4. **Profile Update Errors**
   - Non-existent user profiles
   - Invalid field values
   - Empty update data

## Mock Data Examples

### Student Registration Data
```typescript
const studentData = {
  // Basic info
  email: 'student@university.edu',
  password: 'StudentPass123!',
  firstName: 'Sarah',
  lastName: 'Johnson',
  userType: 'JobSeeker',
  experienceType: 'Student',
  
  // Education only
  educationData: {
    college: { name: 'Stanford University' },
    degreeType: "Bachelor's Degree",
    fieldOfStudy: 'Computer Science'
  }
  // No workExperienceData
};
```

### Professional Registration Data
```typescript
const professionalData = {
  // Basic info
  email: 'john.engineer@techcorp.com',
  password: 'ProfessionalPass123!',
  firstName: 'John',
  lastName: 'Smith',
  userType: 'JobSeeker',
  experienceType: 'Experienced',
  
  // Education
  educationData: {
    college: { name: 'UC Berkeley' },
    degreeType: "Master's Degree",
    fieldOfStudy: 'Computer Science'
  },
  
  // Work experience
  workExperienceData: {
    currentJobTitle: 'Senior Software Engineer',
    currentCompany: 'Tech Corp Inc.',
    yearsOfExperience: '5-7 years',
    primarySkills: 'React, Node.js, TypeScript, AWS'
  }
};
```

## Database Validation Helpers

```typescript
// Helper function to validate expected database state
export const validateExpectedDatabaseState = (
  userType: 'Student' | 'Professional',
  userId: string,
  applicantId: string
) => {
  // Returns expected database structure based on user type
  // Used to validate test results
};
```

This comprehensive test suite ensures that all registration flows work correctly and that the database is populated exactly as expected for both student and working professional user types.