/**
 * Resume Builder Service
 * 
 * State-of-the-art resume builder with:
 * - CRUD for projects, sections
 * - Template management
 * - Auto-fill from user profile data
 * - AI-powered summary, bullet rewriting, ATS scoring (Gemini)
 * - Server-side HTML→PDF generation
 * 
 * @module ResumeBuilderService
 * @since 2026-02-23
 */

import { dbService } from './database.service';

// ── Gemini AI Config ────────────────────────────────────────
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

// ── Types ───────────────────────────────────────────────────

export interface TemplateConfig {
  fontFamily: string;
  fontSize: string;
  lineHeight: string;
  primaryColor: string;
  accentColor: string;
  marginTop: string;
  marginSide: string;
  showPhoto: boolean;
  layout?: string;
  headerBg?: string;
  headerText?: string;
}

export interface PersonalInfo {
  fullName: string;
  email: string;
  phone: string;
  location: string;
  linkedin?: string;
  github?: string;
  portfolio?: string;
}

export interface SectionItem {
  id: string;
  // experience
  title?: string;
  company?: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  current?: boolean;
  bullets?: string[];
  // education
  institution?: string;
  degree?: string;
  field?: string;
  gpa?: string;
  graduationYear?: string;
  // skills
  category?: string;
  skills?: string[];
  // projects
  name?: string;
  description?: string;
  technologies?: string[];
  url?: string;
  // certifications
  certName?: string;
  issuer?: string;
  date?: string;
  // custom/generic
  text?: string;
}

export interface ResumeProject {
  ProjectID: string;
  UserID: string;
  TemplateID: number;
  Title: string;
  Status: string;
  TargetJobTitle?: string;
  TargetJobDescription?: string;
  CustomConfig?: string;
  PersonalInfo?: string;
  Summary?: string;
  MatchScore?: number;
  LastExportedAt?: string;
  TemplateDefaultConfig?: string;
  CreatedAt: string;
  UpdatedAt: string;
  sections?: ResumeSection[];
  templateName?: string;
  templateSlug?: string;
}

export interface ResumeSection {
  SectionID: string;
  ProjectID: string;
  SectionType: string;
  SectionTitle: string;
  Content: string;
  SortOrder: number;
  IsVisible: boolean;
}

// ── Service Class ───────────────────────────────────────────

export class ResumeBuilderService {

  // ============================================================
  // TEMPLATES
  // ============================================================

  /**
   * Get all active templates
   */
  static async getTemplates(): Promise<any[]> {
    const result = await dbService.executeQuery(`
      SELECT TemplateID, Name, Slug, Category, Description, ThumbnailURL,
             DefaultConfig, IsPremium, SortOrder
      FROM ResumeBuilderTemplates
      WHERE IsActive = 1
      ORDER BY SortOrder ASC
    `);
    return result.recordset.map((t: any) => ({
      ...t,
      DefaultConfig: t.DefaultConfig ? JSON.parse(t.DefaultConfig) : null,
    }));
  }

  /**
   * Get single template with full HTML/CSS
   */
  static async getTemplateById(templateId: number): Promise<any> {
    const result = await dbService.executeQuery(
      `SELECT * FROM ResumeBuilderTemplates WHERE TemplateID = @param0`,
      [templateId]
    );
    if (result.recordset.length === 0) return null;
    const t = result.recordset[0];
    return {
      ...t,
      DefaultConfig: t.DefaultConfig ? JSON.parse(t.DefaultConfig) : null,
    };
  }

