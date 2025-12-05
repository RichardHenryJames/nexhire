/**
 * Job Archive Service
 * Handles archiving old jobs to Azure Blob Storage
 */

import { BlobServiceClient, ContainerClient } from '@azure/storage-blob';
import { dbService } from './database.service';

export class JobArchiveService {
    private static containerName = 'archived-jobs';
    private static blobServiceClient: BlobServiceClient;
    private static containerClient: ContainerClient;

    /**
     * Initialize Azure Blob Storage connection
     */
    private static getStorageClient(): BlobServiceClient {
        if (!this.blobServiceClient) {
            const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
            if (!connectionString) {
                throw new Error('AZURE_STORAGE_CONNECTION_STRING environment variable is required');
            }
            this.blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
        }
        return this.blobServiceClient;
    }

    /**
     * Sanitize metadata value for Azure Blob Storage
     * Removes invalid characters but preserves full length
     */
    private static sanitizeMetadata(value: string): string {
        if (!value) return 'unknown';
        return value
            .replace(/[\r\n\t]/g, ' ')           // Remove newlines, tabs
            .replace(/[^\x20-\x7E]/g, '')        // Remove non-printable ASCII
            .trim() || 'unknown';
    }

    /**
     * Get container client for archived jobs
     */
    private static async getContainerClient(): Promise<ContainerClient> {
        if (!this.containerClient) {
            const blobServiceClient = this.getStorageClient();
            this.containerClient = blobServiceClient.getContainerClient(this.containerName);
            
            // Ensure container exists (blob access is private by default)
            await this.containerClient.createIfNotExists();
        }
        return this.containerClient;
    }

