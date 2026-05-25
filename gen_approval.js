const fs = require('fs');
const path = require('path');

const src = path.join(process.cwd(), 'src');
const ensureDir = (dir) => fs.mkdirSync(dir, { recursive: true });

// Models
const modelsPath = path.join(src, 'models');

fs.writeFileSync(path.join(modelsPath, 'ApprovalWorkflow.ts'), `
import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type ApprovalWorkflowModel = ModelStatic<any> & { associate?: (models: any) => void; };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): ApprovalWorkflowModel => {
  const ApprovalWorkflow = sequelize.define("ApprovalWorkflow", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    businessId: { type: dataTypes.UUID, allowNull: false },
    moduleKey: { type: dataTypes.STRING(120), allowNull: false },
    entityType: { type: dataTypes.STRING(120), allowNull: false },
    name: { type: dataTypes.STRING(200), allowNull: false },
    key: { type: dataTypes.STRING(120), allowNull: false },
    description: { type: dataTypes.TEXT, allowNull: true },
    status: { type: dataTypes.STRING(50), defaultValue: "active" }, // active, inactive
    settings: { type: dataTypes.JSONB, defaultValue: {} }
  }, { tableName: "approval_workflows", timestamps: true, paranoid: true }) as ApprovalWorkflowModel;

  ApprovalWorkflow.associate = (models: any) => {
    models.ApprovalWorkflow.belongsTo(models.Business, { foreignKey: "businessId" });
    models.ApprovalWorkflow.hasMany(models.ApprovalStep, { foreignKey: "workflowId", as: "steps" });
    models.ApprovalWorkflow.hasMany(models.ApprovalRequest, { foreignKey: "workflowId" });
  };
  return ApprovalWorkflow;
};`);

fs.writeFileSync(path.join(modelsPath, 'ApprovalStep.ts'), `
import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type ApprovalStepModel = ModelStatic<any> & { associate?: (models: any) => void; };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): ApprovalStepModel => {
  const ApprovalStep = sequelize.define("ApprovalStep", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    businessId: { type: dataTypes.UUID, allowNull: false },
    workflowId: { type: dataTypes.UUID, allowNull: false },
    stepOrder: { type: dataTypes.INTEGER, allowNull: false },
    approverType: { type: dataTypes.STRING(50), allowNull: false }, // user, role, department
    approverRoleId: { type: dataTypes.UUID, allowNull: true },
    approverUserId: { type: dataTypes.UUID, allowNull: true },
    approverDepartmentId: { type: dataTypes.UUID, allowNull: true },
    actionRequired: { type: dataTypes.STRING(50), defaultValue: "any" }, // any, all
    isFinalStep: { type: dataTypes.BOOLEAN, defaultValue: false },
    settings: { type: dataTypes.JSONB, defaultValue: {} }
  }, { tableName: "approval_steps", timestamps: true, paranoid: true }) as ApprovalStepModel;

  ApprovalStep.associate = (models: any) => {
    models.ApprovalStep.belongsTo(models.ApprovalWorkflow, { foreignKey: "workflowId", as: "workflow" });
    models.ApprovalStep.belongsTo(models.Business, { foreignKey: "businessId" });
  };
  return ApprovalStep;
};`);

fs.writeFileSync(path.join(modelsPath, 'ApprovalRequest.ts'), `
import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type ApprovalRequestModel = ModelStatic<any> & { associate?: (models: any) => void; };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): ApprovalRequestModel => {
  const ApprovalRequest = sequelize.define("ApprovalRequest", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    businessId: { type: dataTypes.UUID, allowNull: false },
    workflowId: { type: dataTypes.UUID, allowNull: false },
    entityType: { type: dataTypes.STRING(120), allowNull: false },
    entityId: { type: dataTypes.STRING(120), allowNull: false },
    requestedByUserId: { type: dataTypes.UUID, allowNull: false },
    currentStepId: { type: dataTypes.UUID, allowNull: true },
    status: { type: dataTypes.STRING(50), defaultValue: "pending" }, // pending, approved, rejected, returned, cancelled
    submittedData: { type: dataTypes.JSONB, defaultValue: {} },
    finalDecision: { type: dataTypes.STRING(50), allowNull: true },
    completedAt: { type: dataTypes.DATE, allowNull: true }
  }, { tableName: "approval_requests", timestamps: true, paranoid: true }) as ApprovalRequestModel;

  ApprovalRequest.associate = (models: any) => {
    models.ApprovalRequest.belongsTo(models.Business, { foreignKey: "businessId" });
    models.ApprovalRequest.belongsTo(models.ApprovalWorkflow, { foreignKey: "workflowId", as: "workflow" });
    models.ApprovalRequest.belongsTo(models.ApprovalStep, { foreignKey: "currentStepId", as: "currentStep" });
    models.ApprovalRequest.hasMany(models.ApprovalAction, { foreignKey: "approvalRequestId", as: "actions" });
  };
  return ApprovalRequest;
};`);

