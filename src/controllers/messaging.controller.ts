import { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { MessagingService } from '../services/messaging.service';
import { withAuth } from '../middleware';
import { successResponse, extractRequestBody, extractQueryParams } from '../utils/validation';

// ?? CORS Headers for all responses
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json'
};

// Get or create conversation with another user
export const getOrCreateConversation = withAuth(async (req: HttpRequest, context: InvocationContext, user): Promise<HttpResponseInit> => {
  try {
    const body = await extractRequestBody(req);
    const { otherUserId } = body;

    if (!otherUserId) {
      return { status: 400, headers: corsHeaders, jsonBody: { success: false, error: 'otherUserId is required' } };
    }

    // Check if trying to message self
    if (otherUserId === user.userId) {
      return { status: 400, headers: corsHeaders, jsonBody: { success: false, error: 'Cannot create conversation with yourself' } };
    }

    // Check if users are blocked
    const blockCheck = await MessagingService.isUserBlocked(user.userId, otherUserId);
    if (blockCheck.isBlocked) {
      return { status: 403, headers: corsHeaders, jsonBody: { success: false, error: 'Cannot create conversation - users are blocked' } };
    }

    const conversation = await MessagingService.getOrCreateConversation({
      user1Id: user.userId,
      user2Id: otherUserId
    });

    return { status: 200, headers: corsHeaders, jsonBody: successResponse(conversation, 'Conversation retrieved successfully') };
  } catch (error) {
    console.error('Error in getOrCreateConversation:', error);
    return { status: 500, headers: corsHeaders, jsonBody: { success: false, error: 'Failed to get/create conversation' } };
  }
}); // Remove permissions - any authenticated user can message

// Get my conversations (inbox)
export const getMyConversations = withAuth(async (req: HttpRequest, context: InvocationContext, user): Promise<HttpResponseInit> => {
  try {
    const params = extractQueryParams(req);
    const page = params.page ? parseInt(String(params.page)) : 1;
    const pageSize = params.pageSize ? parseInt(String(params.pageSize)) : 50;
    const archived = params.archived === 'true';

    const result = await MessagingService.getConversations({
      userId: user.userId,
      page,
      pageSize,
      archived
    });

    return {
      status: 200,
      headers: corsHeaders,
      jsonBody: successResponse(result.conversations, 'Conversations retrieved successfully', {
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
        totalPages: result.totalPages,
        hasMore: result.hasMore
      })
    };
  } catch (error) {
    console.error('Error in getMyConversations:', error);
    return { status: 500, headers: corsHeaders, jsonBody: { success: false, error: 'Failed to retrieve conversations' } };
  }
}); // Remove permissions

// Get messages in a conversation
export const getConversationMessages = withAuth(async (req: HttpRequest, context: InvocationContext, user): Promise<HttpResponseInit> => {
  try {
    const conversationId = req.params.conversationId;
    if (!conversationId) {
      return { status: 400, headers: corsHeaders, jsonBody: { success: false, error: 'conversationId is required' } };
    }

    const params = extractQueryParams(req);
    const page = params.page ? parseInt(String(params.page)) : 1;
    const pageSize = params.pageSize ? parseInt(String(params.pageSize)) : 50;
    const beforeMessageId = params.beforeMessageId as string;

    const result = await MessagingService.getMessages({
      conversationId,
      page,
      pageSize,
      beforeMessageId
    });

    return {
      status: 200,
      headers: corsHeaders,
      jsonBody: successResponse(result.messages, 'Messages retrieved successfully', {
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
        totalPages: result.totalPages,
        hasMore: result.hasMore
      })
    };
  } catch (error) {
    console.error('Error in getConversationMessages:', error);
    return { status: 500, headers: corsHeaders, jsonBody: { success: false, error: 'Failed to retrieve messages' } };
  }
}); // Remove permissions

