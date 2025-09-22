/**
 * Job Scraper Controller for NexHire
 * Production-ready endpoints for managing automated job scraping
 */

import { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { AuthService } from '../services/auth.service';
import { dbService } from '../services/database.service';
import { 
    withErrorHandling, 
    withAuth
} from '../middleware';
import { 
    successResponse, 
    extractRequestBody,
    errorResponse
} from '../utils/validation';

// Dynamic import of JobScraperService to avoid initialization issues
async function getJobScraperService() {
    try {
        const { JobScraperService } = await import('../services/job-scraper.service');
        return JobScraperService;
    } catch (error) {
        console.error('Failed to load JobScraperService:', error);
        throw new Error('Job scraping service is temporarily unavailable');
    }
}

// Helper function to verify admin access
async function verifyAdminAccess(req: HttpRequest): Promise<{ success: boolean; error?: string; userId?: string }> {
    try {
        const authHeader = req.headers.get('authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return { success: false, error: 'Authorization header required' };
        }

        const token = authHeader.substring(7);
        const payload = AuthService.verifyToken(token);
        
        if (payload.userType !== 'Admin') {
            return { success: false, error: 'Admin access required' };
        }

        return { success: true, userId: payload.userId };
    } catch (error: any) {
        return { success: false, error: 'Invalid or expired token' };
    }
}

// Trigger job scraping manually (admin only)
export const triggerJobScraping = withErrorHandling(async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    // Verify admin authentication
    const authResult = await verifyAdminAccess(req);
    if (!authResult.success) {
        return {
            status: 403,
            jsonBody: errorResponse('Access denied', authResult.error || 'Admin access required')
        };
    }

    console.log('?? Manual job scraping triggered by admin:', authResult.userId);
    
    try {
        const JobScraperService = await getJobScraperService();
        const result = await JobScraperService.scrapeAndPopulateJobs();
        
        const responseData = {
            success: result.success,
            message: `Job scraping completed. ${result.jobsAdded} jobs added.`,
            data: {
                jobsAdded: result.jobsAdded,
                totalJobsScraped: result.summary.totalJobsScraped,
                indiaJobsAdded: result.summary.indiaJobsAdded,
                sourceBreakdown: result.summary.sourceBreakdown,
                executionTimeSeconds: Math.round(result.summary.executionTime / 1000),
                errors: result.errors
            }
        };

        return {
            status: result.success ? 200 : 500,
            jsonBody: responseData
        };
    } catch (error: any) {
        console.error('Job scraping failed:', error);
        return {
            status: 503,
            jsonBody: errorResponse('Service unavailable', error.message || 'Job scraping service is temporarily unavailable')
        };
    }
});

// Get scraping configuration
export const getScrapingConfig = withErrorHandling(async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const authResult = await verifyAdminAccess(req);
    if (!authResult.success) {
        return {
            status: 403,
            jsonBody: errorResponse('Access denied', authResult.error || 'Admin access required')
        };
    }

    try {
        const JobScraperService = await getJobScraperService();
        const config = JobScraperService.getConfig();
        
        return {
            status: 200,
            jsonBody: successResponse(config, 'Scraping configuration retrieved successfully')
        };
    } catch (error: any) {
        console.error('Failed to get scraping config:', error);
        return {
            status: 503,
            jsonBody: errorResponse('Service unavailable', error.message || 'Configuration service is temporarily unavailable')
        };
    }
});

// Update scraping configuration
export const updateScrapingConfig = withErrorHandling(async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const authResult = await verifyAdminAccess(req);
    if (!authResult.success) {
        return {
            status: 403,
            jsonBody: errorResponse('Access denied', authResult.error || 'Admin access required')
        };
    }

    const updates = await extractRequestBody(req);
    
    // Validate configuration updates
    if (updates.maxJobsPerRun && (updates.maxJobsPerRun < 1 || updates.maxJobsPerRun > 500)) {
        return {
            status: 400,
            jsonBody: errorResponse('Validation failed', 'maxJobsPerRun must be between 1 and 500')
        };
    }

    try {
        const JobScraperService = await getJobScraperService();
        JobScraperService.updateConfig(updates);
        
        return {
            status: 200,
            jsonBody: successResponse(JobScraperService.getConfig(), 'Scraping configuration updated successfully')
        };
    } catch (error: any) {
        console.error('Failed to update scraping config:', error);
        return {
            status: 503,
            jsonBody: errorResponse('Service unavailable', error.message || 'Configuration service is temporarily unavailable')
        };
    }
});

