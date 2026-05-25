
import { db } from '../../models';
export class WorkflowDAL {
  findAll(query: any, offset: number, limit: number) { 
    return db.ApprovalWorkflow.findAndCountAll({ where: query, offset, limit, order: [['createdAt', 'DESC']], include: ['steps'] }); 
  }
  findById(id: string, businessId: string) { return db.ApprovalWorkflow.findOne({ where: { id, businessId }, include: ['steps'] }); }
  create(data: any) { return db.ApprovalWorkflow.create(data); }
  createStep(data: any) { return db.ApprovalStep.create(data); }
  async deleteStep(stepId: string, businessId: string) {
    const step = await db.ApprovalStep.findOne({ where: { id: stepId, businessId } });
    if (step) { await step.destroy(); return true; }
    return false;
  }
}