  /**
   * Generate a preview HTML for a template using dummy data.
   * Used for template picker thumbnails — 100% DB-driven.
   * To add a new template: just INSERT into DB. Thumbnail auto-appears.
   */
  static async generateTemplatePreview(slug: string): Promise<string | null> {
    const result = await dbService.executeQuery(
      `SELECT * FROM ResumeBuilderTemplates WHERE Slug = @param0 AND IsActive = 1`,
      [slug]
    );
    if (result.recordset.length === 0) return null;
    const template = result.recordset[0];
    const config = template.DefaultConfig ? JSON.parse(template.DefaultConfig) : {};

    // Dummy data sections
    const dummyExperience = this.renderExperienceHtml('Work Experience', [
      { title: 'Senior Software Engineer', company: 'Google', location: 'Mountain View, CA', startDate: '2021-01', current: true, bullets: ['Led development of microservices platform serving 10M+ daily users, reducing latency by 40%', 'Architected real-time data pipeline processing 5TB/day using Kafka and Apache Spark', 'Mentored 4 junior engineers, conducted code reviews and established team best practices'] },
      { title: 'Software Engineer', company: 'Meta', location: 'Menlo Park, CA', startDate: '2019-06', endDate: '2020-12', bullets: ['Built React Native features used by 2B+ monthly active users across iOS and Android', 'Reduced app crash rate by 35% through systematic debugging and performance optimization'] },
    ]);

    const dummyEducation = this.renderEducationHtml('Education', [
      { institution: 'Massachusetts Institute of Technology', degree: 'B.S.', field: 'Computer Science', graduationYear: '2019', gpa: '3.9/4.0' },
    ]);

    const dummySkills = this.renderSkillsHtml('Skills', [
      { category: 'Technical Skills', skills: ['React', 'Node.js', 'TypeScript', 'Python', 'AWS', 'Docker', 'PostgreSQL', 'GraphQL', 'Kubernetes', 'Redis'] },
    ], config);

    const dummyCerts = this.renderCertificationsHtml('Certifications', [
      { certName: 'AWS Solutions Architect', issuer: 'Amazon Web Services', date: '2023' },
    ]);

    const isModern = config.layout === 'two-column';
    const mainHtml = dummyExperience + dummyEducation + (isModern ? '' : dummySkills) + dummyCerts;
    const sidebarHtml = isModern ? dummySkills : '';

    const contactHtml = ['john.doe@email.com', '+1 (555) 123-4567', 'San Francisco, CA'].join('<span class="sep">|</span>');
    const linksHtml = ['<a href="#">LinkedIn</a>', '<a href="#">GitHub</a>', '<a href="#">Portfolio</a>'].join('<span class="sep">·</span>');
    const summaryText = 'Results-driven Full-Stack Engineer with 5+ years of experience building scalable web applications. Specialized in React, Node.js, and cloud infrastructure. Led development of platforms serving millions of users with a focus on performance and reliability.';

    let html = template.HtmlTemplate || '';
    const css = template.CssTemplate || '';

    html = html
      .replace(/\{\{STYLES\}\}/g, css)
      .replace(/\{\{FULL_NAME\}\}/g, 'John Doe')
      .replace(/\{\{CONTACT_HTML\}\}/g, contactHtml)
      .replace(/\{\{LINKS_HTML\}\}/g, linksHtml)
      .replace(/\{\{SUMMARY_TEXT\}\}/g, summaryText)
      .replace(/\{\{SECTIONS_HTML\}\}/g, mainHtml + sidebarHtml)
      .replace(/\{\{MAIN_SECTIONS_HTML\}\}/g, mainHtml)
      .replace(/\{\{SIDEBAR_SECTIONS_HTML\}\}/g, sidebarHtml)
      .replace(/\{\{TITLE\}\}/g, 'John Doe - Resume');

    return html;
  }

  // ============================================================
  // PROJECTS CRUD
  // ============================================================

  /**
   * Create a new resume project
   */
  static async createProject(userId: string, data: {
    templateId: number;
    title?: string;
    targetJobTitle?: string;
  }): Promise<ResumeProject> {
    const result = await dbService.executeQuery(`
      INSERT INTO ResumeBuilderProjects (UserID, TemplateID, Title, TargetJobTitle)
      OUTPUT INSERTED.*
      VALUES (@param0, @param1, @param2, @param3)
    `, [userId, data.templateId, data.title || 'Untitled Resume', data.targetJobTitle || null]);

    const project = result.recordset[0];

    // Auto-create default sections
    const defaultSections = [
      { type: 'experience', title: 'Work Experience', order: 1 },
      { type: 'education', title: 'Education', order: 2 },
      { type: 'skills', title: 'Skills', order: 3 },
      { type: 'projects', title: 'Projects', order: 4 },
      { type: 'certifications', title: 'Certifications', order: 5 },
    ];

    for (const sec of defaultSections) {
      await dbService.executeQuery(`
        INSERT INTO ResumeBuilderSections (ProjectID, SectionType, SectionTitle, Content, SortOrder)
        VALUES (@param0, @param1, @param2, '[]', @param3)
      `, [project.ProjectID, sec.type, sec.title, sec.order]);
    }

    return project;
  }

  /**
   * Get all projects for a user
   */
  static async getProjects(userId: string): Promise<ResumeProject[]> {
    const result = await dbService.executeQuery(`
      SELECT p.*, t.Name as TemplateName, t.Slug as TemplateSlug
      FROM ResumeBuilderProjects p
      JOIN ResumeBuilderTemplates t ON p.TemplateID = t.TemplateID
      WHERE p.UserID = @param0 AND p.IsDeleted = 0
      ORDER BY p.UpdatedAt DESC
    `, [userId]);

    return result.recordset;
  }

