
import { db } from '../../models';
export class TemplateDAL {
  findAll(query: any) { 
    return db.ModuleTemplate.findAll({ where: query, order: [['createdAt', 'ASC']], include: ['forms', 'workflows'] }); 
  }
  findByKey(moduleKey: string) { return db.ModuleTemplate.findOne({ where: { moduleKey }, include: ['forms', 'workflows'] }); }
  async getBusinessModuleStatus(businessId: string, moduleKey: string) {
    return db.BusinessModule.findOne({ where: { businessId, moduleKey } });
  }
}
