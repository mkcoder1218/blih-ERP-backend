
import { db } from '../../models';
export class WidgetDAL {
  findAll(query: any, offset: number, limit: number) { return db.DashboardWidget.findAndCountAll({ where: query, offset, limit }); }
  findById(id: string, businessId: string) { return db.DashboardWidget.findOne({ where: { id, businessId } }); }
  create(data: any) { return db.DashboardWidget.create(data); }
  async update(id: string, businessId: string, data: any) {
    const w = await db.DashboardWidget.findOne({ where: { id, businessId } });
    if (w) return w.update(data); return null;
  }
}
