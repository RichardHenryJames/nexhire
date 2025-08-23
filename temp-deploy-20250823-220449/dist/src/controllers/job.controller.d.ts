import { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
export declare const createJob: (req: HttpRequest, context: InvocationContext) => Promise<HttpResponseInit>;
export declare const getJobs: (req: HttpRequest, context: InvocationContext) => Promise<HttpResponseInit>;
export declare const getJobById: (req: HttpRequest, context: InvocationContext) => Promise<HttpResponseInit>;
export declare const updateJob: (req: HttpRequest, context: InvocationContext) => Promise<HttpResponseInit>;
export declare const publishJob: (req: HttpRequest, context: InvocationContext) => Promise<HttpResponseInit>;
export declare const closeJob: (req: HttpRequest, context: InvocationContext) => Promise<HttpResponseInit>;
export declare const deleteJob: (req: HttpRequest, context: InvocationContext) => Promise<HttpResponseInit>;
export declare const searchJobs: (req: HttpRequest, context: InvocationContext) => Promise<HttpResponseInit>;
export declare const getJobsByOrganization: (req: HttpRequest, context: InvocationContext) => Promise<HttpResponseInit>;
export declare const getJobTypes: (req: HttpRequest, context: InvocationContext) => Promise<HttpResponseInit>;
export declare const getCurrencies: (req: HttpRequest, context: InvocationContext) => Promise<HttpResponseInit>;
//# sourceMappingURL=job.controller.d.ts.map