// Send a message
export const sendMessage = withAuth(async (req: HttpRequest, context: InvocationContext, user): Promise<HttpResponseInit> => {
  try {
    const body = await extractRequestBody(req);
    const {
      conversationId,
      content,
      messageType = 'Text',
      attachmentUrl,
      attachmentType,
      attachmentSize,
      attachmentName,
      replyToMessageId
    } = body;

    if (!conversationId || !content) {
      return { status: 400, headers: corsHeaders, jsonBody: { success: false, error: 'conversationId and content are required' } };
    }

    const message = await MessagingService.sendMessage({
      conversationId,
      senderUserId: user.userId,
      content,
      messageType,
      attachmentUrl,
      attachmentType,
      attachmentSize,
      attachmentName,
      replyToMessageId
    });

    return { status: 201, headers: corsHeaders, jsonBody: successResponse(message, 'Message sent successfully') };
  } catch (error) {
    console.error('Error in sendMessage:', error);
    return { status: 500, headers: corsHeaders, jsonBody: { success: false, error: 'Failed to send message' } };
  }
});

// Mark message as read
export const markMessageAsRead = withAuth(async (req: HttpRequest, context: InvocationContext, user): Promise<HttpResponseInit> => {
  try {
    const messageId = req.params.messageId;
    if (!messageId) {
      return { status: 400, jsonBody: { success: false, error: 'messageId is required' } };
    }

    const result = await MessagingService.markMessageAsRead(messageId, user.userId);

    return { status: 200, jsonBody: successResponse(result, 'Message marked as read') };
  } catch (error) {
    console.error('Error in markMessageAsRead:', error);
    return { status: 500, jsonBody: { success: false, error: 'Failed to mark message as read' } };
  }
});

// Mark all messages in conversation as read
export const markConversationAsRead = withAuth(async (req: HttpRequest, context: InvocationContext, user): Promise<HttpResponseInit> => {
  try {
    const conversationId = req.params.conversationId;
    if (!conversationId) {
      return { status: 400, jsonBody: { success: false, error: 'conversationId is required' } };
    }

    const result = await MessagingService.markConversationAsRead(conversationId, user.userId);

    return { status: 200, jsonBody: successResponse(result, 'Conversation marked as read') };
  } catch (error) {
    console.error('Error in markConversationAsRead:', error);
    return { status: 500, jsonBody: { success: false, error: 'Failed to mark conversation as read' } };
  }
});

// Get unread message count
export const getUnreadCount = withAuth(async (req: HttpRequest, context: InvocationContext, user): Promise<HttpResponseInit> => {
  try {
    const result = await MessagingService.getUnreadCount(user.userId);

    return { status: 200, jsonBody: successResponse(result, 'Unread count retrieved successfully') };
  } catch (error) {
    console.error('Error in getUnreadCount:', error);
    return { status: 500, jsonBody: { success: false, error: 'Failed to get unread count' } };
  }
});

// Archive/Unarchive conversation
export const archiveConversation = withAuth(async (req: HttpRequest, context: InvocationContext, user): Promise<HttpResponseInit> => {
  try {
    const conversationId = req.params.conversationId;
    const body = await extractRequestBody(req);
    const { archive } = body;

    if (!conversationId) {
      return { status: 400, jsonBody: { success: false, error: 'conversationId is required' } };
    }

    if (typeof archive !== 'boolean') {
      return { status: 400, jsonBody: { success: false, error: 'archive must be a boolean' } };
    }

    const result = await MessagingService.archiveConversation(conversationId, user.userId, archive);

    return { status: 200, jsonBody: successResponse(result, `Conversation ${archive ? 'archived' : 'unarchived'} successfully`) };
  } catch (error) {
    console.error('Error in archiveConversation:', error);
    return { status: 500, jsonBody: { success: false, error: 'Failed to archive conversation' } };
  }
});

// Mute/Unmute conversation
export const muteConversation = withAuth(async (req: HttpRequest, context: InvocationContext, user): Promise<HttpResponseInit> => {
  try {
    const conversationId = req.params.conversationId;
    const body = await extractRequestBody(req);
    const { mute } = body;

    if (!conversationId) {
      return { status: 400, jsonBody: { success: false, error: 'conversationId is required' } };
    }

    if (typeof mute !== 'boolean') {
      return { status: 400, jsonBody: { success: false, error: 'mute must be a boolean' } };
    }

    const result = await MessagingService.muteConversation(conversationId, user.userId, mute);

    return { status: 200, jsonBody: successResponse(result, `Conversation ${mute ? 'muted' : 'unmuted'} successfully`) };
  } catch (error) {
    console.error('Error in muteConversation:', error);
    return { status: 500, jsonBody: { success: false, error: 'Failed to mute conversation' } };
  }
});

