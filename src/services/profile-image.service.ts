import { BlobServiceClient } from '@azure/storage-blob';
import { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';

// Azure Storage configuration
const AZURE_STORAGE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING || '';
const STORAGE_CONTAINER_NAME = 'profilephotos';

interface ProfileImageUploadRequest {
  fileName: string;
  fileData: string; // base64 encoded
  mimeType: string;
  userId: string;
}

/**
 * Azure Blob Storage Service for Profile Images
 */
export class ProfileImageStorageService {
  private blobServiceClient: BlobServiceClient;

  constructor() {
    if (!AZURE_STORAGE_CONNECTION_STRING) {
      throw new Error('AZURE_STORAGE_CONNECTION_STRING environment variable is required');
    }
    this.blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_STORAGE_CONNECTION_STRING);
  }

  /**
   * Upload profile image to Azure Blob Storage
   * Structure: profilephotos/{userId}/profile-{userId}-{timestamp}.{ext}
   */
  async uploadProfileImage(uploadData: ProfileImageUploadRequest): Promise<string> {
    try {
      console.log('=== AZURE STORAGE UPLOAD DEBUG ===');
      console.log('User ID:', uploadData.userId);
      console.log('File name:', uploadData.fileName);
      console.log('MIME type:', uploadData.mimeType);
      console.log('File data length:', uploadData.fileData?.length || 0);

      // Create container client
      const containerClient = this.blobServiceClient.getContainerClient(STORAGE_CONTAINER_NAME);
      
      // Ensure container exists
      await containerClient.createIfNotExists({
        access: 'blob' // Public read access for profile images
      });

      // Create folder structure: userId/filename
      const blobName = `${uploadData.userId}/${uploadData.fileName}`;
      const blockBlobClient = containerClient.getBlockBlobClient(blobName);

      // Convert base64 to buffer
      const buffer = Buffer.from(uploadData.fileData, 'base64');
      console.log('Buffer size:', buffer.length);

      // Upload with proper content type
      const uploadResult = await blockBlobClient.upload(buffer, buffer.length, {
        blobHTTPHeaders: {
          blobContentType: uploadData.mimeType,
          blobCacheControl: 'public, max-age=31536000', // Cache for 1 year
        },
        metadata: {
          userId: uploadData.userId,
          uploadDate: new Date().toISOString(),
          originalFileName: uploadData.fileName,
        }
      });

      // Get the public URL
      const imageUrl = blockBlobClient.url;
      console.log('Image uploaded successfully:', imageUrl);
      console.log('=== END AZURE STORAGE UPLOAD DEBUG ===');

      return imageUrl;

    } catch (error: unknown) {
      console.error('=== AZURE STORAGE UPLOAD ERROR ===');
      console.error('Error type:', (error as Error)?.constructor?.name || 'Unknown');
      console.error('Error message:', (error as Error)?.message || 'Unknown error');
      console.error('Upload data:', {
        userId: uploadData.userId,
        fileName: uploadData.fileName,
        mimeType: uploadData.mimeType,
        fileDataLength: uploadData.fileData?.length || 0
      });
      console.error('=== END ERROR DEBUG ===');
      throw error;
    }
  }

  /**
   * Delete old profile image when user uploads a new one
   */
  async deleteOldProfileImage(userId: string, oldImageUrl: string): Promise<void> {
    try {
      if (!oldImageUrl || !oldImageUrl.includes(STORAGE_CONTAINER_NAME)) {
        return; // Not our image or no old image
      }

      // Extract blob name from URL
      const urlParts = oldImageUrl.split('/');
      const containerIndex = urlParts.findIndex(part => part === STORAGE_CONTAINER_NAME);
      if (containerIndex === -1 || containerIndex === urlParts.length - 1) {
        return; // Invalid URL structure
      }

      const blobName = urlParts.slice(containerIndex + 1).join('/');
      console.log('??? Deleting old profile image:', blobName);

      const containerClient = this.blobServiceClient.getContainerClient(STORAGE_CONTAINER_NAME);
      const blockBlobClient = containerClient.getBlockBlobClient(blobName);
      
      await blockBlobClient.deleteIfExists();
      console.log('Old profile image deleted successfully');

    } catch (error: unknown) {
      console.error('Error deleting old profile image:', error);
      // Don't throw - deletion failure shouldn't prevent upload
    }
  }

  /**
   * List all images for a user (for cleanup or management)
   */
  async listUserImages(userId: string): Promise<string[]> {
    try {
      const containerClient = this.blobServiceClient.getContainerClient(STORAGE_CONTAINER_NAME);
      const imageUrls: string[] = [];

      // List blobs with the user's prefix
      for await (const blob of containerClient.listBlobsFlat({ prefix: `${userId}/` })) {
        const blobClient = containerClient.getBlobClient(blob.name);
        imageUrls.push(blobClient.url);
      }

      return imageUrls;

    } catch (error: unknown) {
      console.error('Error listing user images:', error);
      return [];
    }
  }
}

