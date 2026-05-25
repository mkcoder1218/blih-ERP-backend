const fs = require('fs');
const path = require('path');

const src = path.join(process.cwd(), 'src');
const ensureDir = (dir) => fs.mkdirSync(dir, { recursive: true });

const modelsPath = path.join(src, 'models');

// MODELS
fs.writeFileSync(path.join(modelsPath, 'ModuleTemplate.ts'), `
import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type ModuleTemplateModel = ModelStatic<any> & { associate?: (models: any) => void; };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): ModuleTemplateModel => {
  const ModuleTemplate = sequelize.define("ModuleTemplate", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    moduleKey: { type: dataTypes.STRING(120), allowNull: false, unique: true },
    name: { type: dataTypes.STRING(200), allowNull: false },
    description: { type: dataTypes.TEXT, allowNull: true },
    version: { type: dataTypes.STRING(50), defaultValue: "1.0.0" },
    status: { type: dataTypes.STRING(50), defaultValue: "active" },
    settings: { type: dataTypes.JSONB, defaultValue: {} }
  }, { tableName: "module_templates", timestamps: true, paranoid: true }) as ModuleTemplateModel;

  ModuleTemplate.associate = (models: any) => {
    models.ModuleTemplate.hasMany(models.ModuleTemplateForm, { foreignKey: "moduleTemplateId", as: "forms" });
    models.ModuleTemplate.hasMany(models.ModuleTemplateWorkflow, { foreignKey: "moduleTemplateId", as: "workflows" });
  };
  return ModuleTemplate;
};`);

fs.writeFileSync(path.join(modelsPath, 'ModuleTemplateForm.ts'), `
import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type ModuleTemplateFormModel = ModelStatic<any> & { associate?: (models: any) => void; };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): ModuleTemplateFormModel => {
  const ModuleTemplateForm = sequelize.define("ModuleTemplateForm", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    moduleTemplateId: { type: dataTypes.UUID, allowNull: false },
    formKey: { type: dataTypes.STRING(120), allowNull: false },
    formName: { type: dataTypes.STRING(200), allowNull: false },
    formSchema: { type: dataTypes.JSONB, defaultValue: {} },
    defaultFields: { type: dataTypes.JSONB, defaultValue: [] },
    settings: { type: dataTypes.JSONB, defaultValue: {} }
  }, { tableName: "module_template_forms", timestamps: true }) as ModuleTemplateFormModel;

  ModuleTemplateForm.associate = (models: any) => {
    models.ModuleTemplateForm.belongsTo(models.ModuleTemplate, { foreignKey: "moduleTemplateId" });
  };
  return ModuleTemplateForm;
};`);

fs.writeFileSync(path.join(modelsPath, 'ModuleTemplateWorkflow.ts'), `
import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type ModuleTemplateWorkflowModel = ModelStatic<any> & { associate?: (models: any) => void; };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): ModuleTemplateWorkflowModel => {
  const ModuleTemplateWorkflow = sequelize.define("ModuleTemplateWorkflow", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    moduleTemplateId: { type: dataTypes.UUID, allowNull: false },
    workflowKey: { type: dataTypes.STRING(120), allowNull: false },
    workflowName: { type: dataTypes.STRING(200), allowNull: false },
    workflowSchema: { type: dataTypes.JSONB, defaultValue: {} },
    defaultSteps: { type: dataTypes.JSONB, defaultValue: [] },
    settings: { type: dataTypes.JSONB, defaultValue: {} }
  }, { tableName: "module_template_workflows", timestamps: true }) as ModuleTemplateWorkflowModel;

  ModuleTemplateWorkflow.associate = (models: any) => {
    models.ModuleTemplateWorkflow.belongsTo(models.ModuleTemplate, { foreignKey: "moduleTemplateId" });
  };
  return ModuleTemplateWorkflow;
};`);

// VALIDATORS
ensureDir(path.join(src, 'validators'));
fs.writeFileSync(path.join(src, 'validators', 'template.validator.ts'), `
import Joi from 'joi';
export const applyTemplateSchema = Joi.object({
  targetBusinessId: Joi.string().uuid().optional(),
  moduleKey: Joi.string().max(120).required()
});
`);