  /**
   * Get a single project with all sections
   */
  static async getProjectById(projectId: string, userId: string): Promise<ResumeProject | null> {
    const result = await dbService.executeQuery(`
      SELECT p.*, t.Name as TemplateName, t.Slug as TemplateSlug, t.DefaultConfig as TemplateDefaultConfig
      FROM ResumeBuilderProjects p
      JOIN ResumeBuilderTemplates t ON p.TemplateID = t.TemplateID
      WHERE p.ProjectID = @param0 AND p.UserID = @param1 AND p.IsDeleted = 0
    `, [projectId, userId]);

    if (result.recordset.length === 0) return null;
    const project = result.recordset[0];

    // Fetch sections
    const sections = await dbService.executeQuery(`
      SELECT * FROM ResumeBuilderSections
      WHERE ProjectID = @param0
      ORDER BY SortOrder ASC
    `, [projectId]);

    project.sections = sections.recordset;
    return project;
  }

  /**
   * Update project metadata (title, personalInfo, summary, config, template)
   */
  static async updateProject(projectId: string, userId: string, data: Partial<{
    title: string;
    templateId: number;
    status: string;
    targetJobTitle: string;
    targetJobDescription: string;
    customConfig: any;
    personalInfo: any;
    summary: string;
    matchScore: number;
  }>): Promise<boolean> {
    const setClauses: string[] = ['UpdatedAt = GETUTCDATE()'];
    const params: any[] = [projectId, userId];
    let paramIndex = 2;

    if (data.title !== undefined) { setClauses.push(`Title = @param${paramIndex}`); params.push(data.title); paramIndex++; }
    if (data.templateId !== undefined) { setClauses.push(`TemplateID = @param${paramIndex}`); params.push(data.templateId); paramIndex++; }
    if (data.status !== undefined) { setClauses.push(`Status = @param${paramIndex}`); params.push(data.status); paramIndex++; }
    if (data.targetJobTitle !== undefined) { setClauses.push(`TargetJobTitle = @param${paramIndex}`); params.push(data.targetJobTitle); paramIndex++; }
    if (data.targetJobDescription !== undefined) { setClauses.push(`TargetJobDescription = @param${paramIndex}`); params.push(data.targetJobDescription); paramIndex++; }
    if (data.customConfig !== undefined) { setClauses.push(`CustomConfig = @param${paramIndex}`); params.push(JSON.stringify(data.customConfig)); paramIndex++; }
    if (data.personalInfo !== undefined) { setClauses.push(`PersonalInfo = @param${paramIndex}`); params.push(JSON.stringify(data.personalInfo)); paramIndex++; }
    if (data.summary !== undefined) { setClauses.push(`Summary = @param${paramIndex}`); params.push(data.summary); paramIndex++; }
    if (data.matchScore !== undefined) { setClauses.push(`MatchScore = @param${paramIndex}`); params.push(data.matchScore); paramIndex++; }

    const result = await dbService.executeQuery(`
      UPDATE ResumeBuilderProjects SET ${setClauses.join(', ')}
      WHERE ProjectID = @param0 AND UserID = @param1 AND IsDeleted = 0
    `, params);

    return (result.rowsAffected?.[0] || 0) > 0;
  }

  /**
   * Soft-delete a project
   */
  static async deleteProject(projectId: string, userId: string): Promise<boolean> {
    const result = await dbService.executeQuery(`
      UPDATE ResumeBuilderProjects SET IsDeleted = 1, UpdatedAt = GETUTCDATE()
      WHERE ProjectID = @param0 AND UserID = @param1 AND IsDeleted = 0
    `, [projectId, userId]);
    return (result.rowsAffected?.[0] || 0) > 0;
  }

  // ============================================================
  // SECTIONS CRUD
  // ============================================================

  /**
   * Update a section's content, title, visibility, or order
   */
  static async updateSection(sectionId: string, projectId: string, userId: string, data: Partial<{
    sectionTitle: string;
    content: any[];
    sortOrder: number;
    isVisible: boolean;
  }>): Promise<boolean> {
    // Verify ownership
    const ownerCheck = await dbService.executeQuery(`
      SELECT 1 FROM ResumeBuilderProjects WHERE ProjectID = @param0 AND UserID = @param1 AND IsDeleted = 0
    `, [projectId, userId]);
    if (ownerCheck.recordset.length === 0) return false;

    const setClauses: string[] = ['UpdatedAt = GETUTCDATE()'];
    const params: any[] = [sectionId, projectId];
    let paramIndex = 2;

    if (data.sectionTitle !== undefined) { setClauses.push(`SectionTitle = @param${paramIndex}`); params.push(data.sectionTitle); paramIndex++; }
    if (data.content !== undefined) { setClauses.push(`Content = @param${paramIndex}`); params.push(JSON.stringify(data.content)); paramIndex++; }
    if (data.sortOrder !== undefined) { setClauses.push(`SortOrder = @param${paramIndex}`); params.push(data.sortOrder); paramIndex++; }
    if (data.isVisible !== undefined) { setClauses.push(`IsVisible = @param${paramIndex}`); params.push(data.isVisible ? 1 : 0); paramIndex++; }

    const result = await dbService.executeQuery(`
      UPDATE ResumeBuilderSections SET ${setClauses.join(', ')}
      WHERE SectionID = @param0 AND ProjectID = @param1
    `, params);

    // Also bump project's UpdatedAt
    await dbService.executeQuery(`UPDATE ResumeBuilderProjects SET UpdatedAt = GETUTCDATE() WHERE ProjectID = @param0`, [projectId]);

    return (result.rowsAffected?.[0] || 0) > 0;
  }

