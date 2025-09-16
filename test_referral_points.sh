#!/bin/bash

# NexHire Referral Points System - Complete Test Script
# This script tests the entire referral flow and point award system

# Configuration
API_BASE="https://nexhire-api-func.azurewebsites.net/api"
CONTENT_TYPE="Content-Type: application/json"

# Test Users
SEEKER3_EMAIL="job_seeker3@gmail.com"
SEEKER4_EMAIL="job_seeker4@gmail.com"
PASSWORD="Test@123"

echo "?? Starting Referral Points System Test"
echo "======================================="

# Function to make authenticated API calls
make_api_call() {
    local method=$1
    local endpoint=$2
    local token=$3
    local data=$4
    
    if [[ -n $data ]]; then
        curl -s -X "$method" \
            -H "$CONTENT_TYPE" \
            -H "Authorization: Bearer $token" \
            -d "$data" \
            "$API_BASE$endpoint"
    else
        curl -s -X "$method" \
            -H "$CONTENT_TYPE" \
            -H "Authorization: Bearer $token" \
            "$API_BASE$endpoint"
    fi
}

# Function to extract token from login response
extract_token() {
    echo $1 | jq -r '.data.tokens.accessToken'
}

# Function to extract user info
extract_user_info() {
    echo $1 | jq -r '.data.user'
}

echo "?? Step 1: Login both users"
echo "----------------------------"

# Login job_seeker3 (will request referral)
echo "Logging in job_seeker3@gmail.com..."
seeker3_response=$(curl -s -X POST \
    -H "$CONTENT_TYPE" \
    -d "{\"email\":\"$SEEKER3_EMAIL\",\"password\":\"$PASSWORD\"}" \
    "$API_BASE/auth/login")

seeker3_token=$(extract_token "$seeker3_response")
if [[ "$seeker3_token" == "null" || -z "$seeker3_token" ]]; then
    echo "? Failed to login job_seeker3"
    echo "Response: $seeker3_response"
    exit 1
fi
echo "? job_seeker3 logged in successfully"

# Login job_seeker4 (will provide referral)
echo "Logging in job_seeker4@gmail.com..."
seeker4_response=$(curl -s -X POST \
    -H "$CONTENT_TYPE" \
    -d "{\"email\":\"$SEEKER4_EMAIL\",\"password\":\"$PASSWORD\"}" \
    "$API_BASE/auth/login")

seeker4_token=$(extract_token "$seeker4_response")
if [[ "$seeker4_token" == "null" || -z "$seeker4_token" ]]; then
    echo "? Failed to login job_seeker4"
    echo "Response: $seeker4_response"
    exit 1
fi
echo "? job_seeker4 logged in successfully"

echo ""
echo "?? Step 2: Get available jobs"
echo "-----------------------------"

# Get jobs for referral request
jobs_response=$(make_api_call "GET" "/jobs?pageSize=5" "$seeker3_token")
job_id=$(echo $jobs_response | jq -r '.data[0].JobID')

if [[ "$job_id" == "null" || -z "$job_id" ]]; then
    echo "? No jobs found"
    echo "Jobs response: $jobs_response"
    exit 1
fi

job_title=$(echo $jobs_response | jq -r '.data[0].Title')
echo "? Found job: $job_title (ID: $job_id)"

echo ""
echo "?? Step 3: Get resumes for referral request"
echo "--------------------------------------------"

# Get seeker3's resumes
resumes_response=$(make_api_call "GET" "/users/resumes" "$seeker3_token")
resume_id=$(echo $resumes_response | jq -r '.data[0].ResumeID')

if [[ "$resume_id" == "null" || -z "$resume_id" ]]; then
    echo "? No resumes found for job_seeker3"
    echo "Resumes response: $resumes_response"
    exit 1
fi

echo "? Found resume: $resume_id"

echo ""
echo "?? Step 4: Create referral request"
echo "----------------------------------"

# Create referral request
create_request_data="{\"jobID\":\"$job_id\",\"resumeID\":\"$resume_id\"}"
create_response=$(make_api_call "POST" "/referral/requests" "$seeker3_token" "$create_request_data")

request_id=$(echo $create_response | jq -r '.data.RequestID')
if [[ "$request_id" == "null" || -z "$request_id" ]]; then
    echo "? Failed to create referral request"
    echo "Response: $create_response"
    exit 1
fi

echo "? Referral request created: $request_id"

echo ""
echo "?? Step 5: Check available requests for referrer"
echo "------------------------------------------------"

# Check available requests for job_seeker4
available_response=$(make_api_call "GET" "/referral/available?pageSize=10" "$seeker4_token")
echo "Available requests: $available_response"

echo ""
echo "?? Step 6: Check initial referral points for both users"
echo "-------------------------------------------------------"

