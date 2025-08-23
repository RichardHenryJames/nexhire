import { User } from '../types';
export declare class UserService {
    static register(userData: any): Promise<User>;
    private static createEmployerProfileWithOrganizationTx;
    private static createEmployerProfileWithOrganization;
    private static createApplicantProfileTx;
    private static createApplicantProfile;
    static initializeEmployerProfile(userId: string, data: any): Promise<{
        organizationId: string;
        employerId: string;
    }>;
    static login(loginData: any): Promise<{
        user: Omit<User, 'Password'>;
        tokens: any;
    }>;
    static findByEmail(email: string): Promise<User | null>;
    static findById(userId: string): Promise<User | null>;
    static updateProfile(userId: string, updateData: any): Promise<User>;
    static changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void>;
    static verifyEmail(userId: string): Promise<void>;
    static deactivateAccount(userId: string): Promise<void>;
    static getDashboardStats(userId: string): Promise<any>;
    private static incrementLoginAttempts;
    private static updateLastLogin;
    private static getJobSeekerStats;
    private static getEmployerStats;
    static updateEducation(userId: string, educationData: any): Promise<{
        success: boolean;
        message: string;
    }>;
    static updateWorkExperience(userId: string, workExperienceData: any): Promise<{
        success: boolean;
        message: string;
    }>;
    static updateJobPreferences(userId: string, jobPreferencesData: any): Promise<{
        success: boolean;
        message: string;
    }>;
}
//# sourceMappingURL=user.service.d.ts.map