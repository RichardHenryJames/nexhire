/**
 * User Engagement Service
 * Handles all engagement-related emails and in-app notifications:
 * 1. Weekly digest (new companies + market stats)
 * 2. Saved job expiring nudge
 * 3. Onboarding drip emails (Day 3 + Day 7)
 * 4. Similar jobs notification
 */

import { dbService } from './database.service';
import { EmailService } from './emailService';
import { TemplateService } from './templateService';
import { InAppNotificationService } from './inAppNotification.service';

const APP_URL = process.env.APP_URL || 'https://www.refopen.com';

// ═══════════════════════════════════════════════════════════════
// 1. WEEKLY DIGEST — New companies + market stats
//    Runs every Monday at 10 AM IST
// ═══════════════════════════════════════════════════════════════

export async function sendWeeklyDigest(): Promise<{ sent: number; failed: number }> {
  const result = { sent: 0, failed: 0 };

  try {
    // Get this week's stats
    const stats = await dbService.executeQuery(`
      SELECT
        (SELECT COUNT(*) FROM Jobs WHERE Status='Published' AND CreatedAt >= DATEADD(day,-7,GETUTCDATE())) as newJobsThisWeek,
        (SELECT COUNT(*) FROM Jobs WHERE Status='Published' AND ExternalJobID LIKE 'direct_%' AND CreatedAt >= DATEADD(day,-7,GETUTCDATE())) as newDirectJobs,
        (SELECT COUNT(DISTINCT o.Name) FROM Jobs j JOIN Organizations o ON j.OrganizationID=o.OrganizationID WHERE j.ExternalJobID LIKE 'direct_%' AND j.CreatedAt >= DATEADD(day,-7,GETUTCDATE())) as newDirectCompanies
    `, []);
    const s = stats.recordset[0];

    // Get top hiring direct companies this week
    const topCompanies = await dbService.executeQuery(`
      SELECT TOP 8 o.Name, ISNULL(o.LogoURL,'') as LogoURL, COUNT(*) as cnt
      FROM Jobs j JOIN Organizations o ON j.OrganizationID=o.OrganizationID
      WHERE j.ExternalJobID LIKE 'direct_%' AND j.CreatedAt >= DATEADD(day,-7,GETUTCDATE()) AND j.Status='Published'
      GROUP BY o.Name, o.LogoURL ORDER BY cnt DESC
    `, []);

    // Get NEW companies added this week (first time appearing in direct jobs)
    const newCompanies = await dbService.executeQuery(`
      SELECT o.Name, ISNULL(o.LogoURL,'') as LogoURL, COUNT(*) as cnt
      FROM Jobs j JOIN Organizations o ON j.OrganizationID=o.OrganizationID
      WHERE j.ExternalJobID LIKE 'direct_%' AND j.Status='Published'
      GROUP BY o.Name, o.LogoURL
      HAVING MIN(j.CreatedAt) >= DATEADD(day,-7,GETUTCDATE())
      ORDER BY cnt DESC
    `, []);

    if (s.newJobsThisWeek === 0) {
      console.log('📭 Weekly digest: No new jobs this week, skipping');
      return result;
    }

    // Build company logos HTML
    const topCompaniesHtml = topCompanies.recordset.map((c: any) =>
      `<td style="text-align:center;padding:8px;">
        ${c.LogoURL ? `<img src="${c.LogoURL}" width="36" height="36" style="border-radius:10px;border:1px solid #eee;" />` :
        `<div style="width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;text-align:center;line-height:36px;font-weight:700;font-size:15px;margin:0 auto;">${c.Name.charAt(0)}</div>`}
        <p style="margin:4px 0 0;font-size:11px;color:#666;">${c.Name}</p>
        <p style="margin:0;font-size:10px;color:#999;">${c.cnt} jobs</p>
      </td>`
    ).join('');

    const newCompaniesText = newCompanies.recordset.length > 0
      ? newCompanies.recordset.map((c: any) => `${c.Name} (${c.cnt})`).join(', ')
      : null;

    // Build subject line with brand names
    const brandNames = topCompanies.recordset.slice(0, 3).map((c: any) => c.Name).join(', ');
    const subject = `🚀 This week on RefOpen: ${s.newDirectJobs} direct jobs from ${brandNames} & more`;

    const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;background:#fff;">
      <!-- Header -->
      <div style="background:linear-gradient(135deg,#1e1b4b,#312e81);padding:28px 24px;border-radius:0 0 16px 16px;">
        <h1 style="margin:0;color:#fff;font-size:22px;">📊 Your Weekly Job Market Update</h1>
        <p style="margin:6px 0 0;color:rgba(255,255,255,0.7);font-size:13px;">Week of ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
      </div>

      <div style="padding:24px;">
        <!-- Stats Cards -->
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
          <tr>
            <td style="padding:4px;">
              <div style="background:#f0fdf4;border-radius:12px;padding:16px;text-align:center;">
                <p style="margin:0;font-size:24px;font-weight:800;color:#16a34a;">${s.newJobsThisWeek.toLocaleString()}</p>
                <p style="margin:4px 0 0;font-size:11px;color:#666;">New Jobs</p>
              </div>
            </td>
            <td style="padding:4px;">
              <div style="background:#eff6ff;border-radius:12px;padding:16px;text-align:center;">
                <p style="margin:0;font-size:24px;font-weight:800;color:#2563eb;">${s.newDirectJobs.toLocaleString()}</p>
                <p style="margin:4px 0 0;font-size:11px;color:#666;">Direct Company Jobs</p>
              </div>
            </td>
            <td style="padding:4px;">
              <div style="background:#faf5ff;border-radius:12px;padding:16px;text-align:center;">
                <p style="margin:0;font-size:24px;font-weight:800;color:#7c3aed;">${s.newDirectCompanies}</p>
                <p style="margin:4px 0 0;font-size:11px;color:#666;">Companies Hiring</p>
              </div>
            </td>
          </tr>
        </table>

        <!-- Top Hiring Companies -->
        <h2 style="font-size:16px;margin:0 0 12px;color:#1a1a1a;">🏢 Top Hiring This Week</h2>
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
          <tr>${topCompaniesHtml}</tr>
        </table>

        ${newCompaniesText ? `
        <!-- Newly Added Companies -->
        <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:16px;margin-bottom:24px;">
          <p style="margin:0 0 6px;font-size:14px;font-weight:700;color:#92400e;">✨ New on RefOpen this week</p>
          <p style="margin:0;font-size:13px;color:#78350f;">${newCompaniesText}</p>
        </div>
        ` : ''}

        <!-- CTA -->
        <div style="text-align:center;margin:24px 0;">
          <a href="${APP_URL}/jobs/browse" style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;padding:14px 32px;border-radius:25px;text-decoration:none;font-weight:700;font-size:15px;">Browse All Jobs →</a>
        </div>

        <p style="text-align:center;font-size:12px;color:#999;margin-top:24px;">
          Direct from 100+ company career pages — NVIDIA, Anthropic, SpaceX, Airbnb, Databricks & more
        </p>
      </div>
    </div>`;

    // Get all eligible users
    const users = await dbService.executeQuery(`
      SELECT u.UserID, u.Email, u.FirstName
      FROM Users u
      INNER JOIN Applicants a ON u.UserID = a.UserID
      LEFT JOIN NotificationPreferences np ON u.UserID = np.UserID
      WHERE u.LastLoginAt >= DATEADD(MONTH, -1, GETUTCDATE())
        AND u.IsActive = 1 AND u.Email IS NOT NULL AND u.Email != ''
        AND u.UserType = 'JobSeeker'
        AND COALESCE(np.DailyJobRecommendationEmail, 1) = 1
    `, []);

    console.log(`📧 Weekly digest: Sending to ${users.recordset.length} users`);

    // Send in batches of 10
    for (let i = 0; i < users.recordset.length; i += 10) {
      const batch = users.recordset.slice(i, i + 10);
      await Promise.allSettled(batch.map(async (user: any) => {
        try {
          const personalHtml = html.replace('Your Weekly', `${user.FirstName || 'Hey'}, Your Weekly`);
          await EmailService.send({
            to: user.Email,
            subject,
            html: personalHtml,
            text: `This week: ${s.newJobsThisWeek} new jobs, ${s.newDirectJobs} direct company jobs. Browse at ${APP_URL}/jobs`,
            userId: user.UserID,
            emailType: 'weekly_digest'
          });
          result.sent++;
        } catch { result.failed++; }
      }));
      await new Promise(r => setTimeout(r, 1000));
    }

    console.log(`✅ Weekly digest: ${result.sent} sent, ${result.failed} failed`);
  } catch (error: any) {
    console.error('❌ Weekly digest failed:', error.message);
  }

  return result;
}

// ═══════════════════════════════════════════════════════════════
// 2. SAVED JOB EXPIRING NUDGE
//    Runs daily — alerts users whose saved jobs expire in 5 days
// ═══════════════════════════════════════════════════════════════

export async function sendSavedJobExpiringNudges(): Promise<{ sent: number }> {
  const result = { sent: 0 };

  try {
    // Find saved jobs expiring in 4-6 days (window to avoid sending twice)
    const expiringJobs = await dbService.executeQuery(`
      SELECT
        sj.UserID, u.Email, u.FirstName,
        j.JobID, j.Title, o.Name as CompanyName, j.Location, j.ExpiresAt
      FROM SavedJobs sj
      JOIN Jobs j ON sj.JobID = j.JobID
      JOIN Organizations o ON j.OrganizationID = o.OrganizationID
      JOIN Users u ON sj.UserID = u.UserID
      WHERE j.Status = 'Published'
        AND j.ExpiresAt BETWEEN DATEADD(day, 4, GETUTCDATE()) AND DATEADD(day, 6, GETUTCDATE())
        AND u.IsActive = 1 AND u.Email IS NOT NULL
      ORDER BY sj.UserID, j.ExpiresAt ASC
    `, []);

    if (expiringJobs.recordset.length === 0) {
      console.log('📭 No saved jobs expiring soon');
      return result;
    }

    // Group by user
    const userJobs = new Map<string, { user: any; jobs: any[] }>();
    for (const row of expiringJobs.recordset) {
      if (!userJobs.has(row.UserID)) {
        userJobs.set(row.UserID, { user: { UserID: row.UserID, Email: row.Email, FirstName: row.FirstName }, jobs: [] });
      }
      userJobs.get(row.UserID)!.jobs.push(row);
    }

    console.log(`⏰ Saved job expiring: ${userJobs.size} users, ${expiringJobs.recordset.length} jobs`);

    for (const [userId, { user, jobs }] of userJobs) {
      try {
        const jobListHtml = jobs.map(j =>
          `<li style="margin-bottom:8px;">
            <a href="${APP_URL}/job-details/${j.JobID}" style="color:#6366f1;font-weight:600;text-decoration:none;">${j.Title}</a>
            <span style="color:#888;font-size:12px;"> at ${j.CompanyName}</span>
          </li>`
        ).join('');

        const subject = jobs.length === 1
          ? `⏰ Your saved job "${jobs[0].Title}" at ${jobs[0].CompanyName} expires soon`
          : `⏰ ${jobs.length} of your saved jobs are expiring soon`;

        const html = `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;">
          <div style="padding:24px;">
            <h2 style="margin:0 0 8px;color:#1a1a1a;">⏰ Act fast, ${user.FirstName || 'there'}!</h2>
            <p style="color:#666;font-size:14px;margin:0 0 16px;">${jobs.length === 1 ? 'A job you saved is' : `${jobs.length} jobs you saved are`} expiring in 5 days:</p>
            <ul style="padding-left:20px;margin:0 0 20px;">${jobListHtml}</ul>
            <div style="text-align:center;">
              <a href="${APP_URL}/saved-jobs" style="display:inline-block;background:#6366f1;color:#fff;padding:12px 28px;border-radius:25px;text-decoration:none;font-weight:700;">View Saved Jobs →</a>
            </div>
          </div>
        </div>`;

        await EmailService.send({
          to: user.Email, subject, html,
          text: `${jobs.length} saved job(s) expiring soon. View at ${APP_URL}/saved-jobs`,
          userId, emailType: 'saved_job_expiring'
        });

        // In-app notification
        await InAppNotificationService.createSafe({
          userId,
          title: `⏰ ${jobs.length} saved job${jobs.length > 1 ? 's' : ''} expiring soon`,
          body: jobs.length === 1
            ? `"${jobs[0].Title}" at ${jobs[0].CompanyName} expires in 5 days. Apply now!`
            : `${jobs.length} of your saved jobs expire in 5 days. Don't miss out!`,
          icon: 'time',
          actionUrl: '/saved-jobs',
          notificationType: 'job_recommendations',
          expiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        });

        result.sent++;
      } catch (error: any) {
        console.warn(`⚠️ Expiring nudge failed for ${user.Email}:`, error.message);
      }
    }

    console.log(`✅ Saved job expiring: ${result.sent} users notified`);
  } catch (error: any) {
    console.error('❌ Saved job expiring nudge failed:', error.message);
  }

  return result;
}