// Delete message
export const deleteMessage = withAuth(async (req: HttpRequest, context: InvocationContext, user): Promise<HttpResponseInit> => {
  try {
    const messageId = req.params.messageId;
    const params = extractQueryParams(req);
    const deleteFor = (params.deleteFor as 'Sender' | 'Both') || 'Sender';

    if (!messageId) {
      return { status: 400, jsonBody: { success: false, error: 'messageId is required' } };
    }

    if (!['Sender', 'Both'].includes(deleteFor)) {
      return { status: 400, jsonBody: { success: false, error: 'deleteFor must be "Sender" or "Both"' } };
    }

    const result = await MessagingService.deleteMessage(messageId, user.userId, deleteFor);

    return { status: 200, jsonBody: successResponse(result, 'Message deleted successfully') };
  } catch (error) {
    console.error('Error in deleteMessage:', error);
    return { status: 500, jsonBody: { success: false, error: 'Failed to delete message' } };
  }
});

// Block user
export const blockUser = withAuth(async (req: HttpRequest, context: InvocationContext, user): Promise<HttpResponseInit> => {
  try {
    const body = await extractRequestBody(req);
    const { userIdToBlock, reason } = body;

    if (!userIdToBlock) {
      return { status: 400, jsonBody: { success: false, error: 'userIdToBlock is required' } };
    }

    if (userIdToBlock === user.userId) {
      return { status: 400, jsonBody: { success: false, error: 'Cannot block yourself' } };
    }

    const result = await MessagingService.blockUser(user.userId, userIdToBlock, reason);

    return { status: 200, jsonBody: successResponse(result, 'User blocked successfully') };
  } catch (error) {
    console.error('Error in blockUser:', error);
    return { status: 500, jsonBody: { success: false, error: 'Failed to block user' } };
  }
});

// Unblock user
export const unblockUser = withAuth(async (req: HttpRequest, context: InvocationContext, user): Promise<HttpResponseInit> => {
  try {
    const userIdToUnblock = req.params.userId;

    if (!userIdToUnblock) {
      return { status: 400, jsonBody: { success: false, error: 'userId is required' } };
    }

    const result = await MessagingService.unblockUser(user.userId, userIdToUnblock);

    return { status: 200, jsonBody: successResponse(result, 'User unblocked successfully') };
  } catch (error) {
    console.error('Error in unblockUser:', error);
    return { status: 500, jsonBody: { success: false, error: 'Failed to unblock user' } };
  }
});

// Check if user is blocked
export const checkIfBlocked = withAuth(async (req: HttpRequest, context: InvocationContext, user): Promise<HttpResponseInit> => {
  try {
    const otherUserId = req.params.userId;

    if (!otherUserId) {
      return { status: 400, jsonBody: { success: false, error: 'userId is required' } };
    }

    const result = await MessagingService.isUserBlocked(user.userId, otherUserId);

    return { status: 200, jsonBody: successResponse(result, 'Block status checked successfully') };
  } catch (error) {
    console.error('Error in checkIfBlocked:', error);
    return { status: 500, jsonBody: { success: false, error: 'Failed to check block status' } };
  }
});

// Get blocked users
export const getBlockedUsers = withAuth(async (req: HttpRequest, context: InvocationContext, user): Promise<HttpResponseInit> => {
  try {
    const result = await MessagingService.getBlockedUsers(user.userId);

    return { status: 200, jsonBody: successResponse(result, 'Blocked users retrieved successfully') };
  } catch (error) {
    console.error('Error in getBlockedUsers:', error);
    return { status: 500, jsonBody: { success: false, error: 'Failed to retrieve blocked users' } };
  }
});

