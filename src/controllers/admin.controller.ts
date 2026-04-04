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
      
      // Top 10 verified referrers — pre-aggregate counts (avoids double correlated subquery)
      dbService.executeQuery(`
        SELECT TOP 10 u.UserID, u.FirstName, u.LastName, u.Email, u.ProfilePictureURL, 
          u.CreatedAt, a.CurrentCompanyName AS CompanyName,
          ISNULL(rc.ReferralsCompleted, 0) AS ReferralsCompleted
        FROM Users u
        LEFT JOIN Applicants a ON u.UserID = a.UserID
        LEFT JOIN (
          SELECT AssignedReferrerID, COUNT(*) AS ReferralsCompleted
          FROM ReferralRequests WHERE Status = 'Completed'
          GROUP BY AssignedReferrerID
        ) rc ON rc.AssignedReferrerID = u.UserID
        WHERE u.IsVerifiedReferrer = 1 AND u.UserType != 'Admin'
        ORDER BY ISNULL(rc.ReferralsCompleted, 0) DESC, u.CreatedAt ASC
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
    } else if (verifiedStatus === 'eligible') {
      // Eligible referrers: not yet verified BUT has a current work experience
      whereConditions.push('(u.IsVerifiedReferrer = 0 OR u.IsVerifiedReferrer IS NULL)');
      whereConditions.push(`EXISTS (
        SELECT 1 FROM WorkExperiences we2 
        INNER JOIN Applicants a3 ON we2.ApplicantID = a3.ApplicantID 
        WHERE a3.UserID = u.UserID AND we2.IsActive = 1 AND (we2.IsCurrent = 1 OR we2.EndDate IS NULL)
      )`);
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
         WHERE a2.UserID = u.UserID) AS ReferralsAsked,
        CASE WHEN EXISTS (
          SELECT 1 FROM WorkExperiences we2 
          INNER JOIN Applicants a3 ON we2.ApplicantID = a3.ApplicantID 
          WHERE a3.UserID = u.UserID AND we2.IsActive = 1 AND (we2.IsCurrent = 1 OR we2.EndDate IS NULL)
        ) THEN 1 ELSE 0 END AS HasCurrentWorkExp
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

    const [referralStats, recentReferrals, dailyReferrals, topOrgs, eligibleReferrers, companiesWithReferrers] = await Promise.all([
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
          rr.RequestID, rr.JobTitle, rr.JobID, rr.ExtJobID, rr.JobURL,
          o.Name AS CompanyName, rr.Status,
          rr.RequestedAt, rr.ReferredAt, rr.ReferralMessage,
          u.FirstName + ' ' + u.LastName AS RequesterName, u.Email AS RequesterEmail,
          u.UserID AS RequesterUserID, u.ProfilePictureURL AS RequesterPhoto,
          ref.FirstName + ' ' + ref.LastName AS ReferrerName, ref.Email AS ReferrerEmail,
          ar.ResumeURL, ar.ResumeLabel
        FROM ReferralRequests rr
        JOIN Applicants a ON rr.ApplicantID = a.ApplicantID
        JOIN Users u ON a.UserID = u.UserID
        LEFT JOIN Users ref ON rr.AssignedReferrerID = ref.UserID
        LEFT JOIN Organizations o ON rr.OrganizationID = o.OrganizationID
        LEFT JOIN ApplicantResumes ar ON rr.ResumeID = ar.ResumeID
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
          jc.JobCount, ISNULL(rc.ReferralCount, 0) AS ReferralCount
        FROM Organizations o
        INNER JOIN (
          SELECT OrganizationID, COUNT(*) AS JobCount
          FROM Jobs GROUP BY OrganizationID
        ) jc ON jc.OrganizationID = o.OrganizationID
        LEFT JOIN (
          SELECT OrganizationID, COUNT(*) AS ReferralCount
          FROM ReferralRequests GROUP BY OrganizationID
        ) rc ON rc.OrganizationID = o.OrganizationID
        ORDER BY jc.JobCount DESC      `, []),
      // Get eligible referrers per organization (verified employees)
      // CTE to pre-compute recent org IDs — avoids correlated subquery (3.2s → 110ms)
      dbService.executeQuery(`
        WITH RecentOrgs AS (
          SELECT DISTINCT OrganizationID FROM ReferralRequests
          WHERE RequestedAt >= DATEADD(day, -30, GETUTCDATE()) AND OrganizationID IS NOT NULL
        )
        SELECT 
          we.OrganizationID,
          u.UserID, u.FirstName + ' ' + u.LastName AS ReferrerName, 
          u.Email AS ReferrerEmail, u.ProfilePictureURL,
          u.LastActive,
          we.JobTitle AS CurrentRole
        FROM WorkExperiences we
        INNER JOIN Applicants a ON we.ApplicantID = a.ApplicantID
        INNER JOIN Users u ON a.UserID = u.UserID
        INNER JOIN RecentOrgs ro ON we.OrganizationID = ro.OrganizationID
        WHERE we.IsCurrent = 1 AND we.IsActive = 1 AND u.IsVerifiedReferrer = 1
      `, []),
      // Companies with verified referrers
      dbService.executeQuery(`
        SELECT 
          o.OrganizationID, o.Name AS CompanyName, o.LogoURL, o.Industry,
          COUNT(DISTINCT we.ApplicantID) AS ReferrerCount,
          ISNULL(rc.ReferralCount, 0) AS TotalReferrals,
          ISNULL(rc.CompletedCount, 0) AS CompletedReferrals,
          STRING_AGG(CONCAT(u.FirstName, ' ', u.LastName), ', ') AS ReferrerNames
        FROM Organizations o
        INNER JOIN WorkExperiences we ON we.OrganizationID = o.OrganizationID
          AND we.IsCurrent = 1 AND we.IsActive = 1
        INNER JOIN Applicants a ON we.ApplicantID = a.ApplicantID
        INNER JOIN Users u ON a.UserID = u.UserID AND u.IsVerifiedReferrer = 1
        LEFT JOIN (
          SELECT OrganizationID, 
            COUNT(*) AS ReferralCount,
            SUM(CASE WHEN Status IN ('Completed','Verified','ProofUploaded') THEN 1 ELSE 0 END) AS CompletedCount
          FROM ReferralRequests GROUP BY OrganizationID
        ) rc ON rc.OrganizationID = o.OrganizationID
        GROUP BY o.OrganizationID, o.Name, o.LogoURL, o.Industry, rc.ReferralCount, rc.CompletedCount
        ORDER BY COUNT(DISTINCT we.ApplicantID) DESC
      `, [])
    ]);

    return {
      status: 200,
      jsonBody: successResponse({
        referralStats: referralStats.recordset[0] || {},
        recentReferrals: recentReferrals.recordset || [],
        dailyReferrals: dailyReferrals.recordset || [],
        topOrganizations: topOrgs.recordset || [],
        eligibleReferrers: eligibleReferrers.recordset || [],
        companiesWithReferrers: companiesWithReferrers.recordset || []
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
    const filterType = url.searchParams.get('type') || '';

    // Build WHERE clause for type filter
    const typeFilter = filterType ? `WHERE el.EmailType = @param2` : '';
    const typeFilterCount = filterType ? `WHERE EmailType = @param0` : '';

    const [emailLogs, totalCount, categorySummary] = await Promise.all([
      dbService.executeQuery(`
        SELECT 
          el.LogID, el.ToEmail, el.EmailType, el.Subject, el.Status,
          el.SentAt, el.DeliveredAt, el.OpenedAt, el.BouncedAt, el.ErrorMessage,
          u.FirstName + ' ' + u.LastName AS UserName, u.UserID
        FROM EmailLogs el
        LEFT JOIN Users u ON el.UserID = u.UserID
        ${typeFilter}
        ORDER BY el.SentAt DESC
        OFFSET @param0 ROWS FETCH NEXT @param1 ROWS ONLY
      `, filterType ? [offset, pageSize, filterType] : [offset, pageSize]),
      dbService.executeQuery(`
        SELECT COUNT(*) AS TotalCount FROM EmailLogs ${typeFilterCount}
      `, filterType ? [filterType] : []),
      dbService.executeQuery(`
        SELECT 
          EmailType,
          COUNT(*) AS Count,
          SUM(CASE WHEN Status = 'Sent' THEN 1 ELSE 0 END) AS Sent,
          SUM(CASE WHEN Status = 'Failed' THEN 1 ELSE 0 END) AS Failed,
          MAX(SentAt) AS LastSent
        FROM EmailLogs
        GROUP BY EmailType
        ORDER BY MAX(SentAt) DESC
      `, [])
    ]);

    const total = totalCount.recordset[0]?.TotalCount || 0;
    const totalPages = Math.ceil(total / pageSize);

    return {
      status: 200,
      jsonBody: successResponse({
        emailLogs: emailLogs.recordset || [],
        categorySummary: categorySummary.recordset || [],
        pagination: {
          page,
          pageSize,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        },
        activeFilter: filterType || null
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

/**
 * Get Admin Dashboard - Resume Builder Tab Data (Paginated)
 */
export const getAdminDashboardResumeBuilder = withAuth(async (
  req: HttpRequest,
  context: InvocationContext,
  user
): Promise<HttpResponseInit> => {
  try {
    const adminCheck = verifyAdmin(user);
    if (adminCheck) return adminCheck;

    const { dbService } = await import('../services/database.service');
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const pageSize = parseInt(url.searchParams.get('pageSize') || '20');
    const offset = (page - 1) * pageSize;

    const [data, totalCount] = await Promise.all([
      dbService.executeQuery(`
        SELECT 
          p.ProjectID, p.UserID, p.Title AS ProjectName, p.TemplateID,
          p.Status, p.TargetJobTitle, p.MatchScore,
          p.LastExportedAt, p.CreatedAt, p.UpdatedAt,
          u.FirstName + ' ' + u.LastName AS UserName, u.Email AS UserEmail,
          t.Name AS TemplateName, t.IsPremium
        FROM ResumeBuilderProjects p
        LEFT JOIN Users u ON p.UserID = u.UserID
        LEFT JOIN ResumeBuilderTemplates t ON p.TemplateID = t.TemplateID
        WHERE p.IsDeleted = 0
        ORDER BY p.UpdatedAt DESC
        OFFSET @param0 ROWS FETCH NEXT @param1 ROWS ONLY
      `, [offset, pageSize]),
      dbService.executeQuery(`SELECT COUNT(*) AS TotalCount FROM ResumeBuilderProjects WHERE IsDeleted = 0`, [])
    ]);

    const total = totalCount.recordset[0]?.TotalCount || 0;

    return {
      status: 200,
      jsonBody: successResponse({
        resumeBuilder: data.recordset || [],
        pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize), hasNext: page < Math.ceil(total / pageSize), hasPrev: page > 1 }
      }, 'Resume builder data loaded')
    };
  } catch (error) {
    console.error('Error in getAdminDashboardResumeBuilder:', error);
    return { status: 500, jsonBody: { success: false, error: 'Failed to load resume builder data' } };
  }
});

/**
 * Get Admin Dashboard - LinkedIn Optimizer Tab Data (Paginated)
 */
export const getAdminDashboardLinkedInOptimizer = withAuth(async (
  req: HttpRequest,
  context: InvocationContext,
  user
): Promise<HttpResponseInit> => {
  try {
    const adminCheck = verifyAdmin(user);
    if (adminCheck) return adminCheck;

    const { dbService } = await import('../services/database.service');
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const pageSize = parseInt(url.searchParams.get('pageSize') || '20');
    const offset = (page - 1) * pageSize;

    const [data, totalCount] = await Promise.all([
      dbService.executeQuery(`
        SELECT 
          l.ID, l.UserID, l.Mode, l.OverallScore, l.ElapsedMs, l.CreatedAt,
          u.FirstName + ' ' + u.LastName AS UserName, u.Email AS UserEmail
        FROM LinkedInOptimizerUsage l
        LEFT JOIN Users u ON CAST(l.UserID AS NVARCHAR(100)) = CAST(u.UserID AS NVARCHAR(100))
        ORDER BY l.CreatedAt DESC
        OFFSET @param0 ROWS FETCH NEXT @param1 ROWS ONLY
      `, [offset, pageSize]),
      dbService.executeQuery(`SELECT COUNT(*) AS TotalCount FROM LinkedInOptimizerUsage`, [])
    ]);

    const total = totalCount.recordset[0]?.TotalCount || 0;

    return {
      status: 200,
      jsonBody: successResponse({
        linkedinOptimizer: data.recordset || [],
        pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize), hasNext: page < Math.ceil(total / pageSize), hasPrev: page > 1 }
      }, 'LinkedIn optimizer data loaded')
    };
  } catch (error) {
    console.error('Error in getAdminDashboardLinkedInOptimizer:', error);
    return { status: 500, jsonBody: { success: false, error: 'Failed to load LinkedIn optimizer data' } };
  }
});

/**
 * GET /api/management/dashboard/blind-review - Blind Review usage data (paginated)
 */
export const getAdminDashboardBlindReview = withAuth(async (
  req: HttpRequest,
  context: InvocationContext,
  user
): Promise<HttpResponseInit> => {
  try {
    const adminCheck = verifyAdmin(user);
    if (adminCheck) return adminCheck;

    const { dbService } = await import('../services/database.service');
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const pageSize = parseInt(url.searchParams.get('pageSize') || '20');
    const offset = (page - 1) * pageSize;

    const [data, totalCount] = await Promise.all([
      dbService.executeQuery(`
        SELECT 
          br.RequestID, br.TargetRole, br.SourceType, br.AIScore, br.FinalScore,
          br.Status, br.ResponseCount, br.CreatedAt,
          u.FirstName + ' ' + u.LastName AS UserName, u.Email AS UserEmail,
          o.Name AS CompanyName
        FROM BlindReviewRequests br
        LEFT JOIN Users u ON br.UserID = u.UserID
        LEFT JOIN Organizations o ON br.OrganizationID = o.OrganizationID
        ORDER BY br.CreatedAt DESC
        OFFSET @param0 ROWS FETCH NEXT @param1 ROWS ONLY
      `, [offset, pageSize]),
      dbService.executeQuery(`SELECT COUNT(*) AS TotalCount FROM BlindReviewRequests`, [])
    ]);

    const total = totalCount.recordset[0]?.TotalCount || 0;

    return {
      status: 200,
      jsonBody: successResponse({
        blindReview: data.recordset || [],
        pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize), hasNext: page < Math.ceil(total / pageSize), hasPrev: page > 1 }
      }, 'Blind review data loaded')
    };
  } catch (error) {
    console.error('Error in getAdminDashboardBlindReview:', error);
    return { status: 500, jsonBody: { success: false, error: 'Failed to load blind review data' } };
  }
});

