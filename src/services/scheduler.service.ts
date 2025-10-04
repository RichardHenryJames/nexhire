/**
 * Production Scheduler Service for NexHire Job Scraping
 * Integrates with existing NexHire architecture
 */

import { JobScraperService } from './job-scraper.service';

export class SchedulerService {
  private static instance: SchedulerService;
  private isRunning: boolean = false;
  private intervalId: NodeJS.Timeout | null = null;
  private config = {
    enabled: process.env.SCHEDULER_ENABLED !== 'false',
    intervalHours: parseInt(process.env.SCRAPING_INTERVAL_HOURS || '24'),
    autoStart: process.env.NODE_ENV === 'production' || process.env.AUTO_START_SCHEDULER === 'true'
  };

  private constructor() {}

  static getInstance(): SchedulerService {
    if (!SchedulerService.instance) {
      SchedulerService.instance = new SchedulerService();
    }
    return SchedulerService.instance;
  }

  // Start automated job scraping schedule
  start(): void {
    if (this.isRunning) {
      console.log('Scheduler already running');
      return;
    }

    if (!this.config.enabled) {
      console.log('Scheduler is disabled');
      return;
    }

    console.log(`?? Starting NexHire job scraping scheduler (every ${this.config.intervalHours}h)`);
    
    // Run immediately on start
    this.runJobScraping();
    
    // Set up recurring schedule
    const intervalMs = this.config.intervalHours * 60 * 60 * 1000;
    this.intervalId = setInterval(() => {
      this.runJobScraping();
    }, intervalMs);
    
    this.isRunning = true;
    console.log('Scheduler started successfully');
  }

  // Stop the scheduler
  stop(): void {
    if (!this.isRunning) {
      console.log('Scheduler is not running');
      return;
    }

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.isRunning = false;
    console.log('Scheduler stopped');
  }

  // Get scheduler status
  getStatus() {
    return {
      isRunning: this.isRunning,
      config: this.config,
      nextRun: this.intervalId ? 
        new Date(Date.now() + (this.config.intervalHours * 60 * 60 * 1000)).toISOString() : 
        null
    };
  }

  // Update scheduler configuration
  updateConfig(newConfig: Partial<typeof this.config>): void {
    const oldConfig = { ...this.config };
    this.config = { ...this.config, ...newConfig };
    
    console.log('Scheduler configuration updated');
    
    // Restart if interval changed and scheduler is running
    if (this.isRunning && oldConfig.intervalHours !== this.config.intervalHours) {
      this.stop();
      this.start();
    }
  }

  // Run job scraping with error handling
  private async runJobScraping(): Promise<void> {
    try {
      console.log('??? Scheduled job scraping started...');
      const startTime = Date.now();
      
      const result = await JobScraperService.scrapeAndPopulateJobs();
      const duration = Date.now() - startTime;
      
      if (result.success) {
        console.log(`? Scheduled scraping completed successfully:`);
        console.log(`   - Jobs added: ${result.jobsAdded}`);
        console.log(`   - India jobs: ${result.summary.indiaJobsAdded}`);
        console.log(`   - Sources: ${Object.keys(result.summary.sourceBreakdown).join(', ')}`);
        console.log(`   - Duration: ${Math.round(duration / 1000)}s`);
        
        // Log to database for monitoring
        await this.logScrapingResult(result, duration);
        
      } else {
        console.error('Scheduled scraping failed:');
        result.errors.forEach(error => console.error(`   - ${error}`));
        
        await this.logScrapingResult(result, duration);
      }
      
    } catch (error: any) {
      console.error('Scheduled scraping crashed:', error.message);
      
      // Log crash for monitoring
      await this.logScrapingResult({
        success: false,
        jobsAdded: 0,
        errors: [error.message],
        summary: {
          totalJobsScraped: 0,
          sourceBreakdown: {},
          indiaJobsAdded: 0,
          executionTime: 0
        }
      }, 0);
    }
  }

  // Log scraping results for monitoring
  private async logScrapingResult(result: any, duration: number): Promise<void> {
    try {
      const { dbService } = await import('./database.service');
      
      const logQuery = `
        INSERT INTO ScrapingLogs (
          RunId, StartTime, EndTime, Success, JobsAdded, IndiaJobs, 
          TotalScraped, Sources, ErrorCount, Errors
        )
        VALUES (
          @param0, @param1, @param2, @param3, @param4, @param5,
          @param6, @param7, @param8, @param9
        )
      `;
      
      const runId = `scrape_${Date.now()}`;
      const now = new Date();
      const endTime = new Date(now.getTime() + duration);
      
      await dbService.executeQuery(logQuery, [
        runId,
        now.toISOString(),
        endTime.toISOString(), 
        result.success,
        result.jobsAdded,
        result.summary.indiaJobsAdded,
        result.summary.totalJobsScraped,
        JSON.stringify(result.summary.sourceBreakdown),
        result.errors.length,
        result.errors.slice(0, 5).join('; ') // Limit error text
      ]);
      
    } catch (logError: any) {
      console.error('Failed to log scraping result:', logError.message);
      // Don't throw - logging failure shouldn't crash the scheduler
    }
  }

  // Create scraping logs table if it doesn't exist
  static async initializeLogging(): Promise<void> {
    try {
      const { dbService } = await import('./database.service');
      
      const createTableQuery = `
        IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='ScrapingLogs' AND xtype='U')
        CREATE TABLE ScrapingLogs (
          LogID int IDENTITY(1,1) PRIMARY KEY,
          RunId nvarchar(50) NOT NULL,
          StartTime datetime2 NOT NULL,
          EndTime datetime2 NOT NULL,
          Success bit NOT NULL,
          JobsAdded int NOT NULL DEFAULT 0,
          IndiaJobs int NOT NULL DEFAULT 0,
          TotalScraped int NOT NULL DEFAULT 0,
          Sources nvarchar(500),
          ErrorCount int NOT NULL DEFAULT 0,
          Errors nvarchar(2000),
          CreatedAt datetime2 DEFAULT GETUTCDATE()
        )
      `;
      
      await dbService.executeQuery(createTableQuery);
      console.log('Scraping logs table ready');
      
    } catch (error: any) {
      console.error('Failed to initialize scraping logs:', error.message);
    }
  }
}

// Initialize and optionally auto-start scheduler
const initializeScheduler = async () => {
  try {
    // Initialize logging table
    await SchedulerService.initializeLogging();
    
    const scheduler = SchedulerService.getInstance();
    
    if (scheduler.getStatus().config.autoStart) {
      console.log('Auto-starting job scraping scheduler...');
      scheduler.start();
    }
    
    // Graceful shutdown handlers
    process.on('SIGTERM', () => {
      console.log('SIGTERM received, stopping scheduler...');
      scheduler.stop();
    });
    
    process.on('SIGINT', () => {
      console.log('SIGINT received, stopping scheduler...');
      scheduler.stop();
    });
    
  } catch (error: any) {
    console.error('Scheduler initialization failed:', error.message);
  }
};

// Auto-initialize in production
if (process.env.NODE_ENV === 'production' || process.env.INIT_SCHEDULER === 'true') {
  initializeScheduler();
}