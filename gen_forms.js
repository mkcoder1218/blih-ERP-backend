const fs = require('fs');
const path = require('path');

const src = path.join(process.cwd(), 'src');
const ensureDir = (dir) => fs.mkdirSync(dir, { recursive: true });

const modelsPath = path.join(src, 'models');

// MODELS
fs.writeFileSync(path.join(modelsPath, 'FormDefinition.ts'), `
import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type FormDefinitionModel = ModelStatic<any> & { associate?: (models: any) => void; };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): FormDefinitionModel => {
  const FormDefinition = sequelize.define("FormDefinition", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    businessId: { type: dataTypes.UUID, allowNull: false },
    moduleKey: { type: dataTypes.STRING(120), allowNull: false },
    name: { type: dataTypes.STRING(200), allowNull: false },
    key: { type: dataTypes.STRING(120), allowNull: false },
    description: { type: dataTypes.TEXT, allowNull: true },
    status: { type: dataTypes.STRING(50), defaultValue: "active" }, // active, inactive, archived
    requiresApproval: { type: dataTypes.BOOLEAN, defaultValue: false },
    approvalWorkflowId: { type: dataTypes.UUID, allowNull: true },
    settings: { type: dataTypes.JSONB, defaultValue: {} }
  }, { tableName: "form_definitions", timestamps: true, paranoid: true }) as FormDefinitionModel;

  FormDefinition.associate = (models: any) => {
    models.FormDefinition.belongsTo(models.Business, { foreignKey: "businessId" });
    if (models.ApprovalWorkflow) models.FormDefinition.belongsTo(models.ApprovalWorkflow, { foreignKey: "approvalWorkflowId" });
    models.FormDefinition.hasMany(models.FormField, { foreignKey: "formDefinitionId", as: "fields" });
    models.FormDefinition.hasMany(models.FormSubmission, { foreignKey: "formDefinitionId" });
  };
  return FormDefinition;
};`);

fs.writeFileSync(path.join(modelsPath, 'FormField.ts'), `
import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type FormFieldModel = ModelStatic<any> & { associate?: (models: any) => void; };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): FormFieldModel => {
  const FormField = sequelize.define("FormField", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    businessId: { type: dataTypes.UUID, allowNull: false },
    formDefinitionId: { type: dataTypes.UUID, allowNull: false },
    label: { type: dataTypes.STRING(200), allowNull: false },
    key: { type: dataTypes.STRING(120), allowNull: false },
    type: { type: dataTypes.STRING(50), allowNull: false }, // text, textarea, number, etc.
    required: { type: dataTypes.BOOLEAN, defaultValue: false },
    options: { type: dataTypes.JSONB, defaultValue: [] },
    validationRules: { type: dataTypes.JSONB, defaultValue: {} },
    orderIndex: { type: dataTypes.INTEGER, defaultValue: 0 },
    visibilityRules: { type: dataTypes.JSONB, defaultValue: {} },
    settings: { type: dataTypes.JSONB, defaultValue: {} }
  }, { tableName: "form_fields", timestamps: true, paranoid: true }) as FormFieldModel;

  FormField.associate = (models: any) => {
    models.FormField.belongsTo(models.Business, { foreignKey: "businessId" });
    models.FormField.belongsTo(models.FormDefinition, { foreignKey: "formDefinitionId" });
  };
  return FormField;
};`);

