const fs = require('fs');
const path = require('path');

const src = path.join(process.cwd(), 'src');
const ensureDir = (dir) => fs.mkdirSync(dir, { recursive: true });

const modelsPath = path.join(src, 'models');

// MODELS
fs.writeFileSync(path.join(modelsPath, 'FileAsset.ts'), `
import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type FileAssetModel = ModelStatic<any> & { associate?: (models: any) => void; };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): FileAssetModel => {
  const FileAsset = sequelize.define("FileAsset", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    businessId: { type: dataTypes.UUID, allowNull: false },
    uploadedByUserId: { type: dataTypes.UUID, allowNull: false },
    originalName: { type: dataTypes.STRING(500), allowNull: false },
    storedName: { type: dataTypes.STRING(500), allowNull: false },
    mimeType: { type: dataTypes.STRING(100), allowNull: false },
    sizeBytes: { type: dataTypes.BIGINT, allowNull: false },
    storageProvider: { type: dataTypes.STRING(50), defaultValue: "local" },
    storagePath: { type: dataTypes.TEXT, allowNull: false },
    publicUrl: { type: dataTypes.TEXT, allowNull: true },
    checksum: { type: dataTypes.STRING(255), allowNull: true },
    status: { type: dataTypes.STRING(50), defaultValue: "active" }, // active, archived, deleted, quarantined
    metadata: { type: dataTypes.JSONB, defaultValue: {} }
  }, { tableName: "file_assets", timestamps: true, paranoid: true }) as FileAssetModel;

  FileAsset.associate = (models: any) => {
    models.FileAsset.belongsTo(models.Business, { foreignKey: "businessId" });
    models.FileAsset.belongsTo(models.User, { foreignKey: "uploadedByUserId", as: "uploadedBy" });
    models.FileAsset.hasMany(models.EntityAttachment, { foreignKey: "fileAssetId" });
  };
  return FileAsset;
};`);

fs.writeFileSync(path.join(modelsPath, 'EntityAttachment.ts'), `
import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type EntityAttachmentModel = ModelStatic<any> & { associate?: (models: any) => void; };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): EntityAttachmentModel => {
  const EntityAttachment = sequelize.define("EntityAttachment", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    businessId: { type: dataTypes.UUID, allowNull: false },
    fileAssetId: { type: dataTypes.UUID, allowNull: false },
    entityType: { type: dataTypes.STRING(120), allowNull: false },
    entityId: { type: dataTypes.STRING(120), allowNull: false },
    moduleKey: { type: dataTypes.STRING(120), allowNull: false },
    attachmentType: { type: dataTypes.STRING(100), allowNull: true }
  }, { tableName: "entity_attachments", timestamps: true, paranoid: true }) as EntityAttachmentModel;

  EntityAttachment.associate = (models: any) => {
    models.EntityAttachment.belongsTo(models.Business, { foreignKey: "businessId" });
    models.EntityAttachment.belongsTo(models.FileAsset, { foreignKey: "fileAssetId" });
  };
  return EntityAttachment;
};`);

// MIDDLEWARE (Multer)
ensureDir(path.join(src, 'middlewares'));
fs.writeFileSync(path.join(src, 'middlewares', 'upload.ts'), `
import multer from 'multer';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';

const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || '10485760', 10); // Default 10MB
const ALLOWED_MIME_TYPES = process.env.ALLOWED_MIME_TYPES ? process.env.ALLOWED_MIME_TYPES.split(',') : ['image/jpeg', 'image/png', 'application/pdf', 'text/csv'];

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Derive structure: /uploads/{businessId}/{moduleKey}/
    const businessId = req.user?.businessId || 'anonymous';
    const moduleKey = req.body.moduleKey || 'general';
    const uploadPath = path.join(process.cwd(), 'uploads', businessId, moduleKey);
    
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const safeName = crypto.randomBytes(16).toString('hex') + ext;
    cb(null, safeName);
  }
});

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type'));
  }
};

export const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter
});
`);

// VALIDATORS
ensureDir(path.join(src, 'validators'));
fs.writeFileSync(path.join(src, 'validators', 'attachment.validator.ts'), `
import Joi from 'joi';
export const attachEntitySchema = Joi.object({
  fileAssetId: Joi.string().uuid().required(),
  entityType: Joi.string().max(120).required(),
  entityId: Joi.string().max(120).required(),
  moduleKey: Joi.string().max(120).required(),
  attachmentType: Joi.string().max(100).allow(null, '').optional()
});
`);

// FILE MODULE
ensureDir(path.join(src, 'modules', 'file'));
fs.writeFileSync(path.join(src, 'modules', 'file', 'file.dal.ts'), `
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
`);

fs.writeFileSync(path.join(src, 'modules', 'file', 'file.service.ts'), `
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
  
  async saveAssetRecord(businessId: string, userId: string, file: Express.Multer.File) {
    return this.dal.create({
      businessId,
      uploadedByUserId: userId,
      originalName: file.originalname,
      storedName: file.filename,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      storageProvider: 'local',
      storagePath: file.path,
      status: 'active'
    });
  }

  softDelete(id: string, businessId: string) { return this.dal.softDelete(id, businessId); }
}
`);

