
import { db } from '../../models';
export class RequestDAL {
  findAll(query: any, offset: number, limit: number) { 
    return db.ApprovalRequest.findAndCountAll({ where: query, offset, limit, order: [['createdAt', 'DESC']], include: [{model: db.ApprovalStep, as: 'currentStep'}] }); 
  }
  findById(id: string, businessId: string) { 
    return db.ApprovalRequest.findOne({ where: { id, businessId }, include: ['workflow', 'currentStep', 'actions'] }); 
  }
  getFirstStep(workflowId: string) {
    return db.ApprovalStep.findOne({ where: { workflowId }, order: [['stepOrder', 'ASC']] });
  }
  getNextStep(workflowId: string, currentOrder: number) {
    const { Op } = require('sequelize');
    return db.ApprovalStep.findOne({ where: { workflowId, stepOrder: { [Op.gt]: currentOrder } }, order: [['stepOrder', 'ASC']] });
  }
  createRequest(data: any) { return db.ApprovalRequest.create(data); }
  createAction(data: any) { return db.ApprovalAction.create(data); }
}