  /**
   * Add a new custom section to a project
   */
  static async addSection(projectId: string, userId: string, data: {
    sectionType: string;
    sectionTitle: string;
    sortOrder?: number;
  }): Promise<any> {
    const ownerCheck = await dbService.executeQuery(`
      SELECT 1 FROM ResumeBuilderProjects WHERE ProjectID = @param0 AND UserID = @param1 AND IsDeleted = 0
    `, [projectId, userId]);
    if (ownerCheck.recordset.length === 0) return null;

    // Get max order
    const maxOrder = await dbService.executeQuery(
      `SELECT ISNULL(MAX(SortOrder), 0) + 1 as NextOrder FROM ResumeBuilderSections WHERE ProjectID = @param0`,
      [projectId]
    );

    const result = await dbService.executeQuery(`
      INSERT INTO ResumeBuilderSections (ProjectID, SectionType, SectionTitle, Content, SortOrder)
      OUTPUT INSERTED.*
      VALUES (@param0, @param1, @param2, '[]', @param3)
    `, [projectId, data.sectionType, data.sectionTitle, data.sortOrder ?? maxOrder.recordset[0].NextOrder]);

    return result.recordset[0];
  }

  /**
   * Delete a section
   */
  static async deleteSection(sectionId: string, projectId: string, userId: string): Promise<boolean> {
    const ownerCheck = await dbService.executeQuery(`
      SELECT 1 FROM ResumeBuilderProjects WHERE ProjectID = @param0 AND UserID = @param1 AND IsDeleted = 0
    `, [projectId, userId]);
    if (ownerCheck.recordset.length === 0) return false;

    const result = await dbService.executeQuery(`
      DELETE FROM ResumeBuilderSections WHERE SectionID = @param0 AND ProjectID = @param1
    `, [sectionId, projectId]);
    return (result.rowsAffected?.[0] || 0) > 0;
  }

  // ============================================================
  // AUTO-FILL FROM PROFILE
  // ============================================================

