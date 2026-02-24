/**
 * Resume Builder Controller
 * 
 * Handles all resume builder HTTP endpoints:
 * - Templates listing
 * - Project CRUD (create, list, get, update, delete)
 * - Section CRUD (update, add, delete)
 * - Auto-fill from profile
 * - AI features (summary, bullets, ATS check)
 * - HTML preview
 * 
 * All endpoints require authentication (except templates listing).
 * 
 * @module ResumeBuilderController
 * @since 2026-02-23
 */

import { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { ResumeBuilderService } from '../services/resume-builder.service';
import { AuthService } from '../services/auth.service';
import { corsHeaders } from '../middleware';

// ── Auth Helper ──────────────────────────────────────────────

function getUserId(req: HttpRequest): string | null {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  try {
    const token = authHeader.replace('Bearer ', '');
    const decoded = AuthService.verifyToken(token);
    return decoded?.userId || null;
  } catch { return null; }
}

function unauthorizedResponse(): HttpResponseInit {
  return {
    status: 401,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({ success: false, error: 'Authentication required' }),
  };
}

// ── TEMPLATES ────────────────────────────────────────────────

/**
 * GET /api/resume-builder/templates
 * Public - no auth required
 */
export async function getTemplates(req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const templates = await ResumeBuilderService.getTemplates();
  return {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({ success: true, data: templates }),
  };
}

// ── PROJECTS CRUD ────────────────────────────────────────────

/**
 * POST /api/resume-builder/projects
 */
export async function createProject(req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const userId = getUserId(req);
  if (!userId) return unauthorizedResponse();

  const body = await req.json() as any;
  const project = await ResumeBuilderService.createProject(userId, {
    templateId: body.templateId || 1,
    title: body.title,
    targetJobTitle: body.targetJobTitle,
  });

  return {
    status: 201,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({ success: true, data: project }),
  };
}

/**
 * GET /api/resume-builder/projects
 */
export async function getProjects(req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const userId = getUserId(req);
  if (!userId) return unauthorizedResponse();

  const projects = await ResumeBuilderService.getProjects(userId);
  return {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({ success: true, data: projects }),
  };
}

/**
 * GET /api/resume-builder/projects/{projectId}
 */
export async function getProjectById(req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const userId = getUserId(req);
  if (!userId) return unauthorizedResponse();

  const projectId = req.params.projectId;
  const project = await ResumeBuilderService.getProjectById(projectId, userId);

  if (!project) {
    return {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: 'Project not found' }),
    };
  }

  return {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({ success: true, data: project }),
  };
}

/**
 * PUT /api/resume-builder/projects/{projectId}
 */
export async function updateProject(req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const userId = getUserId(req);
  if (!userId) return unauthorizedResponse();

  const projectId = req.params.projectId;
  const body = await req.json() as any;

  const updated = await ResumeBuilderService.updateProject(projectId, userId, body);

  return {
    status: updated ? 200 : 404,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      success: updated,
      message: updated ? 'Project updated' : 'Project not found',
    }),
  };
}

/**
 * DELETE /api/resume-builder/projects/{projectId}
 */
export async function deleteProject(req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const userId = getUserId(req);
  if (!userId) return unauthorizedResponse();

  const projectId = req.params.projectId;
  const deleted = await ResumeBuilderService.deleteProject(projectId, userId);

  return {
    status: deleted ? 200 : 404,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      success: deleted,
      message: deleted ? 'Project deleted' : 'Project not found',
    }),
  };
}

// ── SECTIONS ─────────────────────────────────────────────────

/**
 * PUT /api/resume-builder/projects/{projectId}/sections/{sectionId}
 */
export async function updateSection(req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const userId = getUserId(req);
  if (!userId) return unauthorizedResponse();

  const { projectId, sectionId } = req.params;
  const body = await req.json() as any;

  const updated = await ResumeBuilderService.updateSection(sectionId, projectId, userId, body);

  return {
    status: updated ? 200 : 404,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      success: updated,
      message: updated ? 'Section updated' : 'Section not found',
    }),
  };
}

/**
 * POST /api/resume-builder/projects/{projectId}/sections
 */
export async function addSection(req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const userId = getUserId(req);
  if (!userId) return unauthorizedResponse();

  const projectId = req.params.projectId;
  const body = await req.json() as any;

  const section = await ResumeBuilderService.addSection(projectId, userId, {
    sectionType: body.sectionType || 'custom',
    sectionTitle: body.sectionTitle || 'Custom Section',
    sortOrder: body.sortOrder,
  });

  if (!section) {
    return {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: 'Project not found' }),
    };
  }

  return {
    status: 201,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({ success: true, data: section }),
  };
}

/**
 * DELETE /api/resume-builder/projects/{projectId}/sections/{sectionId}
 */
export async function deleteSection(req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const userId = getUserId(req);
  if (!userId) return unauthorizedResponse();

  const { projectId, sectionId } = req.params;
  const deleted = await ResumeBuilderService.deleteSection(sectionId, projectId, userId);

  return {
    status: deleted ? 200 : 404,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      success: deleted,
      message: deleted ? 'Section deleted' : 'Section not found',
    }),
  };
}

// ── AUTO-FILL ────────────────────────────────────────────────

/**
 * POST /api/resume-builder/projects/{projectId}/auto-fill
 */
export async function autoFillProject(req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const userId = getUserId(req);
  if (!userId) return unauthorizedResponse();

  const projectId = req.params.projectId;
  const result = await ResumeBuilderService.autoFillFromProfile(projectId, userId);

  return {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      success: true,
      data: result,
      message: 'Resume auto-filled from your profile',
    }),
  };
}

// ── AI FEATURES ──────────────────────────────────────────────

/**
 * POST /api/resume-builder/projects/{projectId}/ai/summary
 */
export async function aiSummary(req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const userId = getUserId(req);
  if (!userId) return unauthorizedResponse();

  const projectId = req.params.projectId;
  const summary = await ResumeBuilderService.aiGenerateSummary(projectId, userId);

  return {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({ success: true, data: { summary } }),
  };
}

/**
 * POST /api/resume-builder/projects/{projectId}/ai/bullets
 */
export async function aiBullets(req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const userId = getUserId(req);
  if (!userId) return unauthorizedResponse();

  const body = await req.json() as any;
  const bullets = await ResumeBuilderService.aiRewriteBullets(
    body.bullets || [],
    body.jobTitle || '',
  );

  return {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({ success: true, data: { bullets } }),
  };
}

/**
 * POST /api/resume-builder/projects/{projectId}/ai/ats-check
 */
export async function aiATSCheck(req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const userId = getUserId(req);
  if (!userId) return unauthorizedResponse();

  const projectId = req.params.projectId;
  const body = await req.json() as any;

  if (!body.jobDescription) {
    return {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: 'jobDescription is required' }),
    };
  }

  const result = await ResumeBuilderService.aiATSCheck(projectId, userId, body.jobDescription);

  return {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({ success: true, data: result }),
  };
}

// ── HTML PREVIEW ─────────────────────────────────────────────

/**
 * GET /api/resume-builder/projects/{projectId}/preview
 * Returns full HTML document for iframe preview
 */
export async function previewResume(req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const userId = getUserId(req);
  if (!userId) return unauthorizedResponse();

  const projectId = req.params.projectId;
  const html = await ResumeBuilderService.generateHTML(projectId, userId);

  return {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' },
    body: html,
  };
}
