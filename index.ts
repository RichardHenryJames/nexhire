import { app } from "@azure/functions";
import type { InvocationContext, Timer } from "@azure/functions";

// FIXED: Import CORS middleware
import { withErrorHandling, corsHeaders } from "./src/middleware";

// Import controllers
import {
  register,
  login,
  logout, // FIXED: Add logout import
  getProfile,
  updateProfile,
  updateEducation, // NEW: Add education update import
  changePassword,
  verifyEmail,
  getDashboardStats,
  deactivateAccount,
  refreshToken,
  googleLogin, // NEW: Google OAuth login
  googleRegister, // NEW: Google OAuth registration
  getMyReferralCode, // NEW: Get user's referral code and stats
} from "./src/controllers/user.controller";
import {
  createJob,
  getJobs,
  getJobById,
  updateJob,
  deleteJob,
  publishJob,
  closeJob,
  searchJobs,
  getJobsByOrganization,
  getJobTypes,
  getCurrencies,
  getAIRecommendedJobs, // NEW: AI job recommendations with wallet deduction
  getAIJobFilters, // NEW: Get AI filters (FREE - for preview)
  checkAIAccessStatus, // NEW: Check if user has active 24hr AI access
} from "./src/controllers/job.controller";
import {
  applyForJob,
  getMyApplications,
  getJobApplications,
  updateApplicationStatus,
  withdrawApplication,
  getApplicationDetails,
  getApplicationStats,
} from "./src/controllers/job-application.controller";
import {
  getOrganizations,
  getOrganizationById,
  getColleges,
  getUniversitiesByCountry,
  getIndustries,
  getCountries, // NEW: Add countries import
  getWorkplaceTypes, // NEW: Workplace types
} from "./src/controllers/reference.controller";
import { initializeEmployer } from "./src/controllers/employer.controller";

// NEW: Work experience controllers
import {
  getMyWorkExperiences,
  getWorkExperiences,
  getWorkExperienceById,
  createWorkExperience,
  updateWorkExperience,
  deleteWorkExperience,
} from "./src/controllers/work-experience.controller";
import {
  saveJob as saveJobCtrl,
  unsaveJob as unsaveJobCtrl,
  getMySavedJobs as getMySavedJobsCtrl,
} from "./src/controllers/saved-jobs.controller";

// Import referral controllers
import {
  getReferralPlans,
  purchaseReferralPlan,
  getCurrentSubscription,
  checkReferralEligibility,
  createReferralRequest,
  getMyReferralRequests,
  getAvailableRequests, // FIXED: Correct import name
  claimReferralRequest,
  submitReferralProof,
  verifyReferralCompletion,
  getMyReferrerRequests,
  getReferralAnalytics,
  claimReferralRequest as claimReferralRequestWithProof, // FIXED: Use alias for now
  cancelReferralRequest,
  getReferrerStats,
  getReferralPointsHistory, // NEW: Add points history import
  convertPointsToWallet, // NEW: Convert points to wallet
} from "./src/controllers/referral.controller";

// NEW: Payment controllers - Razorpay Integration
import {
  createRazorpayOrder,
  verifyPaymentAndActivateSubscription,
  getPaymentHistory,
} from "./src/controllers/payment.controller";

// NEW: Wallet controllers - Wallet Management
import {
  getWallet,
  getWalletBalance,
  createWalletRechargeOrder,
  verifyWalletRecharge,
  getWalletTransactions,
  getRechargeHistory,
  getWalletStats,
  debitWallet,
} from "./src/controllers/wallet.controller";

// Import storage controller - MOVED HERE to prevent execution issues
import { uploadFile, deleteFile } from "./src/controllers/storage.controller";

// NEW: Messaging system controllers
import {
  getOrCreateConversation,
  getMyConversations,
  getConversationMessages,
  sendMessage,
  markMessageAsRead,
  markConversationAsRead,
  getUnreadCount,
  archiveConversation,
  muteConversation,
  deleteMessage,
  blockUser,
  unblockUser,
  checkIfBlocked,
  getBlockedUsers,
  recordProfileView,
  getMyProfileViews,
  getPublicProfile,
  searchUsers, // ?? User search
} from "./src/controllers/messaging.controller";

// ?? Import SignalR controller
import "./src/controllers/signalr.controller";

// Import profile services
import {
  ApplicantService,
  EmployerService,
} from "./src/services/profile.service";

// ========================================================================
// AUTHENTICATION & USER MANAGEMENT ENDPOINTS
// ========================================================================

app.http("auth-register", {
  methods: ["POST", "OPTIONS"],
  authLevel: "anonymous",
  route: "auth/register",
  handler: withErrorHandling(register),
});

app.http("auth-login", {
  methods: ["POST", "OPTIONS"],
  authLevel: "anonymous",
  route: "auth/login",
  handler: withErrorHandling(login),
});

// NEW: Google OAuth Login
app.http("auth-google-login", {
  methods: ["POST", "OPTIONS"],
  authLevel: "anonymous",
  route: "auth/google",
  handler: withErrorHandling(googleLogin),
});

// NEW: Google OAuth Registration
app.http("auth-google-register", {
  methods: ["POST", "OPTIONS"],
  authLevel: "anonymous",
  route: "auth/google-register",
  handler: withErrorHandling(googleRegister),
});

// FIXED: Add logout endpoint
app.http("auth-logout", {
  methods: ["POST", "OPTIONS"],
  authLevel: "anonymous",
  route: "auth/logout",
  handler: withErrorHandling(logout),
});

app.http("auth-refresh", {
  methods: ["POST", "OPTIONS"],
  authLevel: "anonymous",
  route: "auth/refresh",
  handler: withErrorHandling(refreshToken),
});

app.http("users-profile", {
  methods: ["GET", "PUT", "OPTIONS"],
  authLevel: "anonymous",
  route: "users/profile",
  handler: withErrorHandling(async (req, context) => {
    if (req.method === "GET") {
      return await getProfile(req, context);
    } else {
      return await updateProfile(req, context);
    }
  }),
});

app.http("users-change-password", {
  methods: ["POST", "OPTIONS"],
  authLevel: "anonymous",
  route: "users/change-password",
  handler: withErrorHandling(changePassword),
});

app.http("users-verify-email", {
  methods: ["POST", "OPTIONS"],
  authLevel: "anonymous",
  route: "users/verify-email",
  handler: withErrorHandling(verifyEmail),
});

app.http("users-dashboard-stats", {
  methods: ["GET", "OPTIONS"],
  authLevel: "anonymous",
  route: "users/dashboard-stats",
  handler: withErrorHandling(getDashboardStats),
});

app.http("users-update-education", {
  methods: ["PUT", "OPTIONS"],
  authLevel: "anonymous",
  route: "users/education",
  handler: withErrorHandling(updateEducation),
});

// NEW: Get my referral code and stats
app.http("users-referral-code", {
  methods: ["GET", "OPTIONS"],
  authLevel: "anonymous",
  route: "users/referral-code",
  handler: withErrorHandling(getMyReferralCode),
});

// ========================================================================
// WORK EXPERIENCES CRUD endpoints
// ========================================================================
app.http("my-work-experiences", {
  methods: ["GET", "OPTIONS"],
  authLevel: "anonymous",
  route: "work-experiences/my",
  handler: withErrorHandling(getMyWorkExperiences),
});

app.http("applicant-work-experiences", {
  methods: ["GET", "OPTIONS"],
  authLevel: "anonymous",
  route: "work-experiences/applicant/{applicantId}",
  handler: withErrorHandling(getWorkExperiences),
});

app.http("work-experience-by-id", {
  methods: ["GET", "PUT", "DELETE", "OPTIONS"],
  authLevel: "anonymous",
  route: "work-experiences/{workExperienceId}",
  handler: withErrorHandling(async (req, context) => {
    if (req.method === "GET") return await getWorkExperienceById(req, context);
    if (req.method === "PUT") return await updateWorkExperience(req, context);
    if (req.method === "DELETE")
      return await deleteWorkExperience(req, context);
    return {
      status: 405,
      jsonBody: { success: false, error: "Method not allowed" },
    };
  }),
});

app.http("create-work-experience", {
  methods: ["POST", "OPTIONS"],
  authLevel: "anonymous",
  route: "work-experiences",
  handler: withErrorHandling(createWorkExperience),
});

app.http("users-deactivate", {
  methods: ["POST", "OPTIONS"],
  authLevel: "anonymous",
  route: "users/deactivate",
  handler: withErrorHandling(deactivateAccount),
});

// NEW: Employers initialize endpoint
app.http("employers-initialize", {
  methods: ["POST", "OPTIONS"],
  authLevel: "anonymous",
  route: "employers/initialize",
  handler: withErrorHandling(initializeEmployer),
});

// ========================================================================
// APPLICANT/EMPLOYER PROFILE ENDPOINTS (FIXED: Single function per route)
// ========================================================================

