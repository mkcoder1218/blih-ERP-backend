
import { ViewDAL } from './view.dal';
export class ViewService {
  private dal = new ViewDAL();
  listMine(businessId: string, userId: string, page: number, size: number) {
    return this.dal.findAll({ businessId, userId }, (page - 1) * size, size);
  }
  create(businessId: string, userId: string, data: any) { return this.dal.create({ ...data, businessId, userId }); }
  deleteItem(id: string, businessId: string) { return this.dal.deleteItem(id, businessId); }
}