  /**
   * Auto-populate a project from the user's existing RefOpen profile
   */
  static async autoFillFromProfile(projectId: string, userId: string): Promise<{
    personalInfo: any;
    summary: string | null;
    sections: any[];
  }> {
    // Get user + applicant data
    const userResult = await dbService.executeQuery(`
      SELECT u.FirstName, u.LastName, u.Email, u.Phone, u.ProfilePictureURL,
             a.ApplicantID, a.Headline, a.Summary, a.CurrentLocation, a.LinkedInProfile,
             a.GithubProfile, a.PortfolioURL, a.PrimarySkills, a.SecondarySkills,
             a.Institution, a.HighestEducation, a.FieldOfStudy, a.GraduationYear, a.GPA,
             a.Certifications, a.CurrentJobTitle, a.CurrentCompanyName
      FROM Users u
      LEFT JOIN Applicants a ON u.UserID = a.UserID
      WHERE u.UserID = @param0
    `, [userId]);

    if (userResult.recordset.length === 0) throw new Error('User not found');
    const user = userResult.recordset[0];

    // Build personal info
    const personalInfo: PersonalInfo = {
      fullName: `${user.FirstName} ${user.LastName}`.trim(),
      email: user.Email,
      phone: user.Phone || '',
      location: user.CurrentLocation || '',
      linkedin: user.LinkedInProfile || '',
      github: user.GithubProfile || '',
      portfolio: user.PortfolioURL || '',
    };

    // Update project personal info + summary
    await this.updateProject(projectId, userId, {
      personalInfo,
      summary: user.Summary || user.Headline || '',
    });

    const sectionsToUpdate: any[] = [];

    // Fill work experience
    if (user.ApplicantID) {
      const workExp = await dbService.executeQuery(`
        SELECT w.JobTitle, w.Department, w.StartDate, w.EndDate, w.IsCurrent,
               w.Location, w.Description, w.Skills, w.Achievements,
               COALESCE(o.Name, w.CompanyName) as CompanyName
        FROM WorkExperiences w
        LEFT JOIN Organizations o ON w.OrganizationID = o.OrganizationID
        WHERE w.ApplicantID = @param0 AND w.IsActive = 1
        ORDER BY w.IsCurrent DESC, w.EndDate DESC, w.StartDate DESC
      `, [user.ApplicantID]);

      if (workExp.recordset.length > 0) {
        const experienceItems = workExp.recordset.map((w: any, i: number) => ({
          id: `exp-${i}`,
          title: w.JobTitle,
          company: w.CompanyName || '',
          location: w.Location || '',
          startDate: w.StartDate ? new Date(w.StartDate).toISOString().split('T')[0] : '',
          endDate: w.EndDate ? new Date(w.EndDate).toISOString().split('T')[0] : '',
          current: w.IsCurrent || false,
          bullets: (w.Description || '').split('\n').filter((b: string) => b.trim()),
        }));

        await dbService.executeQuery(`
          UPDATE ResumeBuilderSections SET Content = @param0, UpdatedAt = GETUTCDATE()
          WHERE ProjectID = @param1 AND SectionType = 'experience'
        `, [JSON.stringify(experienceItems), projectId]);
        sectionsToUpdate.push({ type: 'experience', count: experienceItems.length });
      }

      // Fill skills
      const allSkills: string[] = [];
      if (user.PrimarySkills) {
        try { allSkills.push(...JSON.parse(user.PrimarySkills)); } catch { allSkills.push(...user.PrimarySkills.split(',')); }
      }
      if (user.SecondarySkills) {
        try { allSkills.push(...JSON.parse(user.SecondarySkills)); } catch { allSkills.push(...user.SecondarySkills.split(',')); }
      }

      if (allSkills.length > 0) {
        const skillItems = [{
          id: 'skills-0',
          category: 'Technical Skills',
          skills: allSkills.map(s => s.trim()).filter(Boolean),
        }];

        await dbService.executeQuery(`
          UPDATE ResumeBuilderSections SET Content = @param0, UpdatedAt = GETUTCDATE()
          WHERE ProjectID = @param1 AND SectionType = 'skills'
        `, [JSON.stringify(skillItems), projectId]);
        sectionsToUpdate.push({ type: 'skills', count: allSkills.length });
      }

      // Fill education
      if (user.Institution || user.HighestEducation) {
        const eduItems = [{
          id: 'edu-0',
          institution: user.Institution || '',
          degree: user.HighestEducation || '',
          field: user.FieldOfStudy || '',
          gpa: user.GPA || '',
          graduationYear: user.GraduationYear || '',
        }];

        await dbService.executeQuery(`
          UPDATE ResumeBuilderSections SET Content = @param0, UpdatedAt = GETUTCDATE()
          WHERE ProjectID = @param1 AND SectionType = 'education'
        `, [JSON.stringify(eduItems), projectId]);
        sectionsToUpdate.push({ type: 'education', count: 1 });
      }

      // Fill certifications
      if (user.Certifications) {
        try {
          const certs = JSON.parse(user.Certifications);
          if (Array.isArray(certs) && certs.length > 0) {
            const certItems = certs.map((c: any, i: number) => ({
              id: `cert-${i}`,
              certName: typeof c === 'string' ? c : c.name || c.certName || '',
              issuer: typeof c === 'object' ? (c.issuer || '') : '',
              date: typeof c === 'object' ? (c.date || '') : '',
            }));

            await dbService.executeQuery(`
              UPDATE ResumeBuilderSections SET Content = @param0, UpdatedAt = GETUTCDATE()
              WHERE ProjectID = @param1 AND SectionType = 'certifications'
            `, [JSON.stringify(certItems), projectId]);
            sectionsToUpdate.push({ type: 'certifications', count: certItems.length });
          }
        } catch { /* Not valid JSON, skip */ }
      }
    }

    return { personalInfo, summary: user.Summary || user.Headline || null, sections: sectionsToUpdate };
  }

  // ============================================================
  // AI FEATURES (Gemini)
  // ============================================================

  /**
   * Generate professional summary using AI
   */
  static async aiGenerateSummary(projectId: string, userId: string): Promise<string> {
    const project = await this.getProjectById(projectId, userId);
    if (!project) throw new Error('Project not found');

    const personalInfo = project.PersonalInfo ? JSON.parse(project.PersonalInfo) : {};
    const experienceSection = project.sections?.find(s => s.SectionType === 'experience');
    const experiences = experienceSection ? JSON.parse(experienceSection.Content) : [];
    const skillsSection = project.sections?.find(s => s.SectionType === 'skills');
    const skills = skillsSection ? JSON.parse(skillsSection.Content) : [];

    const prompt = `Write a professional resume summary (2-3 sentences, first person implied but don't start with "I"). 
Person: ${personalInfo.fullName || 'Professional'}
Target role: ${project.TargetJobTitle || 'Not specified'}
Latest experience: ${experiences[0]?.title || ''} at ${experiences[0]?.company || ''}
Skills: ${skills[0]?.skills?.slice(0, 10).join(', ') || 'Not specified'}
Total experience entries: ${experiences.length}

Write ONLY the summary text. No quotes, no labels, no explanations. Make it punchy, specific, and achievement-oriented.`;

    const summary = await this.callGemini(prompt);

    // Save to project
    await this.updateProject(projectId, userId, { summary });
    return summary;
  }

