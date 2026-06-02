"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PositionController = void 0;
const position_service_1 = require("./position.service");
const auditLog_service_1 = require("../../services/auditLog.service");
const apiResponse_1 = require("../../utils/apiResponse");
class PositionController {
    constructor() {
        this.service = new position_service_1.PositionService();
        this.list = async (req, res) => {
            const businessId = this.deriveBusinessId(req);
            const search = req.query.search || "";
            const departmentId = req.query.departmentId;
            const page = parseInt(req.query.page) || 1;
            const size = parseInt(req.query.size) || 20;
            const { rows: positions, count } = await this.service.list(businessId, search, page, size, departmentId);
            return (0, apiResponse_1.ok)(res, { positions, count }, 'Positions list');
        };
        this.get = async (req, res, next) => {
            const businessId = this.deriveBusinessId(req);
            const pos = await this.service.getById(req.params.id, businessId);
            if (!pos)
                return next({ statusCode: 404, message: 'Not found' });
            return (0, apiResponse_1.ok)(res, { position: pos }, 'Position details');
        };
        this.create = async (req, res) => {
            const businessId = this.deriveBusinessId(req);
            const pos = await this.service.create(businessId, req.body);
            await auditLog_service_1.AuditLogService.log('CREATE', 'position', pos.id, null, pos, req);
            return (0, apiResponse_1.ok)(res, { position: pos }, 'Position created', 201);
        };
        this.update = async (req, res, next) => {
            const businessId = this.deriveBusinessId(req);
            const beforeData = await this.service.getById(req.params.id, businessId);
            const pos = await this.service.update(req.params.id, businessId, req.body);
            if (!pos)
                return next({ statusCode: 404, message: 'Not found' });
            await auditLog_service_1.AuditLogService.log('UPDATE', 'position', pos.id, beforeData, pos, req);
            return (0, apiResponse_1.ok)(res, { position: pos }, 'Position updated');
        };
        this.remove = async (req, res, next) => {
            const businessId = this.deriveBusinessId(req);
            const beforeData = await this.service.getById(req.params.id, businessId);
            const okFlag = await this.service.softDelete(req.params.id, businessId);
            if (!okFlag)
                return next({ statusCode: 404, message: 'Not found' });
            await auditLog_service_1.AuditLogService.log('DELETE', 'position', req.params.id, beforeData, null, req);
            return (0, apiResponse_1.ok)(res, { ok: true }, 'Position removed');
        };
    }
    deriveBusinessId(req) {
        return req.user.isPlatformSuperAdmin && req.query.businessId
            ? req.query.businessId
            : req.user.businessId;
    }
}
exports.PositionController = PositionController;
