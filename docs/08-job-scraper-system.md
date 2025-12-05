# 🤖 RefOpen Job Scraper System

## Overview

The RefOpen Job Scraper System is an advanced, production-ready automated job aggregation service that collects job postings from multiple external sources and enriches them with organization data. It's designed to scale to 1000+ jobs per run with intelligent anti-blocking mechanisms and Fortune 500 company matching.

## Table of Contents

- [Architecture](#architecture)
- [Supported Job Sources](#supported-job-sources)
- [Scraping Strategy](#scraping-strategy)
- [Configuration](#configuration)
- [Management Scripts](#management-scripts)
- [Data Flow](#data-flow)
- [Anti-Blocking Mechanisms](#anti-blocking-mechanisms)
- [Fortune 500 Matching](#fortune-500-matching)
- [Organization Enrichment](#organization-enrichment)
- [Scheduling](#scheduling)
- [Monitoring & Logs](#monitoring--logs)
- [Troubleshooting](#troubleshooting)

---

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Job Scraper Manager                       │
│                (Orchestrates all scrapers)                   │
└─────────────────┬───────────────────────────────────────────┘
                  │
        ┌─────────┴─────────┬────────────┬──────────────┐
        │                   │            │              │
┌───────▼────────┐  ┌───────▼────┐  ┌───▼──────┐  ┌──▼──────┐
│  RemoteOK      │  │  Adzuna    │  │ WeWork   │  │ HackerNews│
│  Scraper       │  │  API       │  │ Remote   │  │  Jobs     │
│  (200 jobs)    │  │ (400 jobs) │  │ (200jobs)│  │ (30 jobs) │
└───────┬────────┘  └───────┬────┘  └───┬──────┘  └──┬──────┘
        │                   │            │            │
        └───────────────────┴────────────┴────────────┘
                            │
                ┌───────────▼────────────┐
                │   Job Normalization    │
                │   & Deduplication      │
                └───────────┬────────────┘
                            │
                ┌───────────▼────────────┐
                │  Fortune 500 Matcher   │
                │  (Fuzzy matching)      │
                └───────────┬────────────┘
                            │
                ┌───────────▼────────────┐
                │ Organization Enrichment│
                │ (Logo, website, etc)   │
                └───────────┬────────────┘
                            │
                ┌───────────▼────────────┐
                │   Database Storage     │
                │ (Jobs + Organizations) │
                └────────────────────────┘
```

### Key Features

- **Multi-Source Aggregation**: 4+ job sources with 1000+ jobs per run
- **Intelligent Deduplication**: Prevents duplicate jobs across sources
- **Organization Enrichment**: Auto-creates and enriches organization profiles
- **Fortune 500 Matching**: Identifies and flags Fortune 500 companies
- **Anti-Blocking**: Rotating user agents, delays, and session management
- **Geographic Focus**: Special handling for India and US markets
- **Broad Search Terms**: Technology-agnostic job collection

---

## Supported Job Sources

### 1. RemoteOK (200 jobs/run)

**Type**: Web scraping (JSON API)  
**Rate Limit**: 2 seconds between requests  
**Coverage**: Global remote jobs

```typescript
Source: https://remoteok.com/api
Features:
- Real-time remote job listings
- Salary information included
- Company logos and details
- Tags for technologies
```

### 2. Adzuna (400 jobs/run)

**Type**: REST API  
**Rate Limit**: 3 seconds between requests  
**Coverage**: 19+ countries including US, UK, India, Australia

```typescript
API Configs:
- US: 50 jobs (Software, Data, Manager, DevOps, QA)
- UK: 50 jobs
- India: 100 jobs (Bangalore, Hyderabad, Pune, Chennai)
- Australia, Canada, Germany: 50 jobs each
```

**Adzuna API Credentials Required**:
```env
ADZUNA_APP_ID=your-app-id
ADZUNA_APP_KEY=your-api-key
```

### 3. We Work Remotely (200 jobs/run)

**Type**: Web scraping (HTML parsing)  
**Rate Limit**: 1.5 seconds between requests  
**Coverage**: Remote jobs across multiple categories

```typescript
Categories Scraped:
- Programming (backend, frontend, full-stack)
- DevOps & Sysadmin
- Design (UI/UX, Product)
- Marketing & Sales
- Customer Support
- Product Management
- Business & Management
- Finance & Legal
```

### 4. Hacker News Jobs (30 jobs/run)

**Type**: Hacker News API  
**Rate Limit**: 1 second between requests  
**Coverage**: Tech-focused jobs from HN community

```typescript
Source: https://hacker-news.firebaseio.com/v0
Features:
- Ask HN: Who is hiring? threads
- Curated tech jobs
- Startup-focused opportunities
```

---

## Scraping Strategy

### Search Term Approach

**Broad Technology Terms** (not industry-specific):
```typescript
const searchTerms = [
  'software engineer',
  'developer',
  'data scientist',
  'product manager',
  'devops engineer',
  'qa engineer',
  'designer',
  'analyst',
  'manager',
  'marketing'
];
```

**Why Broad Terms?**
- Captures jobs across all industries (fintech, healthcare, e-commerce, etc.)
- Avoids missing jobs due to varied terminology
- Includes Fortune 500 companies automatically
- Better for diverse job seeker profiles

### Geographic Strategy

**India-Focused Scraping** (40% of total):
```typescript
India Cities:
- Bangalore (Tech hub)
- Hyderabad (IT services)
- Pune (Manufacturing + Tech)
- Chennai (Auto + IT)
- Mumbai (Fintech)
- Delhi NCR (Startups)
- Kolkata, Ahmedabad
```

**US & Global** (60% of total):
- All 50 US states
- UK, Australia, Canada
- Remote-first positions
- Europe (Germany, France, Netherlands)

---

## Configuration

### Scraper Settings

Located in `src\config\enhanced-job-scraper.config.ts`:

```typescript
export const scraperConfig = {
  enabled: true,
  maxJobsPerRun: 1000,
  
  sources: {
    remoteok: {
      enabled: true,
      maxJobs: 200,
      rateLimit: 2000,
      url: 'https://remoteok.com/api'
    },
    adzuna: {
      enabled: true,
      maxJobsPerConfig: 50,
      maxTotalJobs: 400,
      rateLimit: 3000,
      credentials: {
        appId: process.env.ADZUNA_APP_ID,
        appKey: process.env.ADZUNA_APP_KEY
      }
    },
    weworkremotely: {
      enabled: true,
      maxJobsPerCategory: 25,
      rateLimit: 1500,
      baseUrl: 'https://weworkremotely.com'
    },
    hackernews: {
      enabled: true,
      maxJobs: 30,
      rateLimit: 1000,
      apiUrl: 'https://hacker-news.firebaseio.com/v0'
    }
  },
  
  // Exclude unwanted job types
  excludeKeywords: [
    'adult',
    'gambling',
    'crypto scam',
    'mlm',
    'pyramid scheme'
  ],
  
  // Deduplication window (days)
  deduplicationWindow: 30,
  
  // Organization enrichment
  enrichOrganizations: true,
  createMissingOrganizations: true
};
```

---

## Management Scripts

### 1. Job Scraper Manager (`job-scraper-manager.ps1`)

**Main orchestration script** for all scraping operations:

```powershell
# Run all scrapers
.\job-scraper-manager.ps1 -Action runall

# Run specific source
.\job-scraper-manager.ps1 -Action run -Source remoteok

# Check scraper status
.\job-scraper-manager.ps1 -Action status

# View logs
.\job-scraper-manager.ps1 -Action logs

# Clear old jobs (30+ days)
.\job-scraper-manager.ps1 -Action cleanup
```

### 2. Manage Job Scraper (`Manage-JobScraper.ps1`)

**Individual scraper control**:

```powershell
# Start scraper service
.\Manage-JobScraper.ps1 -Action start

# Stop scraper
.\Manage-JobScraper.ps1 -Action stop

# Restart scraper
.\Manage-JobScraper.ps1 -Action restart

# View current status
.\Manage-JobScraper.ps1 -Action status
```

### 3. Run All Scrapers (`Run-AllScrapers.ps1`)

**Batch execution script**:

```powershell
# Execute all scrapers sequentially
.\Run-AllScrapers.ps1

# Run with verbose logging
.\Run-AllScrapers.ps1 -Verbose

# Dry run (test without saving)
.\Run-AllScrapers.ps1 -DryRun
```

### 4. Individual Scraper (`job-scraper.ps1`)

**Single source scraper**:

```powershell
# Scrape RemoteOK
.\job-scraper.ps1 -Source remoteok -MaxJobs 200

# Scrape Adzuna (India focus)
.\job-scraper.ps1 -Source adzuna -Country india -MaxJobs 100

# Scrape We Work Remotely
.\job-scraper.ps1 -Source weworkremotely -Category programming

# Test mode (no database writes)
.\job-scraper.ps1 -Source remoteok -TestMode
```

---

## Data Flow

### 1. Job Collection Phase

```typescript
// Scrape jobs from source
const scrapedJobs = await scrapeRemoteOK(maxJobs);

// Example scraped job structure
interface ScrapedJob {
  externalJobId: string;    // Source-specific ID
  title: string;            // Job title
  company: string;          // Company name
  location: string;         // Job location
  description: string;      // Full description
  salaryMin?: number;       // Minimum salary
  salaryMax?: number;       // Maximum salary
  jobType: string;          // Full-time, Part-time, etc.
  workplaceType: string;    // Remote, Hybrid, On-site
  experienceLevel?: string; // Junior, Mid, Senior
  requirements?: string;    // Skills and qualifications
  applicationUrl?: string;  // Apply link
  source: string;           // remoteok, adzuna, etc.
  postedDate?: Date;        // When posted
  logoUrl?: string;         // Company logo
  companyWebsite?: string;  // Company URL
  companyIndustry?: string; // Industry classification
}
```

### 2. Normalization Phase

```typescript
// Normalize job data
const normalizedJob = {
  ...scrapedJob,
  
  // Standardize job types
  jobType: mapJobType(scrapedJob.jobType),
  // Full-time, Part-time, Contract, Freelance, Internship
  
  // Standardize workplace types
  workplaceType: mapWorkplaceType(scrapedJob.workplaceType),
  // Remote, Hybrid, On-site
  
  // Extract salary range
  salaryMin: extractSalaryMin(scrapedJob.description),
  salaryMax: extractSalaryMax(scrapedJob.description),
  
  // Parse location
  location: parseLocation(scrapedJob.location),
  country: extractCountry(scrapedJob.location)
};
```

### 3. Deduplication Phase

```typescript
// Check for duplicate jobs
const isDuplicate = await checkDuplicate({
  externalJobId: job.externalJobId,
  source: job.source,
  title: job.title,
  company: job.company,
  windowDays: 30 // Check last 30 days
});

if (isDuplicate) {
  console.log('Duplicate job skipped');
  return null;
}
```

### 4. Organization Matching Phase

```typescript
// Find or create organization
let organization = await findOrganization(job.company);

if (!organization) {
  // Try Fortune 500 matching
  const fortune500Match = findFortune500Match(job.company);
  
  if (fortune500Match) {
    organization = await createOrganization({
      name: fortune500Match.name,
      website: fortune500Match.website,
      industry: fortune500Match.industry,
      isFortune500: true,
      logoUrl: job.logoUrl || await fetchLogo(fortune500Match.name)
    });
  } else {
    // Create new organization
    organization = await createOrganization({
      name: job.company,
      website: job.companyWebsite,
      industry: job.companyIndustry,
      logoUrl: job.logoUrl
    });
  }
}
```

### 5. Job Storage Phase

```typescript
// Save job to database
const savedJob = await dbService.executeQuery(`
  INSERT INTO Jobs (
    JobID, OrganizationID, Title, Description, Location,
    SalaryMin, SalaryMax, JobType, WorkplaceType,
    ExternalJobID, Source, ApplicationUrl, PostedDate,
    CreatedAt, UpdatedAt
  )
  VALUES (
    @JobID, @OrganizationID, @Title, @Description, @Location,
    @SalaryMin, @SalaryMax, @JobType, @WorkplaceType,
    @ExternalJobID, @Source, @ApplicationUrl, @PostedDate,
    GETDATE(), GETDATE()
  )
`, jobParameters);
```

---

## Anti-Blocking Mechanisms

### 1. Rotating User Agents

```typescript
const userAgents = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/119.0.0.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) Firefox/119.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Edge/119.0.0.0'
];

// Randomly select user agent for each request
const userAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
```

### 2. Intelligent Delays

```typescript
// Random delay between requests (1-3 seconds)
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Vary delay to appear human-like
const randomDelay = Math.floor(Math.random() * 2000) + 1000;
await delay(randomDelay);
```

### 3. Request Headers

```typescript
const headers = {
  'User-Agent': userAgent,
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1',
  'Cache-Control': 'max-age=0',
  'Referer': 'https://www.google.com/'
};
```

### 4. Session Management

```typescript
// Maintain sessions across requests
import axios from 'axios';

const session = axios.create({
  timeout: 30000,
  maxRedirects: 5,
  withCredentials: true
});
```

### 5. Error Handling & Retries

```typescript
async function scrapeWithRetry(url: string, maxRetries = 3): Promise<any> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await axios.get(url, { headers });
      return response.data;
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      
      // Exponential backoff
      const backoffTime = Math.pow(2, i) * 1000;
      await delay(backoffTime);
    }
  }
}
```

---

## Fortune 500 Matching

### Fuzzy Matching Algorithm

Located in `src\data\fortune500-companies.ts`:

```typescript
export function findFortune500Match(companyName: string): Fortune500Company | null {
  // Normalize input
  const normalizedInput = companyName.toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '')
    .trim();
  
  // Check for exact matches
  const exactMatch = fortune500Companies.find(company => 
    normalizeCompanyName(company.name) === normalizedInput
  );
  
  if (exactMatch) return exactMatch;
  
  // Check for partial matches
  const partialMatch = fortune500Companies.find(company => {
    const normalized = normalizeCompanyName(company.name);
    return normalizedInput.includes(normalized) || 
           normalized.includes(normalizedInput);
  });
  
  return partialMatch || null;
}
```

### Fortune 500 Data Structure

```typescript
interface Fortune500Company {
  rank: number;
  name: string;
  website: string;
  industry: string;
  revenue?: number; // in millions
  employees?: number;
  headquarters?: string;
}

// Example entries
const fortune500Companies: Fortune500Company[] = [
  {
    rank: 1,
    name: 'Walmart',
    website: 'https://www.walmart.com',
    industry: 'Retail',
    revenue: 611289,
    employees: 2300000,
    headquarters: 'Bentonville, AR'
  },
  {
    rank: 2,
    name: 'Amazon',
    website: 'https://www.amazon.com',
    industry: 'Technology/E-commerce',
    revenue: 513983,
    employees: 1540000,
    headquarters: 'Seattle, WA'
  }
  // ... 500 companies
];
```

### Matching Examples

```typescript
findFortune500Match('Amazon.com Inc') // ✓ Matches Amazon
findFortune500Match('Alphabet Inc.')  // ✓ Matches Google
findFortune500Match('JPMorgan Chase') // ✓ Matches JPMorgan Chase & Co.
findFortune500Match('Microsoft Corp') // ✓ Matches Microsoft
```

---

## Organization Enrichment

### Auto-Creation Logic

```typescript
async function enrichOrganization(scrapedJob: ScrapedJob): Promise<Organization> {
  // 1. Check if organization exists
  let org = await findOrganization(scrapedJob.company);
  
  if (!org) {
    // 2. Try Fortune 500 match
    const f500Match = findFortune500Match(scrapedJob.company);
    
    // 3. Create organization with enriched data
    org = await createOrganization({
      name: f500Match?.name || scrapedJob.company,
      website: f500Match?.website || scrapedJob.companyWebsite || await findWebsite(scrapedJob.company),
      industry: f500Match?.industry || scrapedJob.companyIndustry || 'Technology',
      isFortune500: !!f500Match,
      logoUrl: scrapedJob.logoUrl || await fetchLogo(scrapedJob.company),
      description: await fetchDescription(scrapedJob.company),
      employeeCount: f500Match?.employees,
      headquarters: f500Match?.headquarters
    });
  }
  
  return org;
}
```

### Logo Fetching

```typescript
async function fetchLogo(companyName: string): Promise<string | null> {
  try {
    // Try Clearbit Logo API
    const logoUrl = `https://logo.clearbit.com/${extractDomain(companyName)}`;
    const response = await axios.head(logoUrl);
    
    if (response.status === 200) {
      return logoUrl;
    }
  } catch (error) {
    // Fallback to placeholder
    return null;
  }
  
  return null;
}
```

---

## Scheduling

### Azure Function Timer Trigger

```typescript
// Run every 6 hours
app.timer('jobScraperScheduled', {
  schedule: '0 0 */6 * * *', // Cron: Every 6 hours
  handler: async (timer: Timer, context: InvocationContext) => {
    context.log('Job scraper triggered at:', new Date().toISOString());
    
    try {
      const result = await JobScraperService.runAllScrapers();
      context.log('Scraping completed:', result.summary);
    } catch (error) {
      context.error('Scraping failed:', error);
    }
  }
});
```

### Cron Schedule Options

```typescript
// Daily at 2 AM
schedule: '0 0 2 * * *'

// Every 12 hours
schedule: '0 0 */12 * * *'

// Monday-Friday at 9 AM
schedule: '0 0 9 * * 1-5'

// Every 30 minutes
schedule: '0 */30 * * * *'
```

---

## Monitoring & Logs

### Scraping Result Structure

```typescript
interface ScrapingResult {
  success: boolean;
  jobsAdded: number;
  errors: string[];
  summary: {
    totalJobsScraped: number;
    sourceBreakdown: {
      remoteok: number;
      adzuna: number;
      weworkremotely: number;
      hackernews: number;
    };
    indiaJobsAdded: number;
    fortune500JobsAdded: number;
    executionTime: number; // milliseconds
    timestamp: Date;
  };
}
```

### Log Examples

```typescript
// Success log
{
  "timestamp": "2025-12-05T10:00:00Z",
  "level": "info",
  "message": "Job scraper completed successfully",
  "jobsAdded": 847,
  "sources": {
    "remoteok": 198,
    "adzuna": 392,
    "weworkremotely": 227,
    "hackernews": 30
  },
  "executionTime": 12456,
  "indiaJobs": 340,
  "fortune500Jobs": 156
}

// Error log
{
  "timestamp": "2025-12-05T10:15:00Z",
  "level": "error",
  "message": "Adzuna scraping failed",
  "error": "API rate limit exceeded",
  "source": "adzuna",
  "retryAfter": 3600
}
```

### Application Insights Queries

```kusto
// Query scraping results
traces
| where customDimensions.operation == "job_scraping"
| where timestamp > ago(24h)
| summarize 
    TotalJobs = sum(toint(customDimensions.jobsAdded)),
    AvgExecutionTime = avg(toint(customDimensions.executionTime)),
    SuccessRate = countif(customDimensions.success == "true") * 100.0 / count()
  by bin(timestamp, 1h)
| order by timestamp desc
```

---

## Troubleshooting

### Common Issues

#### 1. No Jobs Scraped

**Symptoms**: `jobsAdded: 0` in result

**Causes**:
- Website structure changed (HTML scraping)
- API credentials expired (Adzuna)
- Rate limiting triggered
- Network connectivity issues

**Solutions**:
```powershell
# Check scraper status
.\job-scraper-manager.ps1 -Action status

# Test individual source
.\job-scraper.ps1 -Source remoteok -TestMode

# Verify API credentials
$env:ADZUNA_APP_ID
$env:ADZUNA_APP_KEY

# Check network connectivity
Test-NetConnection -ComputerName remoteok.com -Port 443
```

#### 2. Duplicate Jobs

**Symptoms**: Same job appears multiple times

**Causes**:
- ExternalJobID not unique
- Deduplication logic failing
- Different sources posting same job

**Solutions**:
```sql
-- Check for duplicates
SELECT Title, Company, COUNT(*) as Count
FROM Jobs
WHERE PostedDate > DATEADD(day, -7, GETDATE())
GROUP BY Title, Company
HAVING COUNT(*) > 1;

-- Remove duplicates (keep latest)
DELETE FROM Jobs
WHERE JobID NOT IN (
  SELECT MAX(JobID)
  FROM Jobs
  GROUP BY ExternalJobID, Source
);
```

#### 3. Organization Not Created

**Symptoms**: Jobs saved but no organization link

**Causes**:
- Company name parsing issues
- Organization creation disabled
- Database constraints

**Solutions**:
```typescript
// Enable organization enrichment
const scraperConfig = {
  enrichOrganizations: true,
  createMissingOrganizations: true
};

// Manually enrich organizations
.\enrich-organizations.ps1

// Fix organization URLs
.\fix-organization-urls.ps1
```

#### 4. Scraper Timing Out

**Symptoms**: Execution exceeds function timeout

**Causes**:
- Too many jobs configured
- Slow network responses
- Database performance issues

**Solutions**:
```typescript
// Reduce job limits
sources: {
  remoteok: { maxJobs: 100 },  // Reduced from 200
  adzuna: { maxTotalJobs: 200 } // Reduced from 400
}

// Increase function timeout (host.json)
{
  "functionTimeout": "00:10:00" // 10 minutes
}

// Optimize database queries
CREATE INDEX IX_Jobs_ExternalJobID ON Jobs(ExternalJobID);
CREATE INDEX IX_Jobs_Source ON Jobs(Source);
```

---

## Performance Metrics

### Target Benchmarks

| Metric | Target | Current |
|--------|--------|---------|
| Total Jobs/Run | 1000 | 850-900 |
| Execution Time | < 15 min | 10-12 min |
| Success Rate | > 95% | 97% |
| India Jobs % | 40% | 38-42% |
| Fortune 500 Matches | > 100 | 120-150 |
| Duplicate Rate | < 5% | 2-3% |

### Optimization Tips

1. **Parallel Scraping**: Run multiple sources concurrently
2. **Database Indexing**: Index all foreign keys and search fields
3. **Caching**: Cache organization lookups
4. **Batch Inserts**: Use bulk insert for jobs
5. **Connection Pooling**: Reuse database connections

---

## Future Enhancements

- [ ] Add Indeed scraping (API required)
- [ ] LinkedIn job scraping (complex anti-bot)
- [ ] GitHub Jobs integration
- [ ] AngelList startup jobs
- [ ] Glassdoor job listings
- [ ] Custom RSS feed scrapers
- [ ] Machine learning for job quality scoring
- [ ] Automatic job expiry detection
- [ ] Company funding data enrichment
- [ ] Salary prediction models

---

*Last Updated: December 2025*
*Version: 2.0.0*
