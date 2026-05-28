
import type { Request, Response, NextFunction } from 'express';
import { FileService } from './file.service';
import { AuditLogService } from '../../services/auditLog.service';
import path from 'path';
import fs from 'fs';
import { signDownloadToken, verifyDownloadToken } from '../../utils/jwt';

export class FileController {
  private service = new FileService();

  private deriveBusinessId(req: Request) { return req.user!.isPlatformSuperAdmin && req.query.businessId ? req.query.businessId as string : req.user!.businessId; }

  list = async (req: Request, res: Response) => {
    const businessId = this.deriveBusinessId(req);
    const moduleKey = req.query.moduleKey as string || "";
    const page = parseInt(req.query.page as string) || 1;
    const size = parseInt(req.query.size as string) || 20;

    const data = await this.service.list(businessId, moduleKey, page, size);
    
    const safeData = data.rows.map((r: any) => {
      const d = r.toJSON();
      if (!req.user!.isPlatformSuperAdmin) delete d.storagePath;
      d.downloadUrl = `/api/files/${d.id}/download`;
      return d;
    });

    res.json({ count: data.count, rows: safeData });
  };

  /** Issue a short-lived (60s) signed download token for a file. Requires auth. */
  getDownloadToken = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const businessId = this.deriveBusinessId(req);
      const asset = await this.service.getById(req.params.id, businessId);
      if (!asset || asset.status !== 'active') return next({ statusCode: 404, message: 'File not found or inactive' });
      const token = signDownloadToken(req.user!.id, businessId, asset.id);
      res.json({ token });
    } catch (err: any) {
      next({ statusCode: 500, message: err.message });
    }
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
    try {
      let fileId = req.params.id;
      let businessId: string;

      // Support token-based download (no Authorization header needed — works with IDM/browser direct open)
      const queryToken = req.query.token as string | undefined;
      if (queryToken) {
        const payload = verifyDownloadToken(queryToken);
        if (payload.fileId !== fileId) return next({ statusCode: 403, message: 'Token does not match file' });
        businessId = payload.businessId;
      } else {
        // Fallback to normal auth (req.user set by authRequired middleware)
        if (!req.user) return next({ statusCode: 401, message: 'Missing access token' });
        businessId = this.deriveBusinessId(req);
      }

      console.log(`[DOWNLOAD] id=${fileId} businessId=${businessId} origin=${req.headers.origin ?? 'none'}`);

      const asset = await this.service.getById(fileId, businessId);
      console.log(`[DOWNLOAD] asset=${JSON.stringify(asset ? { id: asset.id, status: asset.status, storagePath: asset.storagePath } : null)}`);
      if (!asset || asset.status !== 'active') return next({ statusCode: 404, message: 'File not found or inactive' });

      if (!fs.existsSync(asset.storagePath)) {
        console.log(`[DOWNLOAD] physical file missing at path: ${asset.storagePath}`);
        return next({ statusCode: 404, message: 'Physical file missing' });
      }

      const origin = req.headers.origin;
      if (origin) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
      }
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(asset.originalName)}"`);
      res.setHeader('Content-Type', 'application/octet-stream');

      const fileStream = fs.createReadStream(asset.storagePath);
      fileStream.on('error', (err) => {
        console.error('[DOWNLOAD] stream error:', err);
        next({ statusCode: 500, message: 'Failed to stream file' });
      });
      fileStream.pipe(res);
    } catch (err: any) {
      next({ statusCode: 401, message: err.message || 'Invalid download token' });
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