// FIXED: Combined Applicant Profile Management (GET + PUT in single function)
app.http("applicants-profile", {
  methods: ["GET", "PUT", "OPTIONS"],
  authLevel: "anonymous",
  route: "applicants/{userId}/profile",
  handler: withErrorHandling(async (req, context) => {
    const userId = req.params.userId;

    try {
      // Handle OPTIONS for CORS
      if (req.method === "OPTIONS") {
        return { status: 200 };
      }

      // Handle GET - Get applicant profile
      if (req.method === "GET") {
        console.log("Getting applicant profile for user:", userId);
        const profile = await ApplicantService.getApplicantProfile(userId);
        return {
          status: 200,
          jsonBody: {
            success: true,
            data: profile,
          },
        };
      }

      // Handle PUT - Update applicant profile
      if (req.method === "PUT") {
        console.log("Updating applicant profile for user:", userId);

        const profileData = (await req.json()) as any;
        console.log("Profile data received fields:", Object.keys(profileData));
        console.log("hideCurrentCompany:", profileData.hideCurrentCompany);
        console.log("hideSalaryDetails:", profileData.hideSalaryDetails);

        const updatedProfile = await ApplicantService.updateApplicantProfile(
          userId,
          profileData
        );

        console.log("Profile updated successfully");
        return {
          status: 200,
          jsonBody: {
            success: true,
            data: updatedProfile,
            message: "Applicant profile updated successfully",
          },
        };
      }

      // Unsupported method
      return {
        status: 405,
        jsonBody: {
          success: false,
          error: "Method not allowed",
        },
      };
    } catch (error) {
      console.error(`Error handling applicant profile ${req.method}:`, error);
      return {
        status: 500,
        jsonBody: {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : `Failed to ${
                  req.method === "GET" ? "get" : "update"
                } applicant profile`,
        },
      };
    }
  }),
});

// FIXED: Combined Employer Profile Management (GET + PUT in single function)
app.http("employers-profile", {
  methods: ["GET", "PUT", "OPTIONS"],
  authLevel: "anonymous",
  route: "employers/{userId}/profile",
  handler: withErrorHandling(async (req, context) => {
    const userId = req.params.userId;

    try {
      // Handle OPTIONS for CORS
      if (req.method === "OPTIONS") {
        return { status: 200 };
      }

      // Handle GET - Get employer profile
      if (req.method === "GET") {
        console.log("Getting employer profile for user:", userId);
        const profile = await EmployerService.getEmployerProfile(userId);
        return {
          status: 200,
          jsonBody: {
            success: true,
            data: profile,
          },
        };
      }

      // Handle PUT - Update employer profile
      if (req.method === "PUT") {
        console.log("Updating employer profile for user:", userId);

        const profileData = (await req.json()) as any;
        const updatedProfile = await EmployerService.updateEmployerProfile(
          userId,
          profileData
        );

        return {
          status: 200,
          jsonBody: {
            success: true,
            data: updatedProfile,
            message: "Employer profile updated successfully",
          },
        };
      }

      // Unsupported method
      return {
        status: 405,
        jsonBody: {
          success: false,
          error: "Method not allowed",
        },
      };
    } catch (error) {
      console.error(`Error handling employer profile ${req.method}:`, error);
      return {
        status: 500,
        jsonBody: {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : `Failed to ${
                  req.method === "GET" ? "get" : "update"
                } employer profile`,
        },
      };
    }
  }),
});

// ========================================================================
// JOB MANAGEMENT ENDPOINTS
// ========================================================================

// Specific search route moved to /search/jobs to avoid any collision with /jobs/{id}
app.http("jobs-search", {
  methods: ["GET", "OPTIONS"],
  authLevel: "anonymous",
  route: "search/jobs",
  handler: searchJobs,
});

app.http("jobs", {
  methods: ["GET", "POST", "OPTIONS"],
  authLevel: "anonymous",
  route: "jobs",
  handler: async (req, context) => {
    if (req.method === "GET") {
      return await getJobs(req, context);
    } else {
      return await createJob(req, context);
    }
  },
});

app.http("jobs-by-id", {
  methods: ["GET", "PUT", "DELETE", "OPTIONS"],
  authLevel: "anonymous",
  route: "jobs/{id}",
  handler: withErrorHandling(async (req, context) => {
    if (req.method === "GET") {
      return await getJobById(req, context);
    } else if (req.method === "PUT") {
      return await updateJob(req, context);
    } else {
      return await deleteJob(req, context);
    }
  }),
});

app.http("jobs-publish", {
  methods: ["POST", "OPTIONS"],
  authLevel: "anonymous",
  route: "jobs/{id}/publish",
  handler: withErrorHandling(publishJob),
});

app.http("jobs-close", {
  methods: ["POST", "OPTIONS"],
  authLevel: "anonymous",
  route: "jobs/{id}/close",
  handler: withErrorHandling(closeJob),
});

// NEW: Organization jobs endpoint for employers
app.http("organization-jobs", {
  methods: ["GET", "OPTIONS"],
  authLevel: "anonymous",
  route: "organizations/{organizationId}/jobs",
  handler: withErrorHandling(getJobsByOrganization),
});

// NEW: AI-recommended jobs with wallet deduction
app.http("ai-recommended-jobs", {
  methods: ["GET", "OPTIONS"],
  authLevel: "anonymous",
  route: "jobs/ai-recommendations",
  handler: getAIRecommendedJobs,
});

// NEW: AI job filters (FREE - no wallet deduction, for preview)
app.http("ai-job-filters", {
  methods: ["GET", "OPTIONS"],
  authLevel: "anonymous",
  route: "jobs/ai-filters",
  handler: getAIJobFilters,
});

// NEW: Check AI access status (24hr validity)
app.http("ai-access-status", {
  methods: ["GET", "OPTIONS"],
  authLevel: "anonymous",
  route: "jobs/ai-access-status",
  handler: checkAIAccessStatus,
});

// ========================================================================
// JOB APPLICATION ENDPOINTS
// ========================================================================

app.http("applications", {
  methods: ["POST", "OPTIONS"],
  authLevel: "anonymous",
  route: "applications",
  handler: withErrorHandling(applyForJob),
});

// REPLACED: use a distinct base path to avoid collisions with applications/{applicationId}
app.http("my-applications", {
  methods: ["GET", "OPTIONS"],
  authLevel: "anonymous",
  route: "my/applications",
  handler: withErrorHandling(getMyApplications),
});

app.http("job-applications", {
  methods: ["GET", "OPTIONS"],
  authLevel: "anonymous",
  route: "jobs/{jobId}/applications",
  handler: withErrorHandling(getJobApplications),
});

app.http("applications-update-status", {
  methods: ["PUT", "OPTIONS"],
  authLevel: "anonymous",
  route: "applications/{applicationId}/status",
  handler: withErrorHandling(updateApplicationStatus),
});

// COMBINED: Details (GET) + Withdraw (DELETE) under one function to avoid route collision issues
app.http("applications-details", {
  methods: ["GET", "DELETE", "OPTIONS"],
  authLevel: "anonymous",
  route: "applications/{applicationId}",
  handler: withErrorHandling(async (req, context) => {
    if (req.method === "OPTIONS") return { status: 200 } as any;
    if (req.method === "GET") {
      return await getApplicationDetails(req, context);
    }
    if (req.method === "DELETE") {
      return await withdrawApplication(req, context);
    }
    return {
      status: 405,
      jsonBody: { success: false, error: "Method not allowed" },
    };
  }),
});

// ========================================================================
// REFERENCE DATA ENDPOINTS
// ========================================================================

app.http("reference-job-types", {
  methods: ["GET", "OPTIONS"],
  authLevel: "anonymous",
  route: "reference/job-types",
  handler: withErrorHandling(getJobTypes),
});

app.http("reference-workplace-types", {
  methods: ["GET", "OPTIONS"],
  authLevel: "anonymous",
  route: "reference/workplace-types",
  handler: withErrorHandling(getWorkplaceTypes),
});

app.http("reference-currencies", {
  methods: ["GET", "OPTIONS"],
  authLevel: "anonymous",
  route: "reference/currencies",
  handler: withErrorHandling(getCurrencies),
});

app.http("reference-organizations", {
  methods: ["GET", "OPTIONS"],
  authLevel: "anonymous",
  route: "reference/organizations",
  handler: withErrorHandling(getOrganizations),
});

app.http("reference-organization-by-id", {
  methods: ["GET", "OPTIONS"],
  authLevel: "anonymous",
  route: "reference/organizations/{id}",
  handler: withErrorHandling(getOrganizationById),
});

app.http("reference-colleges", {
  methods: ["GET", "OPTIONS"],
  authLevel: "anonymous",
  route: "reference/colleges",
  handler: withErrorHandling(getColleges),
});

app.http("reference-universities-by-country", {
  methods: ["GET", "OPTIONS"],
  authLevel: "anonymous",
  route: "reference/universities-by-country",
  handler: withErrorHandling(getUniversitiesByCountry),
});

app.http("reference-industries", {
  methods: ["GET", "OPTIONS"],
  authLevel: "anonymous",
  route: "reference/industries",
  handler: withErrorHandling(getIndustries),
});

app.http("reference-countries", {
  methods: ["GET", "OPTIONS"],
  authLevel: "anonymous",
  route: "reference/countries",
  handler: withErrorHandling(getCountries),
});