/**
 * GET /api/management/dashboard/revenue - Day-wise revenue dashboard
 */
export const getAdminDashboardRevenue = withAuth(async (
  req: HttpRequest,
  context: InvocationContext,
  user
): Promise<HttpResponseInit> => {
  try {
    const adminCheck = verifyAdmin(user);
    if (adminCheck) return adminCheck;

    const { dbService } = await import('../services/database.service');
    const url = new URL(req.url);
    const days = parseInt(url.searchParams.get('days') || '30');

    const [dailyData, summary] = await Promise.all([
      dbService.executeQuery(`
        SELECT 
          CAST(wt.CreatedAt AS DATE) AS Day,
          SUM(CASE WHEN wt.TransactionType = 'Credit' THEN wt.Amount ELSE 0 END) AS Deposits,
          SUM(CASE WHEN wt.TransactionType = 'Debit' AND wt.Source NOT LIKE '%Withdraw%' THEN wt.Amount ELSE 0 END) AS ServiceRevenue,
          SUM(CASE WHEN wt.Source LIKE '%Withdraw%' THEN wt.Amount ELSE 0 END) AS Withdrawals,
          COUNT(CASE WHEN wt.TransactionType = 'Credit' THEN 1 END) AS DepositCount,
          COUNT(CASE WHEN wt.TransactionType = 'Debit' AND wt.Source NOT LIKE '%Withdraw%' THEN 1 END) AS ServiceCount,
          COUNT(CASE WHEN wt.Source LIKE '%Withdraw%' THEN 1 END) AS WithdrawalCount
        FROM WalletTransactions wt
        INNER JOIN Wallets w ON wt.WalletID = w.WalletID
        INNER JOIN Users u ON w.UserID = u.UserID
        WHERE wt.CreatedAt >= DATEADD(DAY, -@param0, GETUTCDATE())
          AND wt.Status = 'Completed'
          AND (u.Phone IS NULL OR u.Phone <> '0000000000')
          AND wt.Source NOT LIKE '%Admin_TopUp%'
        GROUP BY CAST(wt.CreatedAt AS DATE)
        ORDER BY Day DESC
      `, [days]),
      dbService.executeQuery(`
        SELECT 
          SUM(CASE WHEN wt.TransactionType = 'Credit' THEN wt.Amount ELSE 0 END) AS TotalDeposits,
          SUM(CASE WHEN wt.TransactionType = 'Debit' AND wt.Source NOT LIKE '%Withdraw%' THEN wt.Amount ELSE 0 END) AS TotalServiceRevenue,
          SUM(CASE WHEN wt.Source LIKE '%Withdraw%' THEN wt.Amount ELSE 0 END) AS TotalWithdrawals,
          COUNT(DISTINCT wt.WalletID) AS UniqueUsers,
          SUM(CASE WHEN wt.TransactionType = 'Debit' AND wt.Source LIKE '%Blind_Review%' THEN wt.Amount ELSE 0 END) AS BlindReviewRevenue,
          SUM(CASE WHEN wt.TransactionType = 'Debit' AND wt.Source LIKE '%LinkedIn%' THEN wt.Amount ELSE 0 END) AS LinkedInRevenue,
          SUM(CASE WHEN wt.TransactionType = 'Debit' AND wt.Source LIKE '%Resume%' THEN wt.Amount ELSE 0 END) AS ResumeRevenue,
          SUM(CASE WHEN wt.TransactionType = 'Debit' AND wt.Source LIKE '%Referral%' THEN wt.Amount ELSE 0 END) AS ReferralRevenue
        FROM WalletTransactions wt
        INNER JOIN Wallets w ON wt.WalletID = w.WalletID
        INNER JOIN Users u ON w.UserID = u.UserID
        WHERE wt.CreatedAt >= DATEADD(DAY, -@param0, GETUTCDATE())
          AND wt.Status = 'Completed'
          AND (u.Phone IS NULL OR u.Phone <> '0000000000')
          AND wt.Source NOT LIKE '%Admin_TopUp%'
      `, [days])
    ]);

    const s = summary.recordset[0] || {};
    const profit = (s.TotalDeposits || 0) - (s.TotalWithdrawals || 0);

    return {
      status: 200,
      jsonBody: successResponse({
        daily: dailyData.recordset || [],
        summary: {
          totalDeposits: s.TotalDeposits || 0,
          totalServiceRevenue: s.TotalServiceRevenue || 0,
          totalWithdrawals: s.TotalWithdrawals || 0,
          netProfit: profit,
          uniqueUsers: s.UniqueUsers || 0,
          byService: {
            blindReview: s.BlindReviewRevenue || 0,
            linkedin: s.LinkedInRevenue || 0,
            resume: s.ResumeRevenue || 0,
            referral: s.ReferralRevenue || 0,
          }
        },
        days,
      }, 'Revenue data loaded')
    };
  } catch (error) {
    console.error('Error in getAdminDashboardRevenue:', error);
    return { status: 500, jsonBody: { success: false, error: 'Failed to load revenue data' } };
  }
});

