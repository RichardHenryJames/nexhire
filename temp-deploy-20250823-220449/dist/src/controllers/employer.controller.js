"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeEmployer = void 0;
const middleware_1 = require("../middleware");
const validation_1 = require("../utils/validation");
const user_service_1 = require("../services/user.service");
// POST /employers/initialize
// Allows an authenticated existing user to initialize an employer profile + organization
exports.initializeEmployer = (0, middleware_1.withAuth)(async (req, context, user) => {
    const payload = await (0, validation_1.extractRequestBody)(req);
    const validated = (0, validation_1.validateRequest)(validation_1.employerInitializeSchema, payload);
    const result = await user_service_1.UserService.initializeEmployerProfile(user.userId, validated);
    return {
        status: 200,
        jsonBody: (0, validation_1.successResponse)(result, 'Employer profile initialized successfully')
    };
});
//# sourceMappingURL=employer.controller.js.map