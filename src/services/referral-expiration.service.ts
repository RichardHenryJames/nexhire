/**
 * Referral Expiration Service
 * 
 * Handles automatic expiration of pending referral requests older than 14 days.
 * Releases wallet holds and marks requests as expired.
 */

import { dbService } from './database.service';
import { WalletService } from './wallet.service';

export interface ExpirationResult {
  success: boolean;
  totalPendingFound: number;
  totalExpired: number;
  totalHoldsReleased: number;
  totalAmountReleased: number;
  expiredRequestIds: string[];
  errors: string[];
}

export class ReferralExpirationService {

  /**
   * Find and expire pending referral requests older than specified days
   * @param daysOld - Number of days after which pending requests should expire (default: 14)
   * @param batchSize - Maximum number of requests to process per run (default: 100)
   */
  static async expirePendingRequests(daysOld: number = 14, batchSize: number = 100): Promise<ExpirationResult> {
    const result: ExpirationResult = {
      success: true,
      totalPendingFound: 0,
      totalExpired: 0,
      totalHoldsReleased: 0,
      totalAmountReleased: 0,
      expiredRequestIds: [],
      errors: []
    };

    try {
      console.log(`\n📋 Finding open referral requests older than ${daysOld} days...`);

      // Find open requests (Pending, NotifiedToReferrers, Viewed, Claimed) older than X days
      // These are requests where no one has completed the referral yet
      const findQuery = `
        SELECT TOP (@param0)
          rr.RequestID,
          rr.ApplicantID,
          rr.JobID,
          rr.Status,
          rr.RequestedAt,
          DATEDIFF(day, rr.RequestedAt, GETUTCDATE()) as DaysOld,
          a.UserID,
          u.Email,
          u.FirstName,
          u.LastName,
          CASE 
            WHEN rr.JobID IS NOT NULL THEN j.Title
            ELSE rr.JobTitle
          END as JobTitle,
          CASE 
            WHEN rr.JobID IS NOT NULL THEN o1.Name
            ELSE o2.Name
          END as CompanyName
        FROM ReferralRequests rr
        INNER JOIN Applicants a ON rr.ApplicantID = a.ApplicantID
        INNER JOIN Users u ON a.UserID = u.UserID
        LEFT JOIN Jobs j ON rr.JobID = j.JobID
        LEFT JOIN Organizations o1 ON j.OrganizationID = o1.OrganizationID
        LEFT JOIN Organizations o2 ON rr.OrganizationID = o2.OrganizationID
        WHERE rr.Status IN ('Pending', 'NotifiedToReferrers', 'Viewed', 'Claimed')
          AND DATEDIFF(day, rr.RequestedAt, GETUTCDATE()) >= @param1
        ORDER BY rr.RequestedAt ASC
      `;

      const pendingRequests = await dbService.executeQuery(findQuery, [batchSize, daysOld]);
      result.totalPendingFound = pendingRequests.recordset?.length || 0;

      console.log(`   Found ${result.totalPendingFound} open requests to expire`);

      if (result.totalPendingFound === 0) {
        console.log('   ✅ No open requests need expiration');
        return result;
      }

      // Process each request
      for (const request of pendingRequests.recordset) {
        try {
          console.log(`\n   Processing RequestID: ${request.RequestID}`);
          console.log(`      User: ${request.FirstName} ${request.LastName} (${request.Email})`);
          console.log(`      Job: ${request.JobTitle} at ${request.CompanyName}`);
          console.log(`      Days old: ${request.DaysOld}`);

          // 1. Update request status to 'Expired'
          await dbService.executeQuery(
            `UPDATE ReferralRequests 
             SET Status = 'Expired'
             WHERE RequestID = @param0`,
            [request.RequestID]
          );

          // 2. Release the wallet hold
          const releaseResult = await WalletService.releaseHold(request.RequestID);
          
          if (releaseResult.released) {
            result.totalHoldsReleased++;
            result.totalAmountReleased += releaseResult.amount;
            console.log(`      ✅ Hold released: ₹${releaseResult.amount}`);
          } else {
            console.log(`      ⚠️ No active hold found (may be older request)`);
          }

          // 3. Log the status change
          try {
            await this.logStatusChange(
              request.RequestID,
              'Expired',
              request.UserID,
              'Auto-expired after 14 days with no referral'
            );
          } catch (logErr) {
            console.warn(`      Warning: Could not log status change:`, logErr);
          }

          result.totalExpired++;
          result.expiredRequestIds.push(request.RequestID);
          console.log(`      ✅ Request expired successfully`);

        } catch (requestError: any) {
          console.error(`      ❌ Error processing request ${request.RequestID}:`, requestError.message);
          result.errors.push(`Request ${request.RequestID}: ${requestError.message}`);
        }
      }

      // Update referrer stats for affected jobs
      try {
        const affectedJobIds: string[] = [...new Set(pendingRequests.recordset.map((r: any) => r.JobID).filter(Boolean))] as string[];
        for (const jobId of affectedJobIds) {
          await this.updateReferrerStatsAfterExpiration(jobId);
        }
      } catch (statsErr) {
        console.warn('Non-critical: Could not update referrer stats:', statsErr);
      }

      result.success = result.errors.length === 0;
      
      console.log(`\n📊 Expiration Summary:`);
      console.log(`   Total Expired: ${result.totalExpired}/${result.totalPendingFound}`);
      console.log(`   Holds Released: ${result.totalHoldsReleased}`);
      console.log(`   Amount Released: ₹${result.totalAmountReleased}`);
      if (result.errors.length > 0) {
        console.log(`   Errors: ${result.errors.length}`);
      }

      return result;

    } catch (error: any) {
      console.error('Error in expirePendingRequests:', error);
      result.success = false;
      result.errors.push(`Fatal error: ${error.message}`);
      return result;
    }
  }

