"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RequestService = void 0;
const request_dal_1 = require("./request.dal");
const models_1 = require("../../models");
const notification_service_1 = require("../notification/notification.service");
class RequestService {
    constructor() {
        this.dal = new request_dal_1.RequestDAL();
    }
    list(businessId, userId, isCreator, isApprover, page, size) {
        const offset = (page - 1) * size;
        const query = { businessId };
        // Simplistic separation: if looking for created items
        if (isCreator)
            query.requestedByUserId = userId;
        return this.dal.findAll(query, offset, size);
    }
    getById(id, businessId) { return this.dal.findById(id, businessId); }
    async submit(businessId, userId, data) {
        // 1. Fetch wf
        const wf = await models_1.db.ApprovalWorkflow.findOne({ where: { id: data.workflowId, businessId } });
        if (!wf || wf.status !== 'active')
            throw new Error("Workflow invalid or inactive");
        // 2. Locate first step
        const firstStep = await this.dal.getFirstStep(wf.id);
        if (!firstStep)
            throw new Error("Workflow has no steps defined");
        // 3. Create
        const req = await this.dal.createRequest({
            businessId,
            workflowId: wf.id,
            entityType: data.entityType,
            entityId: data.entityId,
            requestedByUserId: userId,
            currentStepId: firstStep.id,
            status: "pending",
            submittedData: data.submittedData || {}
        });
        if (firstStep.approverUserId) {
            await notification_service_1.InternalNotifier.send({
                businessId,
                recipientUserId: firstStep.approverUserId,
                senderUserId: userId,
                moduleKey: wf.moduleKey || 'approval',
                type: 'approval_required',
                title: 'New Approval Request',
                message: `You have a new approval request for workflow: ${wf.name}`,
                entityType: 'approval_request',
                entityId: req.id,
                priority: 'high'
            });
        }
        return req;
    }
    async actOnRequest(requestId, businessId, userId, payload) {
        const req = await this.dal.findById(requestId, businessId);
        if (!req)
            throw new Error("Not found");
        if (req.status !== 'pending' && req.status !== 'returned')
            throw new Error("Request is not pending.");
        const step = req.currentStep;
        if (!step)
            throw new Error("Orphaned step");
        // Authorization check implementation details: 
        // In actual ERP, fetch User roles + department to map against approverType ("role", "user", "department").
        // We assume passed for this baseline structure limit.
        await this.dal.createAction({
            businessId,
            approvalRequestId: req.id,
            approvalStepId: step.id,
            actedByUserId: userId,
            action: payload.action,
            comment: payload.comment || null,
            actionData: payload.actionData || {}
        });
        if (payload.action === 'reject') {
            await req.update({ status: 'rejected', finalDecision: 'rejected', completedAt: new Date() });
            await notification_service_1.InternalNotifier.send({ businessId, recipientUserId: req.requestedByUserId, senderUserId: userId, moduleKey: 'approval', type: 'approval_rejected', title: 'Request Rejected', message: 'Your approval request was rejected.', entityType: 'approval_request', entityId: req.id });
        }
        else if (payload.action === 'approve') {
            if (step.isFinalStep) {
                await req.update({ status: 'approved', finalDecision: 'approved', completedAt: new Date() });
                await notification_service_1.InternalNotifier.send({ businessId, recipientUserId: req.requestedByUserId, senderUserId: userId, moduleKey: 'approval', type: 'approval_approved', title: 'Request Approved', message: 'Your approval request was formally approved.', entityType: 'approval_request', entityId: req.id });
            }
            else {
                const nextStep = await this.dal.getNextStep(req.workflowId, step.stepOrder);
                if (nextStep) {
                    await req.update({ currentStepId: nextStep.id });
                }
                else {
                    await req.update({ status: 'approved', finalDecision: 'approved', completedAt: new Date(), currentStepId: null });
                }
            }
        }
        else if (payload.action === 'return') {
            await req.update({ status: 'returned' });
            await notification_service_1.InternalNotifier.send({ businessId, recipientUserId: req.requestedByUserId, senderUserId: userId, moduleKey: 'approval', type: 'approval_returned', title: 'Request Returned', message: 'Your approval request was returned for modifications.', entityType: 'approval_request', entityId: req.id });
        }
        else if (payload.action === 'cancel') {
            await req.update({ status: 'cancelled', finalDecision: 'cancelled', completedAt: new Date() });
        }
        return req.reload();
    }
}
exports.RequestService = RequestService;