fs.writeFileSync(path.join(modelsPath, 'FormSubmission.ts'), `
import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type FormSubmissionModel = ModelStatic<any> & { associate?: (models: any) => void; };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): FormSubmissionModel => {
  const FormSubmission = sequelize.define("FormSubmission", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    businessId: { type: dataTypes.UUID, allowNull: false },
    formDefinitionId: { type: dataTypes.UUID, allowNull: false },
    submittedByUserId: { type: dataTypes.UUID, allowNull: false },
    entityType: { type: dataTypes.STRING(120), allowNull: true },
    entityId: { type: dataTypes.STRING(120), allowNull: true },
    data: { type: dataTypes.JSONB, defaultValue: {} },
    status: { type: dataTypes.STRING(50), defaultValue: "draft" }, // draft, submitted, approved, rejected, returned, cancelled
    approvalRequestId: { type: dataTypes.UUID, allowNull: true }
  }, { tableName: "form_submissions", timestamps: true, paranoid: true }) as FormSubmissionModel;

  FormSubmission.associate = (models: any) => {
    models.FormSubmission.belongsTo(models.Business, { foreignKey: "businessId" });
    models.FormSubmission.belongsTo(models.FormDefinition, { foreignKey: "formDefinitionId" });
    models.FormSubmission.belongsTo(models.User, { foreignKey: "submittedByUserId", as: "submittedBy" });
    if (models.ApprovalRequest) models.FormSubmission.belongsTo(models.ApprovalRequest, { foreignKey: "approvalRequestId" });
  };
  return FormSubmission;
};`);

// VALIDATORS
ensureDir(path.join(src, 'validators'));
fs.writeFileSync(path.join(src, 'validators', 'formDefinition.validator.ts'), `
import Joi from 'joi';
export const createFormDefSchema = Joi.object({
  name: Joi.string().max(200).required(),
  key: Joi.string().max(120).required(),
  moduleKey: Joi.string().max(120).required(),
  description: Joi.string().allow(null, '').optional(),
  status: Joi.string().valid('active', 'inactive', 'archived').optional(),
  requiresApproval: Joi.boolean().optional(),
  approvalWorkflowId: Joi.string().uuid().allow(null).optional(),
  settings: Joi.object().optional()
});

export const createFormFieldSchema = Joi.object({
  formDefinitionId: Joi.string().uuid().required(),
  label: Joi.string().max(200).required(),
  key: Joi.string().max(120).required(),
  type: Joi.string().max(50).required(),
  required: Joi.boolean().optional(),
  options: Joi.array().allow(null).optional(),
  validationRules: Joi.object().optional(),
  orderIndex: Joi.number().optional(),
  visibilityRules: Joi.object().optional(),
  settings: Joi.object().optional()
});
`);

fs.writeFileSync(path.join(src, 'validators', 'formSubmission.validator.ts'), `
import Joi from 'joi';
export const submitDataSchema = Joi.object({
  formDefinitionId: Joi.string().uuid().required(),
  entityType: Joi.string().max(120).allow(null, '').optional(),
  entityId: Joi.string().max(120).allow(null, '').optional(),
  data: Joi.object().required(),
  status: Joi.string().valid('draft', 'submitted').required()
});
`);

// FORM DEFINITION MODULE
ensureDir(path.join(src, 'modules', 'formDefinition'));
fs.writeFileSync(path.join(src, 'modules', 'formDefinition', 'definition.dal.ts'), `
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
`);

fs.writeFileSync(path.join(src, 'modules', 'formDefinition', 'definition.service.ts'), `
import { DefinitionDAL } from './definition.dal';
import { Op } from 'sequelize';

export class DefinitionService {
  private dal = new DefinitionDAL();
  list(businessId: string, search: string, page: number, size: number) {
    const offset = (page - 1) * size;
    const query: any = { businessId };
    if (search) query.name = { [Op.iLike]: \`%\${search}%\` };
    return this.dal.findAll(query, offset, size);
  }
  getById(id: string, businessId: string) { return this.dal.findById(id, businessId); }
  create(businessId: string, data: any) { return this.dal.create({ ...data, businessId }); }
  update(id: string, businessId: string, data: any) { return this.dal.update(id, businessId, data); }
  createField(businessId: string, data: any) { return this.dal.createField({ ...data, businessId }); }
  updateField(id: string, businessId: string, data: any) { return this.dal.updateField(id, businessId, data); }
  deleteField(id: string, businessId: string) { return this.dal.deleteField(id, businessId); }
}
`);