// MODULE CONFIG
ensureDir(path.join(src, 'modules', 'moduleTemplate'));
fs.writeFileSync(path.join(src, 'modules', 'moduleTemplate', 'template.dal.ts'), `
import { db } from '../../models';
export class TemplateDAL {
  findAll(query: any) { 
    return db.ModuleTemplate.findAll({ where: query, order: [['createdAt', 'ASC']], include: ['forms', 'workflows'] }); 
  }
  findByKey(moduleKey: string) { return db.ModuleTemplate.findOne({ where: { moduleKey }, include: ['forms', 'workflows'] }); }
  async getBusinessModuleStatus(businessId: string, moduleKey: string) {
    return db.BusinessModule.findOne({ where: { businessId, moduleKey } });
  }
}
`);

fs.writeFileSync(path.join(src, 'modules', 'moduleTemplate', 'template.service.ts'), `
import { TemplateDAL } from './template.dal';
import { db } from '../../models';

export class TemplateService {
  private dal = new TemplateDAL();

  listAll() {
    return this.dal.findAll({});
  }

  async applyTemplate(businessId: string, moduleKey: string, reapply: boolean = false) {
    // 1. Validate template exists
    const tpl = await this.dal.findByKey(moduleKey);
    if (!tpl) throw new Error(\`Template for module '\${moduleKey}' not found.\`);

    // 2. We don't block applying, but we shouldn't apply unless the module is active. 
    // Handled in controller / logic based on roles. We assume valid business.
    // 3. Apply Workflows
    for (const w of tpl.workflows) {
      const existing = await db.ApprovalWorkflow.findOne({ where: { businessId, key: w.workflowKey, moduleKey }});
      if (existing && !reapply) continue; // Skip duplicate
      
      let wfId = existing?.id;
      if (!existing) {
        const nw = await db.ApprovalWorkflow.create({
          businessId, moduleKey, entityType: 'form_submission',
          name: w.workflowName, key: w.workflowKey,
          description: w.workflowSchema.description || '',
          status: 'active'
        });
        wfId = nw.id;
        
        // Load default steps
        if (w.defaultSteps && Array.isArray(w.defaultSteps)) {
          for (const step of w.defaultSteps) {
            await db.ApprovalStep.create({
              businessId, workflowId: wfId,
              stepOrder: step.stepOrder,
              approverType: step.approverType,
              actionRequired: step.actionRequired || 'any',
              isFinalStep: step.isFinalStep || false
            });
          }
        }
      }
    }

    // 4. Apply Forms
    for (const f of tpl.forms) {
      const existing = await db.FormDefinition.findOne({ where: { businessId, key: f.formKey, moduleKey } });
      if (existing && !reapply) continue;

      let fdId = existing?.id;
      if (!existing) {
        const nf = await db.FormDefinition.create({
          businessId, moduleKey, name: f.formName, key: f.formKey,
          description: f.formSchema.description || '',
          requiresApproval: f.formSchema.requiresApproval || false,
          status: 'active'
        });
        fdId = nf.id;

        // Note: Realistically, you would link the form to the newly created workflowId if requiresApproval is true
        // Simplifying the map for MVP.

        if (f.defaultFields && Array.isArray(f.defaultFields)) {
          for (const field of f.defaultFields) {
            await db.FormField.create({
              businessId, formDefinitionId: fdId,
              label: field.label, key: field.key, type: field.type,
              required: field.required || false,
              options: field.options || [],
              orderIndex: field.orderIndex || 0
            });
          }
        }
      }
    }

    return true;
  }

  async seedGlobalTemplates() {
    const defaultTemplates = [
      {
        moduleKey: 'hr', name: 'HR Core',
        forms: [
          { formKey: 'leave_req', formName: 'Leave Request', fields: [{label: 'Reason', key: 'reason', type: 'text', required: true}, {label: 'Date', key: 'date', type: 'date', required: true}] },
          { formKey: 'emp_profile', formName: 'Employee Profile', fields: [{label: 'Bio', key: 'bio', type: 'textarea', required: false}] }
        ]
      },
      {
        moduleKey: 'crm', name: 'CRM Suite',
        forms: [
          { formKey: 'new_lead', formName: 'New Lead Intake', fields: [{label: 'Company', key: 'company', type: 'text', required: true}, {label: 'Budget', key: 'budget', type: 'number', required: false}] },
          { formKey: 'interaction', formName: 'Interaction Log', fields: [{label: 'Notes', key: 'notes', type: 'textarea', required: true}] }
        ]
      },
      {
        moduleKey: 'projects', name: 'Projects & Tasks',
        forms: [
          { formKey: 'proj_brief', formName: 'Project Brief', fields: [{label: 'Title', key: 'title', type: 'text', required: true}] },
          { formKey: 'task_assign', formName: 'Task Assignment', fields: [{label: 'Task Details', key: 'details', type: 'textarea', required: true}] }
        ]
      },
      {
        moduleKey: 'finance', name: 'Finance & Accounting',
        forms: [
          { formKey: 'invoice', formName: 'Invoice Creation', fields: [{label: 'Amount', key: 'amount', type: 'number', required: true}] },
          { formKey: 'expense', formName: 'Expense Reimbursement', fields: [{label: 'Receipt Amount', key: 'amount', type: 'number', required: true}] }
        ]
      },
      {
        moduleKey: 'brain', name: 'Brain (Knowledge Base)',
        forms: [
          { formKey: 'kb_article', formName: 'Knowledge Article Submission', fields: [{label: 'Title', key: 'title', type: 'text', required: true}] },
          { formKey: 'sop', formName: 'SOP Creation', fields: [{label: 'Procedure Content', key: 'content', type: 'textarea', required: true}] }
        ]
      },
      {
        moduleKey: 'okr', name: 'OKRs',
        forms: [
          { formKey: 'personal_okr', formName: 'Personal OKR Creation', fields: [{label: 'Objective', key: 'objective', type: 'text', required: true}] },
          { formKey: 'okr_progress', formName: 'Monthly OKR Progress Update', fields: [{label: 'Progress %', key: 'progress', type: 'number', required: true}] }
        ]
      }
    ];

    for (const t of defaultTemplates) {
      const [tpl] = await db.ModuleTemplate.findOrCreate({
        where: { moduleKey: t.moduleKey },
        defaults: { name: t.name, description: \`Default \${t.name} template configurations\` }
      });
      
      for (const f of t.forms) {
        await db.ModuleTemplateForm.findOrCreate({
          where: { moduleTemplateId: tpl.id, formKey: f.formKey },
          defaults: { formName: f.formName, defaultFields: f.fields }
        });
      }
    }
  }
}
`);