app.http("reference-salary-components", {
  methods: ["GET", "OPTIONS"],
  authLevel: "anonymous",
  route: "reference/salary-components",
  handler: withErrorHandling(async (req, context) => {
    try {
      if (req.method === "OPTIONS") {
        return { status: 200 };
      }
      const { ApplicantService } = await import(
        "./src/services/profile.service"
      );
      const components = await ApplicantService.getSalaryComponents();
      return { status: 200, jsonBody: { success: true, data: components } };
    } catch (error) {
      console.error("Error getting salary components:", error);
      return {
        status: 500,
        jsonBody: {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to get salary components",
        },
      };
    }
  }),
});

app.http("users-profile-image", {
  methods: ["POST", "OPTIONS"],
  authLevel: "anonymous",
  route: "users/profile-image",
  handler: withErrorHandling(async (req, context) => {
    const { uploadProfileImage } = await import(
      "./src/services/profile-image.service"
    );
    return await uploadProfileImage(req, context);
  }),
});

// NEW: Resume upload endpoint
app.http("users-resume-upload", {
  methods: ["POST", "OPTIONS"],
  authLevel: "anonymous",
  route: "users/resume",
  handler: withErrorHandling(async (req, context) => {
    const { uploadResume } = await import(
      "./src/services/resume-upload.service"
    );
    return await uploadResume(req, context);
  }),
});

// NEW: Resume management endpoints
app.http("users-resumes", {
  methods: ["GET", "OPTIONS"],
  authLevel: "anonymous",
  route: "users/resumes",
  handler: withErrorHandling(async (req, context) => {
    // Get resumes for authenticated user
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return {
        status: 401,
        jsonBody: { success: false, error: "Authorization required" },
      };
    }

    try {
      // Extract user ID from JWT (simplified - you should use proper JWT verification)
      const token = authHeader.replace("Bearer ", "");
      const { AuthService } = await import("./src/services/auth.service");
      const decoded = AuthService.verifyToken(token);

      const { ApplicantService } = await import(
        "./src/services/profile.service"
      );
      const profile = await ApplicantService.getApplicantProfile(
        decoded.userId
      );
      const resumes = await ApplicantService.getApplicantResumes(
        profile.ApplicantID
      );

      return {
        status: 200,
        jsonBody: {
          success: true,
          data: resumes,
          message: "Resumes retrieved successfully",
        },
      };
    } catch (error) {
      return {
        status: 500,
        jsonBody: {
          success: false,
          error:
            error instanceof Error ? error.message : "Failed to get resumes",
        },
      };
    }
  }),
});

app.http("users-resume-primary", {
  methods: ["PUT", "OPTIONS"],
  authLevel: "anonymous",
  route: "users/resume/{resumeId}/primary",
  handler: withErrorHandling(async (req, context) => {
    const resumeId = req.params.resumeId;
    const authHeader = req.headers.get("authorization");

    if (!authHeader) {
      return {
        status: 401,
        jsonBody: { success: false, error: "Authorization required" },
      };
    }

    try {
      const token = authHeader.replace("Bearer ", "");
      const { AuthService } = await import("./src/services/auth.service");
      const decoded = AuthService.verifyToken(token);

      const { ApplicantService } = await import(
        "./src/services/profile.service"
      );
      const profile = await ApplicantService.getApplicantProfile(
        decoded.userId
      );
      await ApplicantService.setPrimaryResume(profile.ApplicantID, resumeId);

      return {
        status: 200,
        jsonBody: {
          success: true,
          message: "Primary resume updated successfully",
        },
      };
    } catch (error) {
      return {
        status: 500,
        jsonBody: {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to update primary resume",
        },
      };
    }
  }),
});

app.http("users-resume-delete", {
  methods: ["DELETE", "OPTIONS"],
  authLevel: "anonymous",
  route: "users/resume/{resumeId}",
  handler: withErrorHandling(async (req, context) => {
    const resumeId = req.params.resumeId;
    const authHeader = req.headers.get("authorization");

    if (!authHeader) {
      return {
        status: 401,
        jsonBody: { success: false, error: "Authorization required" },
      };
    }

    try {
      const token = authHeader.replace("Bearer ", "");
      const { AuthService } = await import("./src/services/auth.service");
      const decoded = AuthService.verifyToken(token);

      const { ApplicantService } = await import(
        "./src/services/profile.service"
      );
      const profile = await ApplicantService.getApplicantProfile(
        decoded.userId
      );

      // Get resume details BEFORE deletion from active list (includes deleted flag now)
      const resumes = await ApplicantService.getApplicantResumes(
        profile.ApplicantID
      );
      const resumeToDelete = resumes.find((r) => r.ResumeID === resumeId);

      if (!resumeToDelete) {
        // Try historical (maybe already soft-deleted previously)
        const historical = await ApplicantService.getResumeForViewing(resumeId);
        if (!historical) {
          return {
            status: 404,
            jsonBody: { success: false, error: "Resume not found" },
          };
        }
        return {
          status: 400,
          jsonBody: { success: false, error: "Resume already deleted" },
        };
      }

      console.log("Deleting resume request:", {
        resumeId,
        userId: decoded.userId,
      });

      // Perform deletion (soft or hard)
      const result = await ApplicantService.deleteApplicantResume(
        profile.ApplicantID,
        resumeId
      );
      console.log("Delete result:", result);

      // Only attempt file deletion for hard delete
      if (!result.softDelete && resumeToDelete.ResumeURL) {
        try {
          const { ResumeStorageService } = await import(
            "./src/services/resume-upload.service"
          );
          const storageService = new ResumeStorageService();
          await storageService.deleteOldResume(
            decoded.userId,
            resumeToDelete.ResumeURL
          );
          console.log("Resume file deleted from storage");
        } catch (storageError) {
          console.error(
            "Warning: Failed to delete file from storage:",
            storageError
          );
          // Non-critical
        }
      } else if (result.softDelete) {
        console.log(
          "Soft delete performed - file retained for historical applications"
        );
      }

      return {
        status: 200,
        jsonBody: {
          success: true,
          message: result.message,
          softDelete: result.softDelete,
          applicationCount: result.applicationCount,
          referralCount: result.referralCount,
        },
      };
    } catch (error) {
      console.error("Error deleting resume:", error);
      return {
        status: 500,
        jsonBody: {
          success: false,
          error:
            error instanceof Error ? error.message : "Failed to delete resume",
        },
      };
    }
  }),
});

app.http("health", {
  methods: ["GET", "OPTIONS"],
  authLevel: "anonymous",
  route: "health",
  handler: withErrorHandling(async (req, context) => {
    return {
      status: 200,
      jsonBody: {
        success: true,
        message: "RefOpen Backend API is running",
        timestamp: new Date().toISOString(),
        version: "1.0.0",
      },
    };
  }),
});

// ========================================================================
// REFERRAL SYSTEM ENDPOINTS - FIXED TO MATCH WORKING PATTERN
// ========================================================================

// Referral Plans
app.http("referral-plans", {
  methods: ["GET", "OPTIONS"],
  authLevel: "anonymous",
  route: "referral/plans",
  handler: withErrorHandling(getReferralPlans), // Public endpoint - no auth needed
});

app.http("referral-plans-purchase", {
  methods: ["POST", "OPTIONS"],
  authLevel: "anonymous",
  route: "referral/plans/purchase",
  handler: withErrorHandling(purchaseReferralPlan), // Same pattern as work experience
});

// Referral Requests
app.http("referral-requests-create", {
  methods: ["POST", "OPTIONS"],
  authLevel: "anonymous",
  route: "referral/requests",
  handler: withErrorHandling(createReferralRequest), // Same pattern as work experience
});

app.http("referral-my-requests", {
  methods: ["GET", "OPTIONS"],
  authLevel: "anonymous",
  route: "referral/my-requests",
  handler: withErrorHandling(getMyReferralRequests), // Same pattern as work experience
});

app.http("referral-available", {
  methods: ["GET", "OPTIONS"],
  authLevel: "anonymous",
  route: "referral/available",
  handler: withErrorHandling(getAvailableRequests), // Same pattern as work experience
});

app.http("referral-claim", {
  methods: ["POST", "OPTIONS"],
  authLevel: "anonymous",
  route: "referral/requests/{requestId}/claim",
  handler: withErrorHandling(claimReferralRequest), // Same pattern as work experience
});

// NEW: Proof Submission & Verification
app.http("referral-proof-submit", {
  methods: ["POST", "OPTIONS"],
  authLevel: "anonymous",
  route: "referral/requests/{requestId}/proof",
  handler: withErrorHandling(submitReferralProof), // Same pattern as work experience
});

app.http("referral-verify", {
  methods: ["POST", "OPTIONS"],
  authLevel: "anonymous",
  route: "referral/requests/{requestId}/verify",
  handler: withErrorHandling(verifyReferralCompletion), // Same pattern as work experience
});

// NEW: Cancel referral request
app.http("referral-cancel", {
  methods: ["POST", "OPTIONS"],
  authLevel: "anonymous",
  route: "referral/requests/{requestId}/cancel",
  handler: withErrorHandling(cancelReferralRequest),
});

app.http("referral-my-referrer-requests", {
  methods: ["GET", "OPTIONS"],
  authLevel: "anonymous",
  route: "referral/my-referrer-requests",
  handler: withErrorHandling(getMyReferrerRequests), // Same pattern as work experience
});