// Record profile view
export const recordProfileView = withAuth(async (req: HttpRequest, context: InvocationContext, user): Promise<HttpResponseInit> => {
  try {
    const viewedUserId = req.params.userId;
    const params = extractQueryParams(req);
    const deviceType = params.deviceType as string;

    if (!viewedUserId) {
      return { status: 400, jsonBody: { success: false, error: 'userId is required' } };
    }

    const result = await MessagingService.recordProfileView(user.userId, viewedUserId, deviceType);

    return { status: 200, jsonBody: successResponse(result, 'Profile view recorded successfully') };
  } catch (error) {
    console.error('Error in recordProfileView:', error);
    return { status: 500, jsonBody: { success: false, error: 'Failed to record profile view' } };
  }
});

// Get profile views (who viewed my profile)
export const getMyProfileViews = withAuth(async (req: HttpRequest, context: InvocationContext, user): Promise<HttpResponseInit> => {
  try {
    const params = extractQueryParams(req);
    const page = params.page ? parseInt(String(params.page)) : 1;
    const pageSize = params.pageSize ? parseInt(String(params.pageSize)) : 20;

    const result = await MessagingService.getProfileViews(user.userId, page, pageSize);

    return {
      status: 200,
      jsonBody: successResponse(result.views, 'Profile views retrieved successfully', {
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
        totalPages: result.totalPages
      })
    };
  } catch (error) {
    console.error('Error in getMyProfileViews:', error);
    return { status: 500, jsonBody: { success: false, error: 'Failed to retrieve profile views' } };
  }
});

// Get public profile (for viewing other users)
export const getPublicProfile = withAuth(async (req: HttpRequest, context: InvocationContext, user): Promise<HttpResponseInit> => {
  try {
    const userId = req.params.userId;

    if (!userId) {
      return { status: 400, headers: corsHeaders, jsonBody: { success: false, error: 'userId is required' } };
    }

    // Import profile services
    const { ApplicantService } = await import('../services/profile.service');

    // Get user type first
    const userQuery = `
      SELECT UserID, Email, FirstName, LastName, UserType, ProfilePictureURL, ProfileVisibility
      FROM Users
      WHERE UserID = @param0 AND IsActive = 1
    `;

    const { dbService } = await import('../services/database.service');
    const userResult = await dbService.executeQuery(userQuery, [userId]);

    if (!userResult.recordset || userResult.recordset.length === 0) {
      return { status: 404, headers: corsHeaders, jsonBody: { success: false, error: 'User not found' } };
    }

    const targetUser = userResult.recordset[0];

    // Check privacy settings
    if (targetUser.ProfileVisibility === 'Private' && targetUser.UserID !== user.userId) {
      return { status: 403, headers: corsHeaders, jsonBody: { success: false, error: 'This profile is private' } };
    }

    // Record profile view (if not viewing own profile)
    if (targetUser.UserID !== user.userId) {
      await MessagingService.recordProfileView(user.userId, userId, 'Web');
    }

    // Get full profile based on user type
    if (targetUser.UserType === 'JobSeeker') {
      const profile = await ApplicantService.getApplicantProfile(userId);

      // Filter sensitive data based on privacy settings
      const publicProfile = {
        ...profile,
        // Always include these
        UserID: profile.UserID,
        FirstName: profile.FirstName,
        LastName: profile.LastName,
        UserName: `${profile.FirstName} ${profile.LastName}`,
        ProfilePictureURL: profile.ProfilePictureURL,
        Headline: profile.Headline,
        Summary: profile.Summary,
        CurrentLocation: profile.CurrentLocation,
        YearsOfExperience: profile.YearsOfExperience,
        LinkedInProfile: profile.LinkedInProfile,
        GithubProfile: profile.GithubProfile,
        PortfolioURL: profile.PortfolioURL,
        PrimarySkills: profile.PrimarySkills,
        IsOpenToWork: profile.IsOpenToWork,

        // Conditional fields based on privacy
        CurrentCompanyName: profile.HideCurrentCompany ? null : profile.CurrentCompanyName,
        CurrentJobTitle: profile.HideCurrentCompany ? null : profile.CurrentJobTitle,
        salaryBreakdown: profile.HideSalaryDetails ? null : profile.salaryBreakdown,

        // Always hide wallet/referral info
        ReferralPoints: undefined,

        // Include work experience and education
        workExperiences: profile.workExperiences,
        Institution: profile.Institution,
        HighestEducation: profile.HighestEducation,
        FieldOfStudy: profile.FieldOfStudy,
        GraduationYear: profile.GraduationYear
      };

      return { status: 200, headers: corsHeaders, jsonBody: successResponse(publicProfile, 'Public profile retrieved successfully') };
    } else {
      // For employers, show basic info
      return {
        status: 200,
        headers: corsHeaders,
        jsonBody: successResponse({
          UserID: targetUser.UserID,
          FirstName: targetUser.FirstName,
          LastName: targetUser.LastName,
          UserName: `${targetUser.FirstName} ${targetUser.LastName}`,
          UserType: targetUser.UserType,
          ProfilePictureURL: targetUser.ProfilePictureURL
        }, 'Public profile retrieved successfully')
      };
    }
  } catch (error) {
    console.error('Error in getPublicProfile:', error);
    return { status: 500, headers: corsHeaders, jsonBody: { success: false, error: 'Failed to retrieve public profile' } };
  }
});