    /**
     * Archive jobs older than specified days
     * @param daysOld - Number of days old to archive (default: 90)
     * @param batchSize - Maximum number of jobs to archive per batch (default: 100)
     * @returns Archive operation result
     */
    static async archiveOldJobs(daysOld: number = 90, batchSize: number = 100): Promise<{
        success: boolean;
        totalJobsFound: number;
        totalJobsArchived: number;
        totalJobsDeleted: number;
        errors: string[];
        archivedJobIds: string[];
    }> {
        const startTime = Date.now();
        const errors: string[] = [];
        const allArchivedJobIds: string[] = [];
        let totalJobsArchived = 0;
        let totalJobsDeleted = 0;
        let batchNumber = 0;

        try {
            console.log(`[Archive Service] Starting archival for jobs older than ${daysOld} days (batch size: ${batchSize})...`);

            // LOOP: Process batches until no more old jobs remain
            let hasMoreJobs = true;
            while (hasMoreJobs) {
                batchNumber++;
                console.log(`[Archive Service] === Processing Batch ${batchNumber} ===`);

                // Get jobs in batches with TOP clause
                const getOldJobsQuery = `
                    SELECT TOP (@param1)
                        j.JobID,
                        j.OrganizationID,
                        j.Title,
                        j.Description,
                        j.Responsibilities,
                        j.BenefitsOffered,
                        j.JobTypeID,
                        j.WorkplaceTypeID,
                        j.Location,
                        j.City,
                        j.State,
                        j.Country,
                        j.PostalCode,
                        j.SalaryRangeMin,
                        j.SalaryRangeMax,
                        j.CurrencyID,
                        j.SalaryPeriod,
                        j.ExperienceMin,
                        j.ExperienceMax,
                        j.Status,
                        j.PostedByType,
                        j.PostedByUserID,
                        j.ExternalJobID,
                        j.ApplicationDeadline,
                        j.CreatedAt,
                        j.UpdatedAt,
                        j.PublishedAt,
                        j.IsRemote,
                        j.Department,
                        j.Tags,
                        o.Name AS OrganizationName,
                        o.Industry,
                        o.LogoURL
                    FROM Jobs j WITH (NOLOCK)
                    LEFT JOIN Organizations o WITH (NOLOCK) ON j.OrganizationID = o.OrganizationID
                    WHERE j.CreatedAt < DATEADD(day, -@param0, GETUTCDATE())
                    ORDER BY j.CreatedAt ASC
                `;

                const oldJobs = await dbService.executeQuery(getOldJobsQuery, [daysOld, batchSize]);
                const batchJobsFound = oldJobs.recordset?.length || 0;

                if (batchJobsFound === 0) {
                    console.log(`[Archive Service] Batch ${batchNumber}: No more jobs found to archive.`);
                    hasMoreJobs = false;
                    break;
                }

                console.log(`[Archive Service] Batch ${batchNumber}: Found ${batchJobsFound} jobs to archive`);

                // Get container client
                const containerClient = await this.getContainerClient();

                const batchArchivedIds: string[] = [];
                let batchArchivedCount = 0;

                // Archive each job
                for (const job of oldJobs.recordset || []) {
                    try {
                        const jobId = job.JobID;
                        const blobName = `${jobId}.json`;
                        const blockBlobClient = containerClient.getBlockBlobClient(blobName);

                        // Prepare job data for archival
                        const jobData = {
                            ...job,
                            archivedAt: new Date().toISOString(),
                            archivedFromTable: 'Jobs',
                            archivalReason: `Job older than ${daysOld} days`
                        };

                        // Upload to blob storage
                        const jsonData = JSON.stringify(jobData, null, 2);
                        await blockBlobClient.upload(jsonData, Buffer.byteLength(jsonData), {
                            blobHTTPHeaders: {
                                blobContentType: 'application/json'
                            },
                            metadata: {
                                jobId: this.sanitizeMetadata(jobId),
                                title: this.sanitizeMetadata(job.Title || 'Unknown'),
                                archivedAt: new Date().toISOString(),
                                organizationId: this.sanitizeMetadata(job.OrganizationID?.toString() || 'unknown'),
                                status: this.sanitizeMetadata(job.Status || 'Unknown')
                            }
                        });

                        batchArchivedIds.push(jobId);
                        batchArchivedCount++;

                    } catch (archiveError: any) {
                        const errorMsg = `Batch ${batchNumber}: Failed to archive job ${job.JobID}: ${archiveError.message}`;
                        console.error(`[Archive Service] ${errorMsg}`);
                        errors.push(errorMsg);
                    }
                }

                console.log(`[Archive Service] Batch ${batchNumber}: Archived ${batchArchivedCount}/${batchJobsFound} jobs to blob storage`);

                // If all jobs in batch archived successfully, delete from SQL
                if (batchArchivedCount === batchJobsFound && batchArchivedIds.length > 0) {
                    try {
                        // SQL Server parameter limit is 2100, delete in chunks of 1000
                        const deleteChunkSize = 1000;
                        let batchDeletedCount = 0;

                        for (let i = 0; i < batchArchivedIds.length; i += deleteChunkSize) {
                            const chunk = batchArchivedIds.slice(i, i + deleteChunkSize);
                            const placeholders = chunk.map((_, index) => `@param${index}`).join(',');
                            const deleteQuery = `DELETE FROM Jobs WHERE JobID IN (${placeholders})`;

                            const deleteResult = await dbService.executeQuery(deleteQuery, chunk);
                            batchDeletedCount += deleteResult.rowsAffected?.[0] || 0;
                        }

                        totalJobsDeleted += batchDeletedCount;
                        console.log(`[Archive Service] Batch ${batchNumber}: Deleted ${batchDeletedCount} jobs from SQL`);

                        // Add to overall count
                        allArchivedJobIds.push(...batchArchivedIds);
                        totalJobsArchived += batchArchivedCount;

                    } catch (deleteError: any) {
                        const errorMsg = `Batch ${batchNumber}: Failed to delete: ${deleteError.message}`;
                        console.error(`[Archive Service] ${errorMsg}`);
                        errors.push(errorMsg);
                    }
                } else {
                    const errorMsg = `Batch ${batchNumber}: Not all jobs archived (${batchArchivedCount}/${batchJobsFound}). Skipping deletion.`;
                    console.warn(`[Archive Service] ${errorMsg}`);
                    errors.push(errorMsg);
                }

                // Continue to next batch if we got full batch size (means more might exist)
                hasMoreJobs = (batchJobsFound === batchSize);
            }

            const duration = Date.now() - startTime;
            console.log(`[Archive Service] ===== ARCHIVAL COMPLETE =====`);
            console.log(`[Archive Service] Total batches processed: ${batchNumber}`);
            console.log(`[Archive Service] Total jobs archived: ${totalJobsArchived}`);
            console.log(`[Archive Service] Total jobs deleted: ${totalJobsDeleted}`);
            console.log(`[Archive Service] Total time: ${Math.round(duration / 1000)}s`);

            return {
                success: errors.length === 0,
                totalJobsFound: totalJobsArchived,
                totalJobsArchived,
                totalJobsDeleted,
                errors,
                archivedJobIds: allArchivedJobIds
            };

        } catch (error: any) {
            console.error('[Archive Service] Fatal error during archival:', error);
            errors.push(`Fatal error: ${error.message}`);
            
            return {
                success: false,
                totalJobsFound: totalJobsArchived,
                totalJobsArchived,
                totalJobsDeleted,
                errors,
                archivedJobIds: allArchivedJobIds
            };
        }
    }