/**
 * Validate image upload request
 */
function validateImageUpload(data: any): ProfileImageUploadRequest {
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

  // Validate MIME type
  const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (!allowedMimeTypes.includes(data.mimeType.toLowerCase())) {
    throw new Error(`Invalid file type. Allowed types: ${allowedMimeTypes.join(', ')}`);
  }

  // Validate file size (5MB limit)
  const fileSizeBytes = (data.fileData.length * 3) / 4; // Approximate base64 to bytes
  const maxSizeBytes = 5 * 1024 * 1024; // 5MB
  if (fileSizeBytes > maxSizeBytes) {
    throw new Error(`File too large. Maximum size: ${maxSizeBytes / 1024 / 1024}MB`);
  }

  // Generate secure filename if needed
  const fileExtension = data.fileName.split('.').pop() || 'jpg';
  const sanitizedFileName = `profile-${data.userId}-${Date.now()}.${fileExtension}`;

  return {
    fileName: sanitizedFileName,
    fileData: data.fileData,
    mimeType: data.mimeType,
    userId: data.userId,
  };
}

/**
 * Profile Image Upload Handler
 */
export async function uploadProfileImage(req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    console.log('=== PROFILE IMAGE UPLOAD HANDLER ===');
    console.log('Method:', req.method);
    console.log('Headers:', Object.keys(req.headers));

    // Handle OPTIONS for CORS
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

    // Only allow POST
    if (req.method !== 'POST') {
      return {
        status: 405,
        jsonBody: {
          success: false,
          error: 'Method not allowed. Use POST.'
        }
      };
    }

    // Parse and validate request body
    const requestBody = await req.json() as any;
    console.log('Request body keys:', requestBody ? Object.keys(requestBody) : []);
    
    const uploadData = validateImageUpload(requestBody);
    console.log('Validated upload data:', {
      fileName: uploadData.fileName,
      userId: uploadData.userId,
      mimeType: uploadData.mimeType,
      fileDataLength: uploadData.fileData.length
    });

    // Initialize storage service
    const storageService = new ProfileImageStorageService();

    // Get current profile picture URL for cleanup
    let oldImageUrl = '';
    try {
      const { UserService } = await import('../services/user.service');
      const currentProfile = await UserService.findById(uploadData.userId);
      oldImageUrl = currentProfile?.ProfilePictureURL || '';
    } catch (error: unknown) {
      console.warn('Could not get current profile picture for cleanup:', (error as Error)?.message || 'Unknown error');
    }

    // Upload new image
    const imageUrl = await storageService.uploadProfileImage(uploadData);

    // Update user profile with new image URL
    try {
      const { UserService } = await import('../services/user.service');
      await UserService.updateProfile(uploadData.userId, {
        profilePictureURL: imageUrl
      });
      console.log('User profile updated with new image URL');
    } catch (error: unknown) {
      console.error('Failed to update user profile with new image URL:', error);
      // Continue anyway - image is uploaded successfully
    }

    // Clean up old image (async, don't wait)
    if (oldImageUrl) {
      storageService.deleteOldProfileImage(uploadData.userId, oldImageUrl)
        .catch(error => console.warn('Failed to delete old profile image:', error));
    }

    console.log('Profile image upload completed successfully');
    console.log('=== END PROFILE IMAGE UPLOAD HANDLER ===');

    return {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      jsonBody: {
        success: true,
        data: {
          imageUrl: imageUrl,
          fileName: uploadData.fileName,
          uploadDate: new Date().toISOString(),
        },
        message: 'Profile image uploaded successfully'
      }
    };

  } catch (error: unknown) {
    console.error('=== PROFILE IMAGE UPLOAD ERROR ===');
    console.error('Error type:', (error as Error)?.constructor?.name || 'Unknown');
    console.error('Error message:', (error as Error)?.message || 'Unknown error');
    console.error('Error stack:', (error as Error)?.stack || 'No stack trace');
    console.error('=== END ERROR DEBUG ===');

    return {
      status: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      jsonBody: {
        success: false,
        error: (error as Error)?.message || 'Failed to upload profile image',
        details: process.env.NODE_ENV === 'development' ? (error as Error)?.stack : undefined
      }
    };
  }
}