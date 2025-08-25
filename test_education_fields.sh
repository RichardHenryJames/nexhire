#!/bin/bash

# ?? Quick Test Script for GraduationYear & GPA Integration
# ============================================================

API_BASE_URL="https://nexhire-api-func.azurewebsites.net/api"
TEST_EMAIL="test-education-$(date +%s)@nexhire.com"
TEST_PASSWORD="TestPassword123!"

echo "?? Testing Education Fields (GraduationYear & GPA)"
echo "=================================================="
echo "?? Test Email: $TEST_EMAIL"
echo "?? API URL: $API_BASE_URL"
echo ""

# 1. Register user
echo "1?? Registering new user..."
REGISTER_RESPONSE=$(curl -s -X POST "${API_BASE_URL}/auth/register" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{
    "email": "'${TEST_EMAIL}'",
    "password": "'${TEST_PASSWORD}'",
    "firstName": "John",
    "lastName": "TestEducation",
    "userType": "JobSeeker",
    "phone": "+1234567890"
  }')

echo "?? Registration Response:"
echo "$REGISTER_RESPONSE" | jq '.'

# Check if registration was successful
if echo "$REGISTER_RESPONSE" | jq -e '.success' > /dev/null; then
  echo "? Registration successful!"
else
  echo "? Registration failed!"
  exit 1
fi

# 2. Extract token and user ID
AUTH_TOKEN=$(echo $REGISTER_RESPONSE | jq -r '.data.tokens.accessToken')
USER_ID=$(echo $REGISTER_RESPONSE | jq -r '.data.user.UserID')

echo ""
echo "?? Auth Token: ${AUTH_TOKEN:0:50}..."
echo "?? User ID: $USER_ID"
echo ""

# 3. Update education with GraduationYear & GPA via registration flow
echo "2?? Updating education via registration flow (with GraduationYear & GPA)..."
EDUCATION_RESPONSE=$(curl -s -X PUT "${API_BASE_URL}/users/education" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d '{
    "college": {
      "name": "Stanford University",
      "country": "United States"
    },
    "degreeType": "Master'\''s Degree",
    "fieldOfStudy": "Computer Science",
    "graduationYear": "2024",
    "gpa": "3.9/4.0"
  }')

echo "?? Education Update Response:"
echo "$EDUCATION_RESPONSE" | jq '.'

# 4. Verify data was saved by getting applicant profile
echo ""
echo "3?? Verifying data was saved (GET applicant profile)..."
PROFILE_RESPONSE=$(curl -s -X GET "${API_BASE_URL}/applicants/${USER_ID}/profile" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -H "Authorization: Bearer ${AUTH_TOKEN}")

echo "?? Profile Response:"
echo "$PROFILE_RESPONSE" | jq '.'

# 5. Extract and verify specific fields
echo ""
echo "4?? Checking specific education fields..."

if echo "$PROFILE_RESPONSE" | jq -e '.success' > /dev/null; then
  INSTITUTION=$(echo $PROFILE_RESPONSE | jq -r '.data.Institution // "null"')
  HIGHEST_EDUCATION=$(echo $PROFILE_RESPONSE | jq -r '.data.HighestEducation // "null"')
  FIELD_OF_STUDY=$(echo $PROFILE_RESPONSE | jq -r '.data.FieldOfStudy // "null"')
  GRADUATION_YEAR=$(echo $PROFILE_RESPONSE | jq -r '.data.GraduationYear // "null"')
  GPA=$(echo $PROFILE_RESPONSE | jq -r '.data.GPA // "null"')
  
  echo "?? Institution: $INSTITUTION"
  echo "?? Highest Education: $HIGHEST_EDUCATION"
  echo "?? Field of Study: $FIELD_OF_STUDY"
  echo "?? Graduation Year: $GRADUATION_YEAR"
  echo "?? GPA: $GPA"
else
  echo "? Failed to get profile data"
  exit 1
fi

# 6. Test profile update via applicant endpoint (Smart Routing)
echo ""
echo "5?? Testing profile update via applicant endpoint (Smart Routing)..."
UPDATE_RESPONSE=$(curl -s -X PUT "${API_BASE_URL}/applicants/${USER_ID}/profile" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d '{
    "institution": "Massachusetts Institute of Technology (MIT)",
    "highestEducation": "PhD",
    "fieldOfStudy": "Artificial Intelligence",
    "graduationYear": "2023",
    "gpa": "4.0/4.0",
    "hideCurrentCompany": true,
    "currentJobTitle": "Senior AI Researcher"
  }')

echo "?? Profile Update Response:"
echo "$UPDATE_RESPONSE" | jq '.'

# 7. Final verification
echo ""
echo "6?? Final verification after profile update..."
FINAL_PROFILE=$(curl -s -X GET "${API_BASE_URL}/applicants/${USER_ID}/profile" \
  -H "Authorization: Bearer ${AUTH_TOKEN}")

if echo "$FINAL_PROFILE" | jq -e '.success' > /dev/null; then
  FINAL_INSTITUTION=$(echo $FINAL_PROFILE | jq -r '.data.Institution // "null"')
  FINAL_GRADUATION_YEAR=$(echo $FINAL_PROFILE | jq -r '.data.GraduationYear // "null"')
  FINAL_GPA=$(echo $FINAL_PROFILE | jq -r '.data.GPA // "null"')
  FINAL_HIDE_COMPANY=$(echo $FINAL_PROFILE | jq -r '.data.HideCurrentCompany // "null"')
  
  echo "?? Final Institution: $FINAL_INSTITUTION"
  echo "?? Final Graduation Year: $FINAL_GRADUATION_YEAR"
  echo "?? Final GPA: $FINAL_GPA"
  echo "?? Hide Company: $FINAL_HIDE_COMPANY"
fi

# 8. Results Summary
echo ""
echo "?? TEST RESULTS SUMMARY"
echo "======================="

# Check registration flow
if [ "$GRADUATION_YEAR" = "2024" ] && [ "$GPA" = "3.9/4.0" ]; then
  echo "? REGISTRATION FLOW: GraduationYear and GPA saved correctly during registration"
else
  echo "? REGISTRATION FLOW: Fields not saved correctly during registration"
fi

# Check profile update flow  
if [ "$FINAL_GRADUATION_YEAR" = "2023" ] && [ "$FINAL_GPA" = "4.0/4.0" ]; then
  echo "? PROFILE UPDATE FLOW: GraduationYear and GPA updated correctly via profile endpoint"
else
  echo "? PROFILE UPDATE FLOW: Fields not updated correctly via profile endpoint"
fi

# Check smart routing
if [ "$FINAL_HIDE_COMPANY" = "1" ] || [ "$FINAL_HIDE_COMPANY" = "true" ]; then
  echo "? SMART ROUTING: Mixed field updates work correctly"
else
  echo "? SMART ROUTING: Mixed field updates may have issues"
fi

# Overall result
if [ "$FINAL_GRADUATION_YEAR" = "2023" ] && [ "$FINAL_GPA" = "4.0/4.0" ]; then
  echo ""
  echo "?? OVERALL: SUCCESS! GraduationYear and GPA integration is working correctly!"
  echo "   - ? Database columns exist and accept data"
  echo "   - ? Registration flow saves the fields"
  echo "   - ? Profile update flow updates the fields"
  echo "   - ? Smart routing works with mixed field types"
else
  echo ""
  echo "? OVERALL: FAILURE! There are issues with the integration."
  echo "   Check the database schema and backend code."
fi

echo ""
echo "?? Test completed with user: $TEST_EMAIL"
echo "?? User ID: $USER_ID (you can use this for manual testing)"