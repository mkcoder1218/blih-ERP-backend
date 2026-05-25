
import { WidgetDAL } from './widget.dal';
import { Op } from 'sequelize';

export class WidgetService {
  private dal = new WidgetDAL();

  listMine(businessId: string, userId: string, page: number, size: number) {
    const offset = (page - 1) * size;
    return this.dal.findAll({ businessId, [Op.or]: [{ ownerUserId: userId }, { visibility: 'business' }] }, offset, size);
  }

  getById(id: string, businessId: string) { return this.dal.findById(id, businessId); }
  create(businessId: string, userId: string, data: any) { return this.dal.create({ ...data, businessId, ownerUserId: userId }); }
  update(id: string, businessId: string, data: any) { return this.dal.update(id, businessId, data); }
}
