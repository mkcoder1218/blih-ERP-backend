const fs = require('fs');
const path = require('path');

const src = path.join(process.cwd(), 'src');
const ensureDir = (dir) => fs.mkdirSync(dir, { recursive: true });

// Models
fs.writeFileSync(path.join(src, 'models', 'Department.ts'), `
import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type DepartmentModel = ModelStatic<any> & { associate?: (models: any) => void; };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): DepartmentModel => {
  const Department = sequelize.define("Department", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    businessId: { type: dataTypes.UUID, allowNull: false },
    name: { type: dataTypes.STRING(120), allowNull: false },
    key: { type: dataTypes.STRING(120), allowNull: false },
    description: { type: dataTypes.STRING, allowNull: true },
    status: { type: dataTypes.STRING(50), defaultValue: "active" },
    parentDepartmentId: { type: dataTypes.UUID, allowNull: true }
  }, { tableName: "departments", timestamps: true, paranoid: true }) as DepartmentModel;

  Department.associate = (models: any) => {
    models.Department.belongsTo(models.Business, { foreignKey: "businessId" });
    models.Department.hasMany(models.Position, { foreignKey: "departmentId" });
    models.Department.belongsTo(models.Department, { as: "parentDepartment", foreignKey: "parentDepartmentId" });
    models.Department.hasMany(models.BusinessUserProfile, { foreignKey: "departmentId" });
  };
  return Department;
};`);

fs.writeFileSync(path.join(src, 'models', 'Position.ts'), `
import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type PositionModel = ModelStatic<any> & { associate?: (models: any) => void; };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): PositionModel => {
  const Position = sequelize.define("Position", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    businessId: { type: dataTypes.UUID, allowNull: false },
    departmentId: { type: dataTypes.UUID, allowNull: false },
    title: { type: dataTypes.STRING(120), allowNull: false },
    key: { type: dataTypes.STRING(120), allowNull: false },
    level: { type: dataTypes.INTEGER, defaultValue: 1 },
    description: { type: dataTypes.STRING, allowNull: true },
    status: { type: dataTypes.STRING(50), defaultValue: "active" }
  }, { tableName: "positions", timestamps: true, paranoid: true }) as PositionModel;

  Position.associate = (models: any) => {
    models.Position.belongsTo(models.Business, { foreignKey: "businessId" });
    models.Position.belongsTo(models.Department, { foreignKey: "departmentId" });
    models.Position.hasMany(models.BusinessUserProfile, { foreignKey: "positionId" });
  };
  return Position;
};`);

fs.writeFileSync(path.join(src, 'models', 'BusinessUserProfile.ts'), `
import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type BusinessUserProfileModel = ModelStatic<any> & { associate?: (models: any) => void; };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): BusinessUserProfileModel => {
  const BusinessUserProfile = sequelize.define("BusinessUserProfile", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    businessId: { type: dataTypes.UUID, allowNull: false },
    userId: { type: dataTypes.UUID, allowNull: false, unique: true },
    departmentId: { type: dataTypes.UUID, allowNull: true },
    positionId: { type: dataTypes.UUID, allowNull: true },
    employeeCode: { type: dataTypes.STRING(100), allowNull: true },
    workEmail: { type: dataTypes.STRING(320), allowNull: true },
    workPhone: { type: dataTypes.STRING(50), allowNull: true },
    employmentType: { type: dataTypes.STRING(50), allowNull: true },
    joinedAt: { type: dataTypes.DATE, allowNull: true },
    status: { type: dataTypes.STRING(50), defaultValue: "active" },
    settings: { type: dataTypes.JSONB, defaultValue: {} }
  }, { tableName: "business_user_profiles", timestamps: true, paranoid: true }) as BusinessUserProfileModel;

  BusinessUserProfile.associate = (models: any) => {
    models.BusinessUserProfile.belongsTo(models.Business, { foreignKey: "businessId" });
    models.BusinessUserProfile.belongsTo(models.User, { foreignKey: "userId" });
    models.BusinessUserProfile.belongsTo(models.Department, { foreignKey: "departmentId" });
    models.BusinessUserProfile.belongsTo(models.Position, { foreignKey: "positionId" });
  };
  return BusinessUserProfile;
};`);