app.http("referral-analytics", {
  methods: ["GET", "OPTIONS"],
  authLevel: "anonymous",
  route: "referral/analytics",
  handler: withErrorHandling(getReferralAnalytics), // Same pattern as work experience
});

app.http("referral-eligibility", {
  methods: ["GET", "OPTIONS"],
  authLevel: "anonymous",
  route: "referral/eligibility",
  handler: withErrorHandling(checkReferralEligibility), // Same pattern as work experience
});

app.http("referral-stats", {
  methods: ["GET", "OPTIONS"],
  authLevel: "anonymous",
  route: "referral/stats",
  handler: withErrorHandling(getReferrerStats), // Same pattern as work experience
});

app.http("referral-subscription", {
  methods: ["GET", "OPTIONS"],
  authLevel: "anonymous",
  route: "referral/subscription",
  handler: withErrorHandling(getCurrentSubscription), // Same pattern as work experience
});

// NEW: Get detailed referral points history
app.http("referral-points-history", {
  methods: ["GET", "OPTIONS"],
  authLevel: "anonymous",
  route: "referral/points-history",
  handler: withErrorHandling(getReferralPointsHistory),
});

// NEW: Convert referral points to wallet balance
app.http("referral-points-convert", {
  methods: ["POST", "OPTIONS"],
  authLevel: "anonymous",
  route: "referral/points/convert-to-wallet",
  handler: withErrorHandling(convertPointsToWallet),
});

// ========================================================================
// SAVED JOBS ENDPOINTS
// ========================================================================

app.http("saved-jobs-save", {
  methods: ["POST", "OPTIONS"],
  authLevel: "anonymous",
  route: "saved-jobs",
  handler: withErrorHandling(saveJobCtrl),
});

app.http("saved-jobs-unsave", {
  methods: ["DELETE", "OPTIONS"],
  authLevel: "anonymous",
  route: "saved-jobs/{jobId}",
  handler: withErrorHandling(unsaveJobCtrl),
});

app.http("saved-jobs-my", {
  methods: ["GET", "OPTIONS"],
  authLevel: "anonymous",
  route: "my/saved-jobs",
  handler: withErrorHandling(getMySavedJobsCtrl),
});

// ========================================================================
// PAYMENT SYSTEM ENDPOINTS - Razorpay Integration
// ========================================================================

app.http("payment-create-order", {
  methods: ["POST", "OPTIONS"],
  authLevel: "anonymous",
  route: "payments/razorpay/create-order",
  handler: withErrorHandling(createRazorpayOrder),
});

app.http("payment-verify-activate", {
  methods: ["POST", "OPTIONS"],
  authLevel: "anonymous",
  route: "payments/razorpay/verify-and-activate",
  handler: withErrorHandling(verifyPaymentAndActivateSubscription),
});

app.http("payment-history", {
  methods: ["GET", "OPTIONS"],
  authLevel: "anonymous",
  route: "payments/history",
  handler: withErrorHandling(getPaymentHistory),
});

// ========================================================================
// WALLET SYSTEM ENDPOINTS - Wallet Management
// ========================================================================

app.http("wallet-get", {
  methods: ["GET", "OPTIONS"],
  authLevel: "anonymous",
  route: "wallet",
  handler: withErrorHandling(getWallet),
});

app.http("wallet-balance", {
  methods: ["GET", "OPTIONS"],
  authLevel: "anonymous",
  route: "wallet/balance",
  handler: withErrorHandling(getWalletBalance),
});

app.http("wallet-recharge-create-order", {
  methods: ["POST", "OPTIONS"],
  authLevel: "anonymous",
  route: "wallet/recharge/create-order",
  handler: withErrorHandling(createWalletRechargeOrder),
});

app.http("wallet-recharge-verify", {
  methods: ["POST", "OPTIONS"],
  authLevel: "anonymous",
  route: "wallet/recharge/verify",
  handler: withErrorHandling(verifyWalletRecharge),
});

app.http("wallet-transactions", {
  methods: ["GET", "OPTIONS"],
  authLevel: "anonymous",
  route: "wallet/transactions",
  handler: withErrorHandling(getWalletTransactions),
});

app.http("wallet-recharge-history", {
  methods: ["GET", "OPTIONS"],
  authLevel: "anonymous",
  route: "wallet/recharge/history",
  handler: withErrorHandling(getRechargeHistory),
});

app.http("wallet-stats", {
  methods: ["GET", "OPTIONS"],
  authLevel: "anonymous",
  route: "wallet/stats",
  handler: withErrorHandling(getWalletStats),
});

app.http("wallet-debit", {
  methods: ["POST", "OPTIONS"],
  authLevel: "anonymous",
  route: "wallet/debit",
  handler: withErrorHandling(debitWallet),
});

// ========================================================================
// STORAGE ENDPOINTS - File uploads (import now at top)
// ========================================================================

app.http("storage-upload", {
  methods: ["POST", "OPTIONS"],
  authLevel: "anonymous",
  route: "storage/upload",
  handler: withErrorHandling(uploadFile),
});

app.http("storage-delete", {
  methods: ["DELETE", "OPTIONS"],
  authLevel: "anonymous",
  route: "storage/{containerName}/{fileName}",
  handler: withErrorHandling(deleteFile),
});

// ========================================================================
// MESSAGING SYSTEM ENDPOINTS - NEW: Chat & Direct Messaging
// ========================================================================

// Conversations
app.http("messaging-create-conversation", {
  methods: ["POST", "OPTIONS"],
  authLevel: "anonymous",
  route: "conversations",
  handler: withErrorHandling(getOrCreateConversation),
});

app.http("messaging-my-conversations", {
  methods: ["GET", "OPTIONS"],
  authLevel: "anonymous",
  route: "conversations/my",
  handler: withErrorHandling(getMyConversations),
});

app.http("messaging-conversation-messages", {
  methods: ["GET", "OPTIONS"],
  authLevel: "anonymous",
  route: "conversations/{conversationId}/messages",
  handler: withErrorHandling(getConversationMessages),
});

app.http("messaging-archive-conversation", {
  methods: ["PUT", "OPTIONS"],
  authLevel: "anonymous",
  route: "conversations/{conversationId}/archive",
  handler: withErrorHandling(archiveConversation),
});

app.http("messaging-mute-conversation", {
  methods: ["PUT", "OPTIONS"],
  authLevel: "anonymous",
  route: "conversations/{conversationId}/mute",
  handler: withErrorHandling(muteConversation),
});

app.http("messaging-mark-conversation-read", {
  methods: ["PUT", "OPTIONS"],
  authLevel: "anonymous",
  route: "conversations/{conversationId}/mark-read",
  handler: withErrorHandling(markConversationAsRead),
});

// Messages
app.http("messaging-send-message", {
  methods: ["POST", "OPTIONS"],
  authLevel: "anonymous",
  route: "messages",
  handler: withErrorHandling(sendMessage),
});

app.http("messaging-mark-message-read", {
  methods: ["PUT", "OPTIONS"],
  authLevel: "anonymous",
  route: "messages/{messageId}/read",
  handler: withErrorHandling(markMessageAsRead),
});

app.http("messaging-delete-message", {
  methods: ["DELETE", "OPTIONS"],
  authLevel: "anonymous",
  route: "messages/{messageId}",
  handler: withErrorHandling(deleteMessage),
});

app.http("messaging-unread-count", {
  methods: ["GET", "OPTIONS"],
  authLevel: "anonymous",
  route: "messages/unread-count",
  handler: withErrorHandling(getUnreadCount),
});

// User Blocking
app.http("messaging-block-user", {
  methods: ["POST", "OPTIONS"],
  authLevel: "anonymous",
  route: "users/block",
  handler: withErrorHandling(blockUser),
});

app.http("messaging-unblock-user", {
  methods: ["DELETE", "OPTIONS"],
  authLevel: "anonymous",
  route: "users/block/{userId}",
  handler: withErrorHandling(unblockUser),
});

app.http("messaging-check-blocked", {
  methods: ["GET", "OPTIONS"],
  authLevel: "anonymous",
  route: "users/is-blocked/{userId}",
  handler: withErrorHandling(checkIfBlocked),
});

app.http("messaging-get-blocked-users", {
  methods: ["GET", "OPTIONS"],
  authLevel: "anonymous",
  route: "users/blocked",
  handler: withErrorHandling(getBlockedUsers),
});

// Profile Viewing
app.http("messaging-record-profile-view", {
  methods: ["POST", "OPTIONS"],
  authLevel: "anonymous",
  route: "users/{userId}/profile-view",
  handler: withErrorHandling(recordProfileView),
});

app.http("messaging-my-profile-views", {
  methods: ["GET", "OPTIONS"],
  authLevel: "anonymous",
  route: "users/profile-views",
  handler: withErrorHandling(getMyProfileViews),
});

app.http("messaging-get-public-profile", {
  methods: ["GET", "OPTIONS"],
  authLevel: "anonymous",
  route: "users/{userId}/public-profile",
  handler: withErrorHandling(getPublicProfile),
});

// ?? NEW: Search users for messaging
app.http("messaging-search-users", {
  methods: ["GET", "OPTIONS"],
  authLevel: "anonymous",
  route: "users/search",
  handler: withErrorHandling(searchUsers),
});

// ========================================================================
// DIAGNOSTIC ENDPOINT - Simple test without any imports
// ========================================================================

