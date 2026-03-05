import { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { withAuth } from '../middleware';
import { extractRequestBody, successResponse, validateRequest, employerInitializeSchema } from '../utils/validation';
import { UserService } from '../services/user.service';

// POST /employers/initialize
// Allows an authenticated existing user to initialize an employer profile + organization
export const initializeEmployer = withAuth(async (req: HttpRequest, context: InvocationContext, user): Promise<HttpResponseInit> => {
  const payload = await extractRequestBody(req);
  const validated = validateRequest(employerInitializeSchema, payload);

  const result = await UserService.initializeEmployerProfile(user.userId, validated);

  return {
    status: 200,
    jsonBody: successResponse(result, 'Employer profile initialized successfully')
  };
});
