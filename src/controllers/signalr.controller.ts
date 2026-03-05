import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { withAuth } from '../middleware';

const SIGNALR_CONNECTION_STRING = process.env.SIGNALR_CONNECTION_STRING || '';

// ?? CORS Headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
};

/**
 * SignalR Negotiate Endpoint
 * Returns connection info for clients to connect to Azure SignalR
 */
export const signalrNegotiate = withAuth(async (req: HttpRequest, context: InvocationContext, user): Promise<HttpResponseInit> => {
  try {
    if (!SIGNALR_CONNECTION_STRING) {
      return {
        status: 500,
        headers: corsHeaders,
        jsonBody: {
          success: false,
          error: 'SignalR not configured'
        }
      };
    }

    // Extract endpoint and key from connection string
    const endpointMatch = SIGNALR_CONNECTION_STRING.match(/Endpoint=([^;]+)/);
    const keyMatch = SIGNALR_CONNECTION_STRING.match(/AccessKey=([^;]+)/);
    
    if (!endpointMatch || !keyMatch) {
      throw new Error('Invalid SignalR connection string');
    }

    const endpoint = endpointMatch[1];
    const accessKey = keyMatch[1];

    // Generate access token for the user
    const crypto = require('crypto');
    const audience = `${endpoint}/client/?hub=messaging`;
    const expiresIn = 3600; // 1 hour
    const expiresAt = Math.floor(Date.now() / 1000) + expiresIn;

    // Create JWT token
    const payload = {
      aud: audience,
      exp: expiresAt,
      sub: user.userId, // User ID as subject
    };

    const header = { alg: 'HS256', typ: 'JWT' };
    
    const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
    
    const signature = crypto
      .createHmac('sha256', accessKey)
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest('base64url');

    const accessToken = `${encodedHeader}.${encodedPayload}.${signature}`;

    // Return connection info
    return {
      status: 200,
      headers: corsHeaders, // ? Add CORS headers
      jsonBody: {
        url: `${endpoint}/client/?hub=messaging`,
        accessToken: accessToken,
      }
    };

  } catch (error) {
    context.error('SignalR negotiate error:', error);
    return {
      status: 500,
      headers: corsHeaders, // ? Add CORS headers
      jsonBody: {
        success: false,
        error: 'Failed to negotiate SignalR connection'
      }
    };
  }
});

// Register the negotiate endpoint
app.http('signalr-negotiate', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'signalr/negotiate',
  handler: signalrNegotiate,
});
