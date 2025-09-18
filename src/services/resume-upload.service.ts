import { BlobServiceClient } from '@azure/storage-blob';
import { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';

// Azure Storage configuration
const AZURE_STORAGE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING || '';
const STORAGE_CONTAINER_NAME = 'resumes'; // Parallel to 'profilephotos'

interface ResumeUploadRequest {
  fileName: string;
  fileData: string; // base64 encoded (same as profile image)
  mimeType: string;
  userId: string;
  resumeLabel?: string; // New: optional label for the resume
}

/**
 * Azure Blob Storage Service for Resume Documents
 * Following the same pattern as ProfileImageStorageService
 */
export class ResumeStorageService {
  private blobServiceClient: BlobServiceClient;

  constructor() {
    if (!AZURE_STORAGE_CONNECTION_STRING) {
      throw new Error('AZURE_STORAGE_CONNECTION_STRING environment variable is required');
    }
    this.blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_STORAGE_CONNECTION_STRING);
  }

  /**
   * Upload resume to Azure Blob Storage
   * Structure: resumes/{userId}/resume-{userId}-{timestamp}.{ext}
   * Same pattern as profilephotos/{userId}/profile-{userId}-{timestamp}.{ext}
   */
  async uploadResume(uploadData: ResumeUploadRequest): Promise<string> {
    try {
      console.log('?? === AZURE STORAGE UPLOAD DEBUG ===');
      console.log('?? User ID:', uploadData.userId);
      console.log('?? File name:', uploadData.fileName);
      console.log('?? MIME type:', uploadData.mimeType);
      console.log('?? File data length:', uploadData.fileData?.length || 0);

      // Create container client
      const containerClient = this.blobServiceClient.getContainerClient(STORAGE_CONTAINER_NAME);
      
      // Ensure container exists
      await containerClient.createIfNotExists({
        access: 'blob' // Public read access for resumes (same as profile images)
      });

      // Create folder structure: userId/filename (same as profile images)
      const blobName = `${uploadData.userId}/${uploadData.fileName}`;
      const blockBlobClient = containerClient.getBlockBlobClient(blobName);

      // Convert base64 to buffer (same as profile images)
      const buffer = Buffer.from(uploadData.fileData, 'base64');
      console.log('?? Buffer size:', buffer.length);

      // Upload with proper content type
      const uploadResult = await blockBlobClient.upload(buffer, buffer.length, {
        blobHTTPHeaders: {
          blobContentType: uploadData.mimeType,
          blobContentDisposition: `attachment; filename="${uploadData.fileName}"`, // For downloads
          blobCacheControl: 'public, max-age=31536000', // Cache for 1 year (same as images)
        },
        metadata: {
          userId: uploadData.userId,
          uploadDate: new Date().toISOString(),
          originalFileName: uploadData.fileName,
          fileType: 'resume'
        }
      });

      // Get the public URL
      const resumeUrl = blockBlobClient.url;
      console.log('?? Resume uploaded successfully:', resumeUrl);
      console.log('?? === END AZURE STORAGE UPLOAD DEBUG ===');

      return resumeUrl;

    } catch (error: unknown) {
      console.error('?? === AZURE STORAGE UPLOAD ERROR ===');
      console.error('?? Error type:', (error as Error)?.constructor?.name || 'Unknown');
      console.error('?? Error message:', (error as Error)?.message || 'Unknown error');
      console.error('?? Upload data:', {
        userId: uploadData.userId,
        fileName: uploadData.fileName,
        mimeType: uploadData.mimeType,
        fileDataLength: uploadData.fileData?.length || 0
      });
      console.error('?? === END ERROR DEBUG ===');
      throw error;
    }
  }

  /**
   * Delete old resume when user uploads a new one
   * Same pattern as deleteOldProfileImage
   */
  async deleteOldResume(userId: string, oldResumeUrl: string): Promise<void> {
    try {
      if (!oldResumeUrl || !oldResumeUrl.includes(STORAGE_CONTAINER_NAME)) {
        return; // Not our resume or no old resume
      }

      // Extract blob name from URL (same logic as profile images)
      const urlParts = oldResumeUrl.split('/');
      const containerIndex = urlParts.findIndex(part => part === STORAGE_CONTAINER_NAME);
      if (containerIndex === -1 || containerIndex === urlParts.length - 1) {
        return; // Invalid URL structure
      }

      const blobName = urlParts.slice(containerIndex + 1).join('/');
      console.log('??? Deleting old resume:', blobName);

      const containerClient = this.blobServiceClient.getContainerClient(STORAGE_CONTAINER_NAME);
      const blockBlobClient = containerClient.getBlockBlobClient(blobName);
      
      await blockBlobClient.deleteIfExists();
      console.log('?? Old resume deleted successfully');

    } catch (error: unknown) {
      console.error('?? Error deleting old resume:', error);
      // Don't throw - deletion failure shouldn't prevent upload
    }
  }

  /**
   * List all resumes for a user (for cleanup or management)
   * Same pattern as listUserImages
   */
  async listUserResumes(userId: string): Promise<string[]> {
    try {
      const containerClient = this.blobServiceClient.getContainerClient(STORAGE_CONTAINER_NAME);
      const resumeUrls: string[] = [];

      // List blobs with the user's prefix
      for await (const blob of containerClient.listBlobsFlat({ prefix: `${userId}/` })) {
        const blobClient = containerClient.getBlobClient(blob.name);
        resumeUrls.push(blobClient.url);
      }

      return resumeUrls;

    } catch (error: unknown) {
      console.error('Error listing user resumes:', error);
      return [];
    }
  }
}

