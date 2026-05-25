"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PositionController = void 0;
const position_service_1 = require("./position.service");
const auditLog_service_1 = require("../../services/auditLog.service");
class PositionController {
    constructor() {
        this.service = new position_service_1.PositionService();
        this.list = async (req, res) => {
            const businessId = this.deriveBusinessId(req);
            const search = req.query.search || "";
            const departmentId = req.query.departmentId;
            const page = parseInt(req.query.page) || 1;
            const size = parseInt(req.query.size) || 20;
            res.json(await this.service.list(businessId, search, page, size, departmentId));
        };
        this.get = async (req, res, next) => {
            const businessId = this.deriveBusinessId(req);
            const pos = await this.service.getById(req.params.id, businessId);
            if (!pos)
                return next({ statusCode: 404, message: 'Not found' });
            res.json({ position: pos });
        };
        this.create = async (req, res) => {
            const businessId = this.deriveBusinessId(req);
            const pos = await this.service.create(businessId, req.body);
            await auditLog_service_1.AuditLogService.log('CREATE', 'position', pos.id, null, pos, req);
            res.status(201).json({ position: pos });
        };
        this.update = async (req, res, next) => {
            const businessId = this.deriveBusinessId(req);
            const beforeData = await this.service.getById(req.params.id, businessId);
            const pos = await this.service.update(req.params.id, businessId, req.body);
            if (!pos)
                return next({ statusCode: 404, message: 'Not found' });
            await auditLog_service_1.AuditLogService.log('UPDATE', 'position', pos.id, beforeData, pos, req);
            res.json({ position: pos });
        };
        this.remove = async (req, res, next) => {
            const businessId = this.deriveBusinessId(req);
            const beforeData = await this.service.getById(req.params.id, businessId);
            const ok = await this.service.softDelete(req.params.id, businessId);
            if (!ok)
                return next({ statusCode: 404, message: 'Not found' });
            await auditLog_service_1.AuditLogService.log('DELETE', 'position', req.params.id, beforeData, null, req);
            res.json({ ok: true });
        };
    }
    deriveBusinessId(req) {
        return req.user.isPlatformSuperAdmin && req.query.businessId
            ? req.query.businessId
            : req.user.businessId;
    }
}
exports.PositionController = PositionController;