// NEW: Search users for messaging
export const searchUsers = withAuth(async (req: HttpRequest, context: InvocationContext, user): Promise<HttpResponseInit> => {
  try {
    const params = extractQueryParams(req);
    const query = params.q as string;
    const page = params.page ? parseInt(String(params.page)) : 1;
    const pageSize = Math.min(params.pageSize ? parseInt(String(params.pageSize)) : 20, 50);

    if (!query || query.trim().length < 2) {
      return { status: 400, headers: corsHeaders, jsonBody: { success: false, error: 'Search query must be at least 2 characters' } };
    }

    const searchTerm = `%${query.trim()}%`;
    const offset = (page - 1) * pageSize;

    const { dbService } = await import('../services/database.service');
    
    // Search users by name or email
    const searchQuery = `
      SELECT 
        u.UserID,
        u.FirstName + ' ' + u.LastName AS UserName,
        u.ProfilePictureURL,
        a.CurrentCompanyName,
        a.CurrentJobTitle,
        a.Headline,
        u.UserType
      FROM Users u
      LEFT JOIN Applicants a ON u.UserID = a.UserID
      WHERE u.IsActive = 1
        AND u.UserID != @param0
        AND u.ProfileVisibility != 'Private'
        AND (
          u.FirstName LIKE @param1 
          OR u.LastName LIKE @param1
          OR u.Email LIKE @param1
          OR (u.FirstName + ' ' + u.LastName) LIKE @param1
        )
      ORDER BY 
        CASE WHEN u.FirstName LIKE @param1 THEN 1 ELSE 2 END,
        u.FirstName, u.LastName
      OFFSET @param2 ROWS FETCH NEXT @param3 ROWS ONLY
    `;

    // Get total count
    const countQuery = `
      SELECT COUNT(*) AS Total
      FROM Users u
      WHERE u.IsActive = 1
        AND u.UserID != @param0
        AND u.ProfileVisibility != 'Private'
        AND (
          u.FirstName LIKE @param1 
          OR u.LastName LIKE @param1
          OR u.Email LIKE @param1
          OR (u.FirstName + ' ' + u.LastName) LIKE @param1
        )
    `;

    const [searchResult, countResult] = await Promise.all([
      dbService.executeQuery(searchQuery, [user.userId, searchTerm, offset, pageSize]),
      dbService.executeQuery(countQuery, [user.userId, searchTerm])
    ]);

    const users = searchResult.recordset || [];
    const total = countResult.recordset[0]?.Total || 0;
    const totalPages = Math.ceil(total / pageSize);

    return {
      status: 200,
      headers: corsHeaders,
      jsonBody: successResponse(users, 'Users found successfully', {
        page,
        pageSize,
        total,
        totalPages,
        hasMore: page < totalPages
      })
    };
  } catch (error) {
    console.error('Error in searchUsers:', error);
    return { status: 500, headers: corsHeaders, jsonBody: { success: false, error: 'Failed to search users' } };
  }
});
