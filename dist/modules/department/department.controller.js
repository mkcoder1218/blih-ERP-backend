"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DepartmentController = void 0;
const department_service_1 = require("./department.service");
const auditLog_service_1 = require("../../services/auditLog.service");
const apiResponse_1 = require("../../utils/apiResponse");
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
            const { rows: departments, count } = await this.service.list(businessId, search, page, size);
            return (0, apiResponse_1.ok)(res, { departments, count }, 'Departments list');
        };
        this.get = async (req, res, next) => {
            const businessId = this.deriveBusinessId(req);
            const dep = await this.service.getById(req.params.id, businessId);
            if (!dep)
                return next({ statusCode: 404, message: 'Not found' });
            return (0, apiResponse_1.ok)(res, { department: dep }, 'Department details');
        };
        this.create = async (req, res) => {
            const businessId = this.deriveBusinessId(req);
            const dep = await this.service.create(businessId, req.body);
            await auditLog_service_1.AuditLogService.log('CREATE', 'department', dep.id, null, dep, req);
            return (0, apiResponse_1.ok)(res, { department: dep }, 'Department created', 201);
        };
        this.update = async (req, res, next) => {
            const businessId = this.deriveBusinessId(req);
            const beforeData = await this.service.getById(req.params.id, businessId);
            const dep = await this.service.update(req.params.id, businessId, req.body);
            if (!dep)
                return next({ statusCode: 404, message: 'Not found' });
            await auditLog_service_1.AuditLogService.log('UPDATE', 'department', dep.id, beforeData, dep, req);
            return (0, apiResponse_1.ok)(res, { department: dep }, 'Department updated');
        };
        this.remove = async (req, res, next) => {
            const businessId = this.deriveBusinessId(req);
            const beforeData = await this.service.getById(req.params.id, businessId);
            const okFlag = await this.service.softDelete(req.params.id, businessId);
            if (!okFlag)
                return next({ statusCode: 404, message: 'Not found' });
            await auditLog_service_1.AuditLogService.log('DELETE', 'department', req.params.id, beforeData, null, req);
            return (0, apiResponse_1.ok)(res, { ok: true }, 'Department removed');
        };
    }
    deriveBusinessId(req) {
        return req.user.isPlatformSuperAdmin && req.query.businessId
            ? req.query.businessId
            : req.user.businessId;
    }
}
exports.DepartmentController = DepartmentController;