fs.writeFileSync(path.join(src, 'modules', 'formDefinition', 'definition.controller.ts'), `
import type { Request, Response, NextFunction } from 'express';
import { DefinitionService } from './definition.service';
import { AuditLogService } from '../../services/auditLog.service';
export class DefinitionController {
  private service = new DefinitionService();
  private deriveBusinessId(req: Request) { return req.user!.isPlatformSuperAdmin && req.query.businessId ? req.query.businessId as string : req.user!.businessId; }

  list = async (req: Request, res: Response) => {
    const businessId = this.deriveBusinessId(req);
    const search = req.query.search as string || "";
    const page = parseInt(req.query.page as string) || 1;
    const size = parseInt(req.query.size as string) || 20;
    res.json(await this.service.list(businessId, search, page, size));
  };
  get = async (req: Request, res: Response, next: NextFunction) => {
    const businessId = this.deriveBusinessId(req);
    const def = await this.service.getById(req.params.id, businessId);
    if (!def) return next({ statusCode: 404, message: 'Not found' });
    res.json({ definition: def });
  };
  create = async (req: Request, res: Response) => {
    const businessId = this.deriveBusinessId(req);
    const def = await this.service.create(businessId, req.body);
    await AuditLogService.log('CREATE', 'form_definition', def.id, null, def, req);
    res.status(201).json({ definition: def });
  };
  update = async (req: Request, res: Response, next: NextFunction) => {
    const businessId = this.deriveBusinessId(req);
    const def = await this.service.update(req.params.id, businessId, req.body);
    if (!def) return next({ statusCode: 404, message: 'Not found' });
    res.json({ definition: def });
  };
  createField = async (req: Request, res: Response) => {
    const businessId = this.deriveBusinessId(req);
    const field = await this.service.createField(businessId, req.body);
    await AuditLogService.log('CREATE', 'form_field', field.id, null, field, req);
    res.status(201).json({ field });
  };
  updateField = async (req: Request, res: Response, next: NextFunction) => {
    const businessId = this.deriveBusinessId(req);
    const field = await this.service.updateField(req.params.id, businessId, req.body);
    if (!field) return next({ statusCode: 404, message: 'Not found' });
    res.json({ field });
  };
}
`);

fs.writeFileSync(path.join(src, 'modules', 'formDefinition', 'definition.routes.ts'), `
import { Router } from 'express';
import { authRequired } from '../../middlewares/auth';
import { requireRole } from '../../middlewares/role';
import { validate } from '../../middlewares/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { createFormDefSchema, createFormFieldSchema } from '../../validators/formDefinition.validator';
import { DefinitionController } from './definition.controller';

const router = Router();
const controller = new DefinitionController();
router.use(authRequired);
// List for submitting
router.get('/', asyncHandler(controller.list));
router.get('/:id', asyncHandler(controller.get));
// Design bounds
router.post('/', requireRole('BUSINESS_ADMIN'), validate(createFormDefSchema), asyncHandler(controller.create));
router.patch('/:id', requireRole('BUSINESS_ADMIN'), asyncHandler(controller.update));
router.post('/fields', requireRole('BUSINESS_ADMIN'), validate(createFormFieldSchema), asyncHandler(controller.createField));
router.patch('/fields/:id', requireRole('BUSINESS_ADMIN'), asyncHandler(controller.updateField));
export const formDefinitionRoutes = router;
`);

// FORM SUBMISSION MODULE
ensureDir(path.join(src, 'modules', 'formSubmission'));
fs.writeFileSync(path.join(src, 'modules', 'formSubmission', 'submission.dal.ts'), `
import { db } from '../../models';
export class SubmissionDAL {
  findAll(query: any, offset: number, limit: number) { 
    return db.FormSubmission.findAndCountAll({ where: query, offset, limit, order: [['createdAt', 'DESC']] }); 
  }
  findById(id: string, businessId: string) { return db.FormSubmission.findOne({ where: { id, businessId } }); }
  create(data: any) { return db.FormSubmission.create(data); }
  async getFormDefinition(id: string, businessId: string) {
    return db.FormDefinition.findOne({ where: { id, businessId, status: 'active' }, include: ['fields'] });
  }
}
`);

