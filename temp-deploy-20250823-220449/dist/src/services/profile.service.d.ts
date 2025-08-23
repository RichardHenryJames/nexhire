interface ProfileData {
    [key: string]: any;
}
export declare class ApplicantService {
    static getApplicantProfile(userId: string): Promise<any>;
    static updateApplicantProfile(userId: string, profileData: ProfileData): Promise<any>;
    private static createApplicantProfile;
}
export declare class EmployerService {
    static getEmployerProfile(userId: string): Promise<any>;
    static updateEmployerProfile(userId: string, profileData: ProfileData): Promise<any>;
}
export {};
//# sourceMappingURL=profile.service.d.ts.map