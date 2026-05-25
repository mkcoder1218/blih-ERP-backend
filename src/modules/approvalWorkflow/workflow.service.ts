
import { WorkflowDAL } from './workflow.dal';
import { Op } from 'sequelize';

export class WorkflowService {
  private dal = new WorkflowDAL();
  list(businessId: string, search: string, page: number, size: number) {
    const offset = (page - 1) * size;
    const query: any = { businessId };
    if (search) query.name = { [Op.iLike]: `%${search}%` };
    return this.dal.findAll(query, offset, size);
  }
  getById(id: string, businessId: string) { return this.dal.findById(id, businessId); }
  create(businessId: string, data: any) { return this.dal.create({ ...data, businessId }); }
  createStep(businessId: string, data: any) { return this.dal.createStep({ ...data, businessId }); }
  deleteStep(stepId: string, businessId: string) { return this.dal.deleteStep(stepId, businessId); }
}
