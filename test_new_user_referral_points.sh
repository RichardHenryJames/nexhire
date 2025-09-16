#!/bin/bash

# Test script for referral points system with new user registration
# This script will register new users and test the complete referral flow

BASE_URL="https://nexhire-api-func.azurewebsites.net/api"
echo "?? Testing Referral Points System with New User Registration"
echo "=================================================="

# Generate unique email addresses
TIMESTAMP=$(date +%s)
SEEKER_EMAIL="test_seeker_${TIMESTAMP}@example.com"
REFERRER_EMAIL="test_referrer_${TIMESTAMP}@example.com"
PASSWORD="12345678"

echo "?? Registering users with emails:"
echo "   Seeker: $SEEKER_EMAIL"
echo "   Referrer: $REFERRER_EMAIL"
echo ""

# Step 1: Register Seeker (who will request referrals)
echo "1?? Registering Seeker..."
REGISTER_SEEKER=$(curl -s -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$SEEKER_EMAIL\",
    \"password\": \"$PASSWORD\",
    \"userType\": \"JobSeeker\",
    \"firstName\": \"Test\",
    \"lastName\": \"Seeker\"
  }")

echo "Seeker Registration Response: $REGISTER_SEEKER"

if [[ $REGISTER_SEEKER == *"success\":true"* ]]; then
    echo "? Seeker registered successfully"
else
    echo "? Seeker registration failed"
    exit 1
fi

# Step 2: Register Referrer (who will provide referrals)
echo ""
echo "2?? Registering Referrer..."
REGISTER_REFERRER=$(curl -s -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$REFERRER_EMAIL\",
    \"password\": \"$PASSWORD\",
    \"userType\": \"JobSeeker\",
    \"firstName\": \"Test\",
    \"lastName\": \"Referrer\"
  }")

echo "Referrer Registration Response: $REGISTER_REFERRER"

if [[ $REGISTER_REFERRER == *"success\":true"* ]]; then
    echo "? Referrer registered successfully"
else
    echo "? Referrer registration failed"
    exit 1
fi

# Wait for registration to complete
echo ""
echo "? Waiting for registration to complete..."
sleep 3

# Step 3: Login Seeker
echo ""
echo "3?? Logging in Seeker..."
LOGIN_SEEKER=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$SEEKER_EMAIL\",
    \"password\": \"$PASSWORD\"
  }")

echo "Seeker Login Response: $LOGIN_SEEKER"

SEEKER_TOKEN=$(echo $LOGIN_SEEKER | grep -o '"accessToken":"[^"]*' | sed 's/"accessToken":"//')

if [[ -z "$SEEKER_TOKEN" ]]; then
    echo "? Failed to get seeker token"
    exit 1
fi

echo "? Seeker logged in successfully"
echo "Seeker Token: ${SEEKER_TOKEN:0:20}..."

# Step 4: Login Referrer
echo ""
echo "4?? Logging in Referrer..."
LOGIN_REFERRER=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$REFERRER_EMAIL\",
    \"password\": \"$PASSWORD\"
  }")

echo "Referrer Login Response: $LOGIN_REFERRER"

REFERRER_TOKEN=$(echo $LOGIN_REFERRER | grep -o '"accessToken":"[^"]*' | sed 's/"accessToken":"//')

if [[ -z "$REFERRER_TOKEN" ]]; then
    echo "? Failed to get referrer token"
    exit 1
fi

echo "? Referrer logged in successfully"
echo "Referrer Token: ${REFERRER_TOKEN:0:20}..."

# Step 5: Create profiles for both users
echo ""
echo "5?? Creating user profiles..."

# Create seeker profile
echo "Creating seeker profile..."
CREATE_SEEKER_PROFILE=$(curl -s -X POST "$BASE_URL/users/profile" \
  -H "Authorization: Bearer $SEEKER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"dateOfBirth\": \"1995-01-15\",
    \"gender\": \"Other\",
    \"phone\": \"+1234567890\",
    \"profileVisibility\": \"Public\"
  }")