/**
 * Validate resume upload request
 * Following the same pattern as validateImageUpload
 */
function validateResumeUpload(data: any): ResumeUploadRequest {
  if (!data.fileName || typeof data.fileName !== 'string') {
    throw new Error('fileName is required and must be a string');
  }

  if (!data.fileData || typeof data.fileData !== 'string') {
    throw new Error('fileData is required and must be a base64 string');
  }

  if (!data.mimeType || typeof data.mimeType !== 'string') {
    throw new Error('mimeType is required and must be a string');
  }

  if (!data.userId || typeof data.userId !== 'string') {
    throw new Error('userId is required and must be a string');
  }

  // Validate MIME type for resumes
  const allowedMimeTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];
  if (!allowedMimeTypes.includes(data.mimeType.toLowerCase())) {
    throw new Error(`Invalid file type. Allowed types: PDF, DOC, DOCX`);
  }

  // Validate file size (10MB limit for resumes vs 5MB for images)
  const fileSizeBytes = (data.fileData.length * 3) / 4; // Approximate base64 to bytes
  const maxSizeBytes = 10 * 1024 * 1024; // 10MB
  if (fileSizeBytes > maxSizeBytes) {
    throw new Error(`File too large. Maximum size: ${maxSizeBytes / 1024 / 1024}MB`);
  }

  // Generate secure filename following the same pattern as profile images
  const fileExtension = data.fileName.split('.').pop() || 'pdf';
  const sanitizedFileName = `resume-${data.userId}-${Date.now()}.${fileExtension}`;

  return {
    fileName: sanitizedFileName,
    fileData: data.fileData,
    mimeType: data.mimeType,
    userId: data.userId,
    resumeLabel: data.resumeLabel || 'Default Resume', // Default label if not provided
  };
}

/**
 * Resume Upload Handler
 * Following the exact same pattern as uploadProfileImage
 */
