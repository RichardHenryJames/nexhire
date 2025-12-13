# Job Scraping Architecture

## Overview

The NexHire job scraping system is a sophisticated, automated pipeline that collects job postings from multiple sources, processes and enriches the data, and stores it in a structured format for the platform.

## System Components

### 1. Job Scraper Manager (`job-scraper-manager.ps1`)

The central orchestrator that manages the entire scraping process.

**Responsibilities**:
- Scheduling and triggering scraping jobs
- Managing scraper lifecycle
- Error handling and retry logic
- Logging and monitoring
- Resource allocation

**Key Features**:
```powershell
# Run specific scrapers
./job-scraper-manager.ps1 -Scrapers "linkedin,greenhouse"

# Run all scrapers
./job-scraper-manager.ps1 -All

# Dry run mode
./job-scraper-manager.ps1 -DryRun
```

### 2. Job Scraper Service (`src/services/job-scraper.service.ts`)

Core scraping logic implemented in TypeScript.

**Architecture**:
```typescript
interface JobScraperService {
  scrapeJobs(source: string, config: ScraperConfig): Promise<Job[]>
  validateJob(job: Job): boolean
  deduplicateJobs(jobs: Job[]): Job[]
  enrichJob(job: Job): Promise<EnrichedJob>
  saveJobs(jobs: Job[]): Promise<void>
}
```

**Key Methods**:
- `scrapeLinkedIn()`: LinkedIn job scraping
- `scrapeGreenhouse()`: Greenhouse ATS scraping
- `scrapeLever()`: Lever ATS scraping
- `scrapeWorkday()`: Workday scraping
- `scrapeCompanyWebsite()`: Generic company website scraping

### 3. Scraper Adapters

Each job source has a dedicated adapter with source-specific logic.

#### LinkedIn Adapter
```typescript
class LinkedInAdapter {
  async scrapeJobs(searchParams: LinkedInSearchParams): Promise<Job[]>
  parseJobListing(html: string): Job
  handlePagination(): Promise<void>
  respectRateLimits(): void
}
```

**Features**:
- Search-based scraping
- Cookie management
- Anti-bot detection handling
- Rate limiting (1 request/2 seconds)

#### Greenhouse Adapter
```typescript
class GreenhouseAdapter {
  async scrapeCompanyJobs(companyId: string): Promise<Job[]>
  parseJobBoard(json: any): Job[]
  extractJobDetails(jobUrl: string): JobDetails
}
```

**Features**:
- API-based when available
- JSON parsing
- Company-specific job boards
- Location normalization

#### Lever Adapter
```typescript
class LeverAdapter {
  async scrapeJobs(companyName: string): Promise<Job[]>
  parsePostings(data: any): Job[]
  enrichWithMetadata(job: Job): EnrichedJob
}
```

**Features**:
- REST API integration
- Team/department extraction
- Commitment type parsing

#### Workday Adapter
```typescript
class WorkdayAdapter {
  async scrapeJobs(instanceUrl: string): Promise<Job[]>
  handleWorkdayAuth(): Promise<void>
  parseWorkdayJson(data: any): Job[]
}
```

**Features**:
- Dynamic URL handling
- Complex JSON structure parsing
- Multi-language support

### 4. Enhanced Job Scraper Config (`src/config/enhanced-job-scraper.config.ts`)

Central configuration for all scraping operations.

```typescript
interface ScraperConfig {
  sources: {
    linkedin: LinkedInConfig
    greenhouse: GreenhouseConfig
    lever: LeverConfig
    workday: WorkdayConfig
    custom: CustomSourceConfig[]
  }
  schedule: CronSchedule
  processing: {
    batchSize: number
    concurrency: number
    retryAttempts: number
    timeout: number
  }
  filters: {
    minSalary?: number
    locations?: string[]
    jobTypes?: string[]
    companies?: string[]
  }
}
```

## Scraping Workflow

### Phase 1: Source Discovery
```
1. Load scraper configuration
2. Identify target companies and sources
3. Build scraping task queue
4. Prioritize based on:
   - Fortune 500 status
   - Last scrape time
   - Job posting frequency
```

### Phase 2: Data Collection
```
1. Initialize scraper adapter
2. Authenticate (if required)
3. Execute scraping logic:
   - Search-based: Query jobs by criteria
   - Company-based: Scrape specific job boards
   - API-based: Make API calls
4. Handle pagination
5. Collect raw job data
6. Respect rate limits
```

### Phase 3: Data Processing
```
1. Parse raw HTML/JSON
2. Extract structured fields:
   - Title
   - Description
   - Location
   - Salary (if available)
   - Requirements
   - Company information
3. Normalize data formats
4. Validate required fields
```

