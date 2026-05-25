"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WidgetController = void 0;
const widget_service_1 = require("./widget.service");
const auditLog_service_1 = require("../../services/auditLog.service");
class WidgetController {
    constructor() {
        this.service = new widget_service_1.WidgetService();
        this.list = async (req, res) => {
            const page = parseInt(req.query.page) || 1;
            const size = parseInt(req.query.size) || 20;
            res.json(await this.service.listMine(req.user.businessId, req.user.id, page, size));
        };
        this.get = async (req, res, next) => {
            const doc = await this.service.getById(req.params.id, req.user.businessId);
            if (!doc)
                return next({ statusCode: 404, message: 'Not found' });
            res.json({ widget: doc });
        };
        this.create = async (req, res) => {
            const doc = await this.service.create(req.user.businessId, req.user.id, req.body);
            await auditLog_service_1.AuditLogService.log('CREATE_WIDGET', 'dashboard_widget', doc.id, null, doc, req);
            res.status(201).json({ widget: doc });
        };
        this.update = async (req, res, next) => {
            const doc = await this.service.update(req.params.id, req.user.businessId, req.body);
            if (!doc)
                return next({ statusCode: 404, message: 'Not found' });
            res.json({ widget: doc });
        };
    }
}
exports.WidgetController = WidgetController;