export async function uploadResume(req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    console.log('?? === RESUME UPLOAD HANDLER ===');
    console.log('?? Method:', req.method);
    console.log('?? Headers:', Object.keys(req.headers));

    // Handle OPTIONS for CORS (same as profile image)
    if (req.method === 'OPTIONS') {
      return {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        }
      };
    }

    // Only allow POST (same as profile image)
    if (req.method !== 'POST') {
      return {
        status: 405,
        jsonBody: {
          success: false,
          error: 'Method not allowed. Use POST.'
        }
      };
    }

    // Parse and validate request body (same as profile image)
    const requestBody = await req.json() as any;
    console.log('?? Request body keys:', requestBody ? Object.keys(requestBody) : []);
    
    const uploadData = validateResumeUpload(requestBody);
    console.log('?? Validated upload data:', {
      fileName: uploadData.fileName,
      userId: uploadData.userId,
      mimeType: uploadData.mimeType,
      resumeLabel: uploadData.resumeLabel,
      fileDataLength: uploadData.fileData.length
    });

    // Initialize storage service
    const storageService = new ResumeStorageService();

    // Get current resume for cleanup (check ApplicantResumes table)
    let oldResumeUrl = '';
    try {
      // Get current primary resume from ApplicantResumes table
      const { ApplicantService } = await import('./profile.service');
      const applicantProfile = await ApplicantService.getApplicantProfile(uploadData.userId);
      const primaryResume = await ApplicantService.getPrimaryResume(applicantProfile.ApplicantID);
      oldResumeUrl = primaryResume?.ResumeURL || '';
    } catch (error: unknown) {
      console.warn('Could not get current primary resume for cleanup:', (error as Error)?.message || 'Unknown error');
    }

    // Upload new resume
    const resumeUrl = await storageService.uploadResume(uploadData);

    // Save resume to ApplicantResumes table instead of updating user profile
    let resumeId: string | null = null;
    try {
      // First get or create applicant profile
      const { ApplicantService } = await import('./profile.service');
      const applicantProfile = await ApplicantService.getApplicantProfile(uploadData.userId);
      const applicantId = applicantProfile.ApplicantID;

      if (!applicantId) {
        throw new Error('Could not find applicant profile');
      }

      // ? FIXED: Don't automatically make new resume primary, let user manage multiple resumes
      // Check if user has existing resumes
      const existingResumes = await ApplicantService.getApplicantResumes(applicantId);
      const isPrimaryResume = existingResumes.length === 0; // Only make primary if it's the first resume

      // Save resume to ApplicantResumes table and get the ResumeID
      resumeId = await ApplicantService.saveApplicantResume(applicantId, {
        resumeLabel: uploadData.resumeLabel || 'Default Resume',
        resumeURL: resumeUrl,
        isPrimary: isPrimaryResume // Only set as primary if it's the first resume
      });

      console.log('?? Resume saved to ApplicantResumes table', {
        resumeId,
        isPrimary: isPrimaryResume,
        totalResumes: existingResumes.length + 1
      });

      // Recalculate profile completeness (centralized)
      try {
        const { UserService } = await import('./user.service');
        await UserService.recomputeProfileCompletenessByApplicantId(applicantId);
      } catch (e) { console.warn('Completeness recalculation failed (resume upload):', (e as any)?.message); }
    } catch (error) {
      console.error('? Failed to save resume to database:', error);
      // Continue anyway - resume is uploaded successfully to storage
    }

    // ? FIXED: Don't delete old resume files - let users manage multiple resumes
    // The user can delete specific resumes they don't want through the UI
    console.log('?? Resume upload completed successfully - keeping existing resumes');
    console.log('?? === END RESUME UPLOAD HANDLER ===');

    return {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      jsonBody: {
        success: true,
        data: {
          resumeURL: resumeUrl,
          resumeID: resumeId, // ? NEW: Include ResumeID for job applications
          fileName: uploadData.fileName,
          uploadDate: new Date().toISOString(),
        },
        message: 'Resume uploaded successfully'
      }
    };

  } catch (error: unknown) {
    console.error('?? === RESUME UPLOAD ERROR ===');
    console.error('?? Error type:', (error as Error)?.constructor?.name || 'Unknown');
    console.error('?? Error message:', (error as Error)?.message || 'Unknown error');
    console.error('?? Error stack:', (error as Error)?.stack || 'No stack trace');
    console.error('?? === END ERROR DEBUG ===');

    return {
      status: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      jsonBody: {
        success: false,
        error: (error as Error)?.message || 'Failed to upload resume',
        details: process.env.NODE_ENV === 'development' ? (error as Error)?.stack : undefined
      }
    };
  }
}