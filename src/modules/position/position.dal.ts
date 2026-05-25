
import { db } from '../../models';
export class PositionDAL {
  findAll(query: any, offset: number, limit: number) { 
    return db.Position.findAndCountAll({ where: query, offset, limit, order: [['createdAt', 'DESC']] }); 
  }
  findById(id: string, businessId: string) { return db.Position.findOne({ where: { id, businessId } }); }
  create(data: any) { return db.Position.create(data); }
  async update(id: string, businessId: string, data: any) {
    const pos = await db.Position.findOne({ where: { id, businessId }});
    if (!pos) return null;
    return pos.update(data);
  }
  async softDelete(id: string, businessId: string) {
    const pos = await db.Position.findOne({ where: { id, businessId }});
    if (!pos) return false;
    await pos.destroy();
    return true;
  }
}
