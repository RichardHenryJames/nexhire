import { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { withAuth } from '../middleware';
import { successResponse } from '../utils/validation';

// Helper to verify admin access
const verifyAdmin = (user: any): HttpResponseInit | null => {
  if (user.userType?.toLowerCase() !== 'admin') {
    return {
      status: 403,
      jsonBody: { success: false, error: 'Access denied. Admin only.' }
    };
  }
  return null;
};

/**
 * Get Admin Dashboard - Overview Stats (Quick stats for initial load)
 */
export const getAdminDashboardOverview = withAuth(async (
  req: HttpRequest,
  context: InvocationContext,
  user
): Promise<HttpResponseInit> => {
  try {
    const adminCheck = verifyAdmin(user);
    if (adminCheck) return adminCheck;

    const { dbService } = await import('../services/database.service');

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoStr = weekAgo.toISOString().split('T')[0];
    const monthAgo = new Date(today);
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    const monthAgoStr = monthAgo.toISOString().split('T')[0];

    // Optimized queries - run in parallel but with lightweight counts
    const [userStats, referralStats, jobStats, walletStats, verifiedReferrers] = await Promise.all([
      // Users query - optimized
      dbService.executeQuery(`
        SELECT 
          COUNT(*) AS TotalUsers,
          SUM(CASE WHEN CAST(CreatedAt AS DATE) = @param0 THEN 1 ELSE 0 END) AS UsersToday,
          SUM(CASE WHEN CAST(CreatedAt AS DATE) >= @param1 THEN 1 ELSE 0 END) AS UsersThisWeek,
          SUM(CASE WHEN CAST(CreatedAt AS DATE) >= @param2 THEN 1 ELSE 0 END) AS UsersThisMonth,
          SUM(CASE WHEN UserType = 'JobSeeker' THEN 1 ELSE 0 END) AS TotalJobSeekers,
          SUM(CASE WHEN UserType = 'Employer' THEN 1 ELSE 0 END) AS TotalEmployers,
          SUM(CASE WHEN IsActive = 1 THEN 1 ELSE 0 END) AS ActiveUsers,
          SUM(CASE WHEN IsVerifiedReferrer = 1 THEN 1 ELSE 0 END) AS VerifiedReferrers
        FROM Users WHERE UserType != 'Admin'
      `, [todayStr, weekAgoStr, monthAgoStr]),
      
      // Referrals - small table, fine as is
      dbService.executeQuery(`
        SELECT 
          COUNT(*) AS TotalRequests,
          SUM(CASE WHEN CAST(RequestedAt AS DATE) = @param0 THEN 1 ELSE 0 END) AS RequestsToday,
          SUM(CASE WHEN Status = 'Pending' THEN 1 ELSE 0 END) AS PendingRequests,
          SUM(CASE WHEN Status = 'Completed' THEN 1 ELSE 0 END) AS CompletedRequests
        FROM ReferralRequests
      `, [todayStr]),
      
      // Jobs - optimized counts
      dbService.executeQuery(`
        SELECT 
          (SELECT COUNT(*) FROM Jobs) AS TotalJobs,
          (SELECT COUNT(*) FROM Jobs WHERE CAST(CreatedAt AS DATE) = @param0) AS JobsToday,
          (SELECT COUNT(*) FROM Jobs WHERE Status = 'Active') AS ActiveJobs,
          (SELECT COUNT(*) FROM Jobs WHERE ExternalJobID IS NOT NULL AND CAST(CreatedAt AS DATE) >= @param1) AS RecentExternalJobs
      `, [todayStr, weekAgoStr]),
      
      // Wallets - simple aggregate
      dbService.executeQuery(`
        SELECT ISNULL(SUM(Balance), 0) AS TotalWalletBalance, COUNT(*) AS TotalWallets
        FROM Wallets WHERE Status = 'Active'
      `, []),
      
      // Top 10 verified referrers
      dbService.executeQuery(`
        SELECT TOP 10 u.UserID, u.FirstName, u.LastName, u.Email, u.ProfilePictureURL, 
          u.CreatedAt, a.CurrentCompanyName AS CompanyName,
          (SELECT COUNT(*) FROM ReferralRequests rr 
           WHERE rr.AssignedReferrerID = u.UserID AND rr.Status = 'Completed') AS ReferralsCompleted
        FROM Users u
        LEFT JOIN Applicants a ON u.UserID = a.UserID
        WHERE u.IsVerifiedReferrer = 1 AND u.UserType != 'Admin'
        ORDER BY (SELECT COUNT(*) FROM ReferralRequests rr 
                  WHERE rr.AssignedReferrerID = u.UserID AND rr.Status = 'Completed') DESC, 
                 u.CreatedAt ASC
      `, [])
    ]);

    return {
      status: 200,
      jsonBody: successResponse({
        userStats: userStats.recordset[0] || {},
        referralStats: referralStats.recordset[0] || {},
        jobStats: jobStats.recordset[0] || {},
        walletStats: walletStats.recordset[0] || {},
        verifiedReferrers: verifiedReferrers.recordset || [],
        applicationStats: { TotalApplications: 0, ApplicationsToday: 0 },
        messageStats: { TotalConversations: 0, TotalMessages: 0 }
      }, 'Overview stats loaded')
    };
  } catch (error) {
    console.error('Error in getAdminDashboardOverview:', error);
    return { status: 500, jsonBody: { success: false, error: 'Failed to load overview stats' } };
  }
});

/**
 * Get Admin Dashboard - Users Tab Data
 */
export const getAdminDashboardUsers = withAuth(async (
  req: HttpRequest,
  context: InvocationContext,
  user
): Promise<HttpResponseInit> => {
  try {
    const adminCheck = verifyAdmin(user);
    if (adminCheck) return adminCheck;

    const { dbService } = await import('../services/database.service');

    const [recentUsers, dailySignups] = await Promise.all([
      dbService.executeQuery(`
        SELECT TOP 20
          u.UserID, u.FirstName, u.LastName, u.Email, u.UserType,
          u.IsActive, u.EmailVerified, u.CreatedAt, u.LastLoginAt, u.ProfilePictureURL
        FROM Users u WHERE u.UserType != 'Admin' ORDER BY u.CreatedAt DESC
      `, []),
      dbService.executeQuery(`
        SELECT 
          CAST(CreatedAt AS DATE) AS Date, COUNT(*) AS Count,
          SUM(CASE WHEN UserType = 'JobSeeker' THEN 1 ELSE 0 END) AS JobSeekers,
          SUM(CASE WHEN UserType = 'Employer' THEN 1 ELSE 0 END) AS Employers
        FROM Users WHERE CreatedAt >= DATEADD(day, -30, GETDATE()) AND UserType != 'Admin'
        GROUP BY CAST(CreatedAt AS DATE) ORDER BY Date DESC
      `, [])
    ]);

    return {
      status: 200,
      jsonBody: successResponse({
        recentUsers: recentUsers.recordset || [],
        dailySignups: dailySignups.recordset || []
      }, 'Users data loaded')
    };
  } catch (error) {
    console.error('Error in getAdminDashboardUsers:', error);
    return { status: 500, jsonBody: { success: false, error: 'Failed to load users data' } };
  }
});

/**
 * Get Admin Dashboard - Referrals Tab Data
 */
export const getAdminDashboardReferrals = withAuth(async (
  req: HttpRequest,
  context: InvocationContext,
  user
): Promise<HttpResponseInit> => {
  try {
    const adminCheck = verifyAdmin(user);
    if (adminCheck) return adminCheck;

    const { dbService } = await import('../services/database.service');

    const today = new Date().toISOString().split('T')[0];
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoStr = weekAgo.toISOString().split('T')[0];
    const monthAgo = new Date();
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    const monthAgoStr = monthAgo.toISOString().split('T')[0];

    const [referralStats, recentReferrals, dailyReferrals, topOrgs] = await Promise.all([
      dbService.executeQuery(`
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
      `, [today, weekAgoStr, monthAgoStr]),
      dbService.executeQuery(`
        SELECT TOP 20
          rr.RequestID, rr.JobTitle, o.Name AS CompanyName, rr.Status,
          rr.RequestedAt, rr.ReferredAt,
          u.FirstName + ' ' + u.LastName AS RequesterName, u.Email AS RequesterEmail,
          ref.FirstName + ' ' + ref.LastName AS ReferrerName
        FROM ReferralRequests rr
        JOIN Applicants a ON rr.ApplicantID = a.ApplicantID
        JOIN Users u ON a.UserID = u.UserID
        LEFT JOIN Users ref ON rr.AssignedReferrerID = ref.UserID
        LEFT JOIN Organizations o ON rr.OrganizationID = o.OrganizationID
        ORDER BY rr.RequestedAt DESC
      `, []),
      dbService.executeQuery(`
        SELECT CAST(RequestedAt AS DATE) AS Date, COUNT(*) AS Count,
          SUM(CASE WHEN Status = 'Completed' THEN 1 ELSE 0 END) AS Completed,
          SUM(CASE WHEN Status = 'Pending' THEN 1 ELSE 0 END) AS Pending
        FROM ReferralRequests WHERE RequestedAt >= DATEADD(day, -30, GETDATE())
        GROUP BY CAST(RequestedAt AS DATE) ORDER BY Date DESC
      `, []),
      dbService.executeQuery(`
        SELECT TOP 10
          o.OrganizationID, o.Name AS OrganizationName, o.LogoURL,
          (SELECT COUNT(*) FROM Jobs j WHERE j.OrganizationID = o.OrganizationID) AS JobCount,
          (SELECT COUNT(*) FROM ReferralRequests rr WHERE rr.OrganizationID = o.OrganizationID) AS ReferralCount
        FROM Organizations o
        ORDER BY (SELECT COUNT(*) FROM Jobs j WHERE j.OrganizationID = o.OrganizationID) DESC
      `, [])
    ]);

    return {
      status: 200,
      jsonBody: successResponse({
        referralStats: referralStats.recordset[0] || {},
        recentReferrals: recentReferrals.recordset || [],
        dailyReferrals: dailyReferrals.recordset || [],
        topOrganizations: topOrgs.recordset || []
      }, 'Referrals data loaded')
    };
  } catch (error) {
    console.error('Error in getAdminDashboardReferrals:', error);
    return { status: 500, jsonBody: { success: false, error: 'Failed to load referrals data' } };
  }
});

/**
 * Get Admin Dashboard - Transactions Tab Data
 */
export const getAdminDashboardTransactions = withAuth(async (
  req: HttpRequest,
  context: InvocationContext,
  user
): Promise<HttpResponseInit> => {
  try {
    const adminCheck = verifyAdmin(user);
    if (adminCheck) return adminCheck;

    const { dbService } = await import('../services/database.service');

    const [walletStats, recentTransactions] = await Promise.all([
      dbService.executeQuery(`
        SELECT 
          ISNULL(SUM(Balance), 0) AS TotalWalletBalance,
          COUNT(*) AS TotalWallets,
          (SELECT ISNULL(SUM(Amount), 0) FROM WalletTransactions WHERE TransactionType = 'Credit') AS TotalCredits,
          (SELECT ISNULL(SUM(Amount), 0) FROM WalletTransactions WHERE TransactionType = 'Debit') AS TotalDebits
        FROM Wallets WHERE Status = 'Active'
      `, []),
      dbService.executeQuery(`
        SELECT TOP 30
          wt.TransactionID, wt.TransactionType, wt.Amount, wt.Source,
          wt.Description, wt.Status, wt.CreatedAt,
          u.FirstName + ' ' + u.LastName AS UserName, u.Email
        FROM WalletTransactions wt
        JOIN Wallets w ON wt.WalletID = w.WalletID
        JOIN Users u ON w.UserID = u.UserID
        ORDER BY wt.CreatedAt DESC
      `, [])
    ]);

    return {
      status: 200,
      jsonBody: successResponse({
        walletStats: walletStats.recordset[0] || {},
        recentTransactions: recentTransactions.recordset || []
      }, 'Transactions data loaded')
    };
  } catch (error) {
    console.error('Error in getAdminDashboardTransactions:', error);
    return { status: 500, jsonBody: { success: false, error: 'Failed to load transactions data' } };
  }
});
