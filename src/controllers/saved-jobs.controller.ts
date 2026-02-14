import { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { withAuth, withErrorHandling } from '../middleware';
import { isValidGuid, extractRequestBody, extractQueryParams, successResponse, validateRequest, paginationSchema } from '../utils/validation';
import { SavedJobsService } from '../services/saved-jobs.service';
import { PaginationParams } from '../types';

// Use existing application scopes to align with current tokens and avoid 403
export const saveJob = withAuth(async (req: HttpRequest, context: InvocationContext, user): Promise<HttpResponseInit> => {
  const body = await extractRequestBody(req);
  const jobId = body?.jobID || body?.jobId || body?.JobID;
  if (!jobId) return { status: 400, jsonBody: { success: false, error: 'Job ID is required' } };
  if (!isValidGuid(jobId)) return { status: 400, jsonBody: { success: false, error: 'Invalid Job ID format' } };
  const saved = await SavedJobsService.saveJob(user.userId, jobId);
  return { status: 201, jsonBody: successResponse(saved, 'Job saved') };
}, ['apply:jobs']);

export const unsaveJob = withAuth(async (req: HttpRequest, context: InvocationContext, user): Promise<HttpResponseInit> => {
  const jobId = req.params.jobId;
  if (!jobId) return { status: 400, jsonBody: { success: false, error: 'Job ID is required' } };
  if (!isValidGuid(jobId)) return { status: 400, jsonBody: { success: false, error: 'Invalid Job ID format' } };
  await SavedJobsService.unsaveJob(user.userId, jobId);
  return { status: 200, jsonBody: successResponse(null, 'Job unsaved') };
}, ['apply:jobs']);

export const getMySavedJobs = withAuth(async (req: HttpRequest, context: InvocationContext, user): Promise<HttpResponseInit> => {
  const params = extractQueryParams(req);
  let validated: PaginationParams;
  try { validated = validateRequest<PaginationParams>(paginationSchema, params); }
  catch { validated = { page: 1, pageSize: 20, sortBy: undefined, sortOrder: 'desc' }; }
  const result = await SavedJobsService.getMySavedJobs(user.userId, validated);
  return {
    status: 200,
    jsonBody: successResponse(result.jobs, 'Saved jobs retrieved', {
      page: validated.page, pageSize: validated.pageSize, total: result.total, totalPages: result.totalPages
    })
  };
}, ['read:applications']);
