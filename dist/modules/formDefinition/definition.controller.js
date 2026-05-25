"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DefinitionController = void 0;
const definition_service_1 = require("./definition.service");
const auditLog_service_1 = require("../../services/auditLog.service");
class DefinitionController {
    constructor() {
        this.service = new definition_service_1.DefinitionService();
        this.list = async (req, res) => {
            const businessId = this.deriveBusinessId(req);
            const search = req.query.search || "";
            const page = parseInt(req.query.page) || 1;
            const size = parseInt(req.query.size) || 20;
            res.json(await this.service.list(businessId, search, page, size));
        };
        this.get = async (req, res, next) => {
            const businessId = this.deriveBusinessId(req);
            const def = await this.service.getById(req.params.id, businessId);
            if (!def)
                return next({ statusCode: 404, message: 'Not found' });
            res.json({ definition: def });
        };
        this.create = async (req, res) => {
            const businessId = this.deriveBusinessId(req);
            const def = await this.service.create(businessId, req.body);
            await auditLog_service_1.AuditLogService.log('CREATE', 'form_definition', def.id, null, def, req);
            res.status(201).json({ definition: def });
        };
        this.update = async (req, res, next) => {
            const businessId = this.deriveBusinessId(req);
            const def = await this.service.update(req.params.id, businessId, req.body);
            if (!def)
                return next({ statusCode: 404, message: 'Not found' });
            res.json({ definition: def });
        };
        this.createField = async (req, res) => {
            const businessId = this.deriveBusinessId(req);
            const field = await this.service.createField(businessId, req.body);
            await auditLog_service_1.AuditLogService.log('CREATE', 'form_field', field.id, null, field, req);
            res.status(201).json({ field });
        };
        this.updateField = async (req, res, next) => {
            const businessId = this.deriveBusinessId(req);
            const field = await this.service.updateField(req.params.id, businessId, req.body);
            if (!field)
                return next({ statusCode: 404, message: 'Not found' });
            res.json({ field });
        };
    }
    deriveBusinessId(req) { return req.user.isPlatformSuperAdmin && req.query.businessId ? req.query.businessId : req.user.businessId; }
}
exports.DefinitionController = DefinitionController;