app.http("scraping-ping", {
  methods: ["GET", "OPTIONS"],
  authLevel: "anonymous",
  route: "jobs/scrape/ping",
  handler: withErrorHandling(async (req, context) => {
    return {
      status: 200,
      jsonBody: {
        success: true,
        message: "Scraping section loaded successfully",
        timestamp: new Date().toISOString(),
        test: "This endpoint has zero dependencies",
      },
    };
  }),
});

// ========================================================================
// JOB SCRAPING ENDPOINTS - PROPER IMPLEMENTATION with Dynamic Loading
// ========================================================================

app.http("job-scraper-trigger", {
  methods: ["POST", "OPTIONS"],
  authLevel: "anonymous",
  route: "jobs/scrape/trigger",
  handler: withErrorHandling(async (req, context) => {
    try {
      // Verify admin authentication inline
      const authHeader = req.headers.get("authorization");
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return {
          status: 403,
          jsonBody: {
            success: false,
            error: "Authorization header required",
          },
        };
      }

      const token = authHeader.substring(7);
      const { AuthService } = await import("./src/services/auth.service");
      const payload = AuthService.verifyToken(token);

      if (payload.userType !== "Admin") {
        return {
          status: 403,
          jsonBody: {
            success: false,
            error: "Admin access required",
          },
        };
      }

      console.log("Manual job scraping triggered by admin:", payload.userId);

      // Dynamic import of JobScraperService
      try {
        const { JobScraperService } = await import(
          "./src/services/job-scraper.service"
        );
        const result = await JobScraperService.scrapeAndPopulateJobs();

        return {
          status: result.success ? 200 : 500,
          jsonBody: {
            success: result.success,
            message: `Job scraping completed. ${result.jobsAdded} jobs added.`,
            data: {
              jobsAdded: result.jobsAdded,
              totalJobsScraped: result.summary.totalJobsScraped,
              indiaJobsAdded: result.summary.indiaJobsAdded,
              sourceBreakdown: result.summary.sourceBreakdown,
              executionTimeSeconds: Math.round(
                result.summary.executionTime / 1000
              ),
              errors: result.errors,
            },
          },
        };
      } catch (serviceError) {
        console.error("JobScraperService failed:", serviceError);
        return {
          status: 503,
          jsonBody: {
            success: false,
            error: "Job scraping service is temporarily unavailable",
            details:
              serviceError instanceof Error
                ? serviceError.message
                : "Unknown error",
          },
        };
      }
    } catch (error: any) {
      console.error("Job scraping trigger failed:", error);
      return {
        status: 500,
        jsonBody: {
          success: false,
          error: "Internal server error",
          details: error.message,
        },
      };
    }
  }),
});

app.http("scraping-config", {
  methods: ["GET", "PUT", "OPTIONS"],
  authLevel: "anonymous",
  route: "jobs/scrape/config",
  handler: withErrorHandling(async (req, context) => {
    try {
      // Admin auth check
      const authHeader = req.headers.get("authorization");
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return {
          status: 403,
          jsonBody: { success: false, error: "Authorization header required" },
        };
      }

      const token = authHeader.substring(7);
      const { AuthService } = await import("./src/services/auth.service");
      const payload = AuthService.verifyToken(token);

      if (payload.userType !== "Admin") {
        return {
          status: 403,
          jsonBody: { success: false, error: "Admin access required" },
        };
      }

      // Dynamic import and actual functionality
      const { JobScraperService } = await import(
        "./src/services/job-scraper.service"
      );

      if (req.method === "GET") {
        const config = JobScraperService.getConfig();
        return {
          status: 200,
          jsonBody: {
            success: true,
            data: config,
            message: "Scraping configuration retrieved successfully",
          },
        };
      } else if (req.method === "PUT") {
        const updates = (await req.json()) as any;

        // Validate updates
        if (
          updates.maxJobsPerRun &&
          (updates.maxJobsPerRun < 1 || updates.maxJobsPerRun > 500)
        ) {
          return {
            status: 400,
            jsonBody: {
              success: false,
              error: "maxJobsPerRun must be between 1 and 500",
            },
          };
        }

        JobScraperService.updateConfig(updates);

        return {
          status: 200,
          jsonBody: {
            success: true,
            data: JobScraperService.getConfig(),
            message: "Configuration updated successfully",
          },
        };
      }

      return {
        status: 405,
        jsonBody: { success: false, error: "Method not allowed" },
      };
    } catch (serviceError) {
      console.error("Scraping config error:", serviceError);
      return {
        status: 503,
        jsonBody: {
          success: false,
          error: "Configuration service temporarily unavailable",
          details:
            serviceError instanceof Error
              ? serviceError.message
              : "Unknown error",
        },
      };
    }
  }),
});

app.http("scraping-stats", {
  methods: ["GET", "OPTIONS"],
  authLevel: "anonymous",
  route: "jobs/scrape/stats",
  handler: withErrorHandling(async (req, context) => {
    try {
      // Admin auth
      const authHeader = req.headers.get("authorization");
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return {
          status: 403,
          jsonBody: { success: false, error: "Authorization header required" },
        };
      }

      const token = authHeader.substring(7);
      const { AuthService } = await import("./src/services/auth.service");
      const payload = AuthService.verifyToken(token);

      if (payload.userType !== "Admin") {
        return {
          status: 403,
          jsonBody: { success: false, error: "Admin access required" },
        };
      }

      // Get actual stats from service
      const { JobScraperService } = await import(
        "./src/services/job-scraper.service"
      );
      const stats = await JobScraperService.getScrapingStats();

      return {
        status: 200,
        jsonBody: {
          success: true,
          data: stats,
          message: "Scraping statistics retrieved successfully",
        },
      };
    } catch (serviceError) {
      console.error("Scraping stats error:", serviceError);
      return {
        status: 503,
        jsonBody: {
          success: false,
          error: "Statistics service temporarily unavailable",
          details:
            serviceError instanceof Error
              ? serviceError.message
              : "Unknown error",
        },
      };
    }
  }),
});

app.http("scraping-cleanup", {
  methods: ["DELETE", "OPTIONS"],
  authLevel: "anonymous",
  route: "jobs/scrape/cleanup",
  handler: withErrorHandling(async (req, context) => {
    try {
      // Admin auth
      const authHeader = req.headers.get("authorization");
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return {
          status: 403,
          jsonBody: { success: false, error: "Authorization header required" },
        };
      }

      const token = authHeader.substring(7);
      const { AuthService } = await import("./src/services/auth.service");
      const payload = AuthService.verifyToken(token);

      if (payload.userType !== "Admin") {
        return {
          status: 403,
          jsonBody: { success: false, error: "Admin access required" },
        };
      }

      const { daysOld = 90, source = null } = req.query as any;

      if (isNaN(daysOld) || daysOld < 1 || daysOld > 365) {
        return {
          status: 400,
          jsonBody: {
            success: false,
            error: "daysOld must be between 1 and 365",
          },
        };
      }

      // Perform actual cleanup
      const { dbService } = await import("./src/services/database.service");

      let cleanupQuery = `
                DELETE FROM Jobs
                WHERE PostedByType = 0
                  AND ExternalJobID IS NOT NULL
                  AND CreatedAt < DATEADD(day, -@param0, GETUTCDATE())
            `;

      const queryParams: any[] = [parseInt(daysOld)];

      if (source) {
        cleanupQuery += ` AND ExternalJobID LIKE @param1`;
        queryParams.push(`${source}_%`);
      }

      const result = await dbService.executeQuery(cleanupQuery, queryParams);
      const deletedCount = result.rowsAffected?.[0] || 0;

      return {
        status: 200,
        jsonBody: {
          success: true,
          data: {
            deletedJobs: deletedCount,
            daysOld: parseInt(daysOld),
            source: source || "all",
          },
          message: `Cleanup completed. ${deletedCount} jobs removed.`,
        },
      };
    } catch (serviceError) {
      console.error("Cleanup error:", serviceError);
      return {
        status: 503,
        jsonBody: {
          success: false,
          error: "Cleanup service temporarily unavailable",
          details:
            serviceError instanceof Error
              ? serviceError.message
              : "Unknown error",
        },
      };
    }
  }),
});

