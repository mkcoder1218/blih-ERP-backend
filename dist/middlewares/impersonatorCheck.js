"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.captureImpersonation = void 0;
// Augment request namespace inline for demonstration; in a true production app, would extend AuthUser.
const captureImpersonation = (req, res, next) => {
    // If our JWT payload contained impersonatedBy mapping from adminOps.service
    if (req.user && req.user.impersonatedBy) {
        req.impersonatorMetadata = {
            impersonatedBy: req.user.impersonatedBy,
            sessionId: req.user.impersonationSessionId
        };
    }
    next();
};
exports.captureImpersonation = captureImpersonation;
