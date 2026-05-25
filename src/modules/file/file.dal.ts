
import { db } from '../../models';
export class FileDAL {
  findAll(query: any, offset: number, limit: number) { 
    return db.FileAsset.findAndCountAll({ where: query, offset, limit, order: [['createdAt', 'DESC']] }); 
  }
  findById(id: string, businessId: string) { return db.FileAsset.findOne({ where: { id, businessId } }); }
  create(data: any) { return db.FileAsset.create(data); }
  async softDelete(id: string, businessId: string) {
    const asset = await db.FileAsset.findOne({ where: { id, businessId } });
    if (asset) { await asset.update({ status: 'deleted' }); await asset.destroy(); return true; }
    return false;
  }
}
