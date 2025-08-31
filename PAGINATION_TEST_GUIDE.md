# ?? NexHire Pagination Testing Guide

This guide provides comprehensive curl commands to test the pagination fix for the infinite scroll issue.

## ?? Quick Test Commands

### 1. Basic Authentication Test
```bash
# Test registration (replace timestamp as needed)
curl -X POST "https://nexhire-api-func.azurewebsites.net/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test-pagination@example.com",
    "password": "TestPass123!",
    "firstName": "Test",
    "lastName": "User",
    "userType": "JobSeeker"
  }'

# Login to get JWT token
curl -X POST "https://nexhire-api-func.azurewebsites.net/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test-pagination@example.com",
    "password": "TestPass123!"
  }'
```

### 2. Test Pagination Fix (replace YOUR_JWT_TOKEN)
```bash
export JWT_TOKEN="YOUR_JWT_TOKEN_HERE"

# Page 1 - should work normally with hasMore=true or false
curl -X GET "https://nexhire-api-func.azurewebsites.net/api/jobs?page=1&pageSize=20" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  | jq '.meta'

# Page 2 - check hasMore logic
curl -X GET "https://nexhire-api-func.azurewebsites.net/api/jobs?page=2&pageSize=20" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  | jq '.meta'

# Page 3 - should show hasMore=false if only 65 jobs total
curl -X GET "https://nexhire-api-func.azurewebsites.net/api/jobs?page=3&pageSize=20" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  | jq '.meta'

# Page 4 - should definitely show hasMore=false and empty data
curl -X GET "https://nexhire-api-func.azurewebsites.net/api/jobs?page=4&pageSize=20" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  | jq '.meta'
```

### 3. Test Search Pagination
```bash
# Search with pagination
curl -X GET "https://nexhire-api-func.azurewebsites.net/api/search/jobs?q=engineer&page=1&pageSize=10" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  | jq '.meta'

# Beyond available search results
curl -X GET "https://nexhire-api-func.azurewebsites.net/api/search/jobs?q=engineer&page=10&pageSize=10" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  | jq '.meta'
```

### 4. Test Edge Cases
```bash
# Large page size (should be capped at 100)
curl -X GET "https://nexhire-api-func.azurewebsites.net/api/jobs?page=1&pageSize=1000" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  | jq '.meta'

# Invalid page numbers
curl -X GET "https://nexhire-api-func.azurewebsites.net/api/jobs?page=0&pageSize=20" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  | jq '.meta'

curl -X GET "https://nexhire-api-func.azurewebsites.net/api/jobs?page=-1&pageSize=20" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  | jq '.meta'
```

## ?? What to Look For

### Expected Response Structure
```json
{
  "success": true,
  "data": [...],
  "message": "Jobs retrieved successfully",
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 65,
    "totalPages": 4,
    "hasMore": false,    // KEY: This should be accurate!
    "nextCursor": null
  }
}
```

### Key Validation Points

#### ? **hasMore Logic** (Most Important)
- `hasMore: true` only when more jobs are actually available
- `hasMore: false` when no more jobs exist for the user
- Should stop showing infinite scroll when `hasMore: false`

#### ? **Page Calculations**
- `totalPages` should be correct: `Math.ceil(total / pageSize)`
- Last page should always have `hasMore: false`
- Pages beyond `totalPages` should return empty `data: []`

#### ? **User-Specific Filtering**
- Jobs user has applied to should be excluded from listings
- Jobs user has saved should be excluded from listings
- `total` count should reflect available jobs for that user

#### ? **Edge Case Handling**
- Page size should be capped at 100 (MAX_PAGE_SIZE)
- Invalid page numbers (?0) should default to 1
- Empty results should still have valid metadata

## ?? Automated Test Script

Run the comprehensive test script:

```bash
# Make script executable
chmod +x test-pagination-fix.sh

# Run the test suite
./test-pagination-fix.sh
```

This script will:
1. ? Register a test user
2. ? Login and get JWT token
3. ? Test pagination across multiple pages
4. ? Test search pagination
5. ? Test edge cases and error handling
6. ? Test job application and exclusion logic
7. ? Validate all `hasMore` calculations
8. ? Provide detailed pass/fail results

## ?? Debugging Failed Tests

### If `hasMore` is incorrectly `true`:
- Check backend console logs for pagination debug info
- Verify `rows.length === pageSizeNum` condition
- Ensure `pageNum < totalPages` is calculated correctly

### If jobs don't get excluded after applying:
- Check if `excludeUserApplications` parameter is being passed
- Verify the SQL query excludes applied/saved jobs
- Check if user ID is correctly identified in the backend

### If pagination returns errors:
- Check Azure Function logs in the portal
- Verify database connection is working
- Ensure JWT token is valid and not expired

## ?? Expected Test Results

With 65 total jobs and pageSize=20:
- **Page 1**: 20 jobs, `hasMore: true`
- **Page 2**: 20 jobs, `hasMore: true` 
- **Page 3**: 20 jobs, `hasMore: true`
- **Page 4**: 5 jobs, `hasMore: false` ?
- **Page 5+**: 0 jobs, `hasMore: false` ?

The fix ensures that `hasMore` becomes `false` when there are truly no more jobs available, preventing the infinite scroll issue.

## ? Success Criteria

The pagination fix is working correctly when:

1. ? `hasMore` accurately reflects job availability
2. ? Infinite scroll stops when no more jobs exist
3. ? Applied/saved jobs are properly excluded
4. ? Page calculations are mathematically correct
5. ? Edge cases are handled gracefully
6. ? Search pagination works consistently
7. ? Frontend receives accurate metadata for UI decisions