/**
 * DELETE /api/admin/users/:userId - Delete a user and all their data
 * Same logic as scripts/delete-users.js but as an API endpoint
 */
export const adminDeleteUser = withAuth(async (
  req: HttpRequest,
  context: InvocationContext,
  user
): Promise<HttpResponseInit> => {
  try {
    const adminCheck = verifyAdmin(user);
    if (adminCheck) return adminCheck;

    const userId = req.params.userId;
    if (!userId) {
      return { status: 400, jsonBody: { success: false, error: 'userId is required' } };
    }

    // Prevent admin from deleting themselves
    if (userId === user.userId) {
      return { status: 400, jsonBody: { success: false, error: 'Cannot delete your own account' } };
    }

    const { dbService } = await import('../services/database.service');

    // Verify user exists
    const userResult = await dbService.executeQuery(
      `SELECT UserID, FirstName, LastName, Email, UserType FROM Users WHERE UserID = @param0`,
      [userId]
    );

    if (userResult.recordset.length === 0) {
      return { status: 404, jsonBody: { success: false, error: 'User not found' } };
    }

    const targetUser = userResult.recordset[0];

    // Don't allow deleting other admins
    if (targetUser.UserType === 'Admin') {
      return { status: 403, jsonBody: { success: false, error: 'Cannot delete admin accounts' } };
    }

    context.log(`Admin ${user.userId} deleting user: ${targetUser.Email} (${targetUser.FirstName} ${targetUser.LastName})`);

    // Delete in FK-safe order (synced with scripts/delete-users.js — all 36 FK deps)
    const deleteStatements = [
      // Consent & activity logs
      `DELETE FROM UserConsentLog WHERE UserID = @param0`,
      `DELETE FROM UserActivityLogs WHERE UserID = @param0`,
      `DELETE FROM UserProfileViews WHERE ViewerUserID = @param0 OR ViewedUserID = @param0`,
      `DELETE FROM UserSessions WHERE UserID = @param0`,
      // Notifications & support
      `DELETE FROM InAppNotifications WHERE UserID = @param0`,
      `DELETE FROM NotificationPreferences WHERE UserID = @param0`,
      `DELETE FROM PushTokens WHERE UserID = @param0`,
      `DELETE FROM SupportMessages WHERE TicketID IN (SELECT TicketID FROM SupportTickets WHERE UserID = @param0)`,
      `DELETE FROM SupportMessages WHERE SenderID = @param0`,
      `DELETE FROM SupportTickets WHERE UserID = @param0`,
      `UPDATE SupportTickets SET AdminUserID = NULL WHERE AdminUserID = @param0`,
      `DELETE FROM NotificationQueue WHERE UserID = @param0`,
      // Email & verification
      `DELETE FROM EmailLogs WHERE UserID = @param0`,
      `DELETE FROM EmailVerificationOTPs WHERE UserID = @param0`,
      `DELETE FROM UserVerifications WHERE UserID = @param0`,
      `UPDATE UserVerifications SET ReviewedBy = NULL WHERE ReviewedBy = @param0`,
      // Promo codes
      `DELETE FROM PromoCodeUsages WHERE UserID = @param0`,
      // Wallet & payments
      `DELETE FROM WalletTransactions WHERE WalletID IN (SELECT WalletID FROM Wallets WHERE UserID = @param0)`,
      `DELETE FROM WalletHolds WHERE WalletID IN (SELECT WalletID FROM Wallets WHERE UserID = @param0)`,
      `DELETE FROM WalletHolds WHERE UserID = @param0`,
      `DELETE FROM WalletRechargeOrders WHERE WalletID IN (SELECT WalletID FROM Wallets WHERE UserID = @param0)`,
      `DELETE FROM WalletRechargeOrders WHERE UserID = @param0`,
      `DELETE FROM WalletWithdrawals WHERE WalletID IN (SELECT WalletID FROM Wallets WHERE UserID = @param0)`,
      `DELETE FROM WalletWithdrawals WHERE UserID = @param0`,
      `UPDATE WalletWithdrawals SET ProcessedBy = NULL WHERE ProcessedBy = @param0`,
      `DELETE FROM Wallets WHERE UserID = @param0`,
      `DELETE FROM ManualPaymentSubmissions WHERE UserID = @param0`,
      `DELETE FROM PaymentOrders WHERE ApplicantID IN (SELECT ApplicantID FROM Applicants WHERE UserID = @param0)`,
      `DELETE FROM PaymentTransactions WHERE UserID = @param0`,
      // Referrals
      `DELETE FROM ReferralProofs WHERE ReferrerID = @param0`,
      `DELETE FROM ReferralProofs WHERE RequestID IN (SELECT RequestID FROM ReferralRequests WHERE ApplicantID IN (SELECT ApplicantID FROM Applicants WHERE UserID = @param0))`,
      `DELETE FROM ReferralRequestStatusHistory WHERE RequestID IN (SELECT RequestID FROM ReferralRequests WHERE ApplicantID IN (SELECT ApplicantID FROM Applicants WHERE UserID = @param0))`,
      `DELETE FROM ReferralRewards WHERE ReferrerID IN (SELECT ApplicantID FROM Applicants WHERE UserID = @param0)`,
      `DELETE FROM ReferralRequests WHERE ApplicantID IN (SELECT ApplicantID FROM Applicants WHERE UserID = @param0)`,
      `UPDATE ReferralRequests SET AssignedReferrerID = NULL, Status = 'Pending', ReferredAt = NULL WHERE AssignedReferrerID = @param0`,
      `DELETE FROM ReferrerStats WHERE ReferrerID IN (SELECT ApplicantID FROM Applicants WHERE UserID = @param0)`,
      `DELETE FROM SocialShareClaims WHERE UserID = @param0`,
      // Applicant profile data
      `DELETE FROM ApplicantProfileViews WHERE ApplicantID IN (SELECT ApplicantID FROM Applicants WHERE UserID = @param0)`,
      `DELETE FROM ApplicantProfileViews WHERE ViewedByUserID = @param0`,
      `DELETE FROM ApplicantReferralSubscriptions WHERE ApplicantID IN (SELECT ApplicantID FROM Applicants WHERE UserID = @param0)`,
      `DELETE FROM ApplicantSalaries WHERE ApplicantID IN (SELECT ApplicantID FROM Applicants WHERE UserID = @param0)`,
      // Must delete OTPs linked to work experiences BEFORE deleting work experiences
      `DELETE FROM EmailVerificationOTPs WHERE WorkExperienceID IN (SELECT WorkExperienceID FROM WorkExperiences WHERE ApplicantID IN (SELECT ApplicantID FROM Applicants WHERE UserID = @param0))`,
      `DELETE FROM WorkExperiences WHERE ApplicantID IN (SELECT ApplicantID FROM Applicants WHERE UserID = @param0)`,
      `DELETE FROM ResumeMetadata WHERE ApplicantID IN (SELECT ApplicantID FROM Applicants WHERE UserID = @param0)`,
      `DELETE FROM ResumeMetadata WHERE UserID = @param0`,
      // Resume builder
      `DELETE FROM ResumeBuilderSections WHERE ProjectID IN (SELECT ProjectID FROM ResumeBuilderProjects WHERE UserID = @param0)`,
      `DELETE FROM ResumeBuilderExports WHERE UserID = @param0`,
      `DELETE FROM ResumeBuilderProjects WHERE UserID = @param0`,
      // Salary & services
      `DELETE FROM SalarySubmissions WHERE UserID = @param0`,
      `DELETE FROM SalarySpyAccess WHERE UserID = @param0`,
      `DELETE FROM ServiceInterests WHERE UserID = @param0`,
      // Jobs & applications
      `DELETE FROM ApplicationAttachments WHERE ApplicationID IN (SELECT ApplicationID FROM JobApplications WHERE ApplicantID IN (SELECT ApplicantID FROM Applicants WHERE UserID = @param0))`,
      `DELETE FROM ApplicationTracking WHERE ApplicationID IN (SELECT ApplicationID FROM JobApplications WHERE ApplicantID IN (SELECT ApplicantID FROM Applicants WHERE UserID = @param0))`,
      `DELETE FROM JobApplications WHERE ApplicantID IN (SELECT ApplicantID FROM Applicants WHERE UserID = @param0)`,
      `DELETE FROM SavedJobs WHERE ApplicantID IN (SELECT ApplicantID FROM Applicants WHERE UserID = @param0)`,
      `DELETE FROM ApplicantResumes WHERE ApplicantID IN (SELECT ApplicantID FROM Applicants WHERE UserID = @param0)`,
      `DELETE FROM Applicants WHERE UserID = @param0`,
      // Employer data
      `UPDATE Jobs SET PostedByUserID = NULL WHERE PostedByUserID = @param0`,
      `DELETE FROM Employers WHERE UserID = @param0`,
      `UPDATE Organizations SET CreatedBy = NULL, UpdatedBy = NULL WHERE CreatedBy = @param0`,
      // Messaging
      `DELETE FROM Messages WHERE ConversationID IN (SELECT ConversationID FROM Conversations WHERE User1ID = @param0 OR User2ID = @param0)`,
      `UPDATE Conversations SET LastMessageSenderID = NULL WHERE LastMessageSenderID = @param0`,
      `DELETE FROM Conversations WHERE User1ID = @param0 OR User2ID = @param0`,
      `DELETE FROM BlockedUsers WHERE BlockerUserID = @param0`,
      `DELETE FROM BlockedUsers WHERE BlockedUserID = @param0`,
      // Self-referencing FK
      `UPDATE Users SET ReferredBy = NULL WHERE ReferredBy = @param0`,
      // Finally, the user
      `DELETE FROM Users WHERE UserID = @param0`,
    ];

    let deletedTables = 0;
    for (const stmt of deleteStatements) {
      try {
        await dbService.executeQuery(stmt, [userId]);
        deletedTables++;
      } catch (e: any) {
        // Skip tables that don't exist or have no matching rows
        context.warn(`Delete step failed (non-fatal): ${e.message?.substring(0, 100)}`);
      }
    }

    context.log(`✅ Deleted user ${targetUser.Email} — ${deletedTables}/${deleteStatements.length} steps completed`);

    return {
      status: 200,
      jsonBody: {
        success: true,
        message: `User ${targetUser.FirstName} ${targetUser.LastName} (${targetUser.Email}) deleted successfully`,
        data: { deletedUser: { email: targetUser.Email, name: `${targetUser.FirstName} ${targetUser.LastName}` } }
      }
    };
  } catch (error: any) {
    console.error('Error in adminDeleteUser:', error);
    return { status: 500, jsonBody: { success: false, error: 'Failed to delete user' } };
  }
});

