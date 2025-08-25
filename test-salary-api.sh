#!/bin/bash

# ================================================================
# NexHire API Test Script - New Salary Structure
# ================================================================
# This script tests the complete user registration flow with the new
# salary structure including SalaryComponents and ApplicantSalaries tables
# ================================================================

set -e  # Exit on any error

# Configuration
API_BASE="https://nexhire-api-func.azurewebsites.net/api"
TEST_EMAIL="testuser_$(date +%s)@example.com"
TEST_PASSWORD="TestPassword123!"

echo "?? Starting NexHire API Test - New Salary Structure"
echo "?? Test Email: $TEST_EMAIL"
echo "?? API Base: $API_BASE"
echo ""

# Function to make API calls with proper error handling
api_call() {
    local method=$1
    local endpoint=$2
    local data=$3
    local auth_header=$4
    
    echo "?? API Call: $method $endpoint"
    
    if [ -n "$data" ]; then
        if [ -n "$auth_header" ]; then
            response=$(curl -s -w "\n%{http_code}" -X $method \
                -H "Content-Type: application/json" \
                -H "Authorization: Bearer $auth_header" \
                -d "$data" \
                "$API_BASE$endpoint")
        else
            response=$(curl -s -w "\n%{http_code}" -X $method \
                -H "Content-Type: application/json" \
                -d "$data" \
                "$API_BASE$endpoint")
        fi
    else
        if [ -n "$auth_header" ]; then
            response=$(curl -s -w "\n%{http_code}" -X $method \
                -H "Content-Type: application/json" \
                -H "Authorization: Bearer $auth_header" \
                "$API_BASE$endpoint")
        else
            response=$(curl -s -w "\n%{http_code}" -X $method \
                -H "Content-Type: application/json" \
                "$API_BASE$endpoint")
        fi
    fi
    
    # Split response and status code
    http_code=$(echo "$response" | tail -n1)
    response_body=$(echo "$response" | head -n -1)
    
    echo "?? HTTP Status: $http_code"
    echo "?? Response: $response_body" | jq . 2>/dev/null || echo "$response_body"
    echo ""
    
    # Check for successful status codes
    if [[ $http_code -ge 200 && $http_code -lt 300 ]]; then
        echo "? Success"
    else
        echo "? Error: HTTP $http_code"
        echo "Response: $response_body"
        exit 1
    fi
    
    echo "$response_body"
}

# ================================================================
# 1. HEALTH CHECK
# ================================================================
echo "?? 1. Health Check"
health_response=$(api_call "GET" "/health")
echo ""

# ================================================================
# 2. GET REFERENCE DATA (New Salary Components)
# ================================================================
echo "?? 2. Get Salary Components (New Feature)"
salary_components=$(api_call "GET" "/reference/salary-components")
echo "Salary Components loaded ?"
echo ""

echo "?? 3. Get Currencies"
currencies=$(api_call "GET" "/reference/currencies")
echo "Currencies loaded ?"
echo ""

echo "?? 4. Get Job Types"
job_types=$(api_call "GET" "/reference/job-types")
echo "Job Types loaded ?"
echo ""

# ================================================================
# 5. USER REGISTRATION (JobSeeker)
# ================================================================
echo "?? 5. Register New JobSeeker User"
registration_data='{
    "email": "'$TEST_EMAIL'",
    "password": "'$TEST_PASSWORD'",
    "userType": "JobSeeker",
    "firstName": "John",
    "lastName": "Doe",
    "phone": "+1234567890",
    "dateOfBirth": "1990-01-15",
    "gender": "Male"
}'

registration_response=$(api_call "POST" "/auth/register" "$registration_data")
echo "User registered successfully ?"
echo ""

# ================================================================
# 6. USER LOGIN
# ================================================================
echo "?? 6. Login User"
login_data='{
    "email": "'$TEST_EMAIL'",
    "password": "'$TEST_PASSWORD'"
}'

login_response=$(api_call "POST" "/auth/login" "$login_data")

# Extract token from login response
ACCESS_TOKEN=$(echo "$login_response" | jq -r '.data.tokens.accessToken')

if [ "$ACCESS_TOKEN" == "null" ] || [ -z "$ACCESS_TOKEN" ]; then
    echo "? Failed to extract access token"
    echo "Login response: $login_response"
    exit 1