fs.writeFileSync(path.join(src, 'modules', 'formSubmission', 'submission.service.ts'), `
import { SubmissionDAL } from './submission.dal';
import { db } from '../../models';
import { Op } from 'sequelize';

export class SubmissionService {
  private dal = new SubmissionDAL();

  list(businessId: string, userId: string, isCreator: boolean, statusFilter: string, page: number, size: number) {
    const offset = (page - 1) * size;
    const query: any = { businessId };
    if (isCreator) query.submittedByUserId = userId;
    if (statusFilter) query.status = statusFilter;
    return this.dal.findAll(query, offset, size);
  }

  getById(id: string, businessId: string) { return this.dal.findById(id, businessId); }

  async submit(businessId: string, userId: string, payload: any) {
    const def = await this.dal.getFormDefinition(payload.formDefinitionId, businessId);
    if (!def) throw new Error("Form Definition invalid or inactive");

    // Dynamic Validation
    if (payload.status === 'submitted') {
      for (const field of def.fields) {
        if (field.required) {
          const val = payload.data[field.key];
          if (val === undefined || val === null || val === '') {
            throw new Error(\`Field '\${field.label}' is required.\`);
          }
        }
      }
    }

    const sub = await this.dal.create({
      businessId,
      formDefinitionId: def.id,
      submittedByUserId: userId,
      entityType: payload.entityType || null,
      entityId: payload.entityId || null,
      data: payload.data,
      status: payload.status
    });

    // Approval Triggering
    if (payload.status === 'submitted' && def.requiresApproval && def.approvalWorkflowId) {
      const firstStep = await db.ApprovalStep.findOne({ where: { workflowId: def.approvalWorkflowId }, order: [['stepOrder', 'ASC']] });
      if (firstStep) {
        const req = await db.ApprovalRequest.create({
          businessId,
          workflowId: def.approvalWorkflowId,
          entityType: 'form_submission',
          entityId: sub.id,
          requestedByUserId: userId,
          currentStepId: firstStep.id,
          status: 'pending',
          submittedData: payload.data
        });
        await sub.update({ approvalRequestId: req.id });
      }
    }

    return sub;
  }
}
`);

fs.writeFileSync(path.join(src, 'modules', 'formSubmission', 'submission.controller.ts'), `
import type { Request, Response, NextFunction } from 'express';
import { SubmissionService } from './submission.service';
import { AuditLogService } from '../../services/auditLog.service';
export class SubmissionController {
  private service = new SubmissionService();

  listMine = async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const size = parseInt(req.query.size as string) || 20;
    const statusFilter = req.query.status as string || "";
    res.json(await this.service.list(req.user!.businessId, req.user!.id, true, statusFilter, page, size));
  };
  
  get = async (req: Request, res: Response, next: NextFunction) => {
    const sub = await this.service.getById(req.params.id, req.user!.businessId);
    if (!sub) return next({ statusCode: 404, message: 'Not found' });
    res.json({ submission: sub });
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const sub = await this.service.submit(req.user!.businessId, req.user!.id, req.body);
      await AuditLogService.log('SUBMIT_FORM', 'form_submission', sub.id, null, sub, req);
      res.status(201).json({ submission: sub });
    } catch (err: any) {
      next({ statusCode: 400, message: err.message });
    }
  };
}
`);

fs.writeFileSync(path.join(src, 'modules', 'formSubmission', 'submission.routes.ts'), `
import { Router } from 'express';
import { authRequired } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { submitDataSchema } from '../../validators/formSubmission.validator';
import { SubmissionController } from './submission.controller';

const router = Router();
const controller = new SubmissionController();
router.use(authRequired);
router.get('/mine', asyncHandler(controller.listMine));
router.get('/:id', asyncHandler(controller.get));
router.post('/', validate(submitDataSchema), asyncHandler(controller.create));
export const formSubmissionRoutes = router;
`);

console.log('Dynamic Forms Schema Configured.');