echo "Seeker Profile Response: $CREATE_SEEKER_PROFILE"

# Create referrer profile  
echo "Creating referrer profile..."
CREATE_REFERRER_PROFILE=$(curl -s -X POST "$BASE_URL/users/profile" \
  -H "Authorization: Bearer $REFERRER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"dateOfBirth\": \"1990-05-20\",
    \"gender\": \"Other\",
    \"phone\": \"+1987654321\",
    \"profileVisibility\": \"Public\"
  }")

echo "Referrer Profile Response: $CREATE_REFERRER_PROFILE"

# Step 6: Add work experience for referrer (so they can refer for Acme Corp jobs)
echo ""
echo "6?? Adding work experience for referrer..."
ADD_WORK_EXP=$(curl -s -X POST "$BASE_URL/users/work-experiences" \
  -H "Authorization: Bearer $REFERRER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"organizationName\": \"Acme Corp\",
    \"jobTitle\": \"Senior Developer\",
    \"startDate\": \"2023-01-01\",
    \"endDate\": null,
    \"isCurrent\": true,
    \"description\": \"Working as a senior developer at Acme Corp\"
  }")

echo "Work Experience Response: $ADD_WORK_EXP"

# Step 7: Create resume for seeker
echo ""
echo "7?? Creating resume for seeker..."

# First upload a dummy resume file
RESUME_UPLOAD=$(curl -s -X POST "$BASE_URL/storage/upload" \
  -H "Authorization: Bearer $SEEKER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"fileName\": \"test_resume.pdf\",
    \"mimeType\": \"application/pdf\",
    \"containerName\": \"resumes\",
    \"userId\": \"test-user\",
    \"fileData\": \"JVBERi0xLjQKJdPr6eEKMSAwIG9iago8PAovVHlwZSAvQ2F0YWxvZwovUGFnZXMgMiAwIFIKPj4KZW5kb2JqCjIgMCBvYmoKPDwKL1R5cGUgL1BhZ2VzCi9LaWRzIFsgMyAwIFIgXQovQ291bnQgMQo+PgplbmRvYmoKMyAwIG9iago8PAovVHlwZSAvUGFnZQovUGFyZW50IDIgMCBSCi9NZWRpYUJveCBbIDAgMCA2MTIgNzkyIF0KL0NvbnRlbnRzIDQgMCBSCi9SZXNvdXJjZXMgPDwKL0ZvbnQgPDwKL0YxIDUgMCBSCj4+Cj4+Cj4+CmVuZG9iago0IDAgb2JqCjw8Ci9MZW5ndGggNDQKPj4Kc3RyZWFtCkJUCi9GMSAxMiBUZgoxMDAgNzAwIFRkCihIZWxsbyBXb3JsZCEpIFRqCkVUCmVuZHN0cmVhbQplbmRvYmoKNSAwIG9iago8PAovVHlwZSAvRm9udAovU3VidHlwZSAvVHlwZTEKL0Jhc2VGb250IC9IZWx2ZXRpY2EKPj4KZW5kb2JqCnhyZWYKMCA2CjAwMDAwMDAwMDAgNjU1MzUgZiAKMDAwMDAwMDAwOSAwMDAwMCBuIAowMDAwMDAwMDU4IDAwMDAwIG4gCjAwMDAwMDAxMTUgMDAwMDAgbiAKMDAwMDAwMDI1MiAwMDAwMCBuIAowMDAwMDAwMzQ2IDAwMDAwIG4gCnRyYWlsZXIKPDwKL1NpemUgNgovUm9vdCAxIDAgUgo+PgpzdGFydHhyZWYKNDQzCiUlRU9G\"
  }")

echo "Resume Upload Response: $RESUME_UPLOAD"

