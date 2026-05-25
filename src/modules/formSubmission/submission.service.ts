
import { SubmissionDAL } from './submission.dal';
import { db } from '../../models';
import { Op } from 'sequelize';
import { InternalNotifier } from '../notification/notification.service';

export class SubmissionService {
  private dal = new SubmissionDAL();

  list(businessId: string, userId: string, isCreator: boolean, statusFilter: string, page: number, size: number) {
    const offset = (page - 1) * size;
    const query: any = { businessId };
    if (isCreator) query.submittedByUserId = userId;
    if (statusFilter) query.status = statusFilter;
    return this.dal.findAll(query, offset, size);
  }

  getById(id: string, businessId: string) { return this.dal.findById(id, businessId); }

  async submit(businessId: string, userId: string, payload: any) {
    const def = await this.dal.getFormDefinition(payload.formDefinitionId, businessId);
    if (!def) throw new Error("Form Definition invalid or inactive");

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
      const firstStep = await db.ApprovalStep.findOne({ where: { workflowId: def.approvalWorkflowId }, order: [['stepOrder', 'ASC']] });
      if (firstStep) {
        const req = await db.ApprovalRequest.create({
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
          await InternalNotifier.send({
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
