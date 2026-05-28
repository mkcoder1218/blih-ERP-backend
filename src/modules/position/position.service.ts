
import { PositionDAL } from './position.dal';
import { Op } from 'sequelize';

export class PositionService {
  private dal = new PositionDAL();
  list(businessId: string, search: string, page: number, size: number, departmentId?: string) {
    const offset = (page - 1) * size;
    const query: any = { businessId };
    if (search) query.title = { [Op.iLike]: `%${search}%` };
    if (departmentId) query.departmentId = departmentId;
    return this.dal.findAll(query, offset, size);
  }
  getById(id: string, businessId: string) { return this.dal.findById(id, businessId); }
  create(businessId: string, data: any) { 
    const key = data.key || data.title.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    return this.dal.create({ ...data, key, businessId }); 
  }
  update(id: string, businessId: string, data: any) { return this.dal.update(id, businessId, data); }
  softDelete(id: string, businessId: string) { return this.dal.softDelete(id, businessId); }
}