app.http("scraping-health", {
  methods: ["GET", "OPTIONS"],
  authLevel: "anonymous",
  route: "jobs/scrape/health",
  handler: withErrorHandling(async (req, context) => {
    try {
      // Try to load service and get real health data
      const { JobScraperService } = await import(
        "./src/services/job-scraper.service"
      );

      const config = JobScraperService.getConfig();
      const stats = await JobScraperService.getScrapingStats();

      // Determine real health status
      const totalJobs = stats.summary?.TotalScrapedJobs || 0;
      const jobsLast24h = stats.summary?.JobsLast24h || 0;
      const isHealthy = config.enabled && totalJobs >= 0;

      const healthData = {
        status: isHealthy ? "healthy" : "degraded",
        scrapingEnabled: config.enabled,
        totalScrapedJobs: totalJobs,
        jobsLast24h: jobsLast24h,
        indiaJobs: stats.summary?.TotalIndiaJobs || 0,
        activeSources: Object.keys(config.sources).filter(
          (source) => (config.sources as any)[source]?.enabled
        ),
        lastCheck: new Date().toISOString(),
        recommendations: [] as string[],
      };

      // Add intelligent recommendations
      if (!config.enabled) {
        healthData.recommendations.push("Enable job scraping in configuration");
      }
      if (jobsLast24h === 0 && totalJobs === 0) {
        healthData.recommendations.push(
          "No jobs scraped yet - run initial scraping"
        );
      } else if (jobsLast24h === 0) {
        healthData.recommendations.push(
          "No jobs scraped in last 24 hours - check sources"
        );
      }
      if (totalJobs < 100) {
        healthData.recommendations.push(
          "Low job count - consider running scraper more frequently"
        );
      }

      return {
        status: 200,
        jsonBody: {
          success: true,
          data: healthData,
          message: `Scraper health status: ${healthData.status}`,
        },
      };
    } catch (serviceError) {
      // If service can't load, return basic health info
      console.warn(
        "JobScraperService unavailable for health check:",
        serviceError
      );
      return {
        status: 200,
        jsonBody: {
          success: true,
          data: {
            status: "service-unavailable",
            message:
              "Scraping service temporarily unavailable but endpoint is working",
            error:
              serviceError instanceof Error
                ? serviceError.message
                : "Service load failed",
            lastCheck: new Date().toISOString(),
            recommendations: [
              "Service dependencies may need to be resolved",
              "Check application logs for detailed error information",
            ],
          },
          message: "Health check endpoint operational, service unavailable",
        },
      };
    }
  }),
});

// ========================================================================
// JOB SCRAPING SCHEDULER CONTROL ENDPOINTS - NEW
// ========================================================================

app.http("scheduler-status", {
  methods: ["GET", "OPTIONS"],
  authLevel: "anonymous",
  route: "scheduler/status",
  handler: withErrorHandling(async (req, context) => {
    try {
      const { SchedulerService } = await import(
        "./src/services/scheduler.service"
      );
      const scheduler = SchedulerService.getInstance();
      const status = scheduler.getStatus();

      return {
        status: 200,
        jsonBody: {
          success: true,
          data: status,
          message: "Scheduler status retrieved successfully",
        },
      };
    } catch (error) {
      console.error("Scheduler status error:", error);
      return {
        status: 500,
        jsonBody: {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to get scheduler status",
        },
      };
    }
  }),
});

app.http("scheduler-start", {
  methods: ["POST", "OPTIONS"],
  authLevel: "anonymous",
  route: "scheduler/start",
  handler: withErrorHandling(async (req, context) => {
    try {
      // Admin auth check
      const authHeader = req.headers.get("authorization");
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return {
          status: 403,
          jsonBody: { success: false, error: "Authorization header required" },
        };
      }

      const token = authHeader.substring(7);
      const { AuthService } = await import("./src/services/auth.service");
      const payload = AuthService.verifyToken(token);

      if (payload.userType !== "Admin") {
        return {
          status: 403,
          jsonBody: { success: false, error: "Admin access required" },
        };
      }

      const { SchedulerService } = await import(
        "./src/services/scheduler.service"
      );
      const scheduler = SchedulerService.getInstance();
      scheduler.start();

      return {
        status: 200,
        jsonBody: {
          success: true,
          data: scheduler.getStatus(),
          message: "Scheduler started successfully",
        },
      };
    } catch (error) {
      console.error("Scheduler start error:", error);
      return {
        status: 500,
        jsonBody: {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to start scheduler",
        },
      };
    }
  }),
});

app.http("scheduler-stop", {
  methods: ["POST", "OPTIONS"],
  authLevel: "anonymous",
  route: "scheduler/stop",
  handler: withErrorHandling(async (req, context) => {
    try {
      // Admin auth check
      const authHeader = req.headers.get("authorization");
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return {
          status: 403,
          jsonBody: { success: false, error: "Authorization header required" },
        };
      }

      const token = authHeader.substring(7);
      const { AuthService } = await import("./src/services/auth.service");
      const payload = AuthService.verifyToken(token);

      if (payload.userType !== "Admin") {
        return {
          status: 403,
          jsonBody: { success: false, error: "Admin access required" },
        };
      }

      const { SchedulerService } = await import(
        "./src/services/scheduler.service"
      );
      const scheduler = SchedulerService.getInstance();
      scheduler.stop();

      return {
        status: 200,
        jsonBody: {
          success: true,
          data: scheduler.getStatus(),
          message: "Scheduler stopped successfully",
        },
      };
    } catch (error) {
      console.error("Scheduler stop error:", error);
      return {
        status: 500,
        jsonBody: {
          success: false,
          error:
            error instanceof Error ? error.message : "Failed to stop scheduler",
        },
      };
    }
  }),
});

// ========================================================================
// JOB ARCHIVAL ENDPOINTS - Manual Control & Monitoring
// ========================================================================

app.http("job-archival-trigger", {
  methods: ["POST", "OPTIONS"],
  authLevel: "anonymous",
  route: "jobs/archive/trigger",
  handler: withErrorHandling(async (req, context) => {
    try {
      // Admin auth check
      const authHeader = req.headers.get("authorization");
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return {
          status: 403,
          jsonBody: { success: false, error: "Authorization header required" },
        };
      }

      const token = authHeader.substring(7);
      const { AuthService } = await import("./src/services/auth.service");
      const payload = AuthService.verifyToken(token);

      if (payload.userType !== "Admin") {
        return {
          status: 403,
          jsonBody: { success: false, error: "Admin access required" },
        };
      }

      console.log("Manual job archival triggered by admin:", payload.userId);

      // Get daysOld parameter (default: 30)
      const { daysOld = 30 } = (await req.json().catch(() => ({}))) as any;

      if (isNaN(daysOld) || daysOld < 1 || daysOld > 365) {
        return {
          status: 400,
          jsonBody: {
            success: false,
            error: "daysOld must be between 1 and 365",
          },
        };
      }

      const runId = `manual_${Date.now()}`;
      const startTime = new Date();

      // Import and run archive service
      const { JobArchiveService } = await import(
        "./src/services/job-archive.service"
      );
      await JobArchiveService.initializeArchiveLogs();
      const result = await JobArchiveService.archiveOldJobs(daysOld);

      const endTime = new Date();

      // Log to database
      await JobArchiveService.logArchiveOperation(
        result,
        runId,
        startTime,
        endTime,
        daysOld,
        "Manual"
      );

      return {
        status: result.success ? 200 : 500,
        jsonBody: {
          success: result.success,
          message: `Archival completed. ${result.totalJobsArchived} jobs archived, ${result.totalJobsDeleted} deleted from SQL.`,
          data: {
            totalJobsFound: result.totalJobsFound,
            totalJobsArchived: result.totalJobsArchived,
            totalJobsDeleted: result.totalJobsDeleted,
            errors: result.errors,
            archivedJobIds: result.archivedJobIds.slice(0, 20), // Limit to first 20 IDs
            daysOld: daysOld,
          },
        },
      };
    } catch (error: any) {
      console.error("Job archival trigger failed:", error);
      return {
        status: 500,
        jsonBody: {
          success: false,
          error: "Archival service failed",
          details: error.message,
        },
      };
    }
  }),
});

app.http("job-archival-logs", {
  methods: ["GET", "OPTIONS"],
  authLevel: "anonymous",
  route: "jobs/archive/logs",
  handler: withErrorHandling(async (req, context) => {
    try {
      // Admin auth check
      const authHeader = req.headers.get("authorization");
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return {
          status: 403,
          jsonBody: { success: false, error: "Authorization header required" },
        };
      }

      const token = authHeader.substring(7);
      const { AuthService } = await import("./src/services/auth.service");
      const payload = AuthService.verifyToken(token);

      if (payload.userType !== "Admin") {
        return {
          status: 403,
          jsonBody: { success: false, error: "Admin access required" },
        };
      }

      const { limit = 50, offset = 0 } = req.query as any;

      const { JobArchiveService } = await import(
        "./src/services/job-archive.service"
      );
      const logs = await JobArchiveService.getArchiveLogs(
        Number(limit),
        Number(offset)
      );

      return {
        status: 200,
        jsonBody: {
          success: true,
          data: logs,
          message: "Archive logs retrieved successfully",
        },
      };
    } catch (error: any) {
      console.error("Get archive logs failed:", error);
      return {
        status: 500,
        jsonBody: {
          success: false,
          error: "Failed to get archive logs",
          details: error.message,
        },
      };
    }
  }),
});

app.http("job-archival-stats", {
  methods: ["GET", "OPTIONS"],
  authLevel: "anonymous",
  route: "jobs/archive/stats",
  handler: withErrorHandling(async (req, context) => {
    try {
      // Admin auth check
      const authHeader = req.headers.get("authorization");
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return {
          status: 403,
          jsonBody: { success: false, error: "Authorization header required" },
        };
      }

      const token = authHeader.substring(7);
      const { AuthService } = await import("./src/services/auth.service");
      const payload = AuthService.verifyToken(token);

      if (payload.userType !== "Admin") {
        return {
          status: 403,
          jsonBody: { success: false, error: "Admin access required" },
        };
      }

      const { JobArchiveService } = await import(
        "./src/services/job-archive.service"
      );
      const stats = await JobArchiveService.getArchiveStats();

      return {
        status: 200,
        jsonBody: {
          success: true,
          data: stats,
          message: "Archive statistics retrieved successfully",
        },
      };
    } catch (error: any) {
      console.error("Get archive stats failed:", error);
      return {
        status: 500,
        jsonBody: {
          success: false,
          error: "Failed to get archive statistics",
          details: error.message,
        },
      };
    }
  }),
});

