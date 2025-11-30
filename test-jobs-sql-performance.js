/**
 * ?? DIRECT SQL PERFORMANCE TEST FOR JOBS API
 * 
 * This script tests the actual SQL queries used by getJobs/searchJobs APIs
 * by running them directly against the database to isolate database bottlenecks
 * from API/network overhead.
 * 
 * Usage:
 *   node test-jobs-sql-performance.js [userId]
 * 
 * If userId is not provided, tests will run without user-specific filtering.
 */

const sql = require('mssql');
const fs = require('fs');
const path = require('path');

// ANSI color codes for terminal output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    bgRed: '\x1b[41m',
    bgGreen: '\x1b[42m',
    bgYellow: '\x1b[43m',
    bgBlue: '\x1b[44m',
    bgMagenta: '\x1b[45m',
    bgCyan: '\x1b[46m'
};

// Performance thresholds (in milliseconds)
function getResponseTimeColor(ms) {
    if (ms < 100) return colors.bgGreen;        // Excellent
    if (ms < 300) return colors.bgCyan;         // Good
    if (ms < 500) return colors.bgBlue;         // OK
    if (ms < 1000) return colors.bgYellow;      // Slow
    if (ms < 2000) return colors.bgMagenta;     // Very Slow
    return colors.bgRed;                        // Critical
}

function getPerformanceRating(ms) {
    if (ms < 100) return 'EXCELLENT ?';
    if (ms < 300) return 'GOOD ?';
    if (ms < 500) return 'OK ?';
    if (ms < 1000) return 'SLOW ??';
    if (ms < 2000) return 'VERY SLOW ??';
    return 'CRITICAL ??';
}

// Load database configuration from local.settings.json
function loadDbConfig() {
    try {
        const settingsPath = path.join(__dirname, 'local.settings.json');
        const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
        const values = settings.Values;

        return {
            server: values.DB_SERVER,
            database: values.DB_NAME,
            user: values.DB_USER,
            password: values.DB_PASSWORD,
            options: {
                encrypt: values.DB_ENCRYPT === 'true',
                trustServerCertificate: values.DB_TRUST_SERVER_CERTIFICATE === 'true',
                connectTimeout: parseInt(values.DB_CONNECTION_TIMEOUT) * 1000 || 30000
            }
        };
    } catch (error) {
        console.error(`${colors.red}? Failed to load database configuration:${colors.reset}`, error.message);
        process.exit(1);
    }
}

// Connect to database
async function connectToDatabase(config) {
    try {
        console.log(`${colors.cyan}?? Connecting to database...${colors.reset}`);
        console.log(`   Server: ${config.server}`);
        console.log(`   Database: ${config.database}`);
        
        const pool = await sql.connect(config);
        console.log(`${colors.green}? Connected successfully!${colors.reset}\n`);
        return pool;
    } catch (error) {
        console.error(`${colors.red}? Database connection failed:${colors.reset}`, error.message);
        process.exit(1);
    }
}

// Execute SQL query with performance timing
async function executeQueryWithTiming(pool, testName, query, params = {}) {
    console.log(`${colors.bright}${colors.blue}????????????????????????????????????????${colors.reset}`);
    console.log(`${colors.bright}Test: ${testName}${colors.reset}`);
    console.log(`${colors.cyan}Query Preview:${colors.reset}`, query.substring(0, 200) + '...');
    console.log(`${colors.cyan}Parameters:${colors.reset}`, JSON.stringify(params, null, 2).substring(0, 500));
    
    try {
        const startTime = Date.now();
        
        // Create request and add parameters
        const request = pool.request();
        Object.entries(params).forEach(([key, value]) => {
            request.input(key, value);
        });
        
        // Execute with SET STATISTICS to get detailed performance info
        const statsQuery = `
            SET STATISTICS TIME ON;
            SET STATISTICS IO ON;
            ${query}
        `;
        
        const result = await request.query(statsQuery);
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        const rowCount = result.recordset ? result.recordset.length : 0;
        const totalCount = result.recordsets && result.recordsets[0] && result.recordsets[0][0] 
            ? result.recordsets[0][0].total 
            : rowCount;
        
        // Color-coded output
        const color = getResponseTimeColor(duration);
        const rating = getPerformanceRating(duration);
        
        console.log(`${color}${colors.bright} ${rating} - ${duration}ms ${colors.reset}`);
        console.log(`${colors.green}? Rows returned: ${rowCount}${colors.reset}`);
        console.log(`${colors.green}? Total count: ${totalCount}${colors.reset}`);
        
        return { duration, rowCount, totalCount, success: true };
    } catch (error) {
        console.error(`${colors.red}? Query failed:${colors.reset}`, error.message);
        console.error(`${colors.red}   Error details:${colors.reset}`, error);
        return { duration: -1, rowCount: 0, totalCount: 0, success: false, error: error.message };
    }
}

