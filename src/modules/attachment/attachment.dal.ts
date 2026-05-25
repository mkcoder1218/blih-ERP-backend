
import { db } from '../../models';
export class AttachmentDAL {
  findAll(query: any, offset: number, limit: number) { 
    return db.EntityAttachment.findAndCountAll({ where: query, offset, limit, order: [['createdAt', 'DESC']], include: [db.FileAsset] }); 
  }
  findById(id: string, businessId: string) { return db.EntityAttachment.findOne({ where: { id, businessId }, include: [db.FileAsset] }); }
  create(data: any) { return db.EntityAttachment.create(data); }
  async softDelete(id: string, businessId: string) {
    const att = await db.EntityAttachment.findOne({ where: { id, businessId } });
    if (att) { await att.destroy(); return true; }
    return false;
  }
}