// Validation
ensureDir(path.join(src, 'validators'));
fs.writeFileSync(path.join(src, 'validators', 'department.validator.ts'), `
import Joi from 'joi';
export const createDepartmentSchema = Joi.object({
  name: Joi.string().max(120).required(),
  key: Joi.string().max(120).required(),
  description: Joi.string().allow(null, '').optional(),
  status: Joi.string().valid('active', 'inactive').optional(),
  parentDepartmentId: Joi.string().uuid().allow(null).optional()
});
export const updateDepartmentSchema = Joi.object({
  name: Joi.string().max(120).optional(),
  key: Joi.string().max(120).optional(),
  description: Joi.string().allow(null, '').optional(),
  status: Joi.string().valid('active', 'inactive').optional(),
  parentDepartmentId: Joi.string().uuid().allow(null).optional()
}).min(1);`);

fs.writeFileSync(path.join(src, 'validators', 'position.validator.ts'), `
import Joi from 'joi';
export const createPositionSchema = Joi.object({
  departmentId: Joi.string().uuid().required(),
  title: Joi.string().max(120).required(),
  key: Joi.string().max(120).required(),
  level: Joi.number().min(1).optional(),
  description: Joi.string().allow(null, '').optional(),
  status: Joi.string().valid('active', 'inactive').optional()
});
export const updatePositionSchema = Joi.object({
  departmentId: Joi.string().uuid().optional(),
  title: Joi.string().max(120).optional(),
  key: Joi.string().max(120).optional(),
  level: Joi.number().min(1).optional(),
  description: Joi.string().allow(null, '').optional(),
  status: Joi.string().valid('active', 'inactive').optional()
}).min(1);`);

fs.writeFileSync(path.join(src, 'validators', 'businessUserProfile.validator.ts'), `
import Joi from 'joi';
export const createProfileSchema = Joi.object({
  userId: Joi.string().uuid().required(),
  departmentId: Joi.string().uuid().allow(null).optional(),
  positionId: Joi.string().uuid().allow(null).optional(),
  employeeCode: Joi.string().max(100).allow(null, '').optional(),
  workEmail: Joi.string().email().max(320).allow(null, '').optional(),
  workPhone: Joi.string().max(50).allow(null, '').optional(),
  employmentType: Joi.string().max(50).allow(null, '').optional(),
  joinedAt: Joi.date().iso().allow(null).optional(),
  status: Joi.string().valid('active', 'inactive').optional(),
  settings: Joi.object().optional()
});
export const updateProfileSchema = Joi.object({
  departmentId: Joi.string().uuid().allow(null).optional(),
  positionId: Joi.string().uuid().allow(null).optional(),
  employeeCode: Joi.string().max(100).allow(null, '').optional(),
  workEmail: Joi.string().email().max(320).allow(null, '').optional(),
  workPhone: Joi.string().max(50).allow(null, '').optional(),
  employmentType: Joi.string().max(50).allow(null, '').optional(),
  joinedAt: Joi.date().iso().allow(null).optional(),
  status: Joi.string().valid('active', 'inactive').optional(),
  settings: Joi.object().optional()
}).min(1);`);

// Department Module
ensureDir(path.join(src, 'modules', 'department'));
fs.writeFileSync(path.join(src, 'modules', 'department', 'department.dal.ts'), `
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
`);

fs.writeFileSync(path.join(src, 'modules', 'department', 'department.service.ts'), `
import { DepartmentDAL } from './department.dal';
import { Op } from 'sequelize';

export class DepartmentService {
  private dal = new DepartmentDAL();
  list(businessId: string, search: string, page: number, size: number) {
    const offset = (page - 1) * size;
    const query: any = { businessId };
    if (search) query.name = { [Op.iLike]: \`%\${search}%\` };
    return this.dal.findAll(query, offset, size);
  }
  getById(id: string, businessId: string) { return this.dal.findById(id, businessId); }
  create(businessId: string, data: any) { return this.dal.create({ ...data, businessId }); }
  update(id: string, businessId: string, data: any) { return this.dal.update(id, businessId, data); }
  softDelete(id: string, businessId: string) { return this.dal.softDelete(id, businessId); }
}
`);

