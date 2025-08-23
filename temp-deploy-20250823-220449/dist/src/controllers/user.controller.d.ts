import { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
export declare const register: (req: HttpRequest, context: InvocationContext) => Promise<HttpResponseInit>;
export declare const login: (req: HttpRequest, context: InvocationContext) => Promise<HttpResponseInit>;
export declare const logout: (req: HttpRequest, context: InvocationContext) => Promise<HttpResponseInit>;
export declare const getProfile: (req: HttpRequest, context: InvocationContext) => Promise<HttpResponseInit>;
export declare const updateProfile: (req: HttpRequest, context: InvocationContext) => Promise<HttpResponseInit>;
export declare const changePassword: (req: HttpRequest, context: InvocationContext) => Promise<HttpResponseInit>;
export declare const verifyEmail: (req: HttpRequest, context: InvocationContext) => Promise<HttpResponseInit>;
export declare const getDashboardStats: (req: HttpRequest, context: InvocationContext) => Promise<HttpResponseInit>;
export declare const deactivateAccount: (req: HttpRequest, context: InvocationContext) => Promise<HttpResponseInit>;
export declare const refreshToken: (req: HttpRequest, context: InvocationContext) => Promise<HttpResponseInit>;
export declare const updateEducation: (req: HttpRequest, context: InvocationContext) => Promise<HttpResponseInit>;
export declare const updateWorkExperience: (req: HttpRequest, context: InvocationContext) => Promise<HttpResponseInit>;
//# sourceMappingURL=user.controller.d.ts.map