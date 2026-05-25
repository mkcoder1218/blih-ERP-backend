"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecruitmentController = void 0;
const recruitment_service_1 = require("./recruitment.service");
const response_1 = require("../../utils/response");
const auditLog_service_1 = require("../../services/auditLog.service");
const models_1 = require("../../models");
class RecruitmentController {
    constructor() {
        this.service = new recruitment_service_1.RecruitmentService();
        this.seedForms = async (req, res) => {
            await this.service.provisionForms(req.user.businessId);
            (0, response_1.successResponse)(res, null, "Recruitment templates seeded.");
        };
        // Public Apply
        this.publicApply = async (req, res) => {
            try {
                const app = await this.service.publicApply(req.params.jobOpeningId, req.body);
                // Do not bind AuditLogService mapping heavily due to absent Request User mapping structurally
                (0, response_1.successResponse)(res, { jobApplicationId: app.id }, "Application received.", 201);
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        this.listOpenings = async (req, res) => {
            try {
                const limit = Number(req.query.limit || 20);
                const offset = Number(req.query.offset || 0);
                const q = { businessId: req.user.businessId };
                const result = await models_1.db.JobOpening.findAndCountAll({ where: q, limit, offset });
                (0, response_1.paginationResponse)(res, result.rows, result.count, offset / limit + 1, limit);
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        this.createOpening = async (req, res) => {
            try {
                const opening = await models_1.db.JobOpening.create({ ...req.body, businessId: req.user.businessId, requestedByUserId: req.user.id });
                await auditLog_service_1.AuditLogService.log('CREATED_JOB_OPENING', 'hr_job_openings', String(opening.id), null, {}, req);
                (0, response_1.successResponse)(res, opening, "Job opening defined.", 201);
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        this.advanceApplicant = async (req, res) => {
            try {
                const { stage } = req.body;
                const result = await this.service.advanceApplicant(req.params.id, req.user.businessId, stage);
                await auditLog_service_1.AuditLogService.log('ADVANCED_APPLICANT', 'hr_job_applications', String(result.id), null, { stage }, req);
                (0, response_1.successResponse)(res, result);
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
    }
}
exports.RecruitmentController = RecruitmentController;