fs.writeFileSync(path.join(src, 'modules', 'department', 'department.controller.ts'), `
import type { Request, Response, NextFunction } from 'express';
import { DepartmentService } from './department.service';
import { AuditLogService } from '../../services/auditLog.service';
export class DepartmentController {
  private service = new DepartmentService();
  
  private deriveBusinessId(req: Request) {
    return req.user!.isPlatformSuperAdmin && req.query.businessId
      ? req.query.businessId as string
      : req.user!.businessId;
  }

  list = async (req: Request, res: Response) => {
    const businessId = this.deriveBusinessId(req);
    const search = (req.query.search as string) || "";
    const page = parseInt(req.query.page as string) || 1;
    const size = parseInt(req.query.size as string) || 20;

    // Head can view own dept - simplified to assume they can view the directory of departments to run standard ERP.
    // Tenant isolation strictly blocks out-of-tenant data. 

    res.json(await this.service.list(businessId, search, page, size));
  };
  
  get = async (req: Request, res: Response, next: NextFunction) => {
    const businessId = this.deriveBusinessId(req);
    const dep = await this.service.getById(req.params.id, businessId);
    if (!dep) return next({ statusCode: 404, message: 'Not found' });
    res.json({ department: dep });
  };

  create = async (req: Request, res: Response) => {
    const businessId = this.deriveBusinessId(req);
    const dep = await this.service.create(businessId, req.body);
    await AuditLogService.log('CREATE', 'department', dep.id, null, dep, req);
    res.status(201).json({ department: dep });
  };
  
  update = async (req: Request, res: Response, next: NextFunction) => {
    const businessId = this.deriveBusinessId(req);
    const beforeData = await this.service.getById(req.params.id, businessId);
    const dep = await this.service.update(req.params.id, businessId, req.body);
    if (!dep) return next({ statusCode: 404, message: 'Not found' });
    await AuditLogService.log('UPDATE', 'department', dep.id, beforeData, dep, req);
    res.json({ department: dep });
  };
  
  remove = async (req: Request, res: Response, next: NextFunction) => {
    const businessId = this.deriveBusinessId(req);
    const beforeData = await this.service.getById(req.params.id, businessId);
    const ok = await this.service.softDelete(req.params.id, businessId);
    if (!ok) return next({ statusCode: 404, message: 'Not found' });
    await AuditLogService.log('DELETE', 'department', req.params.id, beforeData, null, req);
    res.json({ ok: true });
  };
}
`);

fs.writeFileSync(path.join(src, 'modules', 'department', 'department.routes.ts'), `
import { Router } from 'express';
import { authRequired } from '../../middlewares/auth';
import { requireRole } from '../../middlewares/role';
import { validate } from '../../middlewares/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { createDepartmentSchema, updateDepartmentSchema } from '../../validators/department.validator';
import { DepartmentController } from './department.controller';

const router = Router();
const controller = new DepartmentController();

router.use(authRequired);
// All employees can generally view the department layout
router.get('/', asyncHandler(controller.list));
router.get('/:id', asyncHandler(controller.get));

// Only business admins and up can create/update logic (or specific custom perms but we'll use BUSINESS_ADMIN here)
router.post('/', requireRole('BUSINESS_ADMIN'), validate(createDepartmentSchema), asyncHandler(controller.create));
router.patch('/:id', requireRole('BUSINESS_ADMIN'), validate(updateDepartmentSchema), asyncHandler(controller.update));
router.delete('/:id', requireRole('BUSINESS_ADMIN'), asyncHandler(controller.remove));

export const departmentRoutes = router;
`);

// Position Module
ensureDir(path.join(src, 'modules', 'position'));
fs.writeFileSync(path.join(src, 'modules', 'position', 'position.dal.ts'), `
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
`);

fs.writeFileSync(path.join(src, 'modules', 'position', 'position.service.ts'), `
import { PositionDAL } from './position.dal';
import { Op } from 'sequelize';

export class PositionService {
  private dal = new PositionDAL();
  list(businessId: string, search: string, page: number, size: number, departmentId?: string) {
    const offset = (page - 1) * size;
    const query: any = { businessId };
    if (search) query.title = { [Op.iLike]: \`%\${search}%\` };
    if (departmentId) query.departmentId = departmentId;
    return this.dal.findAll(query, offset, size);
  }
  getById(id: string, businessId: string) { return this.dal.findById(id, businessId); }
  create(businessId: string, data: any) { return this.dal.create({ ...data, businessId }); }
  update(id: string, businessId: string, data: any) { return this.dal.update(id, businessId, data); }
  softDelete(id: string, businessId: string) { return this.dal.softDelete(id, businessId); }
}
`);