  /**
   * Rewrite bullet points to be achievement-oriented (STAR method)
   */
  static async aiRewriteBullets(bullets: string[], jobTitle: string): Promise<string[]> {
    if (!bullets.length) return [];

    const prompt = `Rewrite these resume bullet points to be achievement-oriented using the STAR method. Add quantifiable metrics where possible.
Job title: ${jobTitle}

Original bullets:
${bullets.map((b, i) => `${i + 1}. ${b}`).join('\n')}

Return ONLY the rewritten bullets as a JSON array of strings. No markdown, no explanation.
Example output: ["Led cross-functional team of 8...", "Reduced deployment time by 40%..."]`;

    const response = await this.callGemini(prompt);

    try {
      // Try to parse JSON from response
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch { /* fallback below */ }

    // Fallback: split by newlines
    return response.split('\n').filter(b => b.trim()).map(b => b.replace(/^\d+\.\s*/, '').replace(/^[-•]\s*/, ''));
  }

  /**
   * ATS score + missing keywords check
   */
  static async aiATSCheck(projectId: string, userId: string, jobDescription: string): Promise<{
    score: number;
    missingKeywords: string[];
    tips: string[];
  }> {
    const project = await this.getProjectById(projectId, userId);
    if (!project) throw new Error('Project not found');

    // Build resume text from all sections
    const resumeText = this.buildResumeText(project);

    const prompt = `You are an ATS (Applicant Tracking System) expert. Analyze this resume against the job description.

RESUME:
${resumeText}

JOB DESCRIPTION:
${jobDescription}

Return a JSON object with exactly this structure (no markdown, no explanation):
{
  "score": <number 0-100>,
  "missingKeywords": ["keyword1", "keyword2"],
  "tips": ["tip1", "tip2", "tip3"]
}

Score criteria: keyword match (40%), experience relevance (30%), skills alignment (20%), formatting (10%).`;

    const response = await this.callGemini(prompt);

    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const score = Math.min(100, Math.max(0, parsed.score || 0));

        // Save score to project
        await this.updateProject(projectId, userId, {
          matchScore: score,
          targetJobDescription: jobDescription,
        });

        return {
          score,
          missingKeywords: parsed.missingKeywords || [],
          tips: parsed.tips || [],
        };
      }
    } catch { /* fallback */ }