// ═══════════════════════════════════════════════════════════════
// 3. ONBOARDING DRIP EMAILS
//    Day 3: Complete your profile
//    Day 7: Try AI recommendations
// ═══════════════════════════════════════════════════════════════

export async function sendOnboardingDripEmails(): Promise<{ sent: number }> {
  const result = { sent: 0 };

  try {
    // Day 3 users: Created 3 days ago, haven't completed profile
    const day3Users = await dbService.executeQuery(`
      SELECT u.UserID, u.Email, u.FirstName
      FROM Users u
      INNER JOIN Applicants a ON u.UserID = a.UserID
      WHERE u.CreatedAt BETWEEN DATEADD(day, -4, GETUTCDATE()) AND DATEADD(day, -2, GETUTCDATE())
        AND u.IsActive = 1 AND u.Email IS NOT NULL AND u.UserType = 'JobSeeker'
        AND (a.ResumeURL IS NULL OR a.PreferredJobTypes IS NULL OR a.PreferredLocations IS NULL)
        AND NOT EXISTS (SELECT 1 FROM EmailLogs e WHERE e.UserID = u.UserID AND e.EmailType = 'onboarding_day3')
    `, []);

    console.log(`📧 Onboarding Day 3: ${day3Users.recordset.length} users`);

    for (const user of day3Users.recordset) {
      try {
        const subject = `${user.FirstName || 'Hey'}, complete your profile for better job matches 🎯`;
        const html = `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
          <h2 style="color:#1a1a1a;">Almost there, ${user.FirstName || 'there'}! 🎯</h2>
          <p style="color:#666;font-size:14px;">You signed up 3 days ago but your profile isn't complete yet. A complete profile helps us match you with the right jobs.</p>
          <div style="background:#f8f9fa;border-radius:12px;padding:16px;margin:16px 0;">
            <p style="margin:0 0 8px;font-weight:600;color:#1a1a1a;">Quick wins:</p>
            <p style="margin:4px 0;font-size:13px;color:#666;">✅ Upload your resume (takes 10 seconds)</p>
            <p style="margin:4px 0;font-size:13px;color:#666;">✅ Set your preferred job type & location</p>
            <p style="margin:4px 0;font-size:13px;color:#666;">✅ Add your work experience</p>
          </div>
          <div style="text-align:center;margin:24px 0;">
            <a href="${APP_URL}/profile" style="display:inline-block;background:#6366f1;color:#fff;padding:12px 28px;border-radius:25px;text-decoration:none;font-weight:700;">Complete Profile →</a>
          </div>
          <p style="font-size:12px;color:#999;text-align:center;">Users with complete profiles get 3× more relevant job matches.</p>
        </div>`;

        await EmailService.send({
          to: user.Email, subject, html,
          text: 'Complete your profile for better job matches. Upload resume, set preferences.',
          userId: user.UserID, emailType: 'onboarding_day3'
        });
        result.sent++;
      } catch {}
    }

    // Day 7 users: Created 7 days ago, haven't used AI recommendations
    const day7Users = await dbService.executeQuery(`
      SELECT u.UserID, u.Email, u.FirstName
      FROM Users u
      WHERE u.CreatedAt BETWEEN DATEADD(day, -8, GETUTCDATE()) AND DATEADD(day, -6, GETUTCDATE())
        AND u.IsActive = 1 AND u.Email IS NOT NULL AND u.UserType = 'JobSeeker'
        AND NOT EXISTS (SELECT 1 FROM EmailLogs e WHERE e.UserID = u.UserID AND e.EmailType = 'onboarding_day7')
    `, []);

    console.log(`📧 Onboarding Day 7: ${day7Users.recordset.length} users`);

    for (const user of day7Users.recordset) {
      try {
        const subject = `${user.FirstName || 'Hey'}, have you tried AI job recommendations? ✨`;
        const html = `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
          <h2 style="color:#1a1a1a;">Unlock smarter job search ✨</h2>
          <p style="color:#666;font-size:14px;">${user.FirstName || 'Hey'}, you've been on RefOpen for a week! Have you tried our AI-powered job recommendations?</p>
          <div style="background:linear-gradient(135deg,#1e1b4b,#312e81);border-radius:16px;padding:24px;margin:16px 0;text-align:center;">
            <p style="color:#c4b5fd;font-size:12px;margin:0 0 6px;text-transform:uppercase;letter-spacing:1px;">AI Powered</p>
            <h3 style="color:#fff;margin:0 0 8px;font-size:18px;">50 Personalized Job Matches</h3>
            <p style="color:rgba(255,255,255,0.7);font-size:13px;margin:0 0 16px;">Based on your skills, experience, and preferences</p>
            <a href="${APP_URL}/ai-jobs" style="display:inline-block;background:#fff;color:#312e81;padding:12px 28px;border-radius:25px;text-decoration:none;font-weight:700;">Get AI Recommendations →</a>
          </div>
          <p style="font-size:12px;color:#999;text-align:center;">Also try: Ask for referrals from employees at your dream company!</p>
        </div>`;

        await EmailService.send({
          to: user.Email, subject, html,
          text: 'Try AI-powered job recommendations on RefOpen.',
          userId: user.UserID, emailType: 'onboarding_day7'
        });
        result.sent++;
      } catch {}
    }

    console.log(`✅ Onboarding drip: ${result.sent} emails sent`);
  } catch (error: any) {
    console.error('❌ Onboarding drip failed:', error.message);
  }

  return result;
}

