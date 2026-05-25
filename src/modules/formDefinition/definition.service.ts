
import { DefinitionDAL } from './definition.dal';
import { Op } from 'sequelize';

export class DefinitionService {
  private dal = new DefinitionDAL();
  list(businessId: string, search: string, page: number, size: number) {
    const offset = (page - 1) * size;
    const query: any = { businessId };
    if (search) query.name = { [Op.iLike]: `%${search}%` };
    return this.dal.findAll(query, offset, size);
  }
  getById(id: string, businessId: string) { return this.dal.findById(id, businessId); }
  create(businessId: string, data: any) { return this.dal.create({ ...data, businessId }); }
  update(id: string, businessId: string, data: any) { return this.dal.update(id, businessId, data); }
  createField(businessId: string, data: any) { return this.dal.createField({ ...data, businessId }); }
  updateField(id: string, businessId: string, data: any) { return this.dal.updateField(id, businessId, data); }
  deleteField(id: string, businessId: string) { return this.dal.deleteField(id, businessId); }
}