/**
 * POST /api/admin/users/:userId/make-referrer - Make a user a verified referrer
 */
export const adminMakeReferrer = withAuth(async (
  req: HttpRequest,
  context: InvocationContext,
  user
): Promise<HttpResponseInit> => {
  try {
    const adminCheck = verifyAdmin(user);
    if (adminCheck) return adminCheck;

    const userId = req.params.userId;
    if (!userId) {
      return { status: 400, jsonBody: { success: false, error: 'userId is required' } };
    }

    const { dbService } = await import('../services/database.service');
    const { isBlockedMarketplace } = await import('../data/blocked-marketplaces');

    // Verify user exists
    const userResult = await dbService.executeQuery(
      `SELECT u.UserID, u.FirstName, u.LastName, u.Email, u.IsVerifiedReferrer,
              a.CurrentCompanyName
       FROM Users u
       LEFT JOIN Applicants a ON u.UserID = a.UserID
       WHERE u.UserID = @param0`,
      [userId]
    );

    if (userResult.recordset.length === 0) {
      return { status: 404, jsonBody: { success: false, error: 'User not found' } };
    }

    const targetUser = userResult.recordset[0];

    if (targetUser.IsVerifiedReferrer) {
      return { status: 400, jsonBody: { success: false, error: 'User is already a verified referrer' } };
    }

    // Check if company is a blocked marketplace
    if (isBlockedMarketplace(targetUser.CurrentCompanyName)) {
      return { status: 400, jsonBody: { success: false, error: `${targetUser.CurrentCompanyName} is a blocked marketplace company. Cannot make referrer.` } };
    }

    // Verify user has a CURRENT work experience (not just any past work exp)
    const currentWorkExp = await dbService.executeQuery(
      `SELECT TOP 1 we.CompanyName 
       FROM WorkExperiences we 
       INNER JOIN Applicants a ON we.ApplicantID = a.ApplicantID 
       WHERE a.UserID = @param0 AND we.IsActive = 1 AND (we.IsCurrent = 1 OR we.EndDate IS NULL)`,
      [userId]
    );
    if (!currentWorkExp.recordset || currentWorkExp.recordset.length === 0) {
      return { status: 400, jsonBody: { success: false, error: 'User must have a current work experience to become a referrer. They have no active current job.' } };
    }

    await dbService.executeQuery(
      `UPDATE Users SET IsVerifiedReferrer = 1, IsVerifiedUser = 1, UpdatedAt = GETUTCDATE() WHERE UserID = @param0`,
      [userId]
    );

    context.log(`✅ Admin ${user.userId} made ${targetUser.Email} a verified referrer`);

    return {
      status: 200,
      jsonBody: {
        success: true,
        message: `${targetUser.FirstName} ${targetUser.LastName} is now a verified referrer`,
        data: { userId, isVerifiedReferrer: true }
      }
    };
  } catch (error: any) {
    console.error('Error in adminMakeReferrer:', error);
    return { status: 500, jsonBody: { success: false, error: 'Failed to make user a referrer' } };
  }
});