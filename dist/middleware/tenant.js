"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tenantWhere = tenantWhere;
exports.enforceTenantParam = enforceTenantParam;
function tenantWhere(req, explicitBusinessId) {
    if (!req.user)
        throw Object.assign(new Error("Unauthorized"), { statusCode: 401 });
    if (req.user.isPlatformSuperAdmin)
        return {};
    const businessId = explicitBusinessId || req.user.businessId;
    return { businessId };
}
function enforceTenantParam(paramName = "businessId") {
    return (req, res, next) => {
        if (!req.user)
            return next({ statusCode: 401, message: "Unauthorized" });
        if (req.user.isPlatformSuperAdmin)
            return next();
        const requested = req.params[paramName] || req.body?.[paramName] || req.query?.[paramName];
        if (requested && requested !== req.user.businessId) {
            return next({ statusCode: 403, message: "Forbidden (tenant)" });
        }
        next();
    };
}
