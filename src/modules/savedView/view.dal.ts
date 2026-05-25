
import { db } from '../../models';
export class ViewDAL {
  findAll(query: any, offset: number, limit: number) { return db.SavedView.findAndCountAll({ where: query, offset, limit }); }
  create(data: any) { return db.SavedView.create(data); }
  async deleteItem(id: string, businessId: string) {
    const v = await db.SavedView.findOne({ where: { id, businessId } });
    if(v) { await v.destroy(); return true; } return false;
  }
}
