"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireRole = requireRole;
function requireRole(...allowedRoleKeys) {
    return (req, res, next) => {
        if (!req.user)
            return next({ statusCode: 401, message: "Unauthorized" });
        if (req.user.isPlatformSuperAdmin)
            return next();
        const has = (req.user.roles || []).some((r) => allowedRoleKeys.includes(r));
        if (!has)
            return next({ statusCode: 403, message: "Forbidden (role)" });
        next();
    };
}