    /**
     * Retrieve archived job by ID from blob storage
     * @param jobId - Job ID to retrieve
     * @returns Archived job data or null if not found
     */
    static async getArchivedJob(jobId: string): Promise<any | null> {
        try {
            const containerClient = await this.getContainerClient();
            const blobName = `${jobId}.json`;
            const blockBlobClient = containerClient.getBlockBlobClient(blobName);

            // Check if blob exists
            const exists = await blockBlobClient.exists();
            if (!exists) {
                return null;
            }

            // Download blob
            const downloadResponse = await blockBlobClient.download();
            const downloaded = await this.streamToBuffer(downloadResponse.readableStreamBody!);
            const jobData = JSON.parse(downloaded.toString());

            return jobData;

        } catch (error: any) {
            console.error(`[Archive Service] Error retrieving archived job ${jobId}:`, error.message);
            return null;
        }
    }

    /**
     * Helper function to convert stream to buffer
     */
    private static async streamToBuffer(readableStream: NodeJS.ReadableStream): Promise<Buffer> {
        return new Promise((resolve, reject) => {
            const chunks: Buffer[] = [];
            readableStream.on('data', (data: Buffer) => {
                chunks.push(data instanceof Buffer ? data : Buffer.from(data));
            });
            readableStream.on('end', () => {
                resolve(Buffer.concat(chunks));
            });
            readableStream.on('error', reject);
        });
    }

    /**
     * Initialize archive logs table
     */
    static async initializeArchiveLogs(): Promise<void> {
        try {
            const createTableQuery = `
                IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='JobArchiveLogs' AND xtype='U')
                CREATE TABLE JobArchiveLogs (
                    LogID int IDENTITY(1,1) PRIMARY KEY,
                    RunID nvarchar(50) NOT NULL,
                    StartTime datetime2 NOT NULL,
                    EndTime datetime2 NOT NULL,
                    DaysOld int NOT NULL,
                    TotalJobsFound int NOT NULL DEFAULT 0,
                    TotalJobsArchived int NOT NULL DEFAULT 0,
                    TotalJobsDeleted int NOT NULL DEFAULT 0,
                    Success bit NOT NULL DEFAULT 0,
                    ErrorCount int NOT NULL DEFAULT 0,
                    Errors nvarchar(MAX),
                    ArchivedJobIDs nvarchar(MAX),
                    DurationSeconds int NOT NULL DEFAULT 0,
                    TriggerType nvarchar(50) NOT NULL DEFAULT 'Manual',
                    CreatedAt datetime2 DEFAULT GETUTCDATE()
                )
            `;

            await dbService.executeQuery(createTableQuery);
            console.log('[Archive Service] Archive logs table initialized successfully');

        } catch (error: any) {
            console.error('[Archive Service] Failed to initialize archive logs table:', error.message);
            throw error;
        }
    }