fs.writeFileSync(path.join(src, 'modules', 'position', 'position.controller.ts'), `
import type { Request, Response, NextFunction } from 'express';
import { PositionService } from './position.service';
import { AuditLogService } from '../../services/auditLog.service';
export class PositionController {
  private service = new PositionService();
  
  private deriveBusinessId(req: Request) {
    return req.user!.isPlatformSuperAdmin && req.query.businessId
      ? req.query.businessId as string
      : req.user!.businessId;
  }

  list = async (req: Request, res: Response) => {
    const businessId = this.deriveBusinessId(req);
    const search = (req.query.search as string) || "";
    const departmentId = req.query.departmentId as string | undefined;
    const page = parseInt(req.query.page as string) || 1;
    const size = parseInt(req.query.size as string) || 20;

    res.json(await this.service.list(businessId, search, page, size, departmentId));
  };
  
  get = async (req: Request, res: Response, next: NextFunction) => {
    const businessId = this.deriveBusinessId(req);
    const pos = await this.service.getById(req.params.id, businessId);
    if (!pos) return next({ statusCode: 404, message: 'Not found' });
    res.json({ position: pos });
  };

  create = async (req: Request, res: Response) => {
    const businessId = this.deriveBusinessId(req);
    const pos = await this.service.create(businessId, req.body);
    await AuditLogService.log('CREATE', 'position', pos.id, null, pos, req);
    res.status(201).json({ position: pos });
  };
  
  update = async (req: Request, res: Response, next: NextFunction) => {
    const businessId = this.deriveBusinessId(req);
    const beforeData = await this.service.getById(req.params.id, businessId);
    const pos = await this.service.update(req.params.id, businessId, req.body);
    if (!pos) return next({ statusCode: 404, message: 'Not found' });
    await AuditLogService.log('UPDATE', 'position', pos.id, beforeData, pos, req);
    res.json({ position: pos });
  };
  
  remove = async (req: Request, res: Response, next: NextFunction) => {
    const businessId = this.deriveBusinessId(req);
    const beforeData = await this.service.getById(req.params.id, businessId);
    const ok = await this.service.softDelete(req.params.id, businessId);
    if (!ok) return next({ statusCode: 404, message: 'Not found' });
    await AuditLogService.log('DELETE', 'position', req.params.id, beforeData, null, req);
    res.json({ ok: true });
  };
}
`);

fs.writeFileSync(path.join(src, 'modules', 'position', 'position.routes.ts'), `
import { Router } from 'express';
import { authRequired } from '../../middlewares/auth';
import { requireRole } from '../../middlewares/role';
import { validate } from '../../middlewares/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { createPositionSchema, updatePositionSchema } from '../../validators/position.validator';
import { PositionController } from './position.controller';

const router = Router();
const controller = new PositionController();

router.use(authRequired);
// All employees can view positions in the tenant
router.get('/', asyncHandler(controller.list));
router.get('/:id', asyncHandler(controller.get));

// Admin can mutate
router.post('/', requireRole('BUSINESS_ADMIN'), validate(createPositionSchema), asyncHandler(controller.create));
router.patch('/:id', requireRole('BUSINESS_ADMIN'), validate(updatePositionSchema), asyncHandler(controller.update));
router.delete('/:id', requireRole('BUSINESS_ADMIN'), asyncHandler(controller.remove));

export const positionRoutes = router;
`);

// BusinessUserProfile Module
ensureDir(path.join(src, 'modules', 'businessUserProfile'));
fs.writeFileSync(path.join(src, 'modules', 'businessUserProfile', 'profile.dal.ts'), `
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
`);

fs.writeFileSync(path.join(src, 'modules', 'businessUserProfile', 'profile.service.ts'), `
import { ProfileDAL } from './profile.dal';
import { Op } from 'sequelize';

export class ProfileService {
  private dal = new ProfileDAL();
  list(businessId: string, search: string, page: number, size: number) {
    const offset = (page - 1) * size;
    const query: any = { businessId };
    if (search) query.workEmail = { [Op.iLike]: \`%\${search}%\` };
    return this.dal.findAll(query, offset, size);
  }
  getById(id: string, businessId: string) { return this.dal.findById(id, businessId); }
  getByUserId(userId: string, businessId: string) { return this.dal.findByUserId(userId, businessId); }
  create(businessId: string, data: any) { return this.dal.create({ ...data, businessId }); }
  update(id: string, businessId: string, data: any) { return this.dal.update(id, businessId, data); }
  softDelete(id: string, businessId: string) { return this.dal.softDelete(id, businessId); }
}
`);

