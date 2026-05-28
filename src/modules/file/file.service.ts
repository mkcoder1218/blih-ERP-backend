
import { FileDAL } from './file.dal';
import fs from 'fs';

export class FileService {
  private dal = new FileDAL();

  list(businessId: string, moduleKey: string, page: number, size: number) {
    const offset = (page - 1) * size;
    const query: any = { businessId };
    if (moduleKey) query.moduleKey = moduleKey; 
    return this.dal.findAll(query, offset, size);
  }
  getById(id: string, businessId: string) { return this.dal.findById(id, businessId); }
  
  async saveAssetRecord(businessId: string, userId: string | null, file: Express.Multer.File, extraMetadata: Record<string, unknown> = {}) {
    return this.dal.create({
      businessId,
      uploadedByUserId: userId || null,
      originalName: file.originalname,
      storedName: file.filename,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      storageProvider: 'local',
      storagePath: file.path,
      status: 'active',
      metadata: extraMetadata,
    });
  }

  softDelete(id: string, businessId: string) { return this.dal.softDelete(id, businessId); }
}