    /**
     * Log archive operation result
     */
    static async logArchiveOperation(
        result: {
            success: boolean;
            totalJobsFound: number;
            totalJobsArchived: number;
            totalJobsDeleted: number;
            errors: string[];
            archivedJobIds: string[];
        },
        runId: string,
        startTime: Date,
        endTime: Date,
        daysOld: number,
        triggerType: 'TimerTrigger' | 'Manual' = 'Manual'
    ): Promise<void> {
        try {
            const durationSeconds = Math.round((endTime.getTime() - startTime.getTime()) / 1000);

            const insertLogQuery = `
                INSERT INTO JobArchiveLogs (
                    RunID, StartTime, EndTime, DaysOld,
                    TotalJobsFound, TotalJobsArchived, TotalJobsDeleted,
                    Success, ErrorCount, Errors, ArchivedJobIDs,
                    DurationSeconds, TriggerType
                )
                VALUES (
                    @param0, @param1, @param2, @param3,
                    @param4, @param5, @param6,
                    @param7, @param8, @param9, @param10,
                    @param11, @param12
                )
            `;

            await dbService.executeQuery(insertLogQuery, [
                runId,
                startTime.toISOString(),
                endTime.toISOString(),
                daysOld,
                result.totalJobsFound,
                result.totalJobsArchived,
                result.totalJobsDeleted,
                result.success,
                result.errors.length,
                result.errors.join('; ').substring(0, 4000), // Limit error text
                result.archivedJobIds.join(',').substring(0, 4000), // Limit job IDs
                durationSeconds,
                triggerType
            ]);

            console.log(`[Archive Service] Logged archive operation: ${runId}`);

        } catch (error: any) {
            console.error('[Archive Service] Failed to log archive operation:', error.message);
            // Don't throw - logging failure shouldn't break archival
        }
    }

    /**
     * Get archive logs with pagination
     */
    static async getArchiveLogs(limit: number = 50, offset: number = 0): Promise<any[]> {
        try {
            const query = `
                SELECT 
                    LogID,
                    RunID,
                    StartTime,
                    EndTime,
                    DaysOld,
                    TotalJobsFound,
                    TotalJobsArchived,
                    TotalJobsDeleted,
                    Success,
                    ErrorCount,
                    Errors,
                    DurationSeconds,
                    TriggerType,
                    CreatedAt
                FROM JobArchiveLogs
                ORDER BY CreatedAt DESC
                OFFSET @param0 ROWS
                FETCH NEXT @param1 ROWS ONLY
            `;

            const result = await dbService.executeQuery(query, [offset, limit]);
            return result.recordset || [];

        } catch (error: any) {
            console.error('[Archive Service] Failed to get archive logs:', error.message);
            return [];
        }
    }

    /**
     * Get archive statistics
     */
    static async getArchiveStats(): Promise<any> {
        try {
            const statsQuery = `
                SELECT 
                    COUNT(*) as TotalRuns,
                    SUM(TotalJobsArchived) as TotalJobsArchived,
                    SUM(TotalJobsDeleted) as TotalJobsDeleted,
                    SUM(CASE WHEN Success = 1 THEN 1 ELSE 0 END) as SuccessfulRuns,
                    SUM(CASE WHEN Success = 0 THEN 1 ELSE 0 END) as FailedRuns,
                    AVG(DurationSeconds) as AvgDurationSeconds,
                    MAX(EndTime) as LastRunTime
                FROM JobArchiveLogs
            `;

            const result = await dbService.executeQuery(statsQuery);
            return result.recordset?.[0] || {};

        } catch (error: any) {
            console.error('[Archive Service] Failed to get archive stats:', error.message);
            return {};
        }
    }
}
