import { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { WorkExperienceService, WorkExperienceInput } from '../services/work-experience.service';
import { authenticate, withErrorHandling } from '../middleware';
import { ValidationError, NotFoundError } from '../utils/validation';

export const getMyWorkExperiences = withErrorHandling(async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
  try {
    const user = authenticate(req);
    const { ApplicantService } = await import('../services/profile.service');
    const profile = await ApplicantService.getApplicantProfile(user.userId);
    if (!profile || !profile.ApplicantID) throw new NotFoundError('Applicant profile not found');

    const experiences = await WorkExperienceService.getWorkExperiencesByApplicant(profile.ApplicantID);
    return { status: 200, jsonBody: { success: true, data: experiences } };
  } catch (error: any) {
    return {
      status: error instanceof NotFoundError ? 404 : 500,
      jsonBody: { success: false, error: error?.message || 'Failed to get work experiences' }
    };
  }
});

export const getWorkExperiences = withErrorHandling(async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
  try {
    const applicantId = (req as any).params?.applicantId;
    if (!applicantId) throw new ValidationError('Applicant ID is required');
    const experiences = await WorkExperienceService.getWorkExperiencesByApplicant(applicantId);
    return { status: 200, jsonBody: { success: true, data: experiences } };
  } catch (error: any) {
    return {
      status: error instanceof ValidationError ? 400 : 500,
      jsonBody: { success: false, error: error?.message || 'Failed to get work experiences' }
    };
  }
});

export const getWorkExperienceById = withErrorHandling(async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
  try {
    const workExperienceId = (req as any).params?.workExperienceId;
    if (!workExperienceId) throw new ValidationError('Work experience ID is required');
    const experience = await WorkExperienceService.getWorkExperienceById(workExperienceId);
    if (!experience) throw new NotFoundError('Work experience not found');
    return { status: 200, jsonBody: { success: true, data: experience } };
  } catch (error: any) {
    return {
      status: error instanceof NotFoundError ? 404 : error instanceof ValidationError ? 400 : 500,
      jsonBody: { success: false, error: error?.message || 'Failed to get work experience' }
    };
  }
});

export const createWorkExperience = withErrorHandling(async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
  try {
    const user = authenticate(req);
    const { ApplicantService } = await import('../services/profile.service');
    const profile = await ApplicantService.getApplicantProfile(user.userId);
    if (!profile || !profile.ApplicantID) throw new NotFoundError('Applicant profile not found');

    const body = (await req.json()) as WorkExperienceInput;
    const created = await WorkExperienceService.createWorkExperience(profile.ApplicantID, body);
    return { status: 201, jsonBody: { success: true, data: created, message: 'Work experience created successfully' } };
  } catch (error: any) {
    return {
      status: error instanceof NotFoundError ? 404 : error instanceof ValidationError ? 400 : 500,
      jsonBody: { success: false, error: error?.message || 'Failed to create work experience' }
    };
  }
});

export const updateWorkExperience = withErrorHandling(async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
  try {
    const user = authenticate(req);
    const workExperienceId = (req as any).params?.workExperienceId;
    if (!workExperienceId) throw new ValidationError('Work experience ID is required');

    const existing = await WorkExperienceService.getWorkExperienceById(workExperienceId);
    if (!existing) throw new NotFoundError('Work experience not found');

    const { ApplicantService } = await import('../services/profile.service');
    const profile = await ApplicantService.getApplicantProfile(user.userId);
    if (!profile || profile.ApplicantID !== existing.ApplicantID) {
      throw new ValidationError('You can only update your own work experiences');
    }

    const body = (await req.json()) as Partial<WorkExperienceInput>;
    const updated = await WorkExperienceService.updateWorkExperience(workExperienceId, body);
    return { status: 200, jsonBody: { success: true, data: updated, message: 'Work experience updated successfully' } };
  } catch (error: any) {
    return {
      status: error instanceof NotFoundError ? 404 : error instanceof ValidationError ? 400 : 500,
      jsonBody: { success: false, error: error?.message || 'Failed to update work experience' }
    };
  }
});

export const deleteWorkExperience = withErrorHandling(async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
  try {
    const user = authenticate(req);
    const workExperienceId = (req as any).params?.workExperienceId;
    if (!workExperienceId) throw new ValidationError('Work experience ID is required');

    const existing = await WorkExperienceService.getWorkExperienceById(workExperienceId);
    if (!existing) throw new NotFoundError('Work experience not found');

    const { ApplicantService } = await import('../services/profile.service');
    const profile = await ApplicantService.getApplicantProfile(user.userId);
    if (!profile || profile.ApplicantID !== existing.ApplicantID) {
      throw new ValidationError('You can only delete your own work experiences');
    }

    await WorkExperienceService.deleteWorkExperience(workExperienceId);
    return { status: 200, jsonBody: { success: true, message: 'Work experience deleted successfully' } };
  } catch (error: any) {
    return {
      status: error instanceof NotFoundError ? 404 : error instanceof ValidationError ? 400 : 500,
      jsonBody: { success: false, error: error?.message || 'Failed to delete work experience' }
    };
  }
});
