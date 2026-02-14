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
    const [userStats, referralStats, jobStats, walletStats, verifiedReferrers, applicationStats, messageStats] = await Promise.all([
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
      `, []),
      
      // Applications stats
      dbService.executeQuery(`
        SELECT 
          COUNT(*) AS TotalApplications,
          SUM(CASE WHEN CAST(SubmittedAt AS DATE) = @param0 THEN 1 ELSE 0 END) AS ApplicationsToday,
          SUM(CASE WHEN CAST(SubmittedAt AS DATE) >= @param1 THEN 1 ELSE 0 END) AS ApplicationsThisWeek
        FROM JobApplications
      `, [todayStr, weekAgoStr]),
      
      // Message stats
      dbService.executeQuery(`
        SELECT 
          (SELECT COUNT(*) FROM Conversations) AS TotalConversations,
          (SELECT COUNT(*) FROM Messages) AS TotalMessages,
          (SELECT COUNT(*) FROM Messages WHERE CAST(CreatedAt AS DATE) = @param0) AS MessagesToday,
          (SELECT COUNT(*) FROM UserProfileViews) AS TotalProfileViews,
          (SELECT COUNT(*) FROM UserProfileViews WHERE CAST(ViewedAt AS DATE) = @param0) AS ProfileViewsToday
        FROM (SELECT 1 AS dummy) d
      `, [todayStr])
    ]);

    return {
      status: 200,
      jsonBody: successResponse({
        userStats: userStats.recordset[0] || {},
        referralStats: referralStats.recordset[0] || {},
        jobStats: jobStats.recordset[0] || {},
        walletStats: walletStats.recordset[0] || {},
        verifiedReferrers: verifiedReferrers.recordset || [],
        applicationStats: applicationStats.recordset[0] || { TotalApplications: 0, ApplicationsToday: 0 },
        messageStats: messageStats.recordset[0] || { TotalConversations: 0, TotalMessages: 0 }
      }, 'Overview stats loaded')
    };
  } catch (error) {
    console.error('Error in getAdminDashboardOverview:', error);
    return { status: 500, jsonBody: { success: false, error: 'Failed to load overview stats' } };
  }
});

/**
 * Get Admin Dashboard - Users Tab Data (Paginated with Filters)
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
    
    // Get pagination and filter params
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const pageSize = parseInt(url.searchParams.get('pageSize') || '20');
    const offset = (page - 1) * pageSize;
    
    // Filter params
    const search = url.searchParams.get('search') || '';
    const userType = url.searchParams.get('userType') || 'all'; // all, JobSeeker, Employer
    const verifiedStatus = url.searchParams.get('verifiedStatus') || 'all'; // all, verified, notVerified
    const accountStatus = url.searchParams.get('accountStatus') || 'all'; // all, active, inactive
    const signupPeriod = url.searchParams.get('signupPeriod') || 'all'; // all, today, week, month
    const hasApplications = url.searchParams.get('hasApplications') || 'all'; // all, yes, no
    const hasBalance = url.searchParams.get('hasBalance') || 'all'; // all, yes, no
    const hasReferrals = url.searchParams.get('hasReferrals') || 'all'; // all, yes, no
    const hasReferralsAsked = url.searchParams.get('hasReferralsAsked') || 'all'; // all, yes, no

    // Build WHERE clause dynamically
    let whereConditions = ["u.UserType != 'Admin'"];
    let params: any[] = [];
    let paramIndex = 0;

    // Search filter
    if (search) {
      whereConditions.push(`(u.FirstName LIKE @param${paramIndex} OR u.LastName LIKE @param${paramIndex} OR u.Email LIKE @param${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    // User type filter
    if (userType !== 'all') {
      whereConditions.push(`u.UserType = @param${paramIndex}`);
      params.push(userType);
      paramIndex++;
    }

    // Verified status filter
    if (verifiedStatus === 'verified') {
      whereConditions.push('u.IsVerifiedReferrer = 1');
    } else if (verifiedStatus === 'notVerified') {
      whereConditions.push('(u.IsVerifiedReferrer = 0 OR u.IsVerifiedReferrer IS NULL)');
    }

    // Account status filter
    if (accountStatus === 'active') {
      whereConditions.push('u.IsActive = 1');
    } else if (accountStatus === 'inactive') {
      whereConditions.push('u.IsActive = 0');
    }

    // Signup period filter
    if (signupPeriod === 'today') {
      whereConditions.push('CAST(u.CreatedAt AS DATE) = CAST(GETUTCDATE() AS DATE)');
    } else if (signupPeriod === 'week') {
      whereConditions.push('u.CreatedAt >= DATEADD(day, -7, GETUTCDATE())');
    } else if (signupPeriod === 'month') {
      whereConditions.push('u.CreatedAt >= DATEADD(day, -30, GETUTCDATE())');
    }

    const whereClause = whereConditions.join(' AND ');

    // Build HAVING clause for aggregated filters
    let havingConditions: string[] = [];
    if (hasApplications === 'yes') {
      havingConditions.push('COUNT(ja.ApplicationID) > 0');
    } else if (hasApplications === 'no') {
      havingConditions.push('COUNT(ja.ApplicationID) = 0');
    }
    if (hasBalance === 'yes') {
      havingConditions.push('ISNULL(MAX(w.Balance), 0) > 0');
    } else if (hasBalance === 'no') {
      havingConditions.push('ISNULL(MAX(w.Balance), 0) = 0');
    }
    if (hasReferrals === 'yes') {
      havingConditions.push('COUNT(rr.RequestID) > 0');
    } else if (hasReferrals === 'no') {
      havingConditions.push('COUNT(rr.RequestID) = 0');
    }
    if (hasReferralsAsked === 'yes') {
      havingConditions.push('(SELECT COUNT(*) FROM ReferralRequests rr2 INNER JOIN Applicants a2 ON rr2.ApplicantID = a2.ApplicantID WHERE a2.UserID = u.UserID) > 0');
    } else if (hasReferralsAsked === 'no') {
      havingConditions.push('(SELECT COUNT(*) FROM ReferralRequests rr2 INNER JOIN Applicants a2 ON rr2.ApplicantID = a2.ApplicantID WHERE a2.UserID = u.UserID) = 0');
    }

    const havingClause = havingConditions.length > 0 ? `HAVING ${havingConditions.join(' AND ')}` : '';

    // Main query with LEFT JOINs for filtering
    // Note: JobApplications.ApplicantID references Applicants.ApplicantID, not Users.UserID
    // So we need to join through Applicants table to get user's applications
    const usersQuery = `
      SELECT 
        u.UserID, u.FirstName, u.LastName, u.Email, u.Phone, u.UserType,
        u.IsActive, u.EmailVerified, u.CreatedAt, u.LastLoginAt, u.ProfilePictureURL,
        u.IsVerifiedReferrer,
        COUNT(DISTINCT ja.ApplicationID) AS ApplicationsCount,
        ISNULL(MAX(w.Balance), 0) AS WalletBalance,
        COUNT(DISTINCT rr.RequestID) AS ReferralsGiven,
        (SELECT COUNT(*) FROM ReferralRequests rr2 
         INNER JOIN Applicants a2 ON rr2.ApplicantID = a2.ApplicantID 
         WHERE a2.UserID = u.UserID) AS ReferralsAsked
      FROM Users u 
      LEFT JOIN Applicants a ON a.UserID = u.UserID
      LEFT JOIN JobApplications ja ON ja.ApplicantID = a.ApplicantID
      LEFT JOIN Wallets w ON w.UserID = u.UserID
      LEFT JOIN ReferralRequests rr ON rr.AssignedReferrerID = u.UserID
      WHERE ${whereClause}
      GROUP BY u.UserID, u.FirstName, u.LastName, u.Email, u.Phone, u.UserType,
        u.IsActive, u.EmailVerified, u.CreatedAt, u.LastLoginAt, u.ProfilePictureURL,
        u.IsVerifiedReferrer
      ${havingClause}
      ORDER BY u.CreatedAt DESC
      OFFSET @param${paramIndex} ROWS FETCH NEXT @param${paramIndex + 1} ROWS ONLY
    `;
    params.push(offset, pageSize);

    // Count query (same filters, no pagination)
    const countQuery = `
      SELECT COUNT(*) AS TotalCount FROM (
        SELECT u.UserID
        FROM Users u 
        LEFT JOIN Applicants a ON a.UserID = u.UserID
        LEFT JOIN JobApplications ja ON ja.ApplicantID = a.ApplicantID
        LEFT JOIN Wallets w ON w.UserID = u.UserID
        LEFT JOIN ReferralRequests rr ON rr.AssignedReferrerID = u.UserID
        WHERE ${whereClause}
        GROUP BY u.UserID, u.FirstName, u.LastName, u.Email, u.Phone, u.UserType,
          u.IsActive, u.EmailVerified, u.CreatedAt, u.LastLoginAt, u.ProfilePictureURL,
          u.IsVerifiedReferrer
        ${havingClause}
      ) AS filtered
    `;

    const [usersResult, totalCountResult, dailySignups] = await Promise.all([
      dbService.executeQuery(usersQuery, params),
      dbService.executeQuery(countQuery, params.slice(0, -2)), // Exclude offset/pageSize
      dbService.executeQuery(`
        SELECT 
          CAST(CreatedAt AS DATE) AS Date, COUNT(*) AS Count,
          SUM(CASE WHEN UserType = 'JobSeeker' THEN 1 ELSE 0 END) AS JobSeekers,
          SUM(CASE WHEN UserType = 'Employer' THEN 1 ELSE 0 END) AS Employers
        FROM Users WHERE CreatedAt >= DATEADD(day, -30, GETUTCDATE()) AND UserType != 'Admin'
        GROUP BY CAST(CreatedAt AS DATE) ORDER BY Date DESC
      `, [])
    ]);

    const totalCount = totalCountResult.recordset[0]?.TotalCount || 0;
    const totalPages = Math.ceil(totalCount / pageSize);

    return {
      status: 200,
      jsonBody: successResponse({
        recentUsers: usersResult.recordset || [],
        dailySignups: dailySignups.recordset || [],
        pagination: {
          page,
          pageSize,
          totalCount,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        },
        filters: { search, userType, verifiedStatus, accountStatus, signupPeriod, hasApplications, hasBalance, hasReferrals }
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
        FROM ReferralRequests WHERE RequestedAt >= DATEADD(day, -30, GETUTCDATE())
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
/**
 * Get Admin Dashboard - Email Logs Tab Data (Paginated)
 */
export const getAdminDashboardEmailLogs = withAuth(async (
  req: HttpRequest,
  context: InvocationContext,
  user
): Promise<HttpResponseInit> => {
  try {
    const adminCheck = verifyAdmin(user);
    if (adminCheck) return adminCheck;

    const { dbService } = await import('../services/database.service');

    // Parse pagination params
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const pageSize = parseInt(url.searchParams.get('pageSize') || '20');
    const offset = (page - 1) * pageSize;

    const [emailLogs, totalCount] = await Promise.all([
      dbService.executeQuery(`
        SELECT 
          el.LogID, el.ToEmail, el.EmailType, el.Subject, el.Status,
          el.SentAt, el.DeliveredAt, el.OpenedAt, el.BouncedAt, el.ErrorMessage,
          u.FirstName + ' ' + u.LastName AS UserName, u.UserID
        FROM EmailLogs el
        LEFT JOIN Users u ON el.UserID = u.UserID
        ORDER BY el.SentAt DESC
        OFFSET @param0 ROWS FETCH NEXT @param1 ROWS ONLY
      `, [offset, pageSize]),
      dbService.executeQuery(`
        SELECT COUNT(*) AS TotalCount FROM EmailLogs
      `, [])
    ]);

    const total = totalCount.recordset[0]?.TotalCount || 0;
    const totalPages = Math.ceil(total / pageSize);

    return {
      status: 200,
      jsonBody: successResponse({
        emailLogs: emailLogs.recordset || [],
        pagination: {
          page,
          pageSize,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      }, 'Email logs loaded')
    };
  } catch (error) {
    console.error('Error in getAdminDashboardEmailLogs:', error);
    return { status: 500, jsonBody: { success: false, error: 'Failed to load email logs' } };
  }
});

/**
 * Get Admin Dashboard - Resume Analyzer Tab Data (Paginated)
 */
export const getAdminDashboardResumeAnalyzer = withAuth(async (
  req: HttpRequest,
  context: InvocationContext,
  user
): Promise<HttpResponseInit> => {
  try {
    const adminCheck = verifyAdmin(user);
    if (adminCheck) return adminCheck;

    const { dbService } = await import('../services/database.service');

    // Parse pagination params
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const pageSize = parseInt(url.searchParams.get('pageSize') || '20');
    const offset = (page - 1) * pageSize;

    const [resumeData, totalCount] = await Promise.all([
      dbService.executeQuery(`
        SELECT 
          rm.ResumeMetadataID, rm.UserID, rm.FileName, rm.FileSizeBytes,
          rm.FullName, rm.Email, rm.Mobile,
          rm.LastJobUrl, rm.LastJobId, rm.LastMatchScore, rm.AnalysisCount,
          rm.AIModel, rm.CreatedAt, rm.LastAnalyzedAt,
          u.FirstName + ' ' + u.LastName AS UserName, u.Email AS UserEmail
        FROM ResumeMetadata rm
        LEFT JOIN Users u ON rm.UserID = u.UserID
        ORDER BY rm.LastAnalyzedAt DESC
        OFFSET @param0 ROWS FETCH NEXT @param1 ROWS ONLY
      `, [offset, pageSize]),
      dbService.executeQuery(`
        SELECT COUNT(*) AS TotalCount FROM ResumeMetadata
      `, [])
    ]);

    const total = totalCount.recordset[0]?.TotalCount || 0;
    const totalPages = Math.ceil(total / pageSize);

    return {
      status: 200,
      jsonBody: successResponse({
        resumeAnalyzer: resumeData.recordset || [],
        pagination: {
          page,
          pageSize,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      }, 'Resume analyzer data loaded')
    };
  } catch (error) {
    console.error('Error in getAdminDashboardResumeAnalyzer:', error);
    return { status: 500, jsonBody: { success: false, error: 'Failed to load resume analyzer data' } };
  }
});