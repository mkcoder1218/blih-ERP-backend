"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubmissionService = void 0;
const submission_dal_1 = require("./submission.dal");
const models_1 = require("../../models");
const notification_service_1 = require("../notification/notification.service");
class SubmissionService {
    constructor() {
        this.dal = new submission_dal_1.SubmissionDAL();
    }
    list(businessId, userId, isCreator, statusFilter, page, size) {
        const offset = (page - 1) * size;
        const query = { businessId };
        if (isCreator)
            query.submittedByUserId = userId;
        if (statusFilter)
            query.status = statusFilter;
        return this.dal.findAll(query, offset, size);
    }
    getById(id, businessId) { return this.dal.findById(id, businessId); }
    async submit(businessId, userId, payload) {
        const def = await this.dal.getFormDefinition(payload.formDefinitionId, businessId);
        if (!def)
            throw new Error("Form Definition invalid or inactive");
        // Dynamic Validation
        if (payload.status === 'submitted') {
            for (const field of def.fields) {
                if (field.required) {
                    const val = payload.data[field.key];
                    if (val === undefined || val === null || val === '') {
                        throw new Error(`Field '${field.label}' is required.`);
                    }
                }
            }
        }
        const sub = await this.dal.create({
            businessId,
            formDefinitionId: def.id,
            submittedByUserId: userId,
            entityType: payload.entityType || null,
            entityId: payload.entityId || null,
            data: payload.data,
            status: payload.status
        });
        // Approval Triggering
        if (payload.status === 'submitted' && def.requiresApproval && def.approvalWorkflowId) {
            const firstStep = await models_1.db.ApprovalStep.findOne({ where: { workflowId: def.approvalWorkflowId }, order: [['stepOrder', 'ASC']] });
            if (firstStep) {
                const req = await models_1.db.ApprovalRequest.create({
                    businessId,
                    workflowId: def.approvalWorkflowId,
                    entityType: 'form_submission',
                    entityId: sub.id,
                    requestedByUserId: userId,
                    currentStepId: firstStep.id,
                    status: 'pending',
                    submittedData: payload.data
                });
                await sub.update({ approvalRequestId: req.id });
                if (firstStep.approverUserId) {
                    await notification_service_1.InternalNotifier.send({
                        businessId,
                        recipientUserId: firstStep.approverUserId,
                        senderUserId: userId,
                        moduleKey: def.moduleKey || 'form',
                        type: 'form_approval_required',
                        title: 'New Form Submission Configured for Approval',
                        message: `A new form submission (${def.name}) requires your approval.`,
                        entityType: 'form_submission',
                        entityId: sub.id,
                        priority: 'normal'
                    });
                }
            }
        }
        return sub;
    }
}
exports.SubmissionService = SubmissionService;
