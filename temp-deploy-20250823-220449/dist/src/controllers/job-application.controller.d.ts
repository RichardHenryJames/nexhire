import { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
export declare const applyForJob: (req: HttpRequest, context: InvocationContext) => Promise<HttpResponseInit>;
export declare const getMyApplications: (req: HttpRequest, context: InvocationContext) => Promise<HttpResponseInit>;
export declare const getJobApplications: (req: HttpRequest, context: InvocationContext) => Promise<HttpResponseInit>;
export declare const updateApplicationStatus: (req: HttpRequest, context: InvocationContext) => Promise<HttpResponseInit>;
export declare const withdrawApplication: (req: HttpRequest, context: InvocationContext) => Promise<HttpResponseInit>;
export declare const getApplicationDetails: (req: HttpRequest, context: InvocationContext) => Promise<HttpResponseInit>;
export declare const getApplicationStats: (req: HttpRequest, context: InvocationContext) => Promise<HttpResponseInit>;
//# sourceMappingURL=job-application.controller.d.ts.map