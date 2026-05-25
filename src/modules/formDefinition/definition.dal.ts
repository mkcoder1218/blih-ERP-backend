
import { db } from '../../models';
export class DefinitionDAL {
  findAll(query: any, offset: number, limit: number) { 
    return db.FormDefinition.findAndCountAll({ where: query, offset, limit, order: [['createdAt', 'DESC']], include: ['fields'] }); 
  }
  findById(id: string, businessId: string) { return db.FormDefinition.findOne({ where: { id, businessId }, include: ['fields'] }); }
  create(data: any) { return db.FormDefinition.create(data); }
  async update(id: string, businessId: string, data: any) {
    const f = await db.FormDefinition.findOne({ where: { id, businessId } });
    if (f) return f.update(data);
    return null;
  }
  createField(data: any) { return db.FormField.create(data); }
  async updateField(id: string, businessId: string, data: any) {
    const f = await db.FormField.findOne({ where: { id, businessId } });
    if (f) return f.update(data);
    return null;
  }
  async deleteField(id: string, businessId: string) {
    const f = await db.FormField.findOne({ where: { id, businessId } });
    if (f) { await f.destroy(); return true; }
    return false;
  }
}
