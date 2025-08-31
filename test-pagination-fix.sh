#!/bin/bash

# ?? NexHire Pagination Fix Test Suite
# Tests the infinite scroll pagination fix implemented in the backend

set -e

# Configuration
API_BASE="https://nexhire-api-func.azurewebsites.net/api"
TEST_EMAIL="pagination-test-$(date +%s)@example.com"
TEST_PASSWORD="TestPass123!"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
print_header() {
    echo -e "\n${BLUE}???????????????????????????????????????????????????????????${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}???????????????????????????????????????????????????????????${NC}\n"
}

print_step() {
    echo -e "\n${YELLOW}? $1${NC}"
}

print_success() {
    echo -e "${GREEN}? $1${NC}"
}

print_error() {
    echo -e "${RED}? $1${NC}"
}

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Function to parse JSON response
extract_json_value() {
    echo "$1" | grep -o "\"$2\":[^,}]*" | cut -d':' -f2 | tr -d '"' | tr -d ' '
}

# Function to test pagination response
test_pagination_response() {
    local response="$1"
    local expected_has_more="$2"
    local page_num="$3"
    local test_name="$4"
    
    echo "Response: $response" | head -c 200
    echo "..."
    
    # Extract pagination metadata
    local success=$(extract_json_value "$response" "success")
    local has_more=$(extract_json_value "$response" "hasMore")
    local total=$(extract_json_value "$response" "total")
    local page=$(extract_json_value "$response" "page")
    local page_size=$(extract_json_value "$response" "pageSize")
    
    echo "  success: $success"
    echo "  hasMore: $has_more"
    echo "  total: $total"
    echo "  page: $page"
    echo "  pageSize: $page_size"
    
    # Validate response
    if [[ "$success" == "true" ]]; then
        if [[ "$has_more" == "$expected_has_more" ]]; then
            print_success "$test_name - hasMore=$has_more (expected)"
            ((TESTS_PASSED++))
        else
            print_error "$test_name - hasMore=$has_more (expected $expected_has_more)"
            ((TESTS_FAILED++))
        fi
    else
        print_error "$test_name - API call failed"
        ((TESTS_FAILED++))
    fi
}

print_header "?? NexHire Pagination Fix Test Suite"

# Step 1: Register a test user
print_step "1. Registering test user: $TEST_EMAIL"

REGISTER_RESPONSE=$(curl -s -X POST "$API_BASE/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$TEST_EMAIL\",
    \"password\": \"$TEST_PASSWORD\",
    \"firstName\": \"Pagination\",
    \"lastName\": \"Tester\",
    \"userType\": \"JobSeeker\"
  }")

echo "Registration response:"
echo "$REGISTER_RESPONSE" | head -c 200
echo "..."

# Step 2: Login and get JWT token
print_step "2. Logging in to get JWT token"

LOGIN_RESPONSE=$(curl -s -X POST "$API_BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$TEST_EMAIL\",
    \"password\": \"$TEST_PASSWORD\"
  }")

echo "Login response:"
echo "$LOGIN_RESPONSE" | head -c 200
echo "..."

# Extract JWT token (improved extraction)
JWT_TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)

if [[ -z "$JWT_TOKEN" ]]; then
    # Try alternative token extraction
    JWT_TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
fi

if [[ -z "$JWT_TOKEN" ]]; then
    print_error "Failed to extract JWT token from login response"
    echo "Full login response:"
    echo "$LOGIN_RESPONSE"
    exit 1
fi

print_success "Got JWT token: ${JWT_TOKEN:0:20}..."

# Step 3: Test pagination on job listings
print_header "?? Testing Job Listings Pagination"