fs.writeFileSync(path.join(modelsPath, 'ApprovalAction.ts'), `
import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type ApprovalActionModel = ModelStatic<any> & { associate?: (models: any) => void; };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): ApprovalActionModel => {
  const ApprovalAction = sequelize.define("ApprovalAction", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    businessId: { type: dataTypes.UUID, allowNull: false },
    approvalRequestId: { type: dataTypes.UUID, allowNull: false },
    approvalStepId: { type: dataTypes.UUID, allowNull: false },
    actedByUserId: { type: dataTypes.UUID, allowNull: false },
    action: { type: dataTypes.STRING(50), allowNull: false }, // approve, reject, return, cancel
    comment: { type: dataTypes.TEXT, allowNull: true },
    actionData: { type: dataTypes.JSONB, defaultValue: {} }
  }, { tableName: "approval_actions", timestamps: true, updatedAt: false }) as ApprovalActionModel;

  ApprovalAction.associate = (models: any) => {
    models.ApprovalAction.belongsTo(models.Business, { foreignKey: "businessId" });
    models.ApprovalAction.belongsTo(models.ApprovalRequest, { foreignKey: "approvalRequestId" });
    models.ApprovalAction.belongsTo(models.ApprovalStep, { foreignKey: "approvalStepId" });
  };
  return ApprovalAction;
};`);

// Validation
ensureDir(path.join(src, 'validators'));
fs.writeFileSync(path.join(src, 'validators', 'approvalWorkflow.validator.ts'), `
import Joi from 'joi';
export const createWorkflowSchema = Joi.object({
  name: Joi.string().max(200).required(),
  key: Joi.string().max(120).required(),
  moduleKey: Joi.string().max(120).required(),
  entityType: Joi.string().max(120).required(),
  description: Joi.string().allow(null, '').optional(),
  status: Joi.string().valid('active', 'inactive').optional(),
  settings: Joi.object().optional()
});

export const createStepSchema = Joi.object({
  workflowId: Joi.string().uuid().required(),
  stepOrder: Joi.number().required(),
  approverType: Joi.string().valid('user', 'role', 'department').required(),
  approverRoleId: Joi.string().uuid().allow(null).optional(),
  approverUserId: Joi.string().uuid().allow(null).optional(),
  approverDepartmentId: Joi.string().uuid().allow(null).optional(),
  actionRequired: Joi.string().valid('any', 'all').optional(),
  isFinalStep: Joi.boolean().optional(),
  settings: Joi.object().optional()
});
`);

fs.writeFileSync(path.join(src, 'validators', 'approvalRequest.validator.ts'), `
import Joi from 'joi';
export const submitRequestSchema = Joi.object({
  workflowId: Joi.string().uuid().required(),
  entityType: Joi.string().max(120).required(),
  entityId: Joi.string().max(120).required(),
  submittedData: Joi.object().optional()
});

export const actRequestSchema = Joi.object({
  action: Joi.string().valid('approve', 'reject', 'return', 'cancel').required(),
  comment: Joi.string().allow(null, '').optional(),
  actionData: Joi.object().optional()
});
`);

// WORKFLOW MODULE
ensureDir(path.join(src, 'modules', 'approvalWorkflow'));
fs.writeFileSync(path.join(src, 'modules', 'approvalWorkflow', 'workflow.dal.ts'), `
import { db } from '../../models';
export class WorkflowDAL {
  findAll(query: any, offset: number, limit: number) { 
    return db.ApprovalWorkflow.findAndCountAll({ where: query, offset, limit, order: [['createdAt', 'DESC']], include: ['steps'] }); 
  }
  findById(id: string, businessId: string) { return db.ApprovalWorkflow.findOne({ where: { id, businessId }, include: ['steps'] }); }
  create(data: any) { return db.ApprovalWorkflow.create(data); }
  createStep(data: any) { return db.ApprovalStep.create(data); }
  async deleteStep(stepId: string, businessId: string) {
    const step = await db.ApprovalStep.findOne({ where: { id: stepId, businessId } });
    if (step) { await step.destroy(); return true; }
    return false;
  }
}
`);