fs.writeFileSync(path.join(src, 'modules', 'file', 'file.controller.ts'), `
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
      d.downloadUrl = \`/api/files/\${d.id}/download\`;
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
      safeData.downloadUrl = \`/api/files/\${safeData.id}/download\`;
      
      res.status(201).json({ file: safeData });
    } catch (err: any) {
      next({ statusCode: 400, message: err.message });
    }
  };

  uploadMultiple = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.files || !Array.isArray(req.files)) throw new Error("No files uploaded");
      const files = [];
      for (const f of req.files as Express.Multer.File[]) {
        const r = await this.service.saveAssetRecord(req.user!.businessId, req.user!.id, f);
        await AuditLogService.log('UPLOAD_FILE', 'file_asset', r.id, null, r, req);
        
        const safeData = r.toJSON();
        if (!req.user!.isPlatformSuperAdmin) delete safeData.storagePath;
        safeData.downloadUrl = \`/api/files/\${safeData.id}/download\`;
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
`);

fs.writeFileSync(path.join(src, 'modules', 'file', 'file.routes.ts'), `
import { Router } from 'express';
import { authRequired } from '../../middlewares/auth';
import { upload } from '../../middlewares/upload';
import { asyncHandler } from '../../utils/asyncHandler';
import { FileController } from './file.controller';

const router = Router();
const controller = new FileController();

router.use(authRequired);
router.get('/', asyncHandler(controller.list));
router.get('/:id/download', asyncHandler(controller.download));
router.post('/upload', upload.single('file'), asyncHandler(controller.uploadSingle));
router.post('/upload/bulk', upload.array('files', 10), asyncHandler(controller.uploadMultiple));
router.delete('/:id', asyncHandler(controller.remove));

export const fileRoutes = router;
`);

// ATTACHMENT MODULE
ensureDir(path.join(src, 'modules', 'attachment'));
fs.writeFileSync(path.join(src, 'modules', 'attachment', 'attachment.dal.ts'), `
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
`);

fs.writeFileSync(path.join(src, 'modules', 'attachment', 'attachment.service.ts'), `
import { AttachmentDAL } from './attachment.dal';

export class AttachmentService {
  private dal = new AttachmentDAL();

  list(businessId: string, entityType: string, entityId: string, page: number, size: number) {
    const offset = (page - 1) * size;
    const query: any = { businessId };
    if (entityType) query.entityType = entityType;
    if (entityId) query.entityId = entityId;
    return this.dal.findAll(query, offset, size);
  }
  
  create(businessId: string, data: any) { return this.dal.create({ ...data, businessId }); }
  softDelete(id: string, businessId: string) { return this.dal.softDelete(id, businessId); }
}
`);

fs.writeFileSync(path.join(src, 'modules', 'attachment', 'attachment.controller.ts'), `
import type { Request, Response, NextFunction } from 'express';
import { AttachmentService } from './attachment.service';
import { AuditLogService } from '../../services/auditLog.service';
export class AttachmentController {
  private service = new AttachmentService();
  private deriveBusinessId(req: Request) { return req.user!.isPlatformSuperAdmin && req.query.businessId ? req.query.businessId as string : req.user!.businessId; }

  list = async (req: Request, res: Response) => {
    const businessId = this.deriveBusinessId(req);
    const entityType = req.query.entityType as string || "";
    const entityId = req.query.entityId as string || "";
    const page = parseInt(req.query.page as string) || 1;
    const size = parseInt(req.query.size as string) || 20;

    res.json(await this.service.list(businessId, entityType, entityId, page, size));
  };
  
  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const businessId = this.deriveBusinessId(req);
      const att = await this.service.create(businessId, req.body);
      await AuditLogService.log('ATTACH_FILE', req.body.entityType, req.body.entityId, null, att, req);
      res.status(201).json({ attachment: att });
    } catch (err: any) {
      next({ statusCode: 400, message: err.message });
    }
  };

  remove = async (req: Request, res: Response, next: NextFunction) => {
    const businessId = this.deriveBusinessId(req);
    const ok = await this.service.softDelete(req.params.id, businessId);
    if (!ok) return next({ statusCode: 404, message: 'Not found' });
    // Assuming we could fetch it prior to log, here simplifying
    await AuditLogService.log('DETACH_FILE', 'entity_attachment', req.params.id, null, null, req);
    res.json({ ok: true });
  };
}
`);

fs.writeFileSync(path.join(src, 'modules', 'attachment', 'attachment.routes.ts'), `
import { Router } from 'express';
import { authRequired } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { attachEntitySchema } from '../../validators/attachment.validator';
import { AttachmentController } from './attachment.controller';

const router = Router();
const controller = new AttachmentController();

router.use(authRequired);
router.get('/', asyncHandler(controller.list));
router.post('/', validate(attachEntitySchema), asyncHandler(controller.create));
router.delete('/:id', asyncHandler(controller.remove));

export const attachmentRoutes = router;
`);

console.log('Files Schema Configured.');