// ========================================================================
// STARTUP LOG
// ========================================================================

console.log(
  "RefOpen Backend API - All functions registered (with Google OAuth)"
);
console.log(
  "Google OAuth endpoints added: /auth/google, /auth/google-register"
);
console.log("API Base URL: https://refopen-api-func.azurewebsites.net/api");

// ========================================================================
// TIMER TRIGGER - JOB ARCHIVAL (Every 24 hours at midnight)
// ========================================================================

app.timer("jobArchivalTimer", {
  schedule: "0 0 0 * * *", // Every day at midnight (00:00:00)
  handler: async (myTimer: Timer, context: InvocationContext) => {
    const startTime = Date.now();
    const executionId = `archive_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    context.log("========================================================================");
    context.log("           JOB ARCHIVAL TIMER TRIGGER STARTED");
    context.log("========================================================================");
    context.log(`Execution ID: ${executionId}`);
    context.log(`Triggered at: ${new Date().toISOString()}`);
    context.log(`Past Due: ${myTimer.isPastDue ? "Yes (catching up)" : "No"}`);

    if (myTimer.isPastDue) {
      context.warn("WARNING: This execution is past its scheduled time!");
    }

    const runStartTime = new Date();

    try {
      context.log("\nStarting job archival process (jobs older than 90 days, batch 100)...\n");

      // Import and initialize archive service
      const { JobArchiveService } = await import("./src/services/job-archive.service");

      // Initialize archive logs table if needed
      await JobArchiveService.initializeArchiveLogs();

      // Archive jobs older than 90 days, max 100 per run
      const daysOld = 90;
      const result = await JobArchiveService.archiveOldJobs(daysOld);

      const runEndTime = new Date();
      const duration = Date.now() - startTime;
      const durationSeconds = Math.round(duration / 1000);
      const durationMinutes = Math.floor(durationSeconds / 60);
      const remainingSeconds = durationSeconds % 60;

      if (result.success) {
        context.log("\n========================================================================");
        context.log("        JOB ARCHIVAL COMPLETED SUCCESSFULLY");
        context.log("========================================================================");
        context.log(`\nEXECUTION SUMMARY:`);
        context.log(`   Jobs Found: ${result.totalJobsFound}`);
        context.log(`   Jobs Archived: ${result.totalJobsArchived}`);
        context.log(`   Jobs Deleted from SQL: ${result.totalJobsDeleted}`);
        context.log(`   Time: ${durationMinutes}m ${remainingSeconds}s`);

        if (result.archivedJobIds.length > 0) {
          context.log(`\nARCHIVED JOB IDs (sample):`);
          const sampleIds = result.archivedJobIds.slice(0, 10);
          sampleIds.forEach(id => context.log(`   - ${id}`));
          if (result.archivedJobIds.length > 10) {
            context.log(`   ... and ${result.archivedJobIds.length - 10} more`);
          }
        }
      } else {
        context.error("\nJob archival completed with errors");
        context.error(`   Jobs Found: ${result.totalJobsFound}`);
        context.error(`   Jobs Archived: ${result.totalJobsArchived}`);
        context.error(`   Jobs Deleted: ${result.totalJobsDeleted}`);
        context.error(`   Errors: ${result.errors.length}`);
        result.errors.forEach((error, i) => context.error(`   ${i + 1}. ${error}`));
      }

      // Log to database
      await JobArchiveService.logArchiveOperation(
        result,
        executionId,
        runStartTime,
        runEndTime,
        daysOld,
        'TimerTrigger'
      );
      context.log("\nLogged to database successfully");

    } catch (error: any) {
      const runEndTime = new Date();
      const duration = Date.now() - startTime;
      context.error("\nJOB ARCHIVAL TIMER TRIGGER FAILED");
      context.error(`   Error: ${error.message}`);
      context.error(`   Duration: ${Math.round(duration / 1000)}s`);

      // Log failure
      try {
        const { JobArchiveService } = await import("./src/services/job-archive.service");
        await JobArchiveService.logArchiveOperation(
          {
            success: false,
            totalJobsFound: 0,
            totalJobsArchived: 0,
            totalJobsDeleted: 0,
            errors: [error.message],
            archivedJobIds: []
          },
          executionId,
          runStartTime,
          runEndTime,
          30,
          'TimerTrigger'
        );
      } catch (logError: any) {
        context.warn(`Failed to log error: ${logError.message}`);
      }

      throw error;
    }
  }
});

// ========================================================================
// TIMER TRIGGER - AUTOMATED JOB SCRAPING (Every 2 hours)
// ========================================================================

app.timer("jobScraperTimer", {
  schedule: "0 0 */2 * * *", // Every 2 hours
  handler: async (myTimer: Timer, context: InvocationContext) => {
    const startTime = Date.now();
    const executionId = `timer_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    context.log(
      "// // // // // // // // // // // // // // // // // // // // // // // // // // // // // // // // // //"
    );
    context.log("//     JOB SCRAPER TIMER TRIGGER STARTED    //");
    context.log(
      "// // // // // // // // // // // // // // // // // // // // // // // // // // // // // // // // // //"
    );
    context.log(`// Execution ID: ${executionId}`);
    context.log(`// Triggered at: ${new Date().toISOString()}`);
    context.log(
      `// Past Due: ${myTimer.isPastDue ? "Yes (catching up)" : "No"}`
    );

    if (myTimer.isPastDue) {
      context.warn("// WARNING: This execution is past its scheduled time!");
    }

    try {
      context.log("\n// Starting job scraping process...\n");
      const { JobScraperService } = await import(
        "./src/services/job-scraper.service"
      );
      const result = await JobScraperService.scrapeAndPopulateJobs();

      const duration = Date.now() - startTime;
      const durationSeconds = Math.round(duration / 1000);
      const durationMinutes = Math.floor(durationSeconds / 60);
      const remainingSeconds = durationSeconds % 60;

      if (result.success) {
        context.log(
          "\n// // // // // // // // // // // // // // // // // // // // // // // // // // // // // // // // //"
        );
        context.log("//   JOB SCRAPING COMPLETED SUCCESSFULLY   //");
        context.log(
          "// // // // // // // // // // // // // // // // // // // // // // // // // // // // // // // // //"
        );
        context.log(`\n// EXECUTION SUMMARY:`);
        context.log(`   // Jobs Added: ${result.jobsAdded}`);
        context.log(`   // Total Scraped: ${result.summary.totalJobsScraped}`);
        context.log(`   // India Jobs: ${result.summary.indiaJobsAdded}`);
        context.log(`   // Time: ${durationMinutes}m ${remainingSeconds}s`);

        context.log(`\n// SOURCE BREAKDOWN:`);
        Object.entries(result.summary.sourceBreakdown).forEach(
          ([source, count]) => {
            const percentage =
              result.summary.totalJobsScraped > 0
                ? ((count / result.summary.totalJobsScraped) * 100).toFixed(1)
                : "0.0";
            context.log(
              `   // ${source.padEnd(20)}: ${String(count).padStart(
                4
              )} jobs (${percentage}%)`
            );
          }
        );
      } else {
        context.error("\n// Job scraping completed with errors");
        context.error(`   // Jobs Added: ${result.jobsAdded}`);
        context.error(`   // Errors: ${result.errors.length}`);
        result.errors.forEach((error, i) =>
          context.error(`   // ${i + 1}. ${error}`)
        );
      }

      // Log to database
      try {
        const { dbService } = await import("./src/services/database.service");
        await dbService.executeQuery(
          `
        INSERT INTO ScrapingLogs (
            RunId, StartTime, EndTime, Success, JobsAdded, IndiaJobs,
               TotalScraped, Sources, ErrorCount, Errors, TriggerType, WasPastDue
       )
         VALUES (@param0, @param1, @param2, @param3, @param4, @param5,
        @param6, @param7, @param8, @param9, @param10, @param11)
  `,
          [
            executionId,
            new Date().toISOString(),
            new Date(Date.now() + duration).toISOString(),
            result.success,
            result.jobsAdded,
            result.summary.indiaJobsAdded,
            result.summary.totalJobsScraped,
            JSON.stringify(result.summary.sourceBreakdown),
            result.errors.length,
            result.errors.slice(0, 5).join("; "),
            "TimerTrigger",
            myTimer.isPastDue,
          ]
        );
        context.log("\n// Logged to database successfully");
      } catch (logError: any) {
        context.warn(`\n// Failed to log to database: ${logError.message}`);
      }
    } catch (error: any) {
      const duration = Date.now() - startTime;
      context.error("\n// JOB SCRAPER TIMER TRIGGER FAILED");
      context.error(`   // Error: ${error.message}`);
      context.error(`   // Duration: ${Math.round(duration / 1000)}s`);

      // Log failure
      try {
        const { dbService } = await import("./src/services/database.service");
        await dbService.executeQuery(
          `
          INSERT INTO ScrapingLogs (
    RunId, StartTime, EndTime, Success, JobsAdded, IndiaJobs,
   TotalScraped, Sources, ErrorCount, Errors, TriggerType, WasPastDue
         )
          VALUES (@param0, @param1, @param2, @param3, @param4, @param5,
     @param6, @param7, @param8, @param9, @param10, @param11)
      `,
          [
            executionId,
            new Date().toISOString(),
            new Date(Date.now() + duration).toISOString(),
            false,
            0,
            0,
            0,
            JSON.stringify({}),
            1,
            error.message,
            "TimerTrigger",
            myTimer.isPastDue,
          ]
        );
      } catch (logError: any) {
        context.warn(`// Failed to log error: ${logError.message}`);
      }

      throw error;
    }
  },
});