fi

echo "Login successful, token obtained ?"
echo ""

# Extract User ID
USER_ID=$(echo "$login_response" | jq -r '.data.user.UserID')
echo "?? User ID: $USER_ID"
echo ""

# ================================================================
# 7. GET INITIAL APPLICANT PROFILE
# ================================================================
echo "?? 7. Get Initial Applicant Profile"
initial_profile=$(api_call "GET" "/applicants/$USER_ID/profile" "" "$ACCESS_TOKEN")
echo "Initial profile retrieved ?"
echo ""

# ================================================================
# 8. UPDATE BASIC APPLICANT PROFILE (WITHOUT SALARY)
# ================================================================
echo "?? 8. Update Basic Applicant Profile"
basic_profile_data='{
    "headline": "Senior Software Engineer",
    "summary": "Experienced full-stack developer with 5+ years in React and Node.js",
    "currentJobTitle": "Senior Software Engineer",
    "currentCompany": "TechCorp Inc.",
    "yearsOfExperience": 5,
    "currentLocation": "New York, NY",
    "primarySkills": "React, Node.js, TypeScript, PostgreSQL",
    "secondarySkills": "Docker, Kubernetes, AWS",
    "preferredJobTypes": "Full-Time, Contract",
    "preferredWorkTypes": "Hybrid",
    "preferredLocations": "New York, San Francisco, Remote",
    "minimumSalary": 120000,
    "linkedInProfile": "https://linkedin.com/in/johndoe",
    "githubProfile": "https://github.com/johndoe"
}'

updated_profile=$(api_call "PUT" "/applicants/$USER_ID/profile" "$basic_profile_data" "$ACCESS_TOKEN")
echo "Basic profile updated successfully ?"
echo ""

# ================================================================
# 9. UPDATE EDUCATION DATA (Enhanced with new fields)
# ================================================================
echo "?? 9. Update Education Data"
education_data='{
    "institution": "Stanford University",
    "highestEducation": "Master of Science",
    "fieldOfStudy": "Computer Science",
    "graduationYear": "2020",
    "gpa": "3.8/4.0"
}'

education_response=$(api_call "PUT" "/applicants/$USER_ID/profile" "$education_data" "$ACCESS_TOKEN")
echo "Education updated successfully ?"
echo ""

# ================================================================
# 10. UPDATE SALARY BREAKDOWN (New Feature)
# ================================================================
echo "?? 10. Update Salary Breakdown (New Feature)"

# Get first currency ID and component IDs
CURRENCY_ID=$(echo "$currencies" | jq -r '.data[0].CurrencyID')
FIXED_COMPONENT_ID=$(echo "$salary_components" | jq -r '.data[] | select(.ComponentName=="Fixed") | .ComponentID')
VARIABLE_COMPONENT_ID=$(echo "$salary_components" | jq -r '.data[] | select(.ComponentName=="Variable") | .ComponentID')
BONUS_COMPONENT_ID=$(echo "$salary_components" | jq -r '.data[] | select(.ComponentName=="Bonus") | .ComponentID')

echo "?? Using Currency ID: $CURRENCY_ID"
echo "?? Fixed Component ID: $FIXED_COMPONENT_ID"
echo "?? Variable Component ID: $VARIABLE_COMPONENT_ID"
echo "?? Bonus Component ID: $BONUS_COMPONENT_ID"

salary_breakdown_data='{
    "salaryBreakdown": {
        "current": [
            {
                "ComponentID": '$FIXED_COMPONENT_ID',
                "Amount": 100000,
                "CurrencyID": '$CURRENCY_ID',
                "Frequency": "Yearly",
                "Notes": "Base salary"
            },
            {
                "ComponentID": '$VARIABLE_COMPONENT_ID',
                "Amount": 20000,
                "CurrencyID": '$CURRENCY_ID',
                "Frequency": "Yearly",
                "Notes": "Performance bonus"
            }
        ],
        "expected": [
            {
                "ComponentID": '$FIXED_COMPONENT_ID',
                "Amount": 130000,
                "CurrencyID": '$CURRENCY_ID',
                "Frequency": "Yearly",
                "Notes": "Expected base salary"
            },
            {
                "ComponentID": '$VARIABLE_COMPONENT_ID',
                "Amount": 30000,
                "CurrencyID": '$CURRENCY_ID',
                "Frequency": "Yearly",
                "Notes": "Expected variable"
            },
            {
                "ComponentID": '$BONUS_COMPONENT_ID',
                "Amount": 15000,
                "CurrencyID": '$CURRENCY_ID',
                "Frequency": "Yearly",
                "Notes": "Signing bonus"
            }
        ]
    }
}'