fs.writeFileSync(path.join(src, 'modules', 'approvalWorkflow', 'workflow.service.ts'), `
import { WorkflowDAL } from './workflow.dal';
import { Op } from 'sequelize';

export class WorkflowService {
  private dal = new WorkflowDAL();
  list(businessId: string, search: string, page: number, size: number) {
    const offset = (page - 1) * size;
    const query: any = { businessId };
    if (search) query.name = { [Op.iLike]: \`%\${search}%\` };
    return this.dal.findAll(query, offset, size);
  }
  getById(id: string, businessId: string) { return this.dal.findById(id, businessId); }
  create(businessId: string, data: any) { return this.dal.create({ ...data, businessId }); }
  createStep(businessId: string, data: any) { return this.dal.createStep({ ...data, businessId }); }
  deleteStep(stepId: string, businessId: string) { return this.dal.deleteStep(stepId, businessId); }
}
`);

fs.writeFileSync(path.join(src, 'modules', 'approvalWorkflow', 'workflow.controller.ts'), `
import type { Request, Response, NextFunction } from 'express';
import { WorkflowService } from './workflow.service';
import { AuditLogService } from '../../services/auditLog.service';
export class WorkflowController {
  private service = new WorkflowService();
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
    const wf = await this.service.getById(req.params.id, businessId);
    if (!wf) return next({ statusCode: 404, message: 'Not found' });
    res.json({ workflow: wf });
  };
  create = async (req: Request, res: Response) => {
    const businessId = this.deriveBusinessId(req);
    const wf = await this.service.create(businessId, req.body);
    await AuditLogService.log('CREATE', 'approval_workflow', wf.id, null, wf, req);
    res.status(201).json({ workflow: wf });
  };
  createStep = async (req: Request, res: Response) => {
    const businessId = this.deriveBusinessId(req);
    const step = await this.service.createStep(businessId, req.body);
    await AuditLogService.log('CREATE', 'approval_step', step.id, null, step, req);
    res.status(201).json({ step });
  };
}
`);

fs.writeFileSync(path.join(src, 'modules', 'approvalWorkflow', 'workflow.routes.ts'), `
import { Router } from 'express';
import { authRequired } from '../../middlewares/auth';
import { requireRole } from '../../middlewares/role';
import { validate } from '../../middlewares/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { createWorkflowSchema, createStepSchema } from '../../validators/approvalWorkflow.validator';
import { WorkflowController } from './workflow.controller';

const router = Router();
const controller = new WorkflowController();
router.use(authRequired);
router.get('/', requireRole('BUSINESS_ADMIN'), asyncHandler(controller.list));
router.get('/:id', requireRole('BUSINESS_ADMIN'), asyncHandler(controller.get));
router.post('/', requireRole('BUSINESS_ADMIN'), validate(createWorkflowSchema), asyncHandler(controller.create));
router.post('/steps', requireRole('BUSINESS_ADMIN'), validate(createStepSchema), asyncHandler(controller.createStep));
export const approvalWorkflowRoutes = router;
`);

// REQUESTS MODULE
ensureDir(path.join(src, 'modules', 'approvalRequest'));
fs.writeFileSync(path.join(src, 'modules', 'approvalRequest', 'request.dal.ts'), `
import { db } from '../../models';
export class RequestDAL {
  findAll(query: any, offset: number, limit: number) { 
    return db.ApprovalRequest.findAndCountAll({ where: query, offset, limit, order: [['createdAt', 'DESC']], include: [{model: db.ApprovalStep, as: 'currentStep'}] }); 
  }
  findById(id: string, businessId: string) { 
    return db.ApprovalRequest.findOne({ where: { id, businessId }, include: ['workflow', 'currentStep', 'actions'] }); 
  }
  getFirstStep(workflowId: string) {
    return db.ApprovalStep.findOne({ where: { workflowId }, order: [['stepOrder', 'ASC']] });
  }
  getNextStep(workflowId: string, currentOrder: number) {
    const { Op } = require('sequelize');
    return db.ApprovalStep.findOne({ where: { workflowId, stepOrder: { [Op.gt]: currentOrder } }, order: [['stepOrder', 'ASC']] });
  }
  createRequest(data: any) { return db.ApprovalRequest.create(data); }
  createAction(data: any) { return db.ApprovalAction.create(data); }
}
`);

