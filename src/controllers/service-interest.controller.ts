import { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { ServiceInterestService } from '../services/service-interest.service';

const VALID_SERVICES = [
  'ResumeAnalyzer',
  'ATSBeatSheet',
  'InterviewDecoded',
  'SalarySpy',
  'OfferCoach',
  'LinkedInOptimizer',
  'BlindReview',
  'CareerSimulator',
  'MarketPulse',
];

/**
 * POST /services/interest — Submit interest in a service
 */
export async function submitServiceInterest(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return { status: 401, jsonBody: { error: 'Unauthorized' } };
    }

    const body = (await request.json()) as { serviceName?: string };
    const { serviceName } = body;

    if (!serviceName || !VALID_SERVICES.includes(serviceName)) {
      return {
        status: 400,
        jsonBody: { error: 'Invalid or missing serviceName', validServices: VALID_SERVICES },
      };
    }

    const result = await ServiceInterestService.submitInterest(userId, serviceName);

    return {
      status: 200,
      jsonBody: {
        success: true,
        alreadyExists: result.alreadyExists,
        message: result.alreadyExists
          ? 'Interest already recorded'
          : 'Interest submitted successfully',
      },
    };
  } catch (error: any) {
    context.error('Error submitting service interest:', error);
    return { status: 500, jsonBody: { error: 'Internal server error' } };
  }
}

/**
 * GET /services/interests — Get all services the user has expressed interest in
 */
export async function getUserServiceInterests(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return { status: 401, jsonBody: { error: 'Unauthorized' } };
    }

    const interests = await ServiceInterestService.getUserInterests(userId);

    return {
      status: 200,
      jsonBody: { interests },
    };
  } catch (error: any) {
    context.error('Error fetching service interests:', error);
    return { status: 500, jsonBody: { error: 'Internal server error' } };
  }
}

/**
 * GET /management/service-interests/stats — Admin: Get interest counts per service
 */
export async function getServiceInterestStats(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const counts = await ServiceInterestService.getInterestCounts();
    const total = counts.reduce((sum, c) => sum + c.count, 0);

    return {
      status: 200,
      jsonBody: { success: true, data: { counts, totalInterests: total } },
    };
  } catch (error: any) {
    context.error('Error fetching service interest stats:', error);
    return { status: 500, jsonBody: { error: 'Internal server error' } };
  }
}
