"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HRPerformanceController = void 0;
const performance_service_1 = require("./performance.service");
const response_1 = require("../../utils/response");
const auditLog_service_1 = require("../../services/auditLog.service");
const models_1 = require("../../models");
const notification_service_1 = require("../notification/notification.service");
class HRPerformanceController {
    constructor() {
        this.service = new performance_service_1.HRPerformanceService();
        this.seedForms = async (req, res) => {
            await this.service.provisionForms(req.user.businessId);
            (0, response_1.successResponse)(res, null, "Performance and Exit templates seeded.");
        };
        // Training
        this.createTrainingRequest = async (req, res) => {
            try {
                const payload = { ...req.body, businessId: req.user.businessId };
                if (!payload.employeeUserId)
                    payload.employeeUserId = req.user.id;
                if (!payload.requestedByUserId)
                    payload.requestedByUserId = req.user.id;
                const r = await models_1.db.TrainingRecord.create(payload);
                await auditLog_service_1.AuditLogService.log('CREATED_TRAINING', 'hr_training_records', String(r.id), null, {}, req);
                (0, response_1.successResponse)(res, r, "Training mapping defined.", 201);
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        this.projectDashboard = async (req, res) => {
            try {
                const data = await this.service.getProjectPerformanceDashboard(req.user.businessId, req.query);
                (0, response_1.successResponse)(res, data);
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        this.overview = async (req, res) => {
            try {
                const data = await this.service.getPerformanceOverview(req.user.businessId, req.query);
                (0, response_1.successResponse)(res, data);
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        this.listReviews = async (req, res) => {
            try {
                const data = await this.service.listPerformanceReviews(req.user.businessId, req.query);
                (0, response_1.successResponse)(res, data);
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        this.employeeEvaluationEvidence = async (req, res) => {
            try {
                const data = await this.service.getEmployeeEvaluationEvidence(req.user.businessId, req.params.employeeUserId, req.query);
                (0, response_1.successResponse)(res, data);
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message, e.message === 'Employee not found' ? 404 : 400);
            }
        };
        this.attachProjectEvidenceToReview = async (req, res) => {
            try {
                const review = await this.service.attachProjectEvidenceToReview(req.user.businessId, req.params.reviewId);
                (0, response_1.successResponse)(res, review, 'Project evidence attached to review.');
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message, e.message === 'Performance review not found' ? 404 : 400);
            }
        };
        // Disciplinary
        this.listDisciplinary = async (req, res) => {
            try {
                await this.service.restrictDisciplinaryAccess(req.user.businessId, req.user);
                const limit = Number(req.query.limit || 20);
                const offset = Number(req.query.offset || 0);
                const result = await models_1.db.DisciplinaryCase.findAndCountAll({ where: { businessId: req.user.businessId }, limit, offset });
                (0, response_1.paginationResponse)(res, result.rows, result.count, offset / limit + 1, limit);
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message, 403);
            }
        };
        // ── Exit Workflow ─────────────────────────────────────────────────────────
        // GET /hr/exit — list all exit processes (HR admin view)
        this.listExitProcesses = async (req, res) => {
            try {
                const businessId = req.user.businessId;
                const limit = Number(req.query.limit || 50);
                const offset = Number(req.query.offset || 0);
                const status = req.query.status;
                const where = { businessId };
                if (status)
                    where.status = status;
                const result = await models_1.db.ExitProcess.findAndCountAll({
                    where,
                    limit,
                    offset,
                    order: [['createdAt', 'DESC']],
                    include: [
                        {
                            model: models_1.db.User,
                            as: 'employee',
                            attributes: ['id', 'fullName', 'email'],
                            include: [{
                                    model: models_1.db.BusinessUserProfile,
                                    required: false,
                                    include: [
                                        { model: models_1.db.Department, as: 'department', attributes: ['id', 'name'] },
                                        { model: models_1.db.Position, as: 'position', attributes: ['id', 'title'] },
                                    ],
                                }],
                        },
                        {
                            model: models_1.db.User,
                            as: 'initiator',
                            attributes: ['id', 'fullName', 'email'],
                        },
                    ],
                });
                (0, response_1.successResponse)(res, { rows: result.rows, count: result.count });
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        // POST /hr/exit/resign — employee submits offboarding request with rich text letter
        this.submitResignation = async (req, res) => {
            try {
                const { effectiveDate, reason, letterHtml, noticePeriodDays } = req.body;
                const businessId = req.user.businessId;
                if (!effectiveDate) {
                    return (0, response_1.errorResponse)(res, 'effectiveDate is required', 400);
                }
                const ex = await models_1.db.ExitProcess.create({
                    businessId,
                    initiatedByUserId: req.user.id,
                    employeeUserId: req.user.id,
                    exitType: 'resignation',
                    effectiveDate,
                    reason: reason || null,
                    status: 'pending',
                    clearanceData: {
                        letterHtml: letterHtml || null,
                        noticePeriodDays: noticePeriodDays || 30,
                    },
                });
                await auditLog_service_1.AuditLogService.log('SUBMIT_RESIGNATION', 'hr_exit_processes', String(ex.id), null, {}, req);
                // Notify all HR managers and business admins
                try {
                    const adminUsers = await models_1.db.User.findAll({
                        where: { businessId, status: 'active' },
                        include: [{
                                model: models_1.db.Role,
                                through: { attributes: [] },
                                where: { key: ['BUSINESS_ADMIN', 'HR_MANAGER'] },
                                required: true,
                            }],
                        attributes: ['id'],
                    });
                    const adminIds = adminUsers
                        .map((u) => u.id)
                        .filter((id) => id !== req.user.id);
                    if (adminIds.length > 0) {
                        const employee = await models_1.db.User.findByPk(req.user.id, { attributes: ['fullName'] });
                        await notification_service_1.InternalNotifier.sendBulk({
                            businessId,
                            recipientUserIds: adminIds,
                            senderUserId: req.user.id,
                            moduleKey: 'hr',
                            type: 'exit_submitted',
                            title: 'New Offboarding Request',
                            message: `${employee?.fullName || 'An employee'} has submitted an offboarding/resignation request. Last working day: ${new Date(effectiveDate).toLocaleDateString()}.`,
                            entityType: 'ExitProcess',
                            entityId: String(ex.id),
                            priority: 'high',
                        });
                    }
                }
                catch (notifErr) {
                    console.error('[ExitProcess] Failed to send admin notifications:', notifErr);
                }
                (0, response_1.successResponse)(res, ex, 'Offboarding request submitted successfully.', 201);
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        this.updateExitStatus = async (req, res) => {
            try {
                const result = await this.service.processExit(req.user.businessId, req.body.employeeUserId, req.params.id, req.body.status);
                await auditLog_service_1.AuditLogService.log('UPDATED_EXIT_PROCESS', 'hr_exit_processes', String(result.id), null, { status: req.body.status }, req);
                (0, response_1.successResponse)(res, result);
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
    }
}
exports.HRPerformanceController = HRPerformanceController;