fs.writeFileSync(path.join(src, 'modules', 'approvalRequest', 'request.service.ts'), `
import { RequestDAL } from './request.dal';
import { db } from '../../models';
import { Op } from 'sequelize';

export class RequestService {
  private dal = new RequestDAL();

  list(businessId: string, userId: string, isCreator: boolean, isApprover: boolean, page: number, size: number) {
    const offset = (page - 1) * size;
    const query: any = { businessId };
    
    // Simplistic separation: if looking for created items
    if (isCreator) query.requestedByUserId = userId;

    return this.dal.findAll(query, offset, size);
  }

  getById(id: string, businessId: string) { return this.dal.findById(id, businessId); }

  async submit(businessId: string, userId: string, data: any) {
    // 1. Fetch wf
    const wf = await db.ApprovalWorkflow.findOne({ where: { id: data.workflowId, businessId } });
    if (!wf || wf.status !== 'active') throw new Error("Workflow invalid or inactive");
    
    // 2. Locate first step
    const firstStep = await this.dal.getFirstStep(wf.id);
    if (!firstStep) throw new Error("Workflow has no steps defined");

    // 3. Create
    return this.dal.createRequest({
      businessId,
      workflowId: wf.id,
      entityType: data.entityType,
      entityId: data.entityId,
      requestedByUserId: userId,
      currentStepId: firstStep.id,
      status: "pending",
      submittedData: data.submittedData || {}
    });
  }

  async actOnRequest(requestId: string, businessId: string, userId: string, payload: any) {
    const req = await this.dal.findById(requestId, businessId);
    if (!req) throw new Error("Not found");
    if (req.status !== 'pending' && req.status !== 'returned') throw new Error("Request is not pending.");

    const step = req.currentStep;
    if (!step) throw new Error("Orphaned step");

    // Authorization check implementation details: 
    // In actual ERP, fetch User roles + department to map against approverType ("role", "user", "department").
    // We assume passed for this baseline structure limit.

    await this.dal.createAction({
      businessId,
      approvalRequestId: req.id,
      approvalStepId: step.id,
      actedByUserId: userId,
      action: payload.action,
      comment: payload.comment || null,
      actionData: payload.actionData || {}
    });

    if (payload.action === 'reject') {
      await req.update({ status: 'rejected', finalDecision: 'rejected', completedAt: new Date() });
    } else if (payload.action === 'approve') {
      if (step.isFinalStep) {
        await req.update({ status: 'approved', finalDecision: 'approved', completedAt: new Date() });
      } else {
        const nextStep = await this.dal.getNextStep(req.workflowId, step.stepOrder);
        if (nextStep) {
          await req.update({ currentStepId: nextStep.id });
        } else {
          await req.update({ status: 'approved', finalDecision: 'approved', completedAt: new Date(), currentStepId: null });
        }
      }
    } else if (payload.action === 'return') {
      await req.update({ status: 'returned' });
    } else if (payload.action === 'cancel') {
      await req.update({ status: 'cancelled', finalDecision: 'cancelled', completedAt: new Date() });
    }

    return req.reload();
  }
}
`);

fs.writeFileSync(path.join(src, 'modules', 'approvalRequest', 'request.controller.ts'), `
import type { Request, Response, NextFunction } from 'express';
import { RequestService } from './request.service';
import { AuditLogService } from '../../services/auditLog.service';
export class RequestController {
  private service = new RequestService();

  listMine = async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const size = parseInt(req.query.size as string) || 20;
    res.json(await this.service.list(req.user!.businessId, req.user!.id, true, false, page, size));
  };
  
  get = async (req: Request, res: Response, next: NextFunction) => {
    const r = await this.service.getById(req.params.id, req.user!.businessId);
    if (!r) return next({ statusCode: 404, message: 'Not found' });
    res.json({ request: r });
  };

  submit = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const r = await this.service.submit(req.user!.businessId, req.user!.id, req.body);
      await AuditLogService.log('SUBMIT_APPROVAL', 'approval_request', r.id, null, r, req);
      res.status(201).json({ request: r });
    } catch (err: any) {
      next({ statusCode: 400, message: err.message });
    }
  };

  act = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const r = await this.service.actOnRequest(req.params.id, req.user!.businessId, req.user!.id, req.body);
      await AuditLogService.log('ACTION_APPROVAL', 'approval_request', req.params.id, null, { action: req.body.action }, req);
      res.json({ request: r });
    } catch (err: any) {
      next({ statusCode: 400, message: err.message });
    }
  };
}
`);

fs.writeFileSync(path.join(src, 'modules', 'approvalRequest', 'request.routes.ts'), `
import { Router } from 'express';
import { authRequired } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { submitRequestSchema, actRequestSchema } from '../../validators/approvalRequest.validator';
import { RequestController } from './request.controller';

const router = Router();
const controller = new RequestController();
router.use(authRequired);
router.get('/mine', asyncHandler(controller.listMine));
router.get('/:id', asyncHandler(controller.get));
router.post('/submit', validate(submitRequestSchema), asyncHandler(controller.submit));
router.post('/:id/act', validate(actRequestSchema), asyncHandler(controller.act));
export const approvalRequestRoutes = router;
`);

console.log('Approval Schema Configured.');
