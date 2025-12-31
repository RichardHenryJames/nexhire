import { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { withAuth } from '../middleware';
import { successResponse } from '../utils/validation';

/**
 * Get Admin Dashboard Statistics
 * Only accessible by Admin users
 */
export const getAdminDashboard = withAuth(async (
  req: HttpRequest,
  context: InvocationContext,
  user
): Promise<HttpResponseInit> => {
  try {
    // Verify admin access
    if (user.userType?.toLowerCase() !== 'admin') {
      return {
        status: 403,
        jsonBody: { success: false, error: 'Access denied. Admin only.' }
      };
    }

    const { dbService } = await import('../services/database.service');

    // Get date ranges
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoStr = weekAgo.toISOString().split('T')[0];
    
    const monthAgo = new Date(today);
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    const monthAgoStr = monthAgo.toISOString().split('T')[0];

    // 1. User Statistics
    const userStatsQuery = `
      SELECT 
        COUNT(*) AS TotalUsers,
        SUM(CASE WHEN CAST(CreatedAt AS DATE) = @param0 THEN 1 ELSE 0 END) AS UsersToday,
        SUM(CASE WHEN CAST(CreatedAt AS DATE) >= @param1 THEN 1 ELSE 0 END) AS UsersThisWeek,
        SUM(CASE WHEN CAST(CreatedAt AS DATE) >= @param2 THEN 1 ELSE 0 END) AS UsersThisMonth,
        SUM(CASE WHEN UserType = 'JobSeeker' THEN 1 ELSE 0 END) AS TotalJobSeekers,
        SUM(CASE WHEN UserType = 'Employer' THEN 1 ELSE 0 END) AS TotalEmployers,
        SUM(CASE WHEN IsActive = 1 THEN 1 ELSE 0 END) AS ActiveUsers,
        SUM(CASE WHEN EmailVerified = 1 THEN 1 ELSE 0 END) AS VerifiedUsers
      FROM Users
      WHERE UserType != 'Admin'
    `;

    // 2. Referral Request Statistics
    const referralStatsQuery = `
      SELECT 
        COUNT(*) AS TotalRequests,
        SUM(CASE WHEN CAST(RequestedAt AS DATE) = @param0 THEN 1 ELSE 0 END) AS RequestsToday,
        SUM(CASE WHEN CAST(RequestedAt AS DATE) >= @param1 THEN 1 ELSE 0 END) AS RequestsThisWeek,
        SUM(CASE WHEN CAST(RequestedAt AS DATE) >= @param2 THEN 1 ELSE 0 END) AS RequestsThisMonth,
        SUM(CASE WHEN Status = 'Pending' THEN 1 ELSE 0 END) AS PendingRequests,
        SUM(CASE WHEN Status = 'Claimed' THEN 1 ELSE 0 END) AS ClaimedRequests,
        SUM(CASE WHEN Status = 'Completed' THEN 1 ELSE 0 END) AS CompletedRequests,
        SUM(CASE WHEN Status = 'Cancelled' THEN 1 ELSE 0 END) AS CancelledRequests
      FROM ReferralRequests
    `;

    // 3. Daily user signups for last 30 days
    const dailySignupsQuery = `
      SELECT 
        CAST(CreatedAt AS DATE) AS Date,
        COUNT(*) AS Count,
        SUM(CASE WHEN UserType = 'JobSeeker' THEN 1 ELSE 0 END) AS JobSeekers,
        SUM(CASE WHEN UserType = 'Employer' THEN 1 ELSE 0 END) AS Employers
      FROM Users
      WHERE CreatedAt >= DATEADD(day, -30, GETDATE())
        AND UserType != 'Admin'
      GROUP BY CAST(CreatedAt AS DATE)
      ORDER BY Date DESC
    `;

    // 4. Daily referral requests for last 30 days
    const dailyReferralsQuery = `
      SELECT 
        CAST(RequestedAt AS DATE) AS Date,
        COUNT(*) AS Count,
        SUM(CASE WHEN Status = 'Completed' THEN 1 ELSE 0 END) AS Completed,
        SUM(CASE WHEN Status = 'Pending' THEN 1 ELSE 0 END) AS Pending
      FROM ReferralRequests
      WHERE RequestedAt >= DATEADD(day, -30, GETDATE())
      GROUP BY CAST(RequestedAt AS DATE)
      ORDER BY Date DESC
    `;

    // 5. Job Statistics
    const jobStatsQuery = `
      SELECT 
        COUNT(*) AS TotalJobs,
        SUM(CASE WHEN CAST(CreatedAt AS DATE) = @param0 THEN 1 ELSE 0 END) AS JobsToday,
        SUM(CASE WHEN CAST(CreatedAt AS DATE) >= @param1 THEN 1 ELSE 0 END) AS JobsThisWeek,
        SUM(CASE WHEN CAST(CreatedAt AS DATE) >= @param2 THEN 1 ELSE 0 END) AS JobsThisMonth,
        SUM(CASE WHEN Status = 'Active' THEN 1 ELSE 0 END) AS ActiveJobs,
        SUM(CASE WHEN ExternalJobID IS NOT NULL THEN 1 ELSE 0 END) AS ExternalJobs
      FROM Jobs
    `;

    // 6. Wallet/Revenue Statistics
    const walletStatsQuery = `
      SELECT 
        ISNULL(SUM(Balance), 0) AS TotalWalletBalance,
        COUNT(*) AS TotalWallets
      FROM Wallets
      WHERE Status = 'Active'
    `;

    // 7. Recent Wallet Transactions
    const recentTransactionsQuery = `
      SELECT TOP 10
        wt.TransactionID,
        wt.TransactionType,
        wt.Amount,
        wt.Source,
        wt.Description,
        wt.Status,
        wt.CreatedAt,
        u.FirstName + ' ' + u.LastName AS UserName,
        u.Email
      FROM WalletTransactions wt
      JOIN Wallets w ON wt.WalletID = w.WalletID
      JOIN Users u ON w.UserID = u.UserID
      ORDER BY wt.CreatedAt DESC
    `;

    // 8. Recent Users
    const recentUsersQuery = `
      SELECT TOP 20
        u.UserID,
        u.FirstName,
        u.LastName,
        u.Email,
        u.UserType,
        u.IsActive,
        u.EmailVerified,
        u.CreatedAt,
        u.LastLoginAt,
        u.ProfilePictureURL
      FROM Users u
      WHERE u.UserType != 'Admin'
      ORDER BY u.CreatedAt DESC
    `;

    // 9. Recent Referral Requests
    const recentReferralsQuery = `
      SELECT TOP 20
        rr.RequestID,
        rr.JobTitle,
        o.Name AS CompanyName,
        rr.Status,
        rr.RequestedAt,
        rr.ReferredAt,
        u.FirstName + ' ' + u.LastName AS RequesterName,
        u.Email AS RequesterEmail,
        ref.FirstName + ' ' + ref.LastName AS ReferrerName
      FROM ReferralRequests rr
      JOIN Users u ON rr.ApplicantID = u.UserID
      LEFT JOIN Users ref ON rr.AssignedReferrerID = ref.UserID
      LEFT JOIN Organizations o ON rr.OrganizationID = o.OrganizationID
      ORDER BY rr.RequestedAt DESC
    `;

    // 10. Top Organizations by Jobs (optimized with subqueries)
    const topOrgsQuery = `
      SELECT TOP 10
        o.OrganizationID,
        o.Name AS OrganizationName,
        o.LogoURL,
        (SELECT COUNT(*) FROM Jobs j WHERE j.OrganizationID = o.OrganizationID) AS JobCount,
        (SELECT COUNT(*) FROM ReferralRequests rr WHERE rr.OrganizationID = o.OrganizationID) AS ReferralCount
      FROM Organizations o
      ORDER BY (SELECT COUNT(*) FROM Jobs j WHERE j.OrganizationID = o.OrganizationID) DESC
    `;

    // 11. Application Statistics
    const appStatsQuery = `
      SELECT 
        COUNT(*) AS TotalApplications,
        SUM(CASE WHEN CAST(SubmittedAt AS DATE) = @param0 THEN 1 ELSE 0 END) AS ApplicationsToday,
        SUM(CASE WHEN CAST(SubmittedAt AS DATE) >= @param1 THEN 1 ELSE 0 END) AS ApplicationsThisWeek,
        SUM(CASE WHEN StatusID = 1 THEN 1 ELSE 0 END) AS Submitted,
        SUM(CASE WHEN StatusID = 2 THEN 1 ELSE 0 END) AS Shortlisted,
        SUM(CASE WHEN StatusID = 5 THEN 1 ELSE 0 END) AS OfferAccepted
      FROM JobApplications
    `;

    // 12. Message Statistics
    const messageStatsQuery = `
      SELECT 
        COUNT(DISTINCT c.ConversationID) AS TotalConversations,
        COUNT(m.MessageID) AS TotalMessages,
        SUM(CASE WHEN CAST(m.CreatedAt AS DATE) = @param0 THEN 1 ELSE 0 END) AS MessagesToday
      FROM Conversations c
      LEFT JOIN Messages m ON c.ConversationID = m.ConversationID
    `;

    // Execute all queries in parallel
    const [
      userStats,
      referralStats,
      dailySignups,
      dailyReferrals,
      jobStats,
      walletStats,
      recentTransactions,
      recentUsers,
      recentReferrals,
      topOrgs,
      appStats,
      messageStats
    ] = await Promise.all([
      dbService.executeQuery(userStatsQuery, [todayStr, weekAgoStr, monthAgoStr]),
      dbService.executeQuery(referralStatsQuery, [todayStr, weekAgoStr, monthAgoStr]),
      dbService.executeQuery(dailySignupsQuery, []),
      dbService.executeQuery(dailyReferralsQuery, []),
      dbService.executeQuery(jobStatsQuery, [todayStr, weekAgoStr, monthAgoStr]),
      dbService.executeQuery(walletStatsQuery, []),
      dbService.executeQuery(recentTransactionsQuery, []),
      dbService.executeQuery(recentUsersQuery, []),
      dbService.executeQuery(recentReferralsQuery, []),
      dbService.executeQuery(topOrgsQuery, []),
      dbService.executeQuery(appStatsQuery, [todayStr, weekAgoStr]),
      dbService.executeQuery(messageStatsQuery, [todayStr])
    ]);

    return {
      status: 200,
      jsonBody: successResponse({
        userStats: userStats.recordset[0] || {},
        referralStats: referralStats.recordset[0] || {},
        dailySignups: dailySignups.recordset || [],
        dailyReferrals: dailyReferrals.recordset || [],
        jobStats: jobStats.recordset[0] || {},
        walletStats: walletStats.recordset[0] || {},
        recentTransactions: recentTransactions.recordset || [],
        recentUsers: recentUsers.recordset || [],
        recentReferrals: recentReferrals.recordset || [],
        topOrganizations: topOrgs.recordset || [],
        applicationStats: appStats.recordset[0] || {},
        messageStats: messageStats.recordset[0] || {}
      }, 'Admin dashboard data retrieved successfully')
    };
  } catch (error) {
    console.error('Error in getAdminDashboard:', error);
    return {
      status: 500,
      jsonBody: { success: false, error: 'Failed to get admin dashboard data' }
    };
  }
});
