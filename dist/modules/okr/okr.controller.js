"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OKRController = void 0;
const okr_service_1 = require("./okr.service");
const auditLog_service_1 = require("../../services/auditLog.service");
class OKRController {
    constructor() {
        this.service = new okr_service_1.OKRService();
        this.createObjective = async (req, res) => {
            try {
                const obj = await this.service.createObjective(req.user.businessId, req.user.id, req.body);
                await auditLog_service_1.AuditLogService.log('CREATE_OBJECTIVE', 'okr_objective', String(obj.id), null, obj, req);
                res.status(201).json({ objective: obj });
            }
            catch (e) {
                res.status(400).json({ message: e.message });
            }
        };
        this.updateObjective = async (req, res) => {
            try {
                const obj = await this.service.updateObjective(req.user.businessId, req.params.id, req.body);
                await auditLog_service_1.AuditLogService.log('UPDATE_OBJECTIVE', 'okr_objective', String(obj.id), null, req.body, req);
                res.json({ objective: obj });
            }
            catch (e) {
                res.status(400).json({ message: e.message });
            }
        };
        this.getObjective = async (req, res) => {
            const obj = await this.service.getObjective(req.user.businessId, req.params.id);
            if (!obj)
                return res.status(404).json({ message: 'Not found' });
            res.json({ objective: obj });
        };
        this.listObjectives = async (req, res) => {
            const page = parseInt(req.query.page) || 1;
            const size = parseInt(req.query.size) || 20;
            res.json(await this.service.listObjectives(req.user.businessId, req.query, page, size));
        };
        this.createKeyResult = async (req, res) => {
            try {
                const kr = await this.service.createKeyResult(req.user.businessId, req.body.objectiveId, req.body);
                await auditLog_service_1.AuditLogService.log('CREATE_KEY_RESULT', 'okr_key_result', String(kr.id), null, kr, req);
                res.status(201).json({ keyResult: kr });
            }
            catch (e) {
                res.status(400).json({ message: e.message });
            }
        };
        this.updateKeyResult = async (req, res) => {
            try {
                const kr = await this.service.updateKeyResult(req.user.businessId, req.params.id, req.body);
                await auditLog_service_1.AuditLogService.log('UPDATE_KEY_RESULT', 'okr_key_result', String(kr.id), null, req.body, req);
                res.json({ keyResult: kr });
            }
            catch (e) {
                res.status(400).json({ message: e.message });
            }
        };
        this.logProgressUpdate = async (req, res) => {
            try {
                const update = await this.service.logProgressUpdate(req.user.businessId, req.user.id, req.body);
                await auditLog_service_1.AuditLogService.log('LOG_OKR_PROGRESS', 'okr_progress_update', String(update.id), null, update, req);
                res.status(201).json({ progressUpdate: update });
            }
            catch (e) {
                res.status(400).json({ message: e.message });
            }
        };
        this.evaluateObjective = async (req, res) => {
            try {
                const evaluation = await this.service.evaluateObjective(req.user.businessId, req.user.id, req.body);
                await auditLog_service_1.AuditLogService.log('EVALUATE_OBJECTIVE', 'okr_evaluation', String(evaluation.id), null, evaluation, req);
                res.status(201).json({ evaluation });
            }
            catch (e) {
                res.status(400).json({ message: e.message });
            }
        };
    }
}
exports.OKRController = OKRController;