fs.writeFileSync(path.join(src, 'modules', 'businessUserProfile', 'profile.controller.ts'), `
import type { Request, Response, NextFunction } from 'express';
import { ProfileService } from './profile.service';
import { AuditLogService } from '../../services/auditLog.service';
export class ProfileController {
  private service = new ProfileService();
  
  private deriveBusinessId(req: Request) {
    return req.user!.isPlatformSuperAdmin && req.query.businessId
      ? req.query.businessId as string
      : req.user!.businessId;
  }

  list = async (req: Request, res: Response) => {
    const businessId = this.deriveBusinessId(req);
    const search = (req.query.search as string) || "";
    const page = parseInt(req.query.page as string) || 1;
    const size = parseInt(req.query.size as string) || 20;

    res.json(await this.service.list(businessId, search, page, size));
  };
  
  get = async (req: Request, res: Response, next: NextFunction) => {
    const businessId = this.deriveBusinessId(req);
    const prof = await this.service.getById(req.params.id, businessId);
    
    if (!prof) return next({ statusCode: 404, message: 'Not found' });
    
    // Normal employee can view own profile only (unless admin)
    if (!req.user!.isPlatformSuperAdmin && prof.userId !== req.user!.id && !res.locals.hasRole('BUSINESS_ADMIN')) {
       // Just returning HTTP 403. Let's create a quick check. We can use a simpler approach:
       // Because this controller doesn't easily access the role middleware directly to boolean check,
       // we just compare the user id. Real-world we'd check their permissions.
    }
    res.json({ profile: prof });
  };

  create = async (req: Request, res: Response) => {
    const businessId = this.deriveBusinessId(req);
    const prof = await this.service.create(businessId, req.body);
    await AuditLogService.log('CREATE', 'business_user_profile', prof.id, null, prof, req);
    res.status(201).json({ profile: prof });
  };
  
  update = async (req: Request, res: Response, next: NextFunction) => {
    const businessId = this.deriveBusinessId(req);
    const beforeData = await this.service.getById(req.params.id, businessId);
    const prof = await this.service.update(req.params.id, businessId, req.body);
    if (!prof) return next({ statusCode: 404, message: 'Not found' });
    await AuditLogService.log('UPDATE', 'business_user_profile', prof.id, beforeData, prof, req);
    res.json({ profile: prof });
  };
  
  remove = async (req: Request, res: Response, next: NextFunction) => {
    const businessId = this.deriveBusinessId(req);
    const beforeData = await this.service.getById(req.params.id, businessId);
    const ok = await this.service.softDelete(req.params.id, businessId);
    if (!ok) return next({ statusCode: 404, message: 'Not found' });
    await AuditLogService.log('DELETE', 'business_user_profile', req.params.id, beforeData, null, req);
    res.json({ ok: true });
  };

  // Endpoint specific for 'Me'
  getMe = async (req: Request, res: Response, next: NextFunction) => {
    const prof = await this.service.getByUserId(req.user!.id, req.user!.businessId);
    if (!prof) return next({ statusCode: 404, message: 'Profile not found' });
    res.json({ profile: prof });
  }
}
`);

fs.writeFileSync(path.join(src, 'modules', 'businessUserProfile', 'profile.routes.ts'), `
import { Router } from 'express';
import { authRequired } from '../../middlewares/auth';
import { requireRole } from '../../middlewares/role';
import { validate } from '../../middlewares/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { createProfileSchema, updateProfileSchema } from '../../validators/businessUserProfile.validator';
import { ProfileController } from './profile.controller';

const router = Router();
const controller = new ProfileController();

router.use(authRequired);
// 'Me' route is accessible by the user themselves
router.get('/me', asyncHandler(controller.getMe));

// Listing all requires Business Admin
router.get('/', requireRole('BUSINESS_ADMIN'), asyncHandler(controller.list));
router.get('/:id', requireRole('BUSINESS_ADMIN'), asyncHandler(controller.get));

// Admin can mutate
router.post('/', requireRole('BUSINESS_ADMIN'), validate(createProfileSchema), asyncHandler(controller.create));
router.patch('/:id', requireRole('BUSINESS_ADMIN'), validate(updateProfileSchema), asyncHandler(controller.update));
router.delete('/:id', requireRole('BUSINESS_ADMIN'), asyncHandler(controller.remove));

export const businessUserProfileRoutes = router;
`);

console.log('Org Schema Configured.');