RESUME_URL=$(echo $RESUME_UPLOAD | grep -o '"fileUrl":"[^"]*' | sed 's/"fileUrl":"//')

if [[ -z "$RESUME_URL" ]]; then
    echo "? Failed to upload resume"
    exit 1
fi

# Create resume record
CREATE_RESUME=$(curl -s -X POST "$BASE_URL/users/resumes" \
  -H "Authorization: Bearer $SEEKER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"resumeLabel\": \"Test Resume for Referral\",
    \"resumeURL\": \"$RESUME_URL\",
    \"isPrimary\": true
  }")

echo "Create Resume Response: $CREATE_RESUME"

RESUME_ID=$(echo $CREATE_RESUME | grep -o '"ResumeID":"[^"]*' | sed 's/"ResumeID":"//')

if [[ -z "$RESUME_ID" ]]; then
    echo "? Failed to create resume"
    exit 1
fi

echo "? Resume created successfully: $RESUME_ID"

# Step 8: Get available jobs
echo ""
echo "8?? Getting available jobs..."
JOBS=$(curl -s -X GET "$BASE_URL/jobs?pageSize=10" \
  -H "Authorization: Bearer $SEEKER_TOKEN")

echo "Jobs Response: $JOBS"

# Extract Acme Corp job ID (where referrer works)
JOB_ID=$(echo $JOBS | grep -o '"JobID":"[^"]*","OrganizationID":[^,]*[^}]*"OrganizationName":"Acme Corp"' | head -1 | grep -o '"JobID":"[^"]*' | sed 's/"JobID":"//')

if [[ -z "$JOB_ID" ]]; then
    echo "? No Acme Corp jobs found"
    # Let's try any job
    JOB_ID=$(echo $JOBS | grep -o '"JobID":"[^"]*' | head -1 | sed 's/"JobID":"//')
fi

if [[ -z "$JOB_ID" ]]; then
    echo "? No jobs found"
    exit 1
fi

echo "? Using Job ID: $JOB_ID"

# Step 9: Create referral request
echo ""
echo "9?? Creating referral request..."
CREATE_REQUEST=$(curl -s -X POST "$BASE_URL/referral/requests" \
  -H "Authorization: Bearer $SEEKER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"jobID\": \"$JOB_ID\",
    \"resumeID\": \"$RESUME_ID\"
  }")

echo "Create Request Response: $CREATE_REQUEST"

REQUEST_ID=$(echo $CREATE_REQUEST | grep -o '"RequestID":"[^"]*' | sed 's/"RequestID":"//')

if [[ -z "$REQUEST_ID" ]]; then
    echo "? Failed to create referral request"
    exit 1
fi

echo "? Referral request created: $REQUEST_ID"

# Step 10: Check available requests for referrer
echo ""
echo "?? Checking available requests for referrer..."
AVAILABLE_REQUESTS=$(curl -s -X GET "$BASE_URL/referral/available?pageSize=10" \
  -H "Authorization: Bearer $REFERRER_TOKEN")

echo "Available Requests Response: $AVAILABLE_REQUESTS"

# Step 11: Upload proof for claim
echo ""
echo "1??1?? Uploading proof for referral claim..."
PROOF_UPLOAD=$(curl -s -X POST "$BASE_URL/storage/upload" \
  -H "Authorization: Bearer $REFERRER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"fileName\": \"referral_proof.jpg\",
    \"mimeType\": \"image/jpeg\",
    \"containerName\": \"referral-proofs\",
    \"userId\": \"test-referrer\",
    \"fileData\": \"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==\"
  }")

echo "Proof Upload Response: $PROOF_UPLOAD"

PROOF_URL=$(echo $PROOF_UPLOAD | grep -o '"fileUrl":"[^"]*' | sed 's/"fileUrl":"//')

if [[ -z "$PROOF_URL" ]]; then
    echo "? Failed to upload proof"
    exit 1
fi