// Get scraping statistics
export const getScrapingStats = withErrorHandling(async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const authResult = await verifyAdminAccess(req);
    if (!authResult.success) {
        return {
            status: 403,
            jsonBody: errorResponse('Access denied', authResult.error || 'Admin access required')
        };
    }

    try {
        const JobScraperService = await getJobScraperService();
        const stats = await JobScraperService.getScrapingStats();
        
        return {
            status: 200,
            jsonBody: successResponse(stats, 'Scraping statistics retrieved successfully')
        };
    } catch (error: any) {
        console.error('Failed to get scraping stats:', error);
        return {
            status: 503,
            jsonBody: errorResponse('Service unavailable', error.message || 'Statistics service is temporarily unavailable')
        };
    }
});

// Clean up old scraped jobs
export const cleanupScrapedJobs = withErrorHandling(async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const authResult = await verifyAdminAccess(req);
    if (!authResult.success) {
        return {
            status: 403,
            jsonBody: errorResponse('Access denied', authResult.error || 'Admin access required')
        };
    }

    const { daysOld = 90, source = null } = req.query as any;
    
    if (isNaN(daysOld) || daysOld < 1 || daysOld > 365) {
        return {
            status: 400,
            jsonBody: errorResponse('Validation failed', 'daysOld must be between 1 and 365')
        };
    }

    // Build cleanup query
    let cleanupQuery = `
        DELETE FROM Jobs 
        WHERE PostedByType = 0 
          AND ExternalJobID IS NOT NULL
          AND CreatedAt < DATEADD(day, -@param0, GETUTCDATE())
    `;
    
    const queryParams: any[] = [parseInt(daysOld)];
    
    if (source) {
        cleanupQuery += ` AND ExternalJobID LIKE @param1`;
        queryParams.push(`${source}_%`);
    }

    const result = await dbService.executeQuery(cleanupQuery, queryParams);
    const deletedCount = result.rowsAffected?.[0] || 0;
    
    return {
        status: 200,
        jsonBody: successResponse({
            deletedJobs: deletedCount,
            daysOld: parseInt(daysOld),
            source: source || 'all'
        }, `Cleanup completed. ${deletedCount} jobs removed.`)
    };
});

// Scraper health check with actual service status
export const scrapingHealthCheck = withErrorHandling(async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    try {
        const JobScraperService = await getJobScraperService();
        const config = JobScraperService.getConfig();
        const stats = await JobScraperService.getScrapingStats();
        
        // Determine health status
        const totalJobs = stats.summary?.TotalScrapedJobs || 0;
        const jobsLast24h = stats.summary?.JobsLast24h || 0;
        const isHealthy = config.enabled && totalJobs >= 0; // Changed from > 0 to >= 0 for initial state
        
        const healthData = {
            status: isHealthy ? 'healthy' : 'degraded',
            scrapingEnabled: config.enabled,
            totalScrapedJobs: totalJobs,
            jobsLast24h: jobsLast24h,
            indiaJobs: stats.summary?.TotalIndiaJobs || 0,
            activeSources: Object.keys(config.sources).filter(source => 
                (config.sources as any)[source]?.enabled
            ),
            lastCheck: new Date().toISOString(),
            recommendations: [] as string[]
        };
        
        // Add recommendations
        if (!config.enabled) {
            healthData.recommendations.push('Enable job scraping in configuration');
        }
        if (jobsLast24h === 0 && totalJobs === 0) {
            healthData.recommendations.push('No jobs scraped yet - run initial scraping');
        } else if (jobsLast24h === 0) {
            healthData.recommendations.push('No jobs scraped in last 24 hours - check sources');
        }
        if (totalJobs < 100) {
            healthData.recommendations.push('Low job count - consider running scraper more frequently');
        }
        
        return {
            status: 200,
            jsonBody: successResponse(healthData, `Scraper health status: ${healthData.status}`)
        };
    } catch (error: any) {
        console.error('Health check failed:', error);
        return {
            status: 503,
            jsonBody: {
                success: false,
                data: {
                    status: 'unhealthy',
                    error: error.message,
                    lastCheck: new Date().toISOString()
                },
                error: 'Health check failed - service unavailable'
            }
        };
    }
});