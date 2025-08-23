import { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
export declare const authenticate: (req: HttpRequest) => import("../services/auth.service").TokenPayload;
export declare const authorize: (user: any, requiredPermissions: string[]) => void;
export declare const handleError: (error: any, context: InvocationContext) => HttpResponseInit;
export declare const corsHeaders: {
    'Access-Control-Allow-Origin': string;
    'Access-Control-Allow-Methods': string;
    'Access-Control-Allow-Headers': string;
    'Access-Control-Max-Age': string;
};
export declare const withErrorHandling: (handler: (req: HttpRequest, context: InvocationContext) => Promise<HttpResponseInit>) => (req: HttpRequest, context: InvocationContext) => Promise<HttpResponseInit>;
export declare const withAuth: (handler: (req: HttpRequest, context: InvocationContext, user: any) => Promise<HttpResponseInit>, requiredPermissions?: string[]) => (req: HttpRequest, context: InvocationContext) => Promise<HttpResponseInit>;
export declare const rateLimit: (requestsPerMinute?: number) => (req: HttpRequest, context: InvocationContext, next: () => Promise<HttpResponseInit>) => Promise<HttpResponseInit>;
export declare const logRequest: (req: HttpRequest, context: InvocationContext) => () => void;
//# sourceMappingURL=index.d.ts.map