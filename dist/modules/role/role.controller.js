"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoleController = void 0;
const role_service_1 = require("./role.service");
const auditLog_service_1 = require("../../services/auditLog.service");
const apiResponse_1 = require("../../utils/apiResponse");
class RoleController {
    constructor() {
        this.list = async (req, res) => {
            let businessId = req.user.businessId;
            if (req.user.isPlatformSuperAdmin) {
                businessId = req.query.businessId || undefined;
            }
            const roles = await this.service.list(businessId);
            return (0, apiResponse_1.ok)(res, { roles, count: roles.length }, "Roles list");
        };
        /**
         * GET /api/v1/roles/my-domain
         * Returns only the roles the caller is authorized to manage based on their role domain.
         * HR_MANAGER → hr domain roles, FINANCE_MANAGER → finance domain roles, etc.
         * BUSINESS_ADMIN → all roles.
         */
        this.listMyDomain = async (req, res) => {
            const callerRoleKeys = req.user.roles || [];
            const roles = await this.service.listForCaller(req.user.businessId, callerRoleKeys);
            return (0, apiResponse_1.ok)(res, { roles, count: roles.length }, "Domain roles list");
        };
        this.get = async (req, res, next) => {
            const role = await this.service.getById(req.params.id);
            if (!role)
                return next({ statusCode: 404, message: "Role not found" });
            if (!req.user.isPlatformSuperAdmin && role.businessId !== req.user.businessId) {
                return next({ statusCode: 403, message: "Forbidden (tenant)" });
            }
            return (0, apiResponse_1.ok)(res, { role }, "Role details");
        };
        this.create = async (req, res) => {
            const role = await this.service.create(req.user.businessId, req.body);
            await auditLog_service_1.AuditLogService.log("CREATE", "role", role.id, null, role, req);
            return (0, apiResponse_1.ok)(res, { role }, "Role created", 201);
        };
        this.update = async (req, res, next) => {
            const callerRoleKeys = req.user.roles || [];
            const beforeData = await this.service.getById(req.params.id);
            const role = await this.service.update(req.params.id, req.user.businessId, req.body, callerRoleKeys);
            if (!role)
                return next({ statusCode: 404, message: "Role not found" });
            await auditLog_service_1.AuditLogService.log("UPDATE", "role", req.params.id, beforeData, role, req);
            return (0, apiResponse_1.ok)(res, { role }, "Role updated");
        };
        this.remove = async (req, res, next) => {
            const callerRoleKeys = req.user.roles || [];
            const beforeData = await this.service.getById(req.params.id);
            const okFlag = await this.service.softDelete(req.params.id, req.user.businessId, callerRoleKeys);
            if (!okFlag)
                return next({ statusCode: 404, message: "Role not found" });
            await auditLog_service_1.AuditLogService.log("DELETE", "role", req.params.id, beforeData, null, req);
            return (0, apiResponse_1.ok)(res, { ok: true }, "Role removed");
        };
        this.service = new role_service_1.RoleService();
    }
}
exports.RoleController = RoleController;