fs.writeFileSync(path.join(src, 'modules', 'moduleTemplate', 'template.controller.ts'), `
import type { Request, Response, NextFunction } from 'express';
import { TemplateService } from './template.service';
import { AuditLogService } from '../../services/auditLog.service';
export class TemplateController {
  private service = new TemplateService();

  list = async (req: Request, res: Response) => {
    res.json({ templates: await this.service.listAll() });
  };
  
  apply = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { moduleKey, targetBusinessId } = req.body;
      const businessId = req.user!.isPlatformSuperAdmin && targetBusinessId ? targetBusinessId : req.user!.businessId;
      
      await this.service.applyTemplate(businessId, moduleKey, false);
      
      await AuditLogService.log('APPLY_TEMPLATE', 'module_template', moduleKey, null, { businessId }, req);
      res.json({ ok: true, message: \`Template \${moduleKey} applied successfully.\` });
    } catch (err: any) { next({ statusCode: 400, message: err.message }); }
  };

  reapply = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { moduleKey, targetBusinessId } = req.body;
      const businessId = req.user!.isPlatformSuperAdmin && targetBusinessId ? targetBusinessId : req.user!.businessId;
      
      await this.service.applyTemplate(businessId, moduleKey, true);
      
      await AuditLogService.log('REAPPLY_TEMPLATE', 'module_template', moduleKey, null, { businessId }, req);
      res.json({ ok: true, message: \`Template \${moduleKey} reapplied successfully.\` });
    } catch (err: any) { next({ statusCode: 400, message: err.message }); }
  };
}
`);

fs.writeFileSync(path.join(src, 'modules', 'moduleTemplate', 'template.routes.ts'), `
import { Router } from 'express';
import { authRequired } from '../../middlewares/auth';
import { requireRole } from '../../middlewares/role';
import { validate } from '../../middlewares/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { applyTemplateSchema } from '../../validators/template.validator';
import { TemplateController } from './template.controller';

const router = Router();
const controller = new TemplateController();

router.use(authRequired);
router.get('/', requireRole('BUSINESS_ADMIN'), asyncHandler(controller.list));
router.post('/apply', requireRole('BUSINESS_ADMIN'), validate(applyTemplateSchema), asyncHandler(controller.apply));
router.post('/reapply', requireRole('BUSINESS_ADMIN'), validate(applyTemplateSchema), asyncHandler(controller.reapply));

export const moduleTemplateRoutes = router;
`);

console.log('Template Schema Configured.');
