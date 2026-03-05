import { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { withAuth } from '../middleware';
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
export const submitServiceInterest = withAuth(async (
  request: HttpRequest,
  context: InvocationContext,
  user: any
): Promise<HttpResponseInit> => {
    const body = (await request.json()) as { serviceName?: string };
    const { serviceName } = body;

    if (!serviceName || !VALID_SERVICES.includes(serviceName)) {
      return {
        status: 400,
        jsonBody: { error: 'Invalid or missing serviceName', validServices: VALID_SERVICES },
      };
    }

    const result = await ServiceInterestService.submitInterest(user.userId, serviceName);

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
});

/**
 * GET /services/interests — Get all services the user has expressed interest in
 */
export const getUserServiceInterests = withAuth(async (
  request: HttpRequest,
  context: InvocationContext,
  user: any
): Promise<HttpResponseInit> => {
    const interests = await ServiceInterestService.getUserInterests(user.userId);

    return {
      status: 200,
      jsonBody: { interests },
    };
});

/**
 * GET /management/service-interests/stats — Admin: Get interest counts per service
 */
export const getServiceInterestStats = withAuth(async (
  request: HttpRequest,
  context: InvocationContext,
  user: any
): Promise<HttpResponseInit> => {
    const counts = await ServiceInterestService.getInterestCounts();
    const total = counts.reduce((sum, c) => sum + c.count, 0);

    return {
      status: 200,
      jsonBody: { success: true, data: { counts, totalInterests: total } },
    };
});
