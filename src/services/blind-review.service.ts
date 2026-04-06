/**
 * Blind Review Service
 * 
 * Core logic for anonymous profile reviews by verified referrers.
 * 
 * Flow:
 * 1. Applicant submits: target company + role + resume/profile
 * 2. AI anonymizes the profile (strips PII) and gives instant preliminary score
 * 3. Matched referrers at target company see anonymized profile card
 * 4. Referrers rate (1-5), say would-refer yes/no, give feedback
 * 5. AI aggregates human feedback into a clean summary for applicant
 * 
 * Uses common AIService layer (Groq primary, Gemini fallback).
 */

import { dbService } from './database.service';
import { AIService } from './ai.service';

// ── AI API Keys (dedicated Blind Review keys, separate quota — KV-backed in prod) ──
const GROQ_API_KEY = process.env.GROQ_BLIND_REVIEW_API_KEY || '';
const GEMINI_API_KEY = process.env.GEMINI_BLIND_REVIEW_API_KEY || '';

// ── Interfaces ─────────────────────────────────────────────────

export interface BlindReviewSubmitRequest {
  userId: string;
  applicantId: string;
  organizationId: number;
  targetRole: string;
  sourceType: 'resume' | 'profile';
  resumeId?: string;        // Required if sourceType = 'resume'
}

export interface AnonymizedProfile {
  experienceYears: number;
  educationLevel: string;
  fieldOfStudy: string;
  institution?: string;     // Anonymized: "Top-tier engineering college" not exact name
  gpa?: string;
  skills: string[];
  recentRoles: Array<{
    title: string;    company?: string;        // Actual company name (kept for referrability)    durationMonths: number;
    industry?: string;
    highlights?: string[];   // Key achievements/responsibilities (anonymized)
  }>;
  projects?: Array<{
    name: string;            // Anonymized project name
    description: string;     // What they built (anonymized)
    technologies?: string[];
  }>;
  certifications: string[];
  summary: string;          // AI-generated anonymized summary
}

export interface AIScoreResult {
  score: number;            // 0-100
  strengths: string[];
  weaknesses: string[];
  redFlags: string[];
  recommendation: string;   // One-line verdict
}

export interface BlindReviewResult {
  requestId: string;
  anonymizedProfile: AnonymizedProfile;
  aiScore: AIScoreResult;
  status: string;
  organizationName: string;
  targetRole: string;
  createdAt: string;
  expiresAt: string;
}

export interface AggregatedFeedback {
  averageRating: number;
  wouldReferPercent: number;
  averageProfileFit: number;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  summary: string;          // AI-synthesized narrative
  responseCount: number;
}

// ── Service ────────────────────────────────────────────────────

export class BlindReviewService {

  /**
   * Submit a new blind review request.
   * 1. Fetch profile data (from resume or profile tables)
   * 2. AI anonymize → produce anonymized profile card
   * 3. AI score → preliminary referrability score
   * 4. Insert into BlindReviewRequests
   * 5. Return instant results (AI score + anonymized preview)
   */
  static async submitReview(request: BlindReviewSubmitRequest): Promise<BlindReviewResult> {
    const startTime = Date.now();

    // ── 1. Get raw profile data ──────────────────────────────
    let rawProfileText = '';

    if (request.sourceType === 'resume' && request.resumeId) {
      // Fetch parsed resume text
      const resumeResult = await dbService.executeQuery(
        `SELECT ParsedResumeText, ResumeLabel FROM ApplicantResumes 
         WHERE ResumeID = @param0 AND ApplicantID = @param1 AND IsDeleted = 0`,
        [request.resumeId, request.applicantId]
      );
      if (!resumeResult.recordset?.length || !resumeResult.recordset[0].ParsedResumeText) {
        throw new Error('Resume not found or has no parsed text. Please upload a resume with text content.');
      }
      rawProfileText = resumeResult.recordset[0].ParsedResumeText;
    } else {
      // Build from profile fields
      rawProfileText = await this.buildProfileText(request.applicantId);
      if (rawProfileText.length < 50) {
        throw new Error('Your profile has too little information. Please upload a resume or complete your profile first.');
      }
    }

    // ── 2. Get target company info ───────────────────────────
    const orgResult = await dbService.executeQuery(
      `SELECT Name, Industry, Tier FROM Organizations WHERE OrganizationID = @param0`,
      [request.organizationId]
    );
    if (!orgResult.recordset?.length) {
      throw new Error('Target company not found.');
    }
    const org = orgResult.recordset[0];

    // ── 3. AI: Anonymize + Score (single call for efficiency) ──
    const prompt = this.buildAnonymizeAndScorePrompt(rawProfileText, org.Name, request.targetRole, org.Industry || '');
    
    const aiResult = await AIService.call({
      prompt,
      groqApiKey: GROQ_API_KEY,
      geminiApiKey: GEMINI_API_KEY,
      options: {
        temperature: 0.3,
        maxTokens: 4096,
        jsonMode: true,
        systemMessage: 'You are an expert career advisor and recruiter. Respond only with valid JSON.',
      },
    });

    const parsed = this.parseAIResponse(aiResult.text);
    const anonymizedProfile: AnonymizedProfile = parsed.anonymizedProfile;
    const aiScore: AIScoreResult = parsed.aiScore;

    // ── 4. Insert request into DB ────────────────────────────
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000); // 72h TTL

