"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HRPerformanceController = void 0;
const performance_service_1 = require("./performance.service");
const response_1 = require("../../utils/response");
const auditLog_service_1 = require("../../services/auditLog.service");
const models_1 = require("../../models");
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
                // Employee submits for self
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
        // Disciplinary Restrictions
        this.listDisciplinary = async (req, res) => {
            try {
                // Enforce Role bounds strictly avoiding standard "my team" leakage for grievance paths internally via Service Logic Checks.
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
        // Exit Workflow
        this.submitResignation = async (req, res) => {
            try {
                const { effectiveDate, reason } = req.body;
                const ex = await models_1.db.ExitProcess.create({
                    businessId: req.user.businessId,
                    initiatedByUserId: req.user.id,
                    employeeUserId: req.user.id,
                    exitType: 'resignation',
                    effectiveDate,
                    reason
                });
                await auditLog_service_1.AuditLogService.log('SUBMIT_RESIGNATION', 'hr_exit_processes', String(ex.id), null, {}, req);
                (0, response_1.successResponse)(res, ex, "Resignation structured.", 201);
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