# Test Page 1 - should have jobs and potentially hasMore=true
print_step "3.1 Testing Page 1 (should have jobs)"
PAGE1_RESPONSE=$(curl -s -X GET "$API_BASE/jobs?page=1&pageSize=20" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json")

test_pagination_response "$PAGE1_RESPONSE" "true" "1" "Page 1"

# Test Page 2 - might have jobs, hasMore depends on total
print_step "3.2 Testing Page 2"
PAGE2_RESPONSE=$(curl -s -X GET "$API_BASE/jobs?page=2&pageSize=20" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json")

# Don't assert hasMore value for page 2, just check if it responds
echo "Response: $PAGE2_RESPONSE" | head -c 200
echo "..."

# Test Page 3 - likely no jobs if only 65 total
print_step "3.3 Testing Page 3 (should have hasMore=false)"
PAGE3_RESPONSE=$(curl -s -X GET "$API_BASE/jobs?page=3&pageSize=20" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json")

test_pagination_response "$PAGE3_RESPONSE" "false" "3" "Page 3"

# Test Page 4 - definitely no jobs
print_step "3.4 Testing Page 4 (should have hasMore=false and empty data)"
PAGE4_RESPONSE=$(curl -s -X GET "$API_BASE/jobs?page=4&pageSize=20" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json")

test_pagination_response "$PAGE4_RESPONSE" "false" "4" "Page 4"

# Test Page 10 - way beyond available data
print_step "3.5 Testing Page 10 (way beyond available data)"
PAGE10_RESPONSE=$(curl -s -X GET "$API_BASE/jobs?page=10&pageSize=20" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json")

test_pagination_response "$PAGE10_RESPONSE" "false" "10" "Page 10"

# Step 4: Test search pagination
print_header "?? Testing Search Jobs Pagination"

print_step "4.1 Search Page 1"
SEARCH1_RESPONSE=$(curl -s -X GET "$API_BASE/search/jobs?q=engineer&page=1&pageSize=10" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json")

echo "Search response:"
echo "$SEARCH1_RESPONSE" | head -c 200
echo "..."

print_step "4.2 Search Page 5 (beyond likely results)"
SEARCH5_RESPONSE=$(curl -s -X GET "$API_BASE/search/jobs?q=engineer&page=5&pageSize=10" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json")

test_pagination_response "$SEARCH5_RESPONSE" "false" "5" "Search Page 5"

# Step 5: Test edge cases
print_header "?? Testing Edge Cases"

# Test with very large page size (should be capped)
print_step "5.1 Testing large page size (should be capped at 100)"
LARGE_PAGE_RESPONSE=$(curl -s -X GET "$API_BASE/jobs?page=1&pageSize=1000" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json")

echo "Large page size response:"
echo "$LARGE_PAGE_RESPONSE" | head -c 200
echo "..."

# Test with invalid page numbers
print_step "5.2 Testing page 0 (should default to 1)"
PAGE0_RESPONSE=$(curl -s -X GET "$API_BASE/jobs?page=0&pageSize=20" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json")

echo "Page 0 response:"
echo "$PAGE0_RESPONSE" | head -c 200
echo "..."

print_step "5.3 Testing negative page (should default to 1)"
NEGATIVE_PAGE_RESPONSE=$(curl -s -X GET "$API_BASE/jobs?page=-1&pageSize=20" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json")

echo "Negative page response:"
echo "$NEGATIVE_PAGE_RESPONSE" | head -c 200
echo "..."

# Step 6: Test with filters (should also respect pagination)
print_header "?? Testing Pagination with Filters"

print_step "6.1 Testing filtered results pagination"
FILTERED_RESPONSE=$(curl -s -X GET "$API_BASE/jobs?page=1&pageSize=10&jobTypeIds=1,2&location=new%20york" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json")

echo "Filtered response:"
echo "$FILTERED_RESPONSE" | head -c 200
echo "..."

# Test second page of filtered results
print_step "6.2 Testing page 2 of filtered results"
FILTERED_PAGE2_RESPONSE=$(curl -s -X GET "$API_BASE/jobs?page=2&pageSize=10&jobTypeIds=1,2&location=new%20york" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json")

test_pagination_response "$FILTERED_PAGE2_RESPONSE" "false" "2" "Filtered Page 2"

# Step 7: Test reference data (no auth required)
print_header "?? Testing Reference Data (No Auth)"

print_step "7.1 Testing job types endpoint"
JOB_TYPES_RESPONSE=$(curl -s -X GET "$API_BASE/reference/job-types" \
  -H "Content-Type: application/json")

if [[ "$JOB_TYPES_RESPONSE" == *"success\":true"* ]]; then
    print_success "Job types endpoint working"
    ((TESTS_PASSED++))
else
    print_error "Job types endpoint failed"
    ((TESTS_FAILED++))
fi

print_step "7.2 Testing currencies endpoint"
CURRENCIES_RESPONSE=$(curl -s -X GET "$API_BASE/reference/currencies" \
  -H "Content-Type: application/json")

if [[ "$CURRENCIES_RESPONSE" == *"success\":true"* ]]; then
    print_success "Currencies endpoint working"
    ((TESTS_PASSED++))
else
    print_error "Currencies endpoint failed"
    ((TESTS_FAILED++))
fi

# Step 8: Apply to a job and test exclusion
print_header "?? Testing Job Application & Exclusion"

# First get a job ID from page 1
JOB_ID=$(echo "$PAGE1_RESPONSE" | grep -o '"JobID":"[^"]*' | head -1 | cut -d'"' -f4)

if [[ -n "$JOB_ID" ]]; then
    print_step "8.1 Applying to job: $JOB_ID"
    
    APPLY_RESPONSE=$(curl -s -X POST "$API_BASE/applications" \
      -H "Authorization: Bearer $JWT_TOKEN" \
      -H "Content-Type: application/json" \
      -d "{
        \"jobID\": \"$JOB_ID\"
      }")
    
    echo "Apply response:"
    echo "$APPLY_RESPONSE" | head -c 200
    echo "..."
    
    if [[ "$APPLY_RESPONSE" == *"success\":true"* ]]; then
        print_success "Successfully applied to job"
        ((TESTS_PASSED++))
        
        # Test that applied job is now excluded from listings
        print_step "8.2 Testing job exclusion after application"
        EXCLUSION_RESPONSE=$(curl -s -X GET "$API_BASE/jobs?page=1&pageSize=20" \
          -H "Authorization: Bearer $JWT_TOKEN" \
          -H "Content-Type: application/json")
        
        if [[ "$EXCLUSION_RESPONSE" != *"$JOB_ID"* ]]; then
            print_success "Applied job correctly excluded from listings"
            ((TESTS_PASSED++))
        else
            print_error "Applied job still appears in listings"
            ((TESTS_FAILED++))
        fi
    else
        print_error "Failed to apply to job"
        ((TESTS_FAILED++))
    fi
else
    echo "No job ID found to test application"
fi

# Final results
print_header "?? Test Results Summary"

TOTAL_TESTS=$((TESTS_PASSED + TESTS_FAILED))

echo -e "Total Tests: $TOTAL_TESTS"
echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
echo -e "${RED}Failed: $TESTS_FAILED${NC}"

if [[ $TESTS_FAILED -eq 0 ]]; then
    print_success "?? All tests passed! Pagination fix is working correctly."
    exit 0
else
    print_error "? Some tests failed. Please check the pagination implementation."
    exit 1
fi