// ========================================================================
// FINAL TEST ENDPOINT - Added at the very end
// ========================================================================

app.http("test-endpoint", {
  methods: ["GET", "OPTIONS"],
  authLevel: "anonymous",
  route: "test-final",
  handler: withErrorHandling(async (req, context) => {
    return {
      status: 200,
      jsonBody: {
        success: true,
        message: "Final test endpoint works",
        timestamp: new Date().toISOString(),
      },
    };
  }),
});

export {};

/*
* ========================================================================
* UPDATED API ENDPOINT LIST (68 total - Added Job Archival System):
* ========================================================================
*
* AUTHENTICATION (7 endpoints): +2 Google OAuth
* POST   /auth/register - User registration
* POST   /auth/login    - User login
* POST   /auth/google   - Google OAuth login
* POST   /auth/google-register  - Google OAuth registration
* POST   /auth/logout   - User logout
* POST   /auth/refresh  - Refresh JWT token
* GET    /health        - Health check
*
* USER MANAGEMENT (12 endpoints):
* GET    /users/profile - Get user profile
* PUT    /users/profile - Update user profile
* POST   /users/change-password - User password update
* POST   /users/verify-email - User email verification
* GET    /users/dashboard-stats - User dashboard statistics
* POST   /users/deactivate - User account deactivation
* POST   /users/profile-image - Upload profile image
* POST   /users/resume - Upload resume document
* GET    /users/resumes - Get user's resumes
* PUT    /users/resume/{id}/primary - Set resume as primary
* DELETE /users/resume/{id} - Delete a resume
* GET    /users/referral-code - Get my referral code and stats
* POST   /employers/initialize - Initialize employer profile
*
* WORK EXPERIENCES (4 endpoints):
* GET    /work-experiences/my - Get my work experiences
* GET    /work-experiences/applicant/{id} - Get applicant work experiences
* POST   /work-experiences - Create work experience
* GET    /work-experiences/{id} - Get work experience by ID
* PUT    /work-experiences/{id} - Update work experience
* DELETE /work-experiences/{id} - Delete work experience
*
* APPLICANT/EMPLOYER PROFILE (4 endpoints):
* GET    /applicants/{userId}/profile - Get applicant profile
* PUT    /applicants/{userId}/profile - Update applicant profile
* GET    /employers/{userId}/profile - Get employer profile
* PUT    /employers/{userId}/profile - Update employer profile
*
* JOB MANAGEMENT (9 endpoints):
* GET    /jobs - List all jobs
* POST   /jobs - Create new job
* GET    /jobs/{id} - Get job details (now searches SQL first, then archives)
* PUT    /jobs/{id} - Update job
* DELETE /jobs/{id} - Delete job
* POST   /jobs/{id}/publish - Publish job
* POST   /jobs/{id}/close - Close job
* GET    /search/jobs - Search jobs
* GET    /organizations/{id}/jobs - Get organization jobs
* GET    /jobs/ai-recommendations - Get AI-recommended jobs (₹100 wallet deduction)
*
* JOB APPLICATIONS (6 endpoints):
* POST   /applications - Apply for job
* GET    /my/applications - Get my applications
* GET    /jobs/{jobId}/applications - Get job applications
* PUT    /applications/{id}/status - Update application status
* DELETE /applications/{id} - Withdraw application
* GET    /applications/{id} - Get application details
*
* JOB SCRAPING SYSTEM (7 endpoints): AUTOMATED JOB POPULATION
* POST   /jobs/scrape/trigger - Manually trigger job scraping (Admin)
* GET    /jobs/scrape/config - Get scraping configuration (Admin)
* PUT    /jobs/scrape/config - Update scraping configuration (Admin)
* GET    /jobs/scrape/stats - Get scraping statistics (Admin)
* DELETE /jobs/scrape/cleanup - Clean up old scraped jobs (Admin)
* GET    /jobs/scrape/health - Scraper service health check
* GET    /jobs/scrape/ping - Simple ping test endpoint
* TIMER  /jobScraperTimer - Automated scraping every 2 hours
*
* JOB ARCHIVAL SYSTEM (3 endpoints): NEW - Automated Job Archival
* POST   /jobs/archive/trigger - Manually trigger archival (Admin)
* GET    /jobs/archive/logs - Get archival logs (Admin)
* GET    /jobs/archive/stats - Get archival statistics (Admin)
* TIMER  /jobArchivalTimer - Automated archival every 24 hours at midnight
*
* REFERRAL SYSTEM (15 endpoints): EXPANDED
* GET    /referral/plans - Get all referral plans
* POST   /referral/plans/purchase - Purchase a referral plan
* GET    /referral/subscription - Get current subscription
* POST   /referral/requests - Create referral request
* GET    /referral/my-requests - Get my referral requests (seeker)
* GET    /referral/available - Get available requests (referrer)
* POST   /referral/requests/{id}/claim - Claim a referral request
* POST   /referral/requests/{id}/proof - Submit proof of referral
* POST   /referral/requests/{id}/verify - Verify referral completion
* POST   /referral/requests/{id}/cancel - Cancel referral request
* GET    /referral/my-referrer-requests - Get my requests as referrer
* GET    /referral/analytics - Get referral analytics
* GET    /referral/eligibility - Check referral eligibility
* GET    /referral/stats - Get referrer badge stats
* GET    /referral/points-history - Get detailed referral points history
*
* REFERENCE DATA (9 endpoints):
* GET    /reference/job-types - Get job types
* GET    /reference/workplace-types - Get workplace types
* GET    /reference/currencies - Get currencies
* GET    /reference/organizations - Get organizations
* GET    /reference/colleges - Get colleges/universities
* GET    /reference/industries - Get industries
* GET    /reference/universities-by-country - Get universities by country and state
* GET    /reference/countries - Get countries
* GET    /reference/salary-components - Get salary components
*
* SAVED JOBS (3 endpoints):
* POST   /saved-jobs - Save a job
* DELETE /saved-jobs/{jobId} - Unsave a job
* GET    /my/saved-jobs - Get my saved jobs
*
* PAYMENT SYSTEM (3 endpoints): RAZORPAY INTEGRATION
* POST   /payments/razorpay/create-order - Create Razorpay payment order
* POST   /payments/razorpay/verify-and-activate - Verify payment and activate subscription
* GET    /payments/history - Get payment transaction history
*
* WALLET SYSTEM (8 endpoints): Wallet Management
* GET    /wallet - Get wallet details
* GET    /wallet/balance - Get wallet balance
* POST   /wallet/recharge/create-order - Create recharge order (Razorpay)
* POST   /wallet/recharge/verify - Verify payment and credit wallet
* GET    /wallet/transactions - Get transaction history (paginated)
* GET    /wallet/recharge/history - Get recharge order history
* GET    /wallet/stats - Get wallet statistics
* POST   /wallet/debit - Debit wallet (internal use)
*
* STORAGE & FILES (2 endpoints): AZURE BLOB STORAGE
* POST   /storage/upload - Upload files to Azure Blob Storage
* DELETE /storage/{containerName}/{fileName} - Delete files from Azure Blob Storage
*
* JOB SCRAPING SCHEDULER (3 endpoints): MANUAL SCHEDULER CONTROL
* GET    /scheduler/status - Get scheduler status
* POST   /scheduler/start - Start scheduler (admin)
* POST   /scheduler/stop - Stop scheduler (admin)
*
* MESSAGING SYSTEM (13 endpoints): Real-time Messaging
* POST   /messages/conversation - Get or create conversation
* GET    /messages/conversations - Get my conversations
* GET    /messages/conversation/{id} - Get conversation messages
* POST   /messages - Send message
* POST   /messages/{id}/read - Mark message as read
* POST   /messages/conversation/{id}/read - Mark entire conversation as read
* GET    /messages/unread-count - Get unread message count
* POST   /messages/conversation/{id}/archive - Archive conversation
* POST   /messages/conversation/{id}/mute - Mute conversation
* DELETE /messages/{id} - Delete message
* POST   /messages/user/{userId}/block - Block user
* DELETE /messages/user/{userId}/unblock - Unblock user
* GET    /messages/user/{userId}/blocked - Check if user is blocked
* GET    /messages/blocked-users - Get blocked users list
* POST   /messages/profile-view - Record profile view
* GET    /messages/profile-views - Get my profile views
* GET    /messages/public-profile/{userId} - Get public profile details
*
* ========================================================================
* TOTAL: 68 HTTP endpoints + 2 Timer Triggers = 70 functions
* ========================================================================
*/
