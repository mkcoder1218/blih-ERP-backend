
import { ProfileDAL } from './profile.dal';
import { Op } from 'sequelize';

export class ProfileService {
  private dal = new ProfileDAL();
  list(businessId: string, search: string, page: number, size: number) {
    const offset = (page - 1) * size;
    const query: any = { businessId };
    if (search) query.workEmail = { [Op.iLike]: `%${search}%` };
    return this.dal.findAll(query, offset, size);
  }
  getById(id: string, businessId: string) { return this.dal.findById(id, businessId); }
  getByUserId(userId: string, businessId: string) { return this.dal.findByUserId(userId, businessId); }
  create(businessId: string, data: any) { return this.dal.create({ ...data, businessId }); }
  update(id: string, businessId: string, data: any) { return this.dal.update(id, businessId, data); }
  softDelete(id: string, businessId: string) { return this.dal.softDelete(id, businessId); }
}
