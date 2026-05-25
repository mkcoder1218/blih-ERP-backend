
import { db } from '../../models';
export class ProfileDAL {
  findAll(query: any, offset: number, limit: number) { 
    return db.BusinessUserProfile.findAndCountAll({ where: query, offset, limit, order: [['createdAt', 'DESC']] }); 
  }
  findById(id: string, businessId: string) { return db.BusinessUserProfile.findOne({ where: { id, businessId } }); }
  findByUserId(userId: string, businessId: string) { return db.BusinessUserProfile.findOne({ where: { userId, businessId } }); }
  create(data: any) { return db.BusinessUserProfile.create(data); }
  async update(id: string, businessId: string, data: any) {
    const prof = await db.BusinessUserProfile.findOne({ where: { id, businessId }});
    if (!prof) return null;
    return prof.update(data);
  }
  async softDelete(id: string, businessId: string) {
    const prof = await db.BusinessUserProfile.findOne({ where: { id, businessId }});
    if (!prof) return false;
    await prof.destroy();
    return true;
  }
}
