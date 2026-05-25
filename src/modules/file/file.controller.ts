
import type { Request, Response, NextFunction } from 'express';
import { FileService } from './file.service';
import { AuditLogService } from '../../services/auditLog.service';
import path from 'path';
import fs from 'fs';

export class FileController {
  private service = new FileService();

  private deriveBusinessId(req: Request) { return req.user!.isPlatformSuperAdmin && req.query.businessId ? req.query.businessId as string : req.user!.businessId; }

  list = async (req: Request, res: Response) => {
    const businessId = this.deriveBusinessId(req);
    const moduleKey = req.query.moduleKey as string || "";
    const page = parseInt(req.query.page as string) || 1;
    const size = parseInt(req.query.size as string) || 20;

    const data = await this.service.list(businessId, moduleKey, page, size);
    
    // Hide pure local paths for safety unless super admin, map to secure download route
    const safeData = data.rows.map((r: any) => {
      const d = r.toJSON();
      if (!req.user!.isPlatformSuperAdmin) delete d.storagePath;
      d.downloadUrl = `/api/files/${d.id}/download`;
      return d;
    });

    res.json({ count: data.count, rows: safeData });
  };

  uploadSingle = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) throw new Error("No file uploaded");
      const r = await this.service.saveAssetRecord(req.user!.businessId, req.user!.id, req.file);
      await AuditLogService.log('UPLOAD_FILE', 'file_asset', r.id, null, r, req);
      
      const safeData = r.toJSON();
      if (!req.user!.isPlatformSuperAdmin) delete safeData.storagePath;
      safeData.downloadUrl = `/api/files/${safeData.id}/download`;
      
      res.status(201).json({ file: safeData });
    } catch (err: any) {
      next({ statusCode: 400, message: err.message });
    }
  };

  uploadMultiple = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.files || !Array.isArray(req.files)) throw new Error("No files uploaded");
      const files: any[] = [];
      for (const f of req.files as Express.Multer.File[]) {
        const r = await this.service.saveAssetRecord(req.user!.businessId, req.user!.id, f);
        await AuditLogService.log('UPLOAD_FILE', 'file_asset', r.id, null, r, req);
        
        const safeData = r.toJSON();
        if (!req.user!.isPlatformSuperAdmin) delete safeData.storagePath;
        safeData.downloadUrl = `/api/files/${safeData.id}/download`;
        files.push(safeData);
      }
      res.status(201).json({ files });
    } catch (err: any) {
      next({ statusCode: 400, message: err.message });
    }
  };

  download = async (req: Request, res: Response, next: NextFunction) => {
    const businessId = this.deriveBusinessId(req);
    const asset = await this.service.getById(req.params.id, businessId);
    if (!asset || asset.status !== 'active') return next({ statusCode: 404, message: 'File not found or inactive' });
    
    if (fs.existsSync(asset.storagePath)) {
      res.download(asset.storagePath, asset.originalName);
    } else {
      next({ statusCode: 404, message: 'Physical file missing' });
    }
  };

  remove = async (req: Request, res: Response, next: NextFunction) => {
    const businessId = this.deriveBusinessId(req);
    const ok = await this.service.softDelete(req.params.id, businessId);
    if (!ok) return next({ statusCode: 404, message: 'File not found' });
    await AuditLogService.log('DELETE_FILE', 'file_asset', req.params.id, null, null, req);
    res.json({ ok: true });
  };
}
