"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tenantWhere = tenantWhere;
exports.enforceTenant = enforceTenant;
function tenantWhere(req, requestedBusinessId) {
    if (!req.user)
        throw Object.assign(new Error("Unauthorized"), { statusCode: 401 });
    if (req.user.isPlatformSuperAdmin)
        return {};
    const businessId = requestedBusinessId || req.user.businessId;
    return { businessId };
}
function enforceTenant(paramName = "businessId") {
    return (req, res, next) => {
        if (!req.user)
            return next({ statusCode: 401, message: "Unauthorized" });
        if (req.user.isPlatformSuperAdmin)
            return next();
        const requested = req.params?.[paramName] ||
            req.body?.[paramName] ||
            req.query?.[paramName];
        if (requested && requested !== req.user.businessId) {
            return next({ statusCode: 403, message: "Forbidden (tenant)" });
        }
        next();
    };
}
