
import { db } from '../../models';
export class DepartmentDAL {
  findAll(query: any, offset: number, limit: number) { 
    return db.Department.findAndCountAll({ where: query, offset, limit, order: [['createdAt', 'DESC']] }); 
  }
  findById(id: string, businessId: string) { return db.Department.findOne({ where: { id, businessId } }); }
  create(data: any) { return db.Department.create(data); }
  async update(id: string, businessId: string, data: any) {
    const dep = await db.Department.findOne({ where: { id, businessId }});
    if (!dep) return null;
    return dep.update(data);
  }
  async softDelete(id: string, businessId: string) {
    const dep = await db.Department.findOne({ where: { id, businessId }});
    if (!dep) return false;
    await dep.destroy();
    return true;
  }
}