### Phase 4: Enrichment
```
1. Company enrichment:
   - Logo fetching
   - Industry classification
   - Company size
   - Fortune 500 status
2. Job enrichment:
   - Skill extraction
   - Experience level detection
   - Remote work detection
   - Salary estimation
3. Location enrichment:
   - Geocoding
   - Timezone
   - Region classification
```

### Phase 5: Deduplication
```
1. Generate job fingerprint:
   - Title + Company + Location hash
2. Check against existing jobs:
   - Exact match detection
   - Fuzzy matching for similar jobs
3. Update vs. Insert decision:
   - Update: If job exists and changed
   - Insert: If new job
   - Skip: If duplicate or unchanged
```

### Phase 6: Storage
```
1. Batch insert/update operations
2. Update job indexes
3. Trigger notifications for new jobs
4. Update scraper metadata:
   - Last run time
   - Jobs collected count
   - Success/failure status
```

## Data Structures

### Raw Job Data
```typescript
interface RawJob {
  externalJobId: string
  sourceUrl: string
  rawHtml?: string
  rawJson?: any
  scrapedAt: Date
  source: string
}
```

### Processed Job
```typescript
interface ProcessedJob {
  title: string
  description: string
  company: string
  location: string
  salary?: {
    min?: number
    max?: number
    currency: string
    period: 'hourly' | 'annual'
  }
  jobType: 'full-time' | 'part-time' | 'contract' | 'internship'
  experienceLevel: 'entry' | 'mid' | 'senior' | 'executive'
  skills: string[]
  requirements: string[]
  benefits: string[]
  remote: boolean
  postedDate: Date
  externalUrl: string
  source: string
}
```

### Enriched Job
```typescript
interface EnrichedJob extends ProcessedJob {
  organization: {
    id: number
    name: string
    logo?: string
    industry?: string
    size?: string
    fortune500: boolean
  }
  location: {
    city: string
    state: string
    country: string
    coordinates?: {
      lat: number
      lng: number
    }
    timezone: string
  }
  metadata: {
    qualityScore: number
    matchScore?: number
    trending: boolean
    applicationCount: number
  }
}
```

## Scheduling & Automation

### PowerShell Schedulers

#### `Run-AllScrapers.ps1`
Runs all configured scrapers in sequence or parallel.

```powershell
# Sequential execution
./Run-AllScrapers.ps1 -Mode Sequential

# Parallel execution (faster but more resource-intensive)
./Run-AllScrapers.ps1 -Mode Parallel -MaxThreads 5

# Specific companies
./Run-AllScrapers.ps1 -Companies @("Microsoft", "Google", "Amazon")
```

#### `job-scraper.ps1`
Individual job scraper execution script.

```powershell
# Scrape specific source
./job-scraper.ps1 -Source "linkedin" -Query "software engineer"

# Scrape with filters
./job-scraper.ps1 -Source "greenhouse" -Company "Airbnb" -Location "Remote"
```

### Cron Schedules

```typescript
const scraperSchedules = {
  // High-priority: Fortune 500 companies
  fortune500: '0 */4 * * *',  // Every 4 hours
  
  // Medium-priority: Tech companies
  techCompanies: '0 */8 * * *',  // Every 8 hours
  
  // Low-priority: Others
  others: '0 0 * * *',  // Once daily
  
  // Full refresh
  fullRefresh: '0 2 * * 0'  // Weekly on Sunday at 2 AM
}
```

## Error Handling & Resilience

### Retry Logic
```typescript
async function scrapeWithRetry(
  scraper: Scraper,
  maxRetries: number = 3
): Promise<Job[]> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await scraper.scrape()
    } catch (error) {
      if (attempt === maxRetries) throw error
      
      const backoff = Math.pow(2, attempt) * 1000
      await sleep(backoff)
    }
  }
}
```

### Error Types & Handling

| Error Type | Handling Strategy |
|------------|-------------------|
| Rate Limit | Exponential backoff, respect headers |
| Network Timeout | Retry with increased timeout |
| Authentication Failed | Re-authenticate, notify admin |
| Parsing Error | Log, skip job, continue |
| Database Error | Retry transaction, alert on failure |
| Anti-Bot Detection | Rotate proxies, add delays, use headless browser |

### Monitoring & Alerts
```typescript
interface ScraperMetrics {
  totalJobs: number
  newJobs: number
  updatedJobs: number
  failedJobs: number
  duration: number
  errors: Error[]
  source: string
  timestamp: Date
}
```

## Rate Limiting & Throttling

