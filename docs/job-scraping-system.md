# RefOpen Job Scraping System ???

## Overview

The RefOpen Job Scraping System is a comprehensive, automated solution that fetches fresh job postings from multiple platforms and populates your Jobs table. It's designed to run continuously, providing a steady stream of up-to-date job opportunities for your users.

## ? Features

### ?? Multi-Source Scraping
- **RemoteOK**: API-based scraping for remote jobs
- **WeWorkRemotely**: Web scraping for remote positions
- **Adzuna**: API integration for comprehensive job search
- **AngelList/Wellfound**: Startup job opportunities
- **Extensible**: Easy to add new sources

### ?? Intelligent Data Processing
- **Duplicate Detection**: Prevents duplicate jobs using external IDs
- **Smart Categorization**: Automatically maps jobs to departments
- **Experience Level Detection**: Extracts experience requirements from job descriptions
- **Salary Normalization**: Standardizes salary information
- **Location Parsing**: Extracts and standardizes location data

### ?? Configurable & Scalable
- **Flexible Scheduling**: Configurable scraping intervals (default: 24 hours)
- **Rate Limiting**: Respects source websites' rate limits
- **Batch Processing**: Efficient database operations
- **Error Recovery**: Automatic retry logic and error handling

### ?? Monitoring & Analytics
- **Real-time Statistics**: Track scraping performance and results
- **Error Reporting**: Detailed logging of failures and issues
- **Health Checks**: Monitor system status and connectivity
- **Admin Dashboard**: Web interface for management

## ?? Quick Start

### 1. Installation

```bash
# Install required dependencies
npm install axios cheerio

# Or if using PowerShell package manager
Install-Module -Name SqlServer  # For PowerShell scripts
```

### 2. Environment Setup

Add these environment variables to your `.env` or Azure Functions configuration:

```env
# Job Scraping Configuration
JOB_SCRAPING_ENABLED=true
SCRAPING_INTERVAL_HOURS=24
MAX_JOBS_PER_RUN=100

# API Keys (optional but recommended)
ADZUNA_APP_ID=your_adzuna_app_id
ADZUNA_APP_KEY=your_adzuna_app_key

# Source Control
REMOTEOK_ENABLED=true
WEWORKREMOTELY_ENABLED=true
ADZUNA_ENABLED=true
ANGELLIST_ENABLED=true

# Monitoring
DETAILED_LOGGING=true
LOG_DB_QUERIES=false
```

### 3. Database Setup

Run the setup script to create required tables:

```powershell
.\scripts\job-scraper-manager.ps1 -Action setup -ConnectionString "Your-Connection-String"
```

### 4. Manual Trigger (Testing)

Test the system with a manual scraping run:

```powershell
.\scripts\job-scraper-manager.ps1 -Action trigger -AdminToken "your-admin-jwt-token"
```

## ?? Database Schema Requirements

The scraper expects your Jobs table to have these key fields (matching your schema):

### Required Fields
- `JobID` (UNIQUEIDENTIFIER)
- `OrganizationID` (INT)
- `Title` (NVARCHAR(200))
- `JobTypeID` (INT)
- `WorkplaceTypeID` (INT)
- `Department` (NVARCHAR(100))
- `Description` (NVARCHAR(MAX))
- `Location` (NVARCHAR(200))
- `ExternalJobID` (NVARCHAR(100)) - **Important for duplicate detection**

### Auto-Populated Fields
- `PostedByType` (0 = System/Scraped, 1 = User)
- `Status` ('Published' for scraped jobs)
- `CreatedAt`, `UpdatedAt`
- `Country`, `State`, `City` (parsed from location)
- `IsRemote` (detected from job details)
- `SalaryRangeMin/Max` (when available)
- `ExperienceMin/Max` (extracted from descriptions)

## ?? Configuration

### Scraping Sources

Each source can be individually enabled/disabled and configured:

```typescript
sources: {
  remoteok: {
    enabled: true,
    maxJobs: 20,
    rateLimit: 1000 // ms between requests
  },
  weworkremotely: {
    enabled: true,
    maxJobsPerCategory: 10,
    rateLimit: 2000
  },
  // ... more sources
}
```

### Content Filtering

Control what gets scraped:

```typescript
filtering: {
  excludeKeywords: ['adult entertainment', 'gambling', 'mlm'],
  minimumTitleLength: 5,
  minimumDescriptionLength: 50,
  minimumSalary: 20000,
  maximumSalary: 500000
}
```

### Geographic Targeting

Focus on specific locations:

```typescript
targetLocations: [
  'Remote',
  'San Francisco, CA',
  'New York, NY',
  'Seattle, WA',
  // ... more locations
]
```

## ?? API Endpoints

### Admin Endpoints (Require Admin Token)

| Endpoint | Method | Description |
|----------|---------|-------------|
| `/admin/jobs/scrape/trigger` | POST | Manually trigger job scraping |
| `/admin/jobs/scrape/config` | GET/PUT | Get/update scraping configuration |
| `/admin/jobs/scrape/stats` | GET | View scraping statistics |
| `/admin/jobs/scrape/cleanup` | DELETE | Clean up old scraped jobs |

### Public Endpoints

| Endpoint | Method | Description |
|----------|---------|-------------|
| `/health/scraper` | GET | Check scraper service health |

## ?? Monitoring & Management

