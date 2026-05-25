"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActivityController = void 0;
const activity_service_1 = require("./activity.service");
class ActivityController {
    constructor() {
        this.list = async (req, res) => {
            // Basic isolation: If they are not admin, restrict the fetch parameters logically across a middleware checking modules,
            // but here we lock solely to businessId, restricting platform boundaries securely.
            const bypass = req.user.isPlatformSuperAdmin || (res.locals.hasRole && res.locals.hasRole('BUSINESS_ADMIN'));
            // Strict scoping fallback: Normal users can only natively query feeds attached to their interactions if heavily gated.
            // Given requirements say "Normal users can view own activity and allowed module activity", 
            // real ERP implements robust ACL interceptors. Standard business abstraction boundary here:
            const page = parseInt(req.query.page) || 1;
            const size = parseInt(req.query.size) || 20;
            const queryOpts = {
                moduleKey: req.query.moduleKey,
                entityType: req.query.entityType,
                entityId: req.query.entityId,
                userId: bypass ? req.query.userId || undefined : req.user.id,
                startDate: req.query.startDate,
                endDate: req.query.endDate
            };
            res.json(await activity_service_1.ActivityLogger.list(req.user.businessId, queryOpts, page, size));
        };
    }
}
exports.ActivityController = ActivityController;
