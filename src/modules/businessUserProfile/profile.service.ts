
import { ProfileDAL } from './profile.dal';
import { Op } from 'sequelize';
import { db } from '../../models';

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
  async ensureForUser(userId: string, businessId: string) {
    const found = await this.dal.findByUserId(userId, businessId);
    if (found) return found;
    const user = await db.User.findByPk(userId);
    await this.dal.create({
      userId,
      businessId,
      workEmail: user?.email || null,
      workPhone: user?.phone || null,
      status: "active",
      settings: {
        fullName: user?.fullName || null,
        email: user?.email || null,
        phone: user?.phone || null
      }
    });
    return this.dal.findByUserId(userId, businessId);
  }
  create(businessId: string, data: any) { return this.dal.create({ ...data, businessId }); }
  update(id: string, businessId: string, data: any) { return this.dal.update(id, businessId, data); }
  softDelete(id: string, businessId: string) { return this.dal.softDelete(id, businessId); }
}