// Build WHERE clause for job queries (replicated from backend)
function buildJobFilters(filters = {}, userId = null) {
    let whereClause = "WHERE j.Status = 'Published'";
    const params = {};
    let paramIndex = 0;
    
    // Default to last 7 days filter
    if (!filters.postedWithinDays) {
        const cutoffDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        whereClause += ` AND j.PublishedAt >= @param${paramIndex}`;
        params[`param${paramIndex}`] = cutoffDate;
        paramIndex++;
    }
    
    // Workplace Type filter
    if (filters.workplaceTypeIds) {
        const ids = String(filters.workplaceTypeIds).split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
        if (ids.length > 0) {
            const placeholders = [];
            ids.forEach(id => {
                const paramName = `param${paramIndex}`;
                placeholders.push(`@${paramName}`);
                params[paramName] = id;
                paramIndex++;
            });
            whereClause += ` AND j.WorkplaceTypeID IN (${placeholders.join(',')})`;
        }
    }
    
    // Job Type filter
    if (filters.jobTypeIds) {
        const ids = String(filters.jobTypeIds).split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
        if (ids.length > 0) {
            const placeholders = [];
            ids.forEach(id => {
                const paramName = `param${paramIndex}`;
                placeholders.push(`@${paramName}`);
                params[paramName] = id;
                paramIndex++;
            });
            whereClause += ` AND j.JobTypeID IN (${placeholders.join(',')})`;
        }
    }
    
    // IsRemote filter
    if (filters.isRemote !== undefined) {
        whereClause += ` AND j.IsRemote = @param${paramIndex}`;
        params[`param${paramIndex}`] = filters.isRemote ? 1 : 0;
        paramIndex++;
    }
    
    // User-specific filtering (exclude applied jobs)
    if (userId) {
        whereClause += ` AND NOT EXISTS (
            SELECT 1 FROM JobApplications ja
            INNER JOIN Applicants a ON ja.ApplicantID = a.ApplicantID
            WHERE a.UserID = @param${paramIndex}
                AND ja.StatusID != 6
                AND ja.JobID = j.JobID
        )`;
        params[`param${paramIndex}`] = userId;
        paramIndex++;
    }
    
    // Search term (replicate backend logic)
    if (filters.search) {
        const searchTerm = String(filters.search).trim();
        if (searchTerm.length <= 4) {
            // Short search: LIKE on Title and Organization
            whereClause += ` AND (j.Title LIKE @param${paramIndex} OR o.Name LIKE @param${paramIndex + 1})`;
            params[`param${paramIndex}`] = `%${searchTerm}%`;
            params[`param${paramIndex + 1}`] = `%${searchTerm}%`;
            paramIndex += 2;
        } else {
            // Long search: CONTAINS fulltext (simplified for testing)
            whereClause += ` AND (j.Title LIKE @param${paramIndex} OR o.Name LIKE @param${paramIndex + 1} OR j.Location LIKE @param${paramIndex + 2})`;
            params[`param${paramIndex}`] = `%${searchTerm}%`;
            params[`param${paramIndex + 1}`] = `%${searchTerm}%`;
            params[`param${paramIndex + 2}`] = `%${searchTerm}%`;
            paramIndex += 3;
        }
    }
    
    // Location filter
    if (filters.location) {
        whereClause += ` AND (j.Location LIKE @param${paramIndex} OR j.City LIKE @param${paramIndex + 1} OR j.Country LIKE @param${paramIndex + 2})`;
        params[`param${paramIndex}`] = `%${filters.location}%`;
        params[`param${paramIndex + 1}`] = `%${filters.location}%`;
        params[`param${paramIndex + 2}`] = `%${filters.location}%`;
        paramIndex += 3;
    }
    
    // Organization filter
    if (filters.organizationIds) {
        const ids = String(filters.organizationIds).split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
        if (ids.length > 0) {
            const placeholders = [];
            ids.forEach(id => {
                const paramName = `param${paramIndex}`;
                placeholders.push(`@${paramName}`);
                params[paramName] = id;
                paramIndex++;
            });
            whereClause += ` AND j.OrganizationID IN (${placeholders.join(',')})`;
        }
    }
    
    // Experience filters
    if (filters.experienceMin) {
        whereClause += ` AND (j.ExperienceMax IS NULL OR j.ExperienceMax >= @param${paramIndex})`;
        params[`param${paramIndex}`] = Number(filters.experienceMin);
        paramIndex++;
    }
    if (filters.experienceMax) {
        whereClause += ` AND (j.ExperienceMin IS NULL OR j.ExperienceMin <= @param${paramIndex})`;
        params[`param${paramIndex}`] = Number(filters.experienceMax);
        paramIndex++;
    }
    
    // Salary filters
    if (filters.salaryMin) {
        whereClause += ` AND (j.SalaryRangeMax IS NULL OR j.SalaryRangeMax >= @param${paramIndex})`;
        params[`param${paramIndex}`] = Number(filters.salaryMin);
        paramIndex++;
    }
    if (filters.salaryMax) {
        whereClause += ` AND (j.SalaryRangeMin IS NULL OR j.SalaryRangeMin <= @param${paramIndex})`;
        params[`param${paramIndex}`] = Number(filters.salaryMax);
        paramIndex++;
    }
    
    // Posted within days (overrides default)
    if (filters.postedWithinDays) {
        const cutoffDate = new Date(Date.now() - Number(filters.postedWithinDays) * 24 * 60 * 60 * 1000);
        whereClause += ` AND j.PublishedAt >= @param${paramIndex}`;
        params[`param${paramIndex}`] = cutoffDate;
        paramIndex++;
    }
    
    return { whereClause, params, paramIndex };
}

