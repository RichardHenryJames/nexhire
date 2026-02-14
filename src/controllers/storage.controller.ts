/**
 * Storage Controller - File Upload to Azure Storage
 * Handles generic file uploads for various containers
 */

import { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { BlobServiceClient } from '@azure/storage-blob';
import { v4 as uuidv4 } from 'uuid';
import { 
    withErrorHandling, 
    authenticate 
} from '../middleware';
import { 
    successResponse, 
    extractRequestBody,
    ValidationError
} from '../utils/validation';

// Azure Storage connection
const getStorageClient = () => {
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
    if (!connectionString) {
        throw new Error('AZURE_STORAGE_CONNECTION_STRING environment variable is required');
    }
    return BlobServiceClient.fromConnectionString(connectionString);
};

/**
 * Generic file upload endpoint
 * POST /storage/upload
 */
export const uploadFile = withErrorHandling(async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    try {
        const user = authenticate(req);
        const uploadData = await extractRequestBody(req);

        // Validate required fields
        if (!uploadData.fileName || typeof uploadData.fileName !== 'string') {
            throw new ValidationError('File name is required');
        }
        if (!uploadData.fileData || typeof uploadData.fileData !== 'string') {
            throw new ValidationError('File data is required');
        }
        if (!uploadData.mimeType || typeof uploadData.mimeType !== 'string') {
            throw new ValidationError('MIME type is required');
        }
        if (!uploadData.containerName || typeof uploadData.containerName !== 'string') {
            throw new ValidationError('Container name is required');
        }

        // Validate file size (10MB limit)
        const fileSizeBytes = (uploadData.fileData.length * 3) / 4; // Base64 to bytes
        const maxSizeBytes = 10 * 1024 * 1024; // 10MB
        if (fileSizeBytes > maxSizeBytes) {
            throw new ValidationError(`File too large. Maximum size: ${maxSizeBytes / 1024 / 1024}MB`);
        }

        // Validate file type for security
        const allowedTypes = [
            'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
            'application/pdf', 'application/msword', 
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ];
        if (!allowedTypes.includes(uploadData.mimeType)) {
            throw new ValidationError('File type not allowed');
        }

        // Generate unique filename
        const fileExtension = getFileExtension(uploadData.fileName);
        const uniqueFileName = `${user.userId}_${Date.now()}_${uuidv4()}${fileExtension}`;

        // Convert base64 to buffer
        const fileBuffer = Buffer.from(uploadData.fileData, 'base64');

        // Upload to Azure Storage
        const blobServiceClient = getStorageClient();
        const containerClient = blobServiceClient.getContainerClient(uploadData.containerName);
        
        // Ensure container exists
        await containerClient.createIfNotExists({
            access: 'blob' // Public read access for images
        });

        const blockBlobClient = containerClient.getBlockBlobClient(uniqueFileName);
        
        await blockBlobClient.uploadData(fileBuffer, {
            blobHTTPHeaders: {
                blobContentType: uploadData.mimeType
            },
            metadata: {
                originalFileName: uploadData.fileName,
                uploadedBy: user.userId,
                uploadedAt: new Date().toISOString()
            }
        });

        // Get the file URL
        const fileUrl = blockBlobClient.url;

        const result = {
            fileUrl,
            fileName: uniqueFileName,
            originalFileName: uploadData.fileName,
            mimeType: uploadData.mimeType,
            fileSize: fileBuffer.length,
            containerName: uploadData.containerName,
            uploadedAt: new Date().toISOString()
        };

        return {
            status: 200,
            jsonBody: successResponse(result, 'File uploaded successfully')
        };

    } catch (error: any) {
        console.error('Storage upload error:', error.message);

        const status = error instanceof ValidationError ? 400 : 500;
        return {
            status,
            jsonBody: { 
                success: false, 
                error: error?.message || 'Failed to upload file'
            }
        };
    }
});

/**
 * Get file extension from filename
 */
function getFileExtension(filename: string): string {
    const parts = filename.split('.');
    if (parts.length > 1) {
        return '.' + parts.pop()?.toLowerCase();
    }
    return '';
}

/**
 * Delete file from storage
 * DELETE /storage/{containerName}/{fileName}
 */
export const deleteFile = withErrorHandling(async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    try {
        const user = authenticate(req);
        const containerName = (req as any).params?.containerName;
        const fileName = (req as any).params?.fileName;

        if (!containerName || !fileName) {
            throw new ValidationError('Container name and file name are required');
        }

        const blobServiceClient = getStorageClient();
        const containerClient = blobServiceClient.getContainerClient(containerName);
        const blockBlobClient = containerClient.getBlockBlobClient(fileName);

        // Check if file exists and user has permission to delete it
        const properties = await blockBlobClient.getProperties();
        if (properties.metadata?.uploadedBy !== user.userId) {
            throw new ValidationError('You can only delete files you uploaded');
        }

        await blockBlobClient.deleteIfExists();

        return {
            status: 200,
            jsonBody: successResponse({ deleted: true }, 'File deleted successfully')
        };

    } catch (error: any) {
        const status = error instanceof ValidationError ? 400 : 500;
        return {
            status,
            jsonBody: { 
                success: false, 
                error: error?.message || 'Failed to delete file'
            }
        };
    }
});