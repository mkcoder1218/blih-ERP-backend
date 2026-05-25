"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViewController = void 0;
const view_service_1 = require("./view.service");
const auditLog_service_1 = require("../../services/auditLog.service");
class ViewController {
    constructor() {
        this.service = new view_service_1.ViewService();
        this.list = async (req, res) => {
            const page = parseInt(req.query.page) || 1;
            const size = parseInt(req.query.size) || 20;
            res.json(await this.service.listMine(req.user.businessId, req.user.id, page, size));
        };
        this.create = async (req, res) => {
            const doc = await this.service.create(req.user.businessId, req.user.id, req.body);
            await auditLog_service_1.AuditLogService.log('CREATE_SAVED_VIEW', 'saved_view', doc.id, null, doc, req);
            res.status(201).json({ view: doc });
        };
        this.remove = async (req, res, next) => {
            const ok = await this.service.deleteItem(req.params.id, req.user.businessId);
            if (!ok)
                return next({ statusCode: 404, message: 'Not found' });
            res.json({ ok: true });
        };
    }
}
exports.ViewController = ViewController;