// ═══════════════════════════════════════════════════════════════
// 4. SIMILAR JOBS NOTIFICATION
//    Runs daily — for users who saved/viewed jobs yesterday,
//    notify about similar new ones
// ═══════════════════════════════════════════════════════════════

export async function sendSimilarJobNotifications(): Promise<{ sent: number }> {
  const result = { sent: 0 };

  try {
    // Get users who saved jobs in the last 2 days
    const recentSaves = await dbService.executeQuery(`
      SELECT TOP 50
        sj.UserID, u.FirstName, u.Email,
        j.Title as SavedTitle, o.Name as SavedCompany, j.JobTypeID, j.WorkplaceTypeID,
        j.OrganizationID, j.ExperienceMin, j.ExperienceMax
      FROM SavedJobs sj
      JOIN Jobs j ON sj.JobID = j.JobID
      JOIN Organizations o ON j.OrganizationID = o.OrganizationID
      JOIN Users u ON sj.UserID = u.UserID
      WHERE sj.CreatedAt >= DATEADD(day, -2, GETUTCDATE())
        AND u.IsActive = 1 AND u.Email IS NOT NULL
      ORDER BY sj.CreatedAt DESC
    `, []);

    if (recentSaves.recordset.length === 0) {
      console.log('📭 Similar jobs: No recent saves');
      return result;
    }

    // Group by user (take first saved job as reference)
    const userRefs = new Map<string, any>();
    for (const row of recentSaves.recordset) {
      if (!userRefs.has(row.UserID)) userRefs.set(row.UserID, row);
    }

    console.log(`🔍 Similar jobs: ${userRefs.size} users with recent saves`);

    for (const [userId, ref] of userRefs) {
      try {
        // Find similar jobs (same job type, similar experience, different company, posted recently)
        const similar = await dbService.executeQuery(`
          SELECT TOP 5 j.JobID, j.Title, o.Name as CompanyName, j.Location
          FROM Jobs j
          JOIN Organizations o ON j.OrganizationID = o.OrganizationID
          WHERE j.Status = 'Published'
            AND j.JobTypeID = @param0
            AND j.OrganizationID != @param1
            AND j.PublishedAt >= DATEADD(day, -3, GETUTCDATE())
            AND NOT EXISTS (SELECT 1 FROM SavedJobs s WHERE s.UserID = @param2 AND s.JobID = j.JobID)
          ORDER BY j.PublishedAt DESC
        `, [ref.JobTypeID, ref.OrganizationID, userId]);

        if (similar.recordset.length === 0) continue;

        const count = similar.recordset.length;
        const firstJob = similar.recordset[0];

        // In-app notification only (not email — don't want to spam)
        await InAppNotificationService.createSafe({
          userId,
          title: `💡 ${count} jobs similar to "${ref.SavedTitle}"`,
          body: `${firstJob.Title} at ${firstJob.CompanyName} and ${count - 1} more match your interest.`,
          icon: 'briefcase',
          actionUrl: '/jobs',
          notificationType: 'job_recommendations',
          expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        });

        result.sent++;
      } catch {}
    }

    console.log(`✅ Similar jobs: ${result.sent} notifications sent`);
  } catch (error: any) {
    console.error('❌ Similar jobs failed:', error.message);
  }

  return result;
}