# Check analytics for both users (includes point totals)
seeker3_analytics=$(make_api_call "GET" "/referral/analytics" "$seeker3_token")
seeker4_analytics=$(make_api_call "GET" "/referral/analytics" "$seeker4_token")

seeker3_points=$(echo $seeker3_analytics | jq -r '.data.totalPointsEarned // 0')
seeker4_points=$(echo $seeker4_analytics | jq -r '.data.totalPointsEarned // 0')

echo "job_seeker3 initial points: $seeker3_points"
echo "job_seeker4 initial points: $seeker4_points"

echo ""
echo "?? Step 7: Upload proof file (simulate)"
echo "---------------------------------------"

# First, we need to upload a proof file
# For testing, we'll use a base64 encoded sample image
proof_data='{
    "fileName": "referral_proof.jpg",
    "fileData": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
    "mimeType": "image/jpeg",
    "containerName": "referral-proofs",
    "userId": "test-user"
}'

upload_response=$(make_api_call "POST" "/storage/upload" "$seeker4_token" "$proof_data")
proof_url=$(echo $upload_response | jq -r '.data.fileUrl')

if [[ "$proof_url" == "null" || -z "$proof_url" ]]; then
    echo "? Failed to upload proof file"
    echo "Upload response: $upload_response"
    exit 1
fi

echo "? Proof file uploaded: $proof_url"

echo ""
echo "?? Step 8: Claim referral request with proof"
echo "--------------------------------------------"

# Claim the referral request with proof
claim_data="{
    \"proofFileURL\":\"$proof_url\",
    \"proofFileType\":\"image/jpeg\",
    \"proofDescription\":\"Screenshot of referral submission confirmation\"
}"

claim_response=$(make_api_call "POST" "/referral/requests/$request_id/claim" "$seeker4_token" "$claim_data")
echo "Claim response: $claim_response"

# Check if claim was successful
claim_status=$(echo $claim_response | jq -r '.data.Status')
if [[ "$claim_status" != "Completed" ]]; then
    echo "? Failed to claim referral request"
    echo "Response: $claim_response"
    exit 1
fi

echo "? Referral request claimed and completed with proof"

echo ""
echo "?? Step 9: Check points after proof submission"
echo "----------------------------------------------"

# Wait a moment for async processing
sleep 2

# Check analytics again
seeker4_analytics_after=$(make_api_call "GET" "/referral/analytics" "$seeker4_token")
seeker4_points_after=$(echo $seeker4_analytics_after | jq -r '.data.totalPointsEarned // 0')

echo "job_seeker4 points after proof submission: $seeker4_points_after"
echo "Points earned from proof: $((seeker4_points_after - seeker4_points))"

echo ""
echo "? Step 10: Verify referral (give additional points)"
echo "---------------------------------------------------"

# Have seeker3 verify the referral
verify_data='{"verified":true}'
verify_response=$(make_api_call "POST" "/referral/requests/$request_id/verify" "$seeker3_token" "$verify_data")
echo "Verify response: $verify_response"

echo ""
echo "?? Step 11: Check final points after verification"
echo "-------------------------------------------------"

# Wait for async processing
sleep 2

# Check final analytics
seeker4_analytics_final=$(make_api_call "GET" "/referral/analytics" "$seeker4_token")
seeker4_points_final=$(echo $seeker4_analytics_final | jq -r '.data.totalPointsEarned // 0')

echo "job_seeker4 final points: $seeker4_points_final"
echo "Additional points from verification: $((seeker4_points_final - seeker4_points_after))"
echo "Total points earned: $((seeker4_points_final - seeker4_points))"

echo ""
echo "?? Step 12: Check ReferralRewards table entries"
echo "----------------------------------------------"

# Get my referrer requests to see the details
my_referrer_requests=$(make_api_call "GET" "/referral/my-referrer-requests?pageSize=5" "$seeker4_token")
echo "My referrer requests: $my_referrer_requests"

echo ""
echo "?? Step 13: Final analytics comparison"
echo "-------------------------------------"

echo "=== FINAL RESULTS ==="
echo "job_seeker3 (requester) final points: $(echo $(make_api_call "GET" "/referral/analytics" "$seeker3_token") | jq -r '.data.totalPointsEarned // 0')"
echo "job_seeker4 (referrer) final points: $seeker4_points_final"
echo ""

if [[ $seeker4_points_final -gt $seeker4_points ]]; then
    echo "? SUCCESS: Points were awarded correctly!"
    echo "Expected: 15 (proof) + 10 (quick response) + 25 (verification) = 50 points"
    echo "Actual points earned: $((seeker4_points_final - seeker4_points))"
else
    echo "? FAILURE: No points were awarded"
    echo "This indicates an issue with the point awarding system"
fi

echo ""
echo "?? Test completed"
echo "================="