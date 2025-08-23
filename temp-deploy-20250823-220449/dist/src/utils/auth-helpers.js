"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.refreshToken = void 0;
const auth_service_1 = require("../services/auth.service");
const validation_1 = require("../utils/validation");
// Refresh token helper
const refreshToken = async (req, context) => {
    try {
        const body = await req.text();
        const { refreshToken } = JSON.parse(body || '{}');
        if (!refreshToken) {
            return {
                status: 400,
                jsonBody: (0, validation_1.errorResponse)('Missing refresh token', 'Refresh token is required')
            };
        }
        // Verify refresh token
        const payload = auth_service_1.AuthService.verifyToken(refreshToken);
        if (payload.type !== 'refresh') {
            return {
                status: 400,
                jsonBody: (0, validation_1.errorResponse)('Invalid token type', 'Refresh token required')
            };
        }
        // Get user and generate new tokens
        const UserService = await Promise.resolve().then(() => __importStar(require('../services/user.service')));
        const user = await UserService.UserService.findById(payload.userId);
        if (!user) {
            return {
                status: 404,
                jsonBody: (0, validation_1.errorResponse)('User not found', 'Invalid refresh token')
            };
        }
        const tokens = auth_service_1.AuthService.generateAuthTokens(user);
        return {
            status: 200,
            jsonBody: { success: true, data: tokens, message: 'Token refreshed successfully' }
        };
    }
    catch (error) {
        return {
            status: 401,
            jsonBody: (0, validation_1.errorResponse)('Token refresh failed', error?.message || 'Unknown error')
        };
    }
};
exports.refreshToken = refreshToken;
//# sourceMappingURL=auth-helpers.js.map