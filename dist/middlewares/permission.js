"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requirePermission = requirePermission;
exports.requireAnyPermission = requireAnyPermission;
function requirePermission(...permissionKeys) {
    return (req, res, next) => {
        if (!req.user)
            return next({ statusCode: 401, message: "Unauthorized" });
        if (req.user.isPlatformSuperAdmin)
            return next();
        const userPerms = new Set(req.user.permissions || []);
        const ok = permissionKeys.every((k) => userPerms.has(k));
        if (!ok)
            return next({ statusCode: 403, message: "Forbidden (permission)" });
        next();
    };
}
function requireAnyPermission(...permissionKeys) {
    return (req, res, next) => {
        if (!req.user)
            return next({ statusCode: 401, message: "Unauthorized" });
        if (req.user.isPlatformSuperAdmin)
            return next();
        const userPerms = new Set(req.user.permissions || []);
        const ok = permissionKeys.some((k) => userPerms.has(k));
        if (!ok)
            return next({ statusCode: 403, message: "Forbidden (permission)" });
        next();
    };
}