    return { score: 50, missingKeywords: [], tips: ['Could not analyze. Try again.'] };
  }

  // ============================================================
  // HTML GENERATION — DB-driven templates
  // ============================================================

  /**
   * Generate complete HTML for a resume project using DB-stored template.
   * Templates are stored in ResumeBuilderTemplates.HtmlTemplate / CssTemplate
   * with {{PLACEHOLDER}} syntax for data injection.
   * 
   * To add a new design: just INSERT a new row in the DB. No code changes needed.
   */
  static async generateHTML(projectId: string, userId: string): Promise<string> {
    const project = await this.getProjectById(projectId, userId);
    if (!project) throw new Error('Project not found');

    // Fetch full template with HTML/CSS from database
    const template = await this.getTemplateById(project.TemplateID);
    if (!template) throw new Error('Template not found');

    const personalInfo: PersonalInfo = project.PersonalInfo ? JSON.parse(project.PersonalInfo) : {};
    const customConfig = project.CustomConfig ? JSON.parse(project.CustomConfig) : {};
    const config: TemplateConfig = { ...(template.DefaultConfig || {}), ...customConfig };

    // Filter and sort visible sections
    const sections = (project.sections || [])
      .filter((s: ResumeSection) => s.IsVisible)
      .sort((a: ResumeSection, b: ResumeSection) => a.SortOrder - b.SortOrder);

    const isModern = config.layout === 'two-column';

    // Render section HTML using existing renderers
    let mainSectionsHtml = '';
    let sidebarSectionsHtml = '';

    for (const section of sections) {
      const items = JSON.parse(section.Content || '[]');
      if (items.length === 0) continue;

      const html = this.renderSectionHtml(section.SectionType, section.SectionTitle, items, config);

      if (isModern && (section.SectionType === 'skills' || section.SectionType === 'languages')) {
        sidebarSectionsHtml += html;
      } else {
        mainSectionsHtml += html;
      }
    }

    // Build contact info HTML
    const contactParts = [personalInfo.email, personalInfo.phone, personalInfo.location].filter(Boolean);
    const contactHtml = contactParts.map(p => this.escapeHtml(p!)).join('<span class="sep">|</span>');

    const linkParts = [
      personalInfo.linkedin ? `<a href="${personalInfo.linkedin}">LinkedIn</a>` : '',
      personalInfo.github ? `<a href="${personalInfo.github}">GitHub</a>` : '',
      personalInfo.portfolio ? `<a href="${personalInfo.portfolio}">Portfolio</a>` : '',
    ].filter(Boolean);
    const linksHtml = linkParts.join('<span class="sep">·</span>');

    const summaryText = project.Summary ? this.escapeHtml(project.Summary) : '';

    // Get template HTML and CSS from database
    let html = template.HtmlTemplate || '';
    const css = template.CssTemplate || '';

    // Replace all template placeholders with rendered data
    html = html
      .replace(/\{\{STYLES\}\}/g, css)
      .replace(/\{\{FULL_NAME\}\}/g, this.escapeHtml(personalInfo.fullName || 'Your Name'))
      .replace(/\{\{CONTACT_HTML\}\}/g, contactHtml)
      .replace(/\{\{LINKS_HTML\}\}/g, linksHtml)
      .replace(/\{\{SUMMARY_TEXT\}\}/g, summaryText)
      .replace(/\{\{SECTIONS_HTML\}\}/g, mainSectionsHtml + sidebarSectionsHtml)
      .replace(/\{\{MAIN_SECTIONS_HTML\}\}/g, mainSectionsHtml)
      .replace(/\{\{SIDEBAR_SECTIONS_HTML\}\}/g, sidebarSectionsHtml)
      .replace(/\{\{TITLE\}\}/g, this.escapeHtml(personalInfo.fullName || 'Resume'));

    return html;
  }

  // ── Section HTML Renderers ──────────────────────────────────

  private static renderSectionHtml(type: string, title: string, items: any[], config: TemplateConfig): string {
    switch (type) {
      case 'experience': return this.renderExperienceHtml(title, items);
      case 'education': return this.renderEducationHtml(title, items);
      case 'skills': return this.renderSkillsHtml(title, items, config);
      case 'projects': return this.renderProjectsHtml(title, items);
      case 'certifications': return this.renderCertificationsHtml(title, items);
      default: return this.renderGenericHtml(title, items);
    }
  }

  private static renderExperienceHtml(title: string, items: any[]): string {
    const entries = items.map(item => `
      <div class="entry">
        <div class="entry-header">
          <div>
            <span class="entry-title">${this.escapeHtml(item.title || '')}</span>
            ${item.company ? `<span class="entry-subtitle"> · ${this.escapeHtml(item.company)}</span>` : ''}
          </div>
          <span class="entry-date">${this.formatDateRange(item.startDate, item.endDate, item.current)}</span>
        </div>
        ${item.location ? `<div class="entry-location">${this.escapeHtml(item.location)}</div>` : ''}
        ${item.bullets?.length ? `<ul class="bullets">${item.bullets.map((b: string) => `<li>${this.escapeHtml(b)}</li>`).join('')}</ul>` : ''}
      </div>
    `).join('');

    return `<section class="section"><h2 class="section-title">${this.escapeHtml(title)}</h2>${entries}</section>`;
  }

  private static renderEducationHtml(title: string, items: any[]): string {
    const entries = items.map(item => `
      <div class="entry">
        <div class="entry-header">
          <div>
            <span class="entry-title">${this.escapeHtml(item.institution || '')}</span>
            ${item.degree ? `<span class="entry-subtitle"> · ${this.escapeHtml(item.degree)}${item.field ? ` in ${this.escapeHtml(item.field)}` : ''}</span>` : ''}
          </div>
          <span class="entry-date">${item.graduationYear || ''}</span>
        </div>
        ${item.gpa ? `<div class="entry-location">GPA: ${this.escapeHtml(item.gpa)}</div>` : ''}
      </div>
    `).join('');

    return `<section class="section"><h2 class="section-title">${this.escapeHtml(title)}</h2>${entries}</section>`;
  }

  private static renderSkillsHtml(title: string, items: any[], config: TemplateConfig): string {
    const categories = items.map(item => `
      <div class="skill-category">
        ${item.category ? `<span class="skill-category-name">${this.escapeHtml(item.category)}:</span>` : ''}
        <div class="skill-tags">
          ${(item.skills || []).map((s: string) => `<span class="skill-tag">${this.escapeHtml(s)}</span>`).join('')}
        </div>
      </div>
    `).join('');

    return `<section class="section"><h2 class="section-title">${this.escapeHtml(title)}</h2>${categories}</section>`;
  }

  private static renderProjectsHtml(title: string, items: any[]): string {
    const entries = items.map(item => `
      <div class="entry">
        <div class="entry-header">
          <span class="entry-title">${this.escapeHtml(item.name || item.title || '')}</span>
          ${item.url ? `<a href="${item.url}" style="font-size:9pt;color:#2563EB;">Link ↗</a>` : ''}
        </div>
        ${item.description ? `<p style="font-size:10pt;margin-top:2pt;">${this.escapeHtml(item.description)}</p>` : ''}
        ${item.technologies?.length ? `<div class="skill-tags" style="margin-top:3pt;">${item.technologies.map((t: string) => `<span class="skill-tag">${this.escapeHtml(t)}</span>`).join('')}</div>` : ''}
      </div>
    `).join('');

    return `<section class="section"><h2 class="section-title">${this.escapeHtml(title)}</h2>${entries}</section>`;
  }

  private static renderCertificationsHtml(title: string, items: any[]): string {
    const entries = items.map(item => `
      <div class="cert-entry">
        <span class="cert-name">${this.escapeHtml(item.certName || item.name || '')}</span>
        ${item.issuer ? `<span class="cert-issuer"> — ${this.escapeHtml(item.issuer)}</span>` : ''}
        ${item.date ? `<span class="cert-issuer"> (${this.escapeHtml(item.date)})</span>` : ''}
      </div>
    `).join('');

    return `<section class="section"><h2 class="section-title">${this.escapeHtml(title)}</h2>${entries}</section>`;
  }

  private static renderGenericHtml(title: string, items: any[]): string {
    const entries = items.map(item => `
      <div class="entry">
        ${item.text ? `<p style="font-size:10pt;">${this.escapeHtml(item.text)}</p>` : ''}
        ${item.title ? `<p style="font-weight:600;">${this.escapeHtml(item.title)}</p>` : ''}
      </div>
    `).join('');

    return `<section class="section"><h2 class="section-title">${this.escapeHtml(title)}</h2>${entries}</section>`;
  }

  // ── Helpers ─────────────────────────────────────────────────

  private static buildResumeText(project: ResumeProject): string {
    const parts: string[] = [];
    const info = project.PersonalInfo ? JSON.parse(project.PersonalInfo) : {};
    parts.push(`${info.fullName || ''} - ${info.email || ''}`);
    if (project.Summary) parts.push(project.Summary);

    for (const section of (project.sections || [])) {
      const items = JSON.parse(section.Content || '[]');
      parts.push(`[${section.SectionTitle}]`);
      for (const item of items) {
        if (item.title) parts.push(item.title);
        if (item.company) parts.push(item.company);
        if (item.bullets) parts.push(item.bullets.join('. '));
        if (item.skills) parts.push(item.skills.join(', '));
        if (item.description) parts.push(item.description);
        if (item.certName) parts.push(item.certName);
        if (item.institution) parts.push(`${item.institution} ${item.degree || ''}`);
      }
    }
    return parts.join('\n');
  }

  private static escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  private static formatDateRange(start?: string, end?: string, current?: boolean): string {
    const formatDate = (d: string) => {
      try {
        const date = new Date(d);
        return date.toLocaleDateString('en-US', { month: 'short' as const, year: 'numeric' as const });
      } catch { return d; }
    };
    const s = start ? formatDate(start) : '';
    const e = current ? 'Present' : (end ? formatDate(end) : '');
    if (s && e) return `${s} – ${e}`;
    if (s) return s;
    if (e) return e;
    return '';
  }

  private static async callGemini(prompt: string): Promise<string> {
    // Try Gemini first, fallback to Groq on rate limit or if key missing
    if (GEMINI_API_KEY) {
      try {
        const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
          }),
        });

        if (response.ok) {
          const data: any = await response.json();
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
          if (text) return text;
        }

        // If rate limited (429), fall through to Groq
        if (response.status !== 429) {
          const errorText = await response.text();
          console.error('Gemini API error:', response.status, errorText);
        }
      } catch (err) {
        console.error('Gemini call failed, trying Groq fallback:', err);
      }
    }

    // Fallback to Groq (Llama 3.3 70B)
    if (GROQ_API_KEY) {
      const groqResponse = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
          max_tokens: 2048,
        }),
      });

      if (!groqResponse.ok) {
        const errorText = await groqResponse.text();
        console.error('Groq API error:', errorText);
        throw new Error('AI service temporarily unavailable. Please try again.');
      }

      const groqData: any = await groqResponse.json();
      return groqData.choices?.[0]?.message?.content?.trim() || '';
    }

    throw new Error('No AI service configured. Please contact support.');
  }
}
