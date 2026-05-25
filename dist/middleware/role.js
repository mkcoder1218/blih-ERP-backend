"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireRole = requireRole;
function requireRole(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user)
            return next({ statusCode: 401, message: "Unauthorized" });
        if (req.user.isPlatformSuperAdmin)
            return next();
        const hasRole = (req.user.roles || []).some((r) => allowedRoles.includes(r));
        if (!hasRole)
            return next({ statusCode: 403, message: "Forbidden (role)" });
        next();
    };
}
