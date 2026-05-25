
import { db } from '../../models';
export class SubmissionDAL {
  findAll(query: any, offset: number, limit: number) { 
    return db.FormSubmission.findAndCountAll({ where: query, offset, limit, order: [['createdAt', 'DESC']] }); 
  }
  findById(id: string, businessId: string) { return db.FormSubmission.findOne({ where: { id, businessId } }); }
  create(data: any) { return db.FormSubmission.create(data); }
  async getFormDefinition(id: string, businessId: string) {
    return db.FormDefinition.findOne({ where: { id, businessId, status: 'active' }, include: ['fields'] });
  }
}