### PowerShell Management Script

The included PowerShell script provides easy management:

```powershell
# Check system status
.\scripts\job-scraper-manager.ps1 -Action status

# View configuration
.\scripts\job-scraper-manager.ps1 -Action config -AdminToken $token

# Get statistics
.\scripts\job-scraper-manager.ps1 -Action stats -AdminToken $token

# Clean up old jobs
.\scripts\job-scraper-manager.ps1 -Action cleanup -CleanupDays 90 -AdminToken $token

# Test all sources
.\scripts\job-scraper-manager.ps1 -Action test
```

### Database Monitoring

Key queries to monitor the system:

```sql
-- Total scraped jobs
SELECT COUNT(*) as TotalScrapedJobs 
FROM Jobs 
WHERE PostedByType = 0 AND ExternalJobID IS NOT NULL;

-- Jobs by source
SELECT 
    LEFT(ExternalJobID, CHARINDEX('_', ExternalJobID + '_') - 1) as Source,
    COUNT(*) as JobCount,
    MAX(CreatedAt) as LastScrapedAt
FROM Jobs 
WHERE PostedByType = 0 
GROUP BY LEFT(ExternalJobID, CHARINDEX('_', ExternalJobID + '_') - 1);

-- Recent scraping activity
SELECT COUNT(*) as JobsLast24Hours
FROM Jobs 
WHERE PostedByType = 0 
  AND CreatedAt >= DATEADD(hour, -24, GETUTCDATE());
```

## ?? Automated Scheduling

The system includes a built-in scheduler that runs automatically:

### Default Schedule
- **Job Scraping**: Every 24 hours
- **Database Cleanup**: Weekly
- **Analytics Aggregation**: Every 6 hours

### Manual Control

```typescript
// Start scheduler programmatically
import { SchedulerService } from './services/scheduler.service';
const scheduler = SchedulerService.getInstance();
scheduler.start();

// Trigger specific tasks
await scheduler.triggerTask('job-scraping');
```

## ??? Error Handling & Recovery

### Built-in Resilience
- **Retry Logic**: Automatic retries for failed requests
- **Rate Limiting**: Respects website rate limits
- **Circuit Breaker**: Temporarily disables failing sources
- **Graceful Degradation**: Continues with working sources

### Error Monitoring
- All errors are logged to `SchedulerLogs` table
- Email alerts for critical failures (configurable)
- Detailed error reporting in admin dashboard

## ?? Security & Compliance

### Rate Limiting
- Configurable delays between requests
- Rotating User-Agent strings
- Respectful scraping practices

### Data Privacy
- Only publicly available job postings
- No personal data collection
- Compliance with robots.txt where applicable

### API Security
- JWT-based authentication for admin endpoints
- Role-based access control
- Request logging and monitoring

## ?? Performance Optimization

### Database Optimization
- Batch inserts for efficiency
- Indexed columns for fast lookups
- Connection pooling
- Query optimization

### Memory Management
- Streaming data processing
- Garbage collection optimization
- Resource cleanup

### Caching Strategy
- Organization data caching
- Job type/workplace type caching
- Configuration caching

## ?? Troubleshooting

### Common Issues

1. **No Jobs Being Scraped**
   ```sql
   -- Check if scraping is enabled
   SELECT * FROM SchedulerLogs WHERE TaskId = 'job-scraping' ORDER BY CreatedAt DESC;
   ```

2. **Duplicate Jobs**
   ```sql
   -- Check for duplicate external IDs
   SELECT ExternalJobID, COUNT(*) 
   FROM Jobs 
   GROUP BY ExternalJobID 
   HAVING COUNT(*) > 1;
   ```

3. **Source Connection Issues**
   - Check network connectivity
   - Verify source website accessibility
   - Review rate limiting settings

4. **Database Errors**
   - Check connection string
   - Verify table permissions
   - Review constraint violations

### Debug Mode

Enable detailed logging:

```env
DETAILED_LOGGING=true
LOG_DB_QUERIES=true
```

### Health Checks

Use the health endpoint to monitor system status:

```bash
curl http://localhost:7071/api/health/scraper
```

## ?? Advanced Features

### Custom Source Integration

Add new job sources by implementing the scraping interface:

```typescript
// Add to job-scraper.service.ts
private static async scrapeCustomSource(): Promise<ScrapedJob[]> {
  const jobs: ScrapedJob[] = [];
  
  // Your scraping logic here
  
  return jobs;
}
```

### Machine Learning Integration

Future enhancements could include:
- Job quality scoring
- Automatic categorization
- Salary prediction
- Skills extraction

### API Integration

The system supports integration with job board APIs:
- Adzuna API (included)
- Indeed API (planned)
- LinkedIn API (planned)
- Custom APIs (extensible)

## ?? Support & Contributing

### Getting Help
- Check the troubleshooting guide above
- Review error logs in `SchedulerLogs` table
- Use the PowerShell management script for diagnostics

### Contributing
- Add new job sources
- Improve data extraction algorithms
- Enhance error handling
- Add monitoring features

## ?? License

This job scraping system is part of the RefOpen platform and follows the same licensing terms as the main project.

---

**?? Ready to start scraping jobs?** Run the setup command and watch your job database grow automatically!

```powershell
.\scripts\job-scraper-manager.ps1 -Action setup -ConnectionString "your-connection-string"
```