# Step 12: Claim referral request with proof (THIS SHOULD AWARD POINTS!)
echo ""
echo "1??2?? Claiming referral request with proof..."
CLAIM_REQUEST=$(curl -s -X POST "$BASE_URL/referral/requests/$REQUEST_ID/claim" \
  -H "Authorization: Bearer $REFERRER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"proofFileURL\": \"$PROOF_URL\",
    \"proofFileType\": \"image/jpeg\",
    \"proofDescription\": \"Test referral proof submission\"
  }")

echo "Claim Request Response: $CLAIM_REQUEST"

if [[ $CLAIM_REQUEST == *"success\":true"* ]]; then
    echo "? Referral request claimed with proof successfully!"
else
    echo "? Failed to claim referral request"
fi

# Step 13: Check referrer analytics (should show points now!)
echo ""
echo "1??3?? Checking referrer analytics for POINTS..."
REFERRER_ANALYTICS=$(curl -s -X GET "$BASE_URL/referral/analytics" \
  -H "Authorization: Bearer $REFERRER_TOKEN")

echo "Referrer Analytics Response: $REFERRER_ANALYTICS"

POINTS=$(echo $REFERRER_ANALYTICS | grep -o '"totalPointsEarned":[0-9]*' | sed 's/"totalPointsEarned"://')

if [[ -z "$POINTS" ]]; then
    POINTS=0
fi

echo ""
echo "?? REFERRAL POINTS EARNED: $POINTS"

if [[ $POINTS -gt 0 ]]; then
    echo "?? SUCCESS! Points system is working!"
    echo "Expected: 15-25 points (15 base + 10 quick bonus if completed within 24 hours)"
else
    echo "??  No points awarded yet. This might be due to:"
    echo "   - Deployment delay"
    echo "   - ApplicantID mapping issue"
    echo "   - Database connection issue"
fi

# Step 14: Verify the referral (should add +25 more points)
echo ""
echo "1??4?? Verifying referral completion..."
VERIFY_REQUEST=$(curl -s -X POST "$BASE_URL/referral/requests/$REQUEST_ID/verify" \
  -H "Authorization: Bearer $SEEKER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"verified\": true
  }")

echo "Verify Request Response: $VERIFY_REQUEST"

if [[ $VERIFY_REQUEST == *"success\":true"* ]]; then
    echo "? Referral verified successfully!"
else
    echo "? Failed to verify referral"
fi

# Step 15: Final analytics check
echo ""
echo "1??5?? Final analytics check..."
FINAL_ANALYTICS=$(curl -s -X GET "$BASE_URL/referral/analytics" \
  -H "Authorization: Bearer $REFERRER_TOKEN")

echo "Final Analytics Response: $FINAL_ANALYTICS"

FINAL_POINTS=$(echo $FINAL_ANALYTICS | grep -o '"totalPointsEarned":[0-9]*' | sed 's/"totalPointsEarned"://')

if [[ -z "$FINAL_POINTS" ]]; then
    FINAL_POINTS=0
fi

echo ""
echo "=================================================="
echo "?? FINAL RESULTS:"
echo "   Points after claim: $POINTS"
echo "   Points after verification: $FINAL_POINTS"
echo "   Expected total: 40-50 points (15-25 claim + 25 verification)"
echo ""

if [[ $FINAL_POINTS -ge 40 ]]; then
    echo "?? COMPLETE SUCCESS! Referral points system is fully working!"
elif [[ $FINAL_POINTS -gt 0 ]]; then
    echo "? PARTIAL SUCCESS! Points system working but may need investigation"
else
    echo "? POINTS SYSTEM ISSUE! No points awarded - needs debugging"
fi

echo "=================================================="
echo ""
echo "Test completed with new users:"
echo "  Seeker: $SEEKER_EMAIL"
echo "  Referrer: $REFERRER_EMAIL"
echo "  Password: $PASSWORD"
echo "  Request ID: $REQUEST_ID"