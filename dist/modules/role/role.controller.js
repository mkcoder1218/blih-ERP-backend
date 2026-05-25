"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoleController = void 0;
const role_service_1 = require("./role.service");
const auditLog_service_1 = require("../../services/auditLog.service");
class RoleController {
    constructor() {
        this.list = async (req, res) => {
            const roles = await this.service.list(req.user.businessId);
            res.json({ roles });
        };
        this.get = async (req, res, next) => {
            const role = await this.service.getById(req.params.id);
            if (!role)
                return next({ statusCode: 404, message: "Role not found" });
            if (!req.user.isPlatformSuperAdmin && role.businessId !== req.user.businessId) {
                return next({ statusCode: 403, message: "Forbidden (tenant)" });
            }
            res.json({ role });
        };
        this.create = async (req, res) => {
            const role = await this.service.create(req.user.businessId, req.body);
            await auditLog_service_1.AuditLogService.log("CREATE", "role", role.id, null, role, req);
            res.status(201).json({ role });
        };
        this.update = async (req, res, next) => {
            const beforeData = await this.service.getById(req.params.id);
            const role = await this.service.update(req.params.id, req.user.businessId, req.body);
            if (!role)
                return next({ statusCode: 404, message: "Role not found" });
            await auditLog_service_1.AuditLogService.log("UPDATE", "role", req.params.id, beforeData, role, req);
            res.json({ role });
        };
        this.remove = async (req, res, next) => {
            const beforeData = await this.service.getById(req.params.id);
            const ok = await this.service.softDelete(req.params.id, req.user.businessId);
            if (!ok)
                return next({ statusCode: 404, message: "Role not found" });
            await auditLog_service_1.AuditLogService.log("DELETE", "role", req.params.id, beforeData, null, req);
            res.json({ ok: true });
        };
        this.service = new role_service_1.RoleService();
    }
}
exports.RoleController = RoleController;