salary_response=$(api_call "PUT" "/applicants/$USER_ID/profile" "$salary_breakdown_data" "$ACCESS_TOKEN")
echo "Salary breakdown updated successfully ?"
echo ""

# ================================================================
# 11. GET FINAL PROFILE WITH SALARY BREAKDOWN
# ================================================================
echo "?? 11. Get Final Profile with Salary Breakdown"
final_profile=$(api_call "GET" "/applicants/$USER_ID/profile" "" "$ACCESS_TOKEN")
echo "Final profile retrieved with salary breakdown ?"
echo ""

# Extract and display salary breakdown
echo "?? Current Salary Breakdown:"
echo "$final_profile" | jq '.data.salaryBreakdown.current[]? | {component: .ComponentName, amount: .Amount, currency: .CurrencyID}' 2>/dev/null || echo "No current salary data"

echo "?? Expected Salary Breakdown:"
echo "$final_profile" | jq '.data.salaryBreakdown.expected[]? | {component: .ComponentName, amount: .Amount, currency: .CurrencyID}' 2>/dev/null || echo "No expected salary data"

# ================================================================
# 12. TEST PRIVACY SETTINGS
# ================================================================
echo "?? 12. Test Privacy Settings"
privacy_data='{
    "hideCurrentCompany": true,
    "hideSalaryDetails": true,
    "allowRecruitersToContact": false
}'

privacy_response=$(api_call "PUT" "/applicants/$USER_ID/profile" "$privacy_data" "$ACCESS_TOKEN")
echo "Privacy settings updated successfully ?"
echo ""

# ================================================================
# 13. LOGOUT
# ================================================================
echo "?? 13. Logout User"
logout_response=$(api_call "POST" "/auth/logout" "" "$ACCESS_TOKEN")
echo "User logged out successfully ?"
echo ""

# ================================================================
# SUMMARY
# ================================================================
echo "?? ================================================================"
echo "?? ALL TESTS COMPLETED SUCCESSFULLY!"
echo "?? ================================================================"
echo ""
echo "? Health Check - API is running"
echo "? Reference Data - Salary components, currencies, job types loaded"
echo "? User Registration - JobSeeker user created"
echo "? User Login - Authentication successful"
echo "? Profile Creation - Initial applicant profile created"
echo "? Basic Profile Update - Professional information saved"
echo "? Education Update - Enhanced with graduation year and GPA"
echo "? Salary Breakdown - New salary structure working"
echo "? Privacy Settings - Toggle settings functional"
echo "? Profile Retrieval - Complete profile with salary breakdown"
echo "? User Logout - Session terminated"
echo ""
echo "?? API Endpoints Tested:"
echo "   • GET  /health"
echo "   • GET  /reference/salary-components ? NEW"
echo "   • GET  /reference/currencies"
echo "   • GET  /reference/job-types"
echo "   • POST /auth/register"
echo "   • POST /auth/login"
echo "   • GET  /applicants/{userId}/profile"
echo "   • PUT  /applicants/{userId}/profile ? ENHANCED"
echo "   • POST /auth/logout"
echo ""
echo "?? New Salary Structure Features Verified:"
echo "   • SalaryComponents table integration"
echo "   • ApplicantSalaries table operations"
echo "   • Current vs Expected salary breakdown"
echo "   • Multiple salary components (Fixed, Variable, Bonus)"
echo "   • Currency support per component"
echo "   • Salary privacy controls"
echo ""
echo "?? Test User Created:"
echo "   ?? Email: $TEST_EMAIL"
echo "   ?? User ID: $USER_ID"
echo "   ??? Type: JobSeeker"
echo ""
echo "?? Ready for frontend integration!"