  /**
   * Log status change to ReferralStatusHistory table
   */
  private static async logStatusChange(
    requestId: string,
    newStatus: string,
    userId: string,
    reason: string
  ): Promise<void> {
    try {
      const query = `
        INSERT INTO ReferralStatusHistory (
          RequestID, Status, ChangedByUserID, ChangedByRole, ChangedByName, Reason, CreatedAt
        ) VALUES (
          @param0, @param1, @param2, 'system', 'Automated Expiration', @param3, GETUTCDATE()
        )
      `;
      await dbService.executeQuery(query, [requestId, newStatus, userId, reason]);
    } catch (error) {
      console.warn('Could not log status change:', error);
    }
  }

  /**
   * Update referrer stats after expiration (decrease pending counts)
   */
  private static async updateReferrerStatsAfterExpiration(jobId: string): Promise<void> {
    try {
      const query = `
        UPDATE rs
        SET rs.PendingCount = CASE WHEN rs.PendingCount > 0 THEN rs.PendingCount - 1 ELSE 0 END,
            rs.UpdatedAt = GETUTCDATE()
        FROM ReferrerStats rs
        INNER JOIN Jobs j ON rs.OrganizationID = j.OrganizationID
        WHERE j.JobID = @param0
          AND rs.PendingCount > 0
      `;
      await dbService.executeQuery(query, [jobId]);
    } catch (error) {
      console.warn('Could not update referrer stats:', error);
    }
  }

  /**
   * Log expiration run to database for monitoring
   */
  static async logExpirationRun(
    executionId: string,
    startTime: Date,
    endTime: Date,
    result: ExpirationResult,
    triggerType: string
  ): Promise<void> {
    try {
      // First check if table exists, create if not
      await this.initializeExpirationLogs();

      const query = `
        INSERT INTO ReferralExpirationLogs (
          ExecutionID, StartTime, EndTime, TriggerType,
          TotalPendingFound, TotalExpired, TotalHoldsReleased, TotalAmountReleased,
          Success, ErrorCount, Errors, CreatedAt
        ) VALUES (
          @param0, @param1, @param2, @param3,
          @param4, @param5, @param6, @param7,
          @param8, @param9, @param10, GETUTCDATE()
        )
      `;

      await dbService.executeQuery(query, [
        executionId,
        startTime,
        endTime,
        triggerType,
        result.totalPendingFound,
        result.totalExpired,
        result.totalHoldsReleased,
        result.totalAmountReleased,
        result.success ? 1 : 0,
        result.errors.length,
        JSON.stringify(result.errors.slice(0, 10)) // Limit errors stored
      ]);

      console.log('Expiration run logged to database');
    } catch (error) {
      console.warn('Could not log expiration run:', error);
    }
  }

  /**
   * Initialize expiration logs table if it doesn't exist
   */
  static async initializeExpirationLogs(): Promise<void> {
    try {
      const createTableQuery = `
        IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='ReferralExpirationLogs' AND xtype='U')
        BEGIN
          CREATE TABLE ReferralExpirationLogs (
            LogID INT IDENTITY(1,1) PRIMARY KEY,
            ExecutionID NVARCHAR(100) NOT NULL,
            StartTime DATETIME2 NOT NULL,
            EndTime DATETIME2 NOT NULL,
            TriggerType NVARCHAR(50) NOT NULL,
            TotalPendingFound INT NOT NULL DEFAULT 0,
            TotalExpired INT NOT NULL DEFAULT 0,
            TotalHoldsReleased INT NOT NULL DEFAULT 0,
            TotalAmountReleased DECIMAL(18,2) NOT NULL DEFAULT 0,
            Success BIT NOT NULL DEFAULT 1,
            ErrorCount INT NOT NULL DEFAULT 0,
            Errors NVARCHAR(MAX),
            CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE()
          );
          
          CREATE INDEX IX_ReferralExpirationLogs_ExecutionID ON ReferralExpirationLogs(ExecutionID);
          CREATE INDEX IX_ReferralExpirationLogs_CreatedAt ON ReferralExpirationLogs(CreatedAt);
        END
      `;
      
      await dbService.executeQuery(createTableQuery, []);
    } catch (error) {
      console.warn('Could not initialize expiration logs table:', error);
    }
  }

  /**
   * Get expiration statistics for monitoring
   */
  static async getExpirationStats(days: number = 30): Promise<any> {
    try {
      const query = `
        SELECT 
          COUNT(*) as TotalRuns,
          SUM(TotalExpired) as TotalExpired,
          SUM(TotalHoldsReleased) as TotalHoldsReleased,
          SUM(TotalAmountReleased) as TotalAmountReleased,
          SUM(CASE WHEN Success = 1 THEN 1 ELSE 0 END) as SuccessfulRuns,
          SUM(CASE WHEN Success = 0 THEN 1 ELSE 0 END) as FailedRuns
        FROM ReferralExpirationLogs
        WHERE CreatedAt >= DATEADD(day, -@param0, GETUTCDATE())
      `;
      
      const result = await dbService.executeQuery(query, [days]);
      return result.recordset?.[0] || {};
    } catch (error) {
      console.error('Error getting expiration stats:', error);
      return {};
    }
  }
}
