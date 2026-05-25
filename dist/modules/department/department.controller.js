"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DepartmentController = void 0;
const department_service_1 = require("./department.service");
const auditLog_service_1 = require("../../services/auditLog.service");
class DepartmentController {
    constructor() {
        this.service = new department_service_1.DepartmentService();
        this.list = async (req, res) => {
            const businessId = this.deriveBusinessId(req);
            const search = req.query.search || "";
            const page = parseInt(req.query.page) || 1;
            const size = parseInt(req.query.size) || 20;
            // Head can view own dept - simplified to assume they can view the directory of departments to run standard ERP.
            // Tenant isolation strictly blocks out-of-tenant data. 
            res.json(await this.service.list(businessId, search, page, size));
        };
        this.get = async (req, res, next) => {
            const businessId = this.deriveBusinessId(req);
            const dep = await this.service.getById(req.params.id, businessId);
            if (!dep)
                return next({ statusCode: 404, message: 'Not found' });
            res.json({ department: dep });
        };
        this.create = async (req, res) => {
            const businessId = this.deriveBusinessId(req);
            const dep = await this.service.create(businessId, req.body);
            await auditLog_service_1.AuditLogService.log('CREATE', 'department', dep.id, null, dep, req);
            res.status(201).json({ department: dep });
        };
        this.update = async (req, res, next) => {
            const businessId = this.deriveBusinessId(req);
            const beforeData = await this.service.getById(req.params.id, businessId);
            const dep = await this.service.update(req.params.id, businessId, req.body);
            if (!dep)
                return next({ statusCode: 404, message: 'Not found' });
            await auditLog_service_1.AuditLogService.log('UPDATE', 'department', dep.id, beforeData, dep, req);
            res.json({ department: dep });
        };
        this.remove = async (req, res, next) => {
            const businessId = this.deriveBusinessId(req);
            const beforeData = await this.service.getById(req.params.id, businessId);
            const ok = await this.service.softDelete(req.params.id, businessId);
            if (!ok)
                return next({ statusCode: 404, message: 'Not found' });
            await auditLog_service_1.AuditLogService.log('DELETE', 'department', req.params.id, beforeData, null, req);
            res.json({ ok: true });
        };
    }
    deriveBusinessId(req) {
        return req.user.isPlatformSuperAdmin && req.query.businessId
            ? req.query.businessId
            : req.user.businessId;
    }
}
exports.DepartmentController = DepartmentController;