// Test scenarios
async function runTests(pool, userId = null) {
    console.log(`${colors.bright}${colors.magenta}????????????????????????????????????????????????????????${colors.reset}`);
    console.log(`${colors.bright}${colors.magenta}       ?? DIRECT SQL PERFORMANCE TESTS${colors.reset}`);
    console.log(`${colors.bright}${colors.magenta}????????????????????????????????????????????????????????${colors.reset}\n`);
    
    if (userId) {
        console.log(`${colors.yellow}?? Testing with user filtering: ${userId}${colors.reset}\n`);
    } else {
        console.log(`${colors.yellow}??  Testing without user-specific filtering${colors.reset}\n`);
    }
    
    const results = [];
    
    // Test 1: Basic getJobs - Count Query
    console.log(`\n${colors.bright}${colors.cyan}???????????????????????????????????????????${colors.reset}`);
    console.log(`${colors.bright}${colors.cyan}   TEST 1: Basic Job Listing (Count)${colors.reset}`);
    console.log(`${colors.bright}${colors.cyan}???????????????????????????????????????????${colors.reset}\n`);
    
    const { whereClause: where1, params: params1 } = buildJobFilters({}, userId);
    const countQuery1 = `
        SELECT COUNT(*) as total
        FROM Jobs j
        INNER JOIN Organizations o ON j.OrganizationID = o.OrganizationID
        ${where1}
    `;
    results.push(await executeQueryWithTiming(pool, 'Basic Count Query', countQuery1, params1));
    
    // Test 1b: Basic getJobs - Data Query
    console.log(`\n${colors.bright}${colors.cyan}???????????????????????????????????????????${colors.reset}`);
    console.log(`${colors.bright}${colors.cyan}   TEST 1b: Basic Job Listing (Data)${colors.reset}`);
    console.log(`${colors.bright}${colors.cyan}???????????????????????????????????????????${colors.reset}\n`);
    
    const dataQuery1 = `
        SELECT TOP 20
            j.JobID, j.Title, j.JobTypeID, j.WorkplaceTypeID,
            j.OrganizationID,
            j.Location, j.City, j.State, j.Country, j.IsRemote, 
            j.SalaryRangeMin, j.SalaryRangeMax, j.SalaryPeriod,
            j.PublishedAt, j.CreatedAt,
            jt.Type as JobTypeName,
            wt.Type as WorkplaceTypeName,
            o.Name as OrganizationName,
            ISNULL(o.LogoURL, '') as OrganizationLogo
        FROM Jobs j
        INNER JOIN JobTypes jt ON j.JobTypeID = jt.JobTypeID
        INNER JOIN Organizations o ON j.OrganizationID = o.OrganizationID
        LEFT JOIN WorkplaceTypes wt ON j.WorkplaceTypeID = wt.WorkplaceTypeID
        ${where1}
        ORDER BY j.PublishedAt DESC, j.JobID DESC
    `;
    results.push(await executeQueryWithTiming(pool, 'Basic Data Query', dataQuery1, params1));
    
    // Test 2: Filtered by Remote Jobs
    console.log(`\n${colors.bright}${colors.cyan}???????????????????????????????????????????${colors.reset}`);
    console.log(`${colors.bright}${colors.cyan}   TEST 2: Remote Jobs Filter${colors.reset}`);
    console.log(`${colors.bright}${colors.cyan}???????????????????????????????????????????${colors.reset}\n`);
    
    const { whereClause: where2, params: params2 } = buildJobFilters({ isRemote: true }, userId);
    const countQuery2 = `
        SELECT COUNT(*) as total
        FROM Jobs j
        INNER JOIN Organizations o ON j.OrganizationID = o.OrganizationID
        ${where2}
    `;
    results.push(await executeQueryWithTiming(pool, 'Remote Jobs Count', countQuery2, params2));
    
    // Test 3: Search Query (short term)
    console.log(`\n${colors.bright}${colors.cyan}???????????????????????????????????????????${colors.reset}`);
    console.log(`${colors.bright}${colors.cyan}   TEST 3: Short Search Query${colors.reset}`);
    console.log(`${colors.bright}${colors.cyan}???????????????????????????????????????????${colors.reset}\n`);
    
    const { whereClause: where3, params: params3 } = buildJobFilters({ search: 'dev' }, userId);
    const searchQuery3 = `
        SELECT COUNT(*) as total
        FROM Jobs j
        INNER JOIN Organizations o ON j.OrganizationID = o.OrganizationID
        ${where3}
    `;
    results.push(await executeQueryWithTiming(pool, 'Search "dev" Count', searchQuery3, params3));
    
    // Test 4: Search Query (long term)
    console.log(`\n${colors.bright}${colors.cyan}???????????????????????????????????????????${colors.reset}`);
    console.log(`${colors.bright}${colors.cyan}   TEST 4: Long Search Query${colors.reset}`);
    console.log(`${colors.bright}${colors.cyan}???????????????????????????????????????????${colors.reset}\n`);
    
    const { whereClause: where4, params: params4 } = buildJobFilters({ search: 'software engineer' }, userId);
    const searchQuery4 = `
        SELECT COUNT(*) as total
        FROM Jobs j
        INNER JOIN Organizations o ON j.OrganizationID = o.OrganizationID
        ${where4}
    `;
    results.push(await executeQueryWithTiming(pool, 'Search "software engineer" Count', searchQuery4, params4));
    
    // Test 5: Complex Multi-Filter Query
    console.log(`\n${colors.bright}${colors.cyan}???????????????????????????????????????????${colors.reset}`);
    console.log(`${colors.bright}${colors.cyan}   TEST 5: Complex Multi-Filter${colors.reset}`);
    console.log(`${colors.bright}${colors.cyan}???????????????????????????????????????????${colors.reset}\n`);
    
    const { whereClause: where5, params: params5 } = buildJobFilters({
        jobTypeIds: '1,2',
        workplaceTypeIds: '3',
        location: 'Bangalore',
        experienceMin: 2,
        experienceMax: 5,
        postedWithinDays: 30
    }, userId);
    const complexQuery5 = `
        SELECT COUNT(*) as total
        FROM Jobs j
        INNER JOIN Organizations o ON j.OrganizationID = o.OrganizationID
        ${where5}
    `;
    results.push(await executeQueryWithTiming(pool, 'Complex Multi-Filter Count', complexQuery5, params5));
    
    // Test 6: Full Data Query with Pagination
    console.log(`\n${colors.bright}${colors.cyan}???????????????????????????????????????????${colors.reset}`);
    console.log(`${colors.bright}${colors.cyan}   TEST 6: Paginated Data Query (Page 2)${colors.reset}`);
    console.log(`${colors.bright}${colors.cyan}???????????????????????????????????????????${colors.reset}\n`);
    
    const { whereClause: where6, params: params6 } = buildJobFilters({}, userId);
    params6.offset = 20;
    params6.pageSize = 20;
    const paginatedQuery6 = `
        SELECT
            j.JobID, j.Title, j.JobTypeID, j.WorkplaceTypeID,
            j.OrganizationID,
            j.Location, j.City, j.State, j.Country, j.IsRemote, 
            j.SalaryRangeMin, j.SalaryRangeMax, j.SalaryPeriod,
            j.PublishedAt, j.CreatedAt,
            jt.Type as JobTypeName,
            wt.Type as WorkplaceTypeName,
            o.Name as OrganizationName,
            ISNULL(o.LogoURL, '') as OrganizationLogo
        FROM Jobs j
        INNER JOIN JobTypes jt ON j.JobTypeID = jt.JobTypeID
        INNER JOIN Organizations o ON j.OrganizationID = o.OrganizationID
        LEFT JOIN WorkplaceTypes wt ON j.WorkplaceTypeID = wt.WorkplaceTypeID
        ${where6}
        ORDER BY j.PublishedAt DESC, j.JobID DESC
        OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
        OPTION (OPTIMIZE FOR (@offset = 0))
    `;
    results.push(await executeQueryWithTiming(pool, 'Paginated Query Page 2', paginatedQuery6, params6));
    
    // Summary
    console.log(`\n${colors.bright}${colors.magenta}????????????????????????????????????????????????????????${colors.reset}`);
    console.log(`${colors.bright}${colors.magenta}              ?? PERFORMANCE SUMMARY${colors.reset}`);
    console.log(`${colors.bright}${colors.magenta}????????????????????????????????????????????????????????${colors.reset}\n`);
    
    const successfulTests = results.filter(r => r.success);
    const times = successfulTests.map(r => r.duration);
    
    if (times.length > 0) {
        const avg = times.reduce((a, b) => a + b, 0) / times.length;
        const min = Math.min(...times);
        const max = Math.max(...times);
        
        console.log(`${colors.bright}Total Tests:${colors.reset} ${results.length}`);
        console.log(`${colors.green}Successful:${colors.reset} ${successfulTests.length}`);
        console.log(`${colors.red}Failed:${colors.reset} ${results.length - successfulTests.length}\n`);
        
        console.log(`${colors.bright}Response Times:${colors.reset}`);
        console.log(`  ${colors.green}Fastest:${colors.reset} ${min.toFixed(2)}ms`);
        console.log(`  ${colors.yellow}Average:${colors.reset} ${avg.toFixed(2)}ms`);
        console.log(`  ${colors.red}Slowest:${colors.reset} ${max.toFixed(2)}ms\n`);
        
        // Overall assessment
        if (avg < 100) {
            console.log(`${colors.bgGreen}${colors.bright} ? EXCELLENT PERFORMANCE ${colors.reset} - Database queries are blazing fast!`);
        } else if (avg < 300) {
            console.log(`${colors.bgCyan}${colors.bright} ? GOOD PERFORMANCE ${colors.reset} - Database queries are performing well.`);
        } else if (avg < 500) {
            console.log(`${colors.bgBlue}${colors.bright} ? OK PERFORMANCE ${colors.reset} - Database queries are acceptable.`);
        } else if (avg < 1000) {
            console.log(`${colors.bgYellow}${colors.bright} ??  SLOW PERFORMANCE ${colors.reset} - Consider adding indexes.`);
        } else {
            console.log(`${colors.bgRed}${colors.bright} ?? CRITICAL PERFORMANCE ${colors.reset} - Database optimization required!`);
        }
        
        console.log(`\n${colors.cyan}?? Recommendations:${colors.reset}`);
        if (avg > 300) {
            console.log(`  • Check if indexes exist on: PublishedAt, Status, WorkplaceTypeID, JobTypeID`);
            console.log(`  • Review execution plans for slow queries`);
            console.log(`  • Consider partitioning the Jobs table by PublishedAt`);
            console.log(`  • Check for missing foreign key indexes`);
        }
        if (max > 1000) {
            console.log(`  • Slowest query needs immediate attention`);
            console.log(`  • Run: SET STATISTICS IO ON; SET STATISTICS TIME ON; <your-query>`);
            console.log(`  • Check for table/index fragmentation`);
        }
        console.log(`  • Compare these times with API response times to identify bottleneck`);
        console.log(`  • If DB is fast but API is slow, focus on network/backend optimization`);
    }
    
    console.log(`\n${colors.bright}${colors.magenta}????????????????????????????????????????????????????????${colors.reset}\n`);
}

// Main execution
(async () => {
    const userId = process.argv[2]; // Optional userId for user-specific filtering
    
    try {
        const dbConfig = loadDbConfig();
        const pool = await connectToDatabase(dbConfig);
        
        await runTests(pool, userId);
        
        await pool.close();
        console.log(`${colors.green}? Database connection closed${colors.reset}`);
    } catch (error) {
        console.error(`${colors.red}? Test execution failed:${colors.reset}`, error);
        process.exit(1);
    }
})();