    const insertResult = await dbService.executeQuery(
      `INSERT INTO BlindReviewRequests 
        (UserID, ApplicantID, OrganizationID, TargetRole, SourceType, ResumeID, 
         AnonymizedProfile, AIScore, AIAnalysis, Status, ExpiresAt)
       OUTPUT INSERTED.RequestID
       VALUES (@param0, @param1, @param2, @param3, @param4, @param5,
               @param6, @param7, @param8, 'pending', @param9)`,
      [
        request.userId,
        request.applicantId,
        request.organizationId,
        request.targetRole,
        request.sourceType,
        request.resumeId || null,
        JSON.stringify(anonymizedProfile),
        aiScore.score,
        JSON.stringify(aiScore),
        expiresAt,
      ]
    );

    const requestId = insertResult.recordset[0].RequestID;
    const elapsedMs = Date.now() - startTime;

    return {
      requestId,
      anonymizedProfile,
      aiScore,
      status: 'pending',
      organizationName: org.Name,
      targetRole: request.targetRole,
      createdAt: new Date().toISOString(),
      expiresAt: expiresAt.toISOString(),
    };
  }

  /**
   * Build profile text from Applicants + WorkExperiences tables
   */
  private static async buildProfileText(applicantId: string): Promise<string> {
    const [profileResult, workResult] = await Promise.all([
      dbService.executeQuery(
        `SELECT a.Headline, a.Summary, a.CurrentJobTitle, a.PrimarySkills, a.SecondarySkills,
                a.HighestEducation, a.FieldOfStudy, a.GraduationYear, a.TotalExperienceMonths,
                a.Certifications, a.Languages, a.PreferredRoles, a.CurrentCompanyName,
                a.Institution, a.GPA,
                u.FirstName, u.LastName
         FROM Applicants a
         JOIN Users u ON a.UserID = u.UserID
         WHERE a.ApplicantID = @param0`,
        [applicantId]
      ),
      dbService.executeQuery(
        `SELECT we.JobTitle, we.CompanyName, we.Department, we.StartDate, we.EndDate, 
                we.IsCurrent, we.Description, we.Achievements, we.Skills, we.Location,
                o.Name AS OrgName, o.Industry AS OrgIndustry
         FROM WorkExperiences we
         LEFT JOIN Organizations o ON we.OrganizationID = o.OrganizationID
         WHERE we.ApplicantID = @param0 AND we.IsActive = 1
         ORDER BY we.StartDate DESC`,
        [applicantId]
      ),
    ]);

    if (!profileResult.recordset?.length) return '';

    const p = profileResult.recordset[0];
    const parts: string[] = [];

    parts.push(`Name: ${p.FirstName} ${p.LastName}`);
    if (p.Headline) parts.push(`Headline: ${p.Headline}`);
    if (p.Summary) parts.push(`Summary: ${p.Summary}`);
    if (p.CurrentJobTitle) parts.push(`Current Role: ${p.CurrentJobTitle}`);
    if (p.CurrentCompanyName) parts.push(`Current Company: ${p.CurrentCompanyName}`);
    if (p.PrimarySkills) parts.push(`Primary Skills: ${p.PrimarySkills}`);
    if (p.SecondarySkills) parts.push(`Secondary Skills: ${p.SecondarySkills}`);
    if (p.HighestEducation) parts.push(`Education: ${p.HighestEducation}${p.FieldOfStudy ? ' in ' + p.FieldOfStudy : ''}${p.GraduationYear ? ' (' + p.GraduationYear + ')' : ''}`);
    if (p.Institution) parts.push(`Institution: ${p.Institution}`);
    if (p.GPA) parts.push(`GPA: ${p.GPA}`);
    if (p.TotalExperienceMonths) parts.push(`Total Experience: ${Math.round(p.TotalExperienceMonths / 12)} years`);
    if (p.Certifications) parts.push(`Certifications: ${p.Certifications}`);
    if (p.Languages) parts.push(`Languages: ${p.Languages}`);

    if (workResult.recordset?.length) {
      parts.push('\nWork Experience:');
      for (const w of workResult.recordset) {
        const company = w.OrgName || w.CompanyName || 'Unknown';
        const duration = w.IsCurrent ? 'Present' : (w.EndDate ? new Date(w.EndDate).getFullYear().toString() : '');
        const start = w.StartDate ? new Date(w.StartDate).getFullYear().toString() : '';
        parts.push(`- ${w.JobTitle} at ${company} (${start} - ${duration})`);
        if (w.Description) parts.push(`  Description: ${w.Description}`);
        if (w.Achievements) parts.push(`  Achievements: ${w.Achievements}`);
        if (w.Skills) parts.push(`  Skills: ${w.Skills}`);
      }
    }

    return parts.join('\n');
  }

  /**
   * Build the AI prompt for combined anonymization + scoring
   */
  private static buildAnonymizeAndScorePrompt(
    rawText: string,
    companyName: string,
    targetRole: string,
    companyIndustry: string
  ): string {
    return `You are an expert recruiter and career advisor. I need you to do TWO things with this profile:

## TASK 1: ANONYMIZE
Strip ONLY personal identifiers from this profile:
- Remove the person's name completely (don't include any name)
- Remove email addresses, phone numbers, URLs, LinkedIn/GitHub profiles
- Remove specific home addresses
- Remove names of managers or references
- KEEP company names as-is (e.g. "IBM", "Google", "L&T") — these are professional credentials, not personal identity
- KEEP college/university names as-is (e.g. "BMS College of Engineering") — these help assess the candidate
- KEEP city names for work locations (e.g. "Bangalore", "Jakarta") — these provide context
- KEEP: job titles, skills, years of experience, education level, field of study, GPA, certifications
- KEEP: project descriptions, technologies, achievements

## TASK 2: SCORE
Evaluate how likely a hiring insider at ${companyName} (${companyIndustry || 'Technology'} industry) would refer this person for a "${targetRole}" role.
Score from 0-100 where:
- 90-100: Slam dunk — perfect fit, would immediately refer
- 70-89: Strong candidate — would refer with confidence  
- 50-69: Decent — would consider referring, some gaps
- 30-49: Weak — significant gaps, unlikely to refer
- 0-29: Not a fit — major misalignment

## PROFILE TO ANALYZE:
${rawText.substring(0, 8000)}

## RESPOND WITH THIS EXACT JSON STRUCTURE:
{
  "anonymizedProfile": {
    "experienceYears": <number>,
    "educationLevel": "<highest degree>",
    "fieldOfStudy": "<field>",
    "institution": "<actual college/university name as written in the profile>",
    "gpa": "<GPA if mentioned, else null>",
    "skills": ["<skill1>", "<skill2>", ...],
    "recentRoles": [
      {
        "title": "<job title>",
        "company": "<actual company name as written in the profile>",
        "durationMonths": <calculate from dates: e.g. May 2021 to May 2024 = 36 months. MUST be > 0 if dates exist>,
        "industry": "<industry>",
        "highlights": ["<key achievement/responsibility 1>", "<key achievement 2>", "<key achievement 3>"]
      }
    ],
    "projects": [
      {
        "name": "<project name — keep as-is but remove client company names like 'CITI Bank' if it reveals the candidate>",
        "description": "<1-2 sentence anonymized description of what was built>",
        "technologies": ["<tech1>", "<tech2>"]
      }
    ],
    "certifications": ["<cert1>", ...],
    "summary": "<3-4 sentence professional summary. Include company names and key technologies. Only remove the person's name.>"
  },
  "aiScore": {
    "score": <0-100>,
    "strengths": ["<strength1>", "<strength2>", "<strength3>"],
    "weaknesses": ["<weakness1>", "<weakness2>"],
    "redFlags": ["<flag1>"] or [],
    "recommendation": "<one sentence verdict>"
  }
}`;
  }

  /**
   * Parse AI JSON response with safe fallbacks
   */
  private static parseAIResponse(text: string): { anonymizedProfile: AnonymizedProfile; aiScore: AIScoreResult } {
    try {
      // Strip markdown fences if present
      let cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
      // Find JSON object
      const start = cleaned.indexOf('{');
      const end = cleaned.lastIndexOf('}');
      if (start === -1 || end === -1) throw new Error('No JSON found');
      cleaned = cleaned.substring(start, end + 1);
      // Remove trailing commas before } or ]
      cleaned = cleaned.replace(/,\s*([}\]])/g, '$1');

      const parsed = JSON.parse(cleaned);

      // Safe extraction with defaults
      const ap = parsed.anonymizedProfile || {};
      const as2 = parsed.aiScore || {};

      return {
        anonymizedProfile: {
          experienceYears: ap.experienceYears || 0,
          educationLevel: ap.educationLevel || 'Not specified',
          fieldOfStudy: ap.fieldOfStudy || 'Not specified',
          institution: ap.institution || undefined,
          gpa: ap.gpa || undefined,
          skills: Array.isArray(ap.skills) ? ap.skills : [],
          recentRoles: Array.isArray(ap.recentRoles) ? ap.recentRoles.map((r: any) => ({
            title: r.title || 'Unknown Role',
            company: r.company || undefined,
            durationMonths: r.durationMonths || 0,
            industry: r.industry || '',
            highlights: Array.isArray(r.highlights) ? r.highlights : [],
          })) : [],
          projects: Array.isArray(ap.projects) ? ap.projects.map((p: any) => ({
            name: p.name || 'Project',
            description: p.description || '',
            technologies: Array.isArray(p.technologies) ? p.technologies : [],
          })) : [],
          certifications: Array.isArray(ap.certifications) ? ap.certifications : [],
          summary: ap.summary || 'Profile summary not available.',
        },
        aiScore: {
          score: Math.min(100, Math.max(0, as2.score || 50)),
          strengths: Array.isArray(as2.strengths) ? as2.strengths : [],
          weaknesses: Array.isArray(as2.weaknesses) ? as2.weaknesses : [],
          redFlags: Array.isArray(as2.redFlags) ? as2.redFlags : [],
          recommendation: as2.recommendation || 'Analysis complete.',
        },
      };
    } catch (err) {
      console.error('Failed to parse blind review AI response:', err);
      // Return safe defaults rather than crashing
      return {
        anonymizedProfile: {
          experienceYears: 0,
          educationLevel: 'Not specified',
          fieldOfStudy: 'Not specified',
          skills: [],
          recentRoles: [],
          certifications: [],
          summary: 'Unable to generate anonymized profile. Please try again.',
        },
        aiScore: {
          score: 50,
          strengths: ['Profile submitted for review'],
          weaknesses: ['AI analysis unavailable — waiting for human review'],
          redFlags: [],
          recommendation: 'AI scoring unavailable. Human reviewers will evaluate your profile.',
        },
      };
    }
  }

  /**
   * Get review status + results for an applicant's request
   */
  static async getRequestStatus(requestId: string, userId: string): Promise<any> {
    const result = await dbService.executeQuery(
      `SELECT br.*, o.Name AS OrganizationName, o.LogoURL AS OrganizationLogo
       FROM BlindReviewRequests br
       JOIN Organizations o ON br.OrganizationID = o.OrganizationID
       WHERE br.RequestID = @param0 AND br.UserID = @param1`,
      [requestId, userId]
    );

    if (!result.recordset?.length) {
      throw new Error('Review request not found.');
    }

    const req = result.recordset[0];

    // Get responses if any
    const responses = await dbService.executeQuery(
      `SELECT WouldRefer, OverallRating, StrengthsFeedback, WeaknessesFeedback, 
              Suggestions, ProfileFit, CreatedAt
       FROM BlindReviewResponses
       WHERE RequestID = @param0
       ORDER BY CreatedAt ASC`,
      [requestId]
    );

    return {
      requestId: req.RequestID,
      status: req.Status,
      targetRole: req.TargetRole,
      organizationName: req.OrganizationName,
      organizationLogo: req.OrganizationLogo,
      sourceType: req.SourceType,
      aiScore: req.AIScore,
      aiAnalysis: req.AIAnalysis ? JSON.parse(req.AIAnalysis) : null,
      anonymizedProfile: req.AnonymizedProfile ? JSON.parse(req.AnonymizedProfile) : null,
      finalScore: req.FinalScore,
      finalFeedback: req.FinalFeedback ? JSON.parse(req.FinalFeedback) : null,
      responseCount: req.ResponseCount,
      createdAt: req.CreatedAt,
      expiresAt: req.ExpiresAt,
      responses: responses.recordset.map((r: any) => ({
        wouldRefer: r.WouldRefer,
        overallRating: r.OverallRating,
        strengths: r.StrengthsFeedback,
        weaknesses: r.WeaknessesFeedback,
        suggestions: r.Suggestions,
        profileFit: r.ProfileFit,
        createdAt: r.CreatedAt,
      })),
    };
  }

  /**
   * Get all blind review requests history for a user
   */
  static async getHistory(userId: string): Promise<any[]> {
    const result = await dbService.executeQuery(
      `SELECT br.RequestID, br.TargetRole, br.Status, br.AIScore, br.FinalScore,
              br.ResponseCount, br.SourceType, br.CreatedAt, br.ExpiresAt,
              o.Name AS OrganizationName, o.LogoURL AS OrganizationLogo
       FROM BlindReviewRequests br
       JOIN Organizations o ON br.OrganizationID = o.OrganizationID
       WHERE br.UserID = @param0
       ORDER BY br.CreatedAt DESC`,
      [userId]
    );

    return result.recordset.map((r: any) => ({
      requestId: r.RequestID,
      targetRole: r.TargetRole,
      status: r.Status,
      aiScore: r.AIScore,
      finalScore: r.FinalScore,
      responseCount: r.ResponseCount,
      sourceType: r.SourceType,
      organizationName: r.OrganizationName,
      organizationLogo: r.OrganizationLogo,
      createdAt: r.CreatedAt,
      expiresAt: r.ExpiresAt,
    }));
  }

  /**
   * Get pending blind reviews for a referrer (matched by their current company)
   */
  static async getPendingForReferrer(userId: string, isAdmin: boolean = false): Promise<any[]> {
    let orgId: number | null = null;

    if (!isAdmin) {
      // Regular referrer: find their current company
      const referrerResult = await dbService.executeQuery(
        `SELECT a.CurrentOrganizationID, a.ApplicantID
         FROM Applicants a
         WHERE a.UserID = @param0 AND a.CurrentOrganizationID IS NOT NULL`,
        [userId]
      );

      if (!referrerResult.recordset?.length || !referrerResult.recordset[0].CurrentOrganizationID) {
        return []; // Referrer has no company set — can't match
      }
      orgId = referrerResult.recordset[0].CurrentOrganizationID;
    }

    // Admin sees all pending; referrer sees only their company
    const orgFilter = isAdmin ? '' : 'AND br.OrganizationID = @param0';
    const params = isAdmin ? [userId] : [orgId, userId];
    const userParam = isAdmin ? '@param0' : '@param1';

    const result = await dbService.executeQuery(
      `SELECT br.RequestID, br.TargetRole, br.AnonymizedProfile, br.AIScore,
              br.SourceType, br.CreatedAt, br.ExpiresAt, br.ResponseCount,
              o.Name AS OrganizationName, o.LogoURL AS OrganizationLogo
       FROM BlindReviewRequests br
       JOIN Organizations o ON br.OrganizationID = o.OrganizationID
       WHERE br.Status IN ('pending', 'in_review')
         AND br.ExpiresAt > GETUTCDATE()
         AND br.UserID <> ${userParam}
         ${orgFilter}
         AND NOT EXISTS (
           SELECT 1 FROM BlindReviewResponses resp 
           WHERE resp.RequestID = br.RequestID AND resp.ReviewerID = ${userParam}
         )
       ORDER BY br.CreatedAt DESC`,
      params
    );

    return result.recordset.map((r: any) => ({
      requestId: r.RequestID,
      targetRole: r.TargetRole,
      anonymizedProfile: r.AnonymizedProfile ? JSON.parse(r.AnonymizedProfile) : null,
      aiScore: r.AIScore,
      sourceType: r.SourceType,
      organizationName: r.OrganizationName,
      organizationLogo: r.OrganizationLogo,
      responseCount: r.ResponseCount,
      createdAt: r.CreatedAt,
      expiresAt: r.ExpiresAt,
    }));
  }

  /**
   * Referrer submits their review of an anonymized profile
   */
  static async submitResponse(
    requestId: string,
    reviewerId: string,
    response: {
      wouldRefer: boolean;
      overallRating: number;
      strengthsFeedback?: string;
      weaknessesFeedback?: string;
      suggestions?: string;
      profileFit?: number;
    },
    isAdmin: boolean = false
  ): Promise<{ success: boolean; message: string }> {
    // Validate rating
    if (response.overallRating < 1 || response.overallRating > 5) {
      throw new Error('Rating must be between 1 and 5.');
    }

    // Check the request exists and is reviewable
    const reqResult = await dbService.executeQuery(
      `SELECT br.RequestID, br.Status, br.ExpiresAt, br.OrganizationID, br.UserID, br.ResponseCount,
              br.TargetRole, u.Email as SeekerEmail, u.FirstName as SeekerFirstName,
              o.Name as CompanyName
       FROM BlindReviewRequests br
       JOIN Users u ON br.UserID = u.UserID
       JOIN Organizations o ON br.OrganizationID = o.OrganizationID
       WHERE br.RequestID = @param0 AND br.Status IN ('pending', 'in_review') AND br.ExpiresAt > GETUTCDATE()`,
      [requestId]
    );

    if (!reqResult.recordset?.length) {
      throw new Error('Review request not found, expired, or already completed.');
    }

    const req = reqResult.recordset[0];

    // Prevent self-review
    if (req.UserID === reviewerId) {
      throw new Error('You cannot review your own profile.');
    }

    // Verify referrer works at the target company (admin bypasses this)
    if (!isAdmin) {
      const referrerOrg = await dbService.executeQuery(
        `SELECT CurrentOrganizationID FROM Applicants WHERE UserID = @param0`,
        [reviewerId]
      );

      if (!referrerOrg.recordset?.length || referrerOrg.recordset[0].CurrentOrganizationID !== req.OrganizationID) {
        throw new Error('You can only review profiles for your current company.');
      }
    }

    // Check for duplicate response
    const dupCheck = await dbService.executeQuery(
      `SELECT 1 AS ex FROM BlindReviewResponses WHERE RequestID = @param0 AND ReviewerID = @param1`,
      [requestId, reviewerId]
    );

    if (dupCheck.recordset?.length) {
      throw new Error('You have already reviewed this profile.');
    }

    // Insert the response
    await dbService.executeQuery(
      `INSERT INTO BlindReviewResponses 
        (RequestID, ReviewerID, WouldRefer, OverallRating, StrengthsFeedback, 
         WeaknessesFeedback, Suggestions, ProfileFit)
       VALUES (@param0, @param1, @param2, @param3, @param4, @param5, @param6, @param7)`,
      [
        requestId,
        reviewerId,
        response.wouldRefer ? 1 : 0,
        response.overallRating,
        response.strengthsFeedback || null,
        response.weaknessesFeedback || null,
        response.suggestions || null,
        response.profileFit || null,
      ]
    );

    // Update response count and status
    const newCount = req.ResponseCount + 1;
    const newStatus = newCount >= 3 ? 'completed' : 'in_review';

    await dbService.executeQuery(
      `UPDATE BlindReviewRequests 
       SET ResponseCount = @param1, Status = @param2, UpdatedAt = GETUTCDATE()
       WHERE RequestID = @param0`,
      [requestId, newCount, newStatus]
    );

    // Aggregate feedback after EVERY response — submitter sees results live
    try {
      await this.aggregateFeedback(requestId);
    } catch (err) {
      console.error('Feedback aggregation failed (non-critical):', err);
    }

    // Notify the seeker (in-app + email) — fire-and-forget
    try {
      const companyName = req.CompanyName || 'the company';
      const seekerEmail = req.SeekerEmail;
      const seekerName = req.SeekerFirstName || 'there';
      const targetRole = req.TargetRole || 'your target role';

      // In-app notification
      const { default: InAppNotificationService } = await import('./inAppNotification.service');
      if (newStatus === 'completed') {
        await InAppNotificationService.notifyBlindReviewCompleted(req.UserID, companyName, newCount, requestId);
      } else {
        await InAppNotificationService.notifyBlindReviewResponse(req.UserID, companyName, newCount, requestId);
      }

      // Email notification
      if (seekerEmail) {
        const { EmailService } = await import('./emailService');
        const appUrl = process.env.APP_URL || 'https://www.refopen.com';
        const isComplete = newStatus === 'completed';
        const subject = isComplete
          ? `Your blind review for ${companyName} is complete`
          : `An insider at ${companyName} reviewed your profile`;
        const html = `
<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;background-color:#f5f5f5;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f5;padding:40px 20px;"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
  <tr><td style="background:linear-gradient(135deg,#8B5CF6 0%,#6D28D9 100%);padding:32px 40px;text-align:center;">
    <h1 style="color:#fff;margin:0;font-size:20px;font-weight:700;">${isComplete ? 'Your Blind Review is Complete' : 'New Review Received'}</h1>
  </td></tr>
  <tr><td style="padding:36px 40px;">
    <p style="color:#1a1a1a;font-size:16px;line-height:1.6;margin:0 0 16px 0;">Hi ${seekerName},</p>
    <p style="color:#4a4a4a;font-size:15px;line-height:1.7;margin:0 0 16px 0;">
      ${isComplete
        ? `<strong>${newCount} insider${newCount > 1 ? 's' : ''}</strong> at <strong>${companyName}</strong> have reviewed your profile for <strong>${targetRole}</strong>. Your final referrability score and detailed feedback are ready.`
        : `An insider at <strong>${companyName}</strong> just reviewed your anonymous profile for <strong>${targetRole}</strong>. You now have <strong>${newCount}</strong> review${newCount > 1 ? 's' : ''}.`
      }
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;"><tr><td align="center">
      <a href="${appUrl}/blind-review" style="display:inline-block;background:linear-gradient(135deg,#8B5CF6,#6D28D9);color:#fff;padding:14px 36px;border-radius:8px;text-decoration:none;font-size:16px;font-weight:700;">
        ${isComplete ? 'See Your Results' : 'View Review'}
      </a>
    </td></tr></table>
    <p style="color:#9ca3af;font-size:13px;line-height:1.6;margin:16px 0 0 0;">
      Your identity was never shared with the reviewer. All feedback is anonymous.
    </p>
  </td></tr>
  <tr><td style="padding:20px 0;border-top:1px solid #e5e7eb;">
    <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="text-align:center;">
      <img src="${appUrl}/refopen-logo.png" alt="RefOpen" width="80" style="margin-bottom:12px;">
      <p style="margin:0 0 8px 0;color:#9ca3af;font-size:12px;text-align:center;">You received this because you have a RefOpen account.</p>
      <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center;">
        <a href="${appUrl}/settings" style="color:#6b7280;text-decoration:none;">Email Preferences</a>
        <span style="color:#d1d5db;margin:0 8px;">|</span>
        <a href="${appUrl}/support" style="color:#6b7280;text-decoration:none;">Help</a>
        <span style="color:#d1d5db;margin:0 8px;">|</span>
        <a href="${appUrl}" style="color:#6b7280;text-decoration:none;">RefOpen</a>
      </p>
    </td></tr></table>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;

        await EmailService.send({
          to: seekerEmail,
          subject,
          html,
          userId: req.UserID,
          emailType: 'blind_review_response',
          referenceType: 'BlindReviewRequest',
          referenceId: requestId,
        });
      }
    } catch (notifErr) {
      console.error('Blind review notification failed (non-critical):', notifErr);
    }

    return {
      success: true,
      message: 'Thank you for your honest feedback!',
    };
  }

  /**
   * Aggregate multiple human reviews into a final score + summary using AI
   */
  static async aggregateFeedback(requestId: string): Promise<void> {
    const responses = await dbService.executeQuery(
      `SELECT WouldRefer, OverallRating, StrengthsFeedback, WeaknessesFeedback, 
              Suggestions, ProfileFit
       FROM BlindReviewResponses
       WHERE RequestID = @param0`,
      [requestId]
    );

    if (!responses.recordset?.length) return;

    const reviews = responses.recordset;
    const avgRating = reviews.reduce((s: number, r: any) => s + r.OverallRating, 0) / reviews.length;
    const wouldReferPct = Math.round((reviews.filter((r: any) => r.WouldRefer).length / reviews.length) * 100);
    const avgFit = reviews.filter((r: any) => r.ProfileFit).reduce((s: number, r: any) => s + r.ProfileFit, 0) / 
                   (reviews.filter((r: any) => r.ProfileFit).length || 1);

    // Build feedback text for AI summarization
    const feedbackText = reviews.map((r: any, i: number) => {
      return `Reviewer ${i + 1}: Rating ${r.OverallRating}/5, Would Refer: ${r.WouldRefer ? 'Yes' : 'No'}
  Strengths: ${r.StrengthsFeedback || 'N/A'}
  Weaknesses: ${r.WeaknessesFeedback || 'N/A'}
  Suggestions: ${r.Suggestions || 'N/A'}`;
    }).join('\n\n');

    // AI: Synthesize feedback
    const reviewerWord = reviews.length === 1 ? 'A company insider' : `${reviews.length} company insiders`;
    const prompt = `You are a career advisor. ${reviewerWord} reviewed an anonymous candidate profile.
Synthesize their feedback into a helpful, actionable summary for the candidate.
Remove any personally identifying info the reviewers may have accidentally included.

REVIEWER FEEDBACK:
${feedbackText}

Respond with JSON:
{
  "summary": "<3-4 sentence synthesized narrative combining all reviewers' perspectives>",
  "strengths": ["<top 3 synthesized strengths>"],
  "weaknesses": ["<top 3 synthesized areas for improvement>"],
  "suggestions": ["<top 3 actionable suggestions>"]
}`;

    try {
      const aiResult = await AIService.call({
        prompt,
        groqApiKey: GROQ_API_KEY,
        geminiApiKey: GEMINI_API_KEY,
        options: { temperature: 0.3, maxTokens: 2048, jsonMode: true },
      });

      let parsed: any;
      try {
        let cleaned = aiResult.text.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
        const start = cleaned.indexOf('{');
        const end = cleaned.lastIndexOf('}');
        cleaned = cleaned.substring(start, end + 1).replace(/,\s*([}\]])/g, '$1');
        parsed = JSON.parse(cleaned);
      } catch {
        parsed = { summary: 'Feedback received from multiple reviewers.', strengths: [], weaknesses: [], suggestions: [] };
      }

      const finalScore = Math.round(avgRating * 20); // Convert 1-5 to 0-100

      const aggregated: AggregatedFeedback = {
        averageRating: Math.round(avgRating * 10) / 10,
        wouldReferPercent: wouldReferPct,
        averageProfileFit: Math.round(avgFit * 10) / 10,
        strengths: parsed.strengths || [],
        weaknesses: parsed.weaknesses || [],
        suggestions: parsed.suggestions || [],
        summary: parsed.summary || 'Feedback received.',
        responseCount: reviews.length,
      };

      await dbService.executeQuery(
        `UPDATE BlindReviewRequests 
         SET FinalScore = @param1, FinalFeedback = @param2, UpdatedAt = GETUTCDATE()
         WHERE RequestID = @param0`,
        [requestId, finalScore, JSON.stringify(aggregated)]
      );
    } catch (err) {
      console.error('AI aggregation failed:', err);
      // Still update with raw scores
      const finalScore = Math.round(avgRating * 20);
      await dbService.executeQuery(
        `UPDATE BlindReviewRequests 
         SET FinalScore = @param1, UpdatedAt = GETUTCDATE()
         WHERE RequestID = @param0`,
        [requestId, finalScore]
      );
    }
  }

  /**
   * AI-only fallback review (when no referrers available at target company)
   */
  static async generateAIOnlyReview(requestId: string): Promise<void> {
    const reqResult = await dbService.executeQuery(
      `SELECT AnonymizedProfile, TargetRole, OrganizationID FROM BlindReviewRequests WHERE RequestID = @param0`,
      [requestId]
    );

    if (!reqResult.recordset?.length) return;
    const req = reqResult.recordset[0];

    const orgResult = await dbService.executeQuery(
      `SELECT Name, Industry, Tier FROM Organizations WHERE OrganizationID = @param0`,
      [req.OrganizationID]
    );
    const orgName = orgResult.recordset?.[0]?.Name || 'the company';
    const orgIndustry = orgResult.recordset?.[0]?.Industry || 'Technology';

    const profile = req.AnonymizedProfile || '{}';

    const prompt = `You are a senior recruiter at ${orgName} (${orgIndustry}). 
A candidate wants to know if they'd get a referral for a "${req.TargetRole}" position.

Here is their anonymized profile:
${profile}

Provide a detailed review as if you were an insider at this company. Be honest but constructive.
Consider the company's typical hiring bar, tech stack, and culture.

IMPORTANT: Clearly state this is an AI-based assessment, not a human insider's review.

Respond with JSON:
{
  "summary": "<3-4 sentence overall assessment>",
  "strengths": ["<top 3 strengths for this specific company/role>"],
  "weaknesses": ["<top 3 gaps or concerns>"],
  "suggestions": ["<top 3 actionable things to improve before applying>"],
  "wouldReferLikelihood": <0-100>,
  "fitScore": <1-5>
}`;

    try {
      const aiResult = await AIService.call({
        prompt,
        groqApiKey: GROQ_API_KEY,
        geminiApiKey: GEMINI_API_KEY,
        options: { temperature: 0.4, maxTokens: 2048, jsonMode: true },
      });

      let parsed: any;
      try {
        let cleaned = aiResult.text.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
        const s = cleaned.indexOf('{');
        const e = cleaned.lastIndexOf('}');
        cleaned = cleaned.substring(s, e + 1).replace(/,\s*([}\]])/g, '$1');
        parsed = JSON.parse(cleaned);
      } catch {
        parsed = { summary: 'AI review generated.', strengths: [], weaknesses: [], suggestions: [], wouldReferLikelihood: 50, fitScore: 3 };
      }

      const aggregated: AggregatedFeedback = {
        averageRating: parsed.fitScore || 3,
        wouldReferPercent: parsed.wouldReferLikelihood || 50,
        averageProfileFit: parsed.fitScore || 3,
        strengths: parsed.strengths || [],
        weaknesses: parsed.weaknesses || [],
        suggestions: parsed.suggestions || [],
        summary: `[AI Review] ${parsed.summary || 'Assessment generated by AI.'}`,
        responseCount: 0,
      };

      const finalScore = parsed.wouldReferLikelihood || 50;

      await dbService.executeQuery(
        `UPDATE BlindReviewRequests 
         SET FinalScore = @param1, FinalFeedback = @param2, Status = 'completed', UpdatedAt = GETUTCDATE()
         WHERE RequestID = @param0`,
        [requestId, finalScore, JSON.stringify(aggregated)]
      );
    } catch (err) {
      console.error('AI-only review generation failed:', err);
    }
  }

  /**
   * Generate AI-prefilled review for admin (sounds like a real human employee)
   */
  static async generateAdminPrefill(requestId: string): Promise<any> {
    const reqResult = await dbService.executeQuery(
      `SELECT br.AnonymizedProfile, br.TargetRole, br.AIScore, br.AIAnalysis, br.OrganizationID
       FROM BlindReviewRequests br WHERE br.RequestID = @param0`,
      [requestId]
    );

    if (!reqResult.recordset?.length) throw new Error('Review request not found.');
    const req = reqResult.recordset[0];

    const orgResult = await dbService.executeQuery(
      `SELECT Name, Industry, Tier FROM Organizations WHERE OrganizationID = @param0`,
      [req.OrganizationID]
    );
    const orgName = orgResult.recordset?.[0]?.Name || 'the company';
    const orgIndustry = orgResult.recordset?.[0]?.Industry || 'Technology';

    const profile = req.AnonymizedProfile || '{}';
    const aiAnalysis = req.AIAnalysis || '';

    const prompt = `You are a real employee at ${orgName} (${orgIndustry}) reviewing an anonymous candidate's profile for a "${req.TargetRole}" position.

Here is their anonymized profile:
${profile}

${aiAnalysis ? `AI analysis of the profile: ${aiAnalysis}` : ''}

Write your review like a normal employee. Avoid bullet points, avoid corporate language, and don't sound like an AI. Write in a natural conversational way like real people type. Sometimes use "you", sometimes "u" if it feels natural. Small casual typos are okay. Keep the tone relaxed, thoughtful, and conversational. Keep replies short and natural, not long explanations. Each field should not exceed 1 paragraph. Respond directly to what u see in the profile. Never use em dashes.

Based on the profile, decide:
1. Would you refer this person? (true/false)
2. Overall rating 1-5
3. Profile fit for role 1-5
4. Their strengths (1 short paragraph, conversational)
5. What needs improvement (1 short paragraph, conversational)
6. Your suggestions (1 short paragraph, conversational)

Respond with JSON only:
{
  "wouldRefer": true/false,
  "overallRating": 1-5,
  "profileFit": 1-5,
  "strengths": "short conversational paragraph",
  "weaknesses": "short conversational paragraph",
  "suggestions": "short conversational paragraph"
}`;

    const aiResult = await AIService.call({
      prompt,
      groqApiKey: GROQ_API_KEY,
      geminiApiKey: GEMINI_API_KEY,
      options: { temperature: 0.7, maxTokens: 1024, jsonMode: true },
    });

    try {
      return JSON.parse(aiResult.text);
    } catch {
      const jsonMatch = aiResult.text?.match(/\{[\s\S]*\}/);
      if (jsonMatch) return JSON.parse(jsonMatch[0]);
      throw new Error('Failed to parse AI response.');
    }
  }

  static async hasReferrersAtCompany(organizationId: number): Promise<{ count: number; hasReferrers: boolean }> {
    const result = await dbService.executeQuery(
      `SELECT COUNT(*) AS cnt 
       FROM Users u 
       JOIN Applicants a ON u.UserID = a.UserID 
       WHERE a.CurrentOrganizationID = @param0 
         AND u.IsVerifiedReferrer = 1 
         AND u.IsActive = 1`,
      [organizationId]
    );
    const count = result.recordset?.[0]?.cnt || 0;
    return { count, hasReferrers: count > 0 };
  }

  /**
   * Get reviews submitted BY this referrer (their review history)
   */
  static async getMyReviews(userId: string): Promise<any[]> {
    const result = await dbService.executeQuery(
      `SELECT resp.ResponseID, resp.WouldRefer, resp.OverallRating, resp.ProfileFit,
              resp.StrengthsFeedback, resp.WeaknessesFeedback, resp.Suggestions,
              resp.CreatedAt,
              req.TargetRole, req.Status AS RequestStatus, req.AIScore,
              o.Name AS OrganizationName, o.LogoURL AS OrganizationLogo
       FROM BlindReviewResponses resp
       JOIN BlindReviewRequests req ON resp.RequestID = req.RequestID
       JOIN Organizations o ON req.OrganizationID = o.OrganizationID
       WHERE resp.ReviewerID = @param0
       ORDER BY resp.CreatedAt DESC`,
      [userId]
    );

    return result.recordset.map((r: any) => ({
      responseId: r.ResponseID,
      wouldRefer: r.WouldRefer,
      overallRating: r.OverallRating,
      profileFit: r.ProfileFit,
      strengths: r.StrengthsFeedback,
      weaknesses: r.WeaknessesFeedback,
      suggestions: r.Suggestions,
      createdAt: r.CreatedAt,
      targetRole: r.TargetRole,
      requestStatus: r.RequestStatus,
      aiScore: r.AIScore,
      organizationName: r.OrganizationName,
      organizationLogo: r.OrganizationLogo,
    }));
  }

  /**
   * Cancel/delete a blind review request (seeker only, before completion)
   */
  static async cancelRequest(requestId: string, userId: string): Promise<{ success: boolean; message: string }> {
    // Verify ownership and status
    const reqResult = await dbService.executeQuery(
      `SELECT RequestID, Status, UserID FROM BlindReviewRequests WHERE RequestID = @param0`,
      [requestId]
    );

    if (!reqResult.recordset?.length) {
      throw new Error('Review request not found.');
    }

    const req = reqResult.recordset[0];

    if (req.UserID !== userId) {
      throw new Error('You can only delete your own review requests.');
    }

    if (req.Status === 'completed') {
      throw new Error('Cannot delete a completed review.');
    }

    // Soft delete: set status to cancelled
    await dbService.executeQuery(
      `UPDATE BlindReviewRequests SET Status = 'cancelled', UpdatedAt = GETUTCDATE() WHERE RequestID = @param0`,
      [requestId]
    );

    return { success: true, message: 'Review request cancelled.' };
  }
}