### Implementation
```typescript
class RateLimiter {
  private queue: RequestQueue
  private limits: Map<string, RateLimit>
  
  async throttle(source: string): Promise<void> {
    const limit = this.limits.get(source)
    await this.queue.wait(limit)
  }
}

const rateLimits = {
  linkedin: { requests: 30, per: 'minute' },
  greenhouse: { requests: 100, per: 'minute' },
  lever: { requests: 60, per: 'minute' },
  workday: { requests: 50, per: 'minute' }
}
```

### Politeness Policy
- Respect `robots.txt`
- Honor rate limit headers
- Use appropriate User-Agent
- Implement random delays between requests
- Avoid scraping during peak hours

## Performance Optimization

### Techniques

1. **Concurrent Scraping**
   - Process multiple sources simultaneously
   - Parallel job detail fetching
   - Batch database operations

2. **Caching**
   - Cache company information
   - Store job board HTML (temporary)
   - Cache API responses

3. **Incremental Updates**
   - Track last scrape time
   - Only fetch new/updated jobs
   - Skip unchanged listings

4. **Smart Filtering**
   - Pre-filter at source level
   - Skip expired jobs
   - Focus on active companies

### Performance Metrics

- **Scrape Duration**: Target <5 minutes per source
- **Jobs Per Minute**: 100-500 depending on source
- **Success Rate**: >95%
- **Deduplication Rate**: ~30-40%
- **Database Write Time**: <10ms per job

## Data Quality

### Validation Rules
```typescript
const jobValidationRules = {
  title: {
    required: true,
    minLength: 5,
    maxLength: 200
  },
  description: {
    required: true,
    minLength: 50
  },
  company: {
    required: true,
    mustExistInOrganizations: true
  },
  location: {
    required: true,
    validFormat: true
  },
  salary: {
    required: false,
    validRange: { min: 0, max: 1000000 }
  }
}
```

### Quality Score Calculation
```typescript
function calculateQualityScore(job: Job): number {
  let score = 0
  
  // Completeness (40 points)
  if (job.description) score += 15
  if (job.salary) score += 10
  if (job.requirements) score += 10
  if (job.benefits) score += 5
  
  // Freshness (30 points)
  const daysSincePosted = getDaysSince(job.postedDate)
  score += Math.max(0, 30 - daysSincePosted)
  
  // Company reputation (30 points)
  if (job.organization.fortune500) score += 30
  else if (job.organization.size === 'large') score += 20
  else score += 10
  
  return Math.min(100, score)
}
```

## Database Schema for Jobs

```sql
CREATE TABLE jobs (
    id INT IDENTITY(1,1) PRIMARY KEY,
    external_job_id NVARCHAR(500) NOT NULL,
    title NVARCHAR(500) NOT NULL,
    description NVARCHAR(MAX),
    organization_id INT FOREIGN KEY REFERENCES organizations(id),
    location NVARCHAR(500),
    salary_min DECIMAL(10,2),
    salary_max DECIMAL(10,2),
    job_type NVARCHAR(50),
    experience_level NVARCHAR(50),
    remote BIT DEFAULT 0,
    external_url NVARCHAR(1000),
    source NVARCHAR(100),
    posted_date DATETIME,
    scraped_at DATETIME DEFAULT GETDATE(),
    last_updated DATETIME DEFAULT GETDATE(),
    is_active BIT DEFAULT 1,
    quality_score INT,
    CONSTRAINT UQ_external_job UNIQUE(external_job_id, source)
)

CREATE INDEX idx_jobs_org ON jobs(organization_id)
CREATE INDEX idx_jobs_location ON jobs(location)
CREATE INDEX idx_jobs_posted ON jobs(posted_date DESC)
CREATE INDEX idx_jobs_active ON jobs(is_active) WHERE is_active = 1
```

## Maintenance & Operations

### Daily Tasks
- Monitor scraper health
- Review error logs
- Check data quality metrics
- Validate job counts

### Weekly Tasks
- Analyze scraping patterns
- Update scraper configurations
- Review and fix failed scrapers
- Optimize slow queries

### Monthly Tasks
- Full system audit
- Update source adapters
- Review and update company list
- Performance optimization

## Future Enhancements

1. **AI-Powered Scraping**
   - ML-based job extraction
   - Intelligent parsing for new sources
   - Automatic adapter generation

2. **Real-Time Updates**
   - WebSocket connections to job boards
   - Instant job notifications
   - Live job status tracking

3. **Advanced Deduplication**
   - ML-based similarity detection
   - Cross-source job matching
   - Automatic job merging

4. **Distributed Scraping**
   - Multi-region scraping nodes
   - Load balancing
   - Fault tolerance

5. **Browser Automation**
   - Puppeteer/Playwright integration
   - JavaScript-heavy site support
   - Screenshot capture for verification

---

**Last Updated**: December 5, 2025
