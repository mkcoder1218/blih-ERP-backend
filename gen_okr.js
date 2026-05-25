const fs = require('fs');
const path = require('path');

const src = path.join(process.cwd(), 'src');
const ensureDir = (dir) => fs.mkdirSync(dir, { recursive: true });
const modelsPath = path.join(src, 'models');

// -- Objective --
fs.writeFileSync(path.join(modelsPath, 'Objective.ts'), `
import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type ObjectiveModel = ModelStatic<any> & { associate?: (models: any) => void; };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): ObjectiveModel => {
  const Objective = sequelize.define("Objective", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    businessId: { type: dataTypes.UUID, allowNull: false },
    ownerUserId: { type: dataTypes.UUID, allowNull: true },
    departmentId: { type: dataTypes.UUID, allowNull: true },
    level: { type: dataTypes.STRING(50), defaultValue: "personal" }, // company, department, team, personal
    title: { type: dataTypes.STRING(500), allowNull: false },
    description: { type: dataTypes.TEXT, allowNull: true },
    periodType: { type: dataTypes.STRING(50), defaultValue: "quarterly" }, // annual, quarterly, monthly
    periodStart: { type: dataTypes.DATEONLY, allowNull: true },
    periodEnd: { type: dataTypes.DATEONLY, allowNull: true },
    status: { type: dataTypes.STRING(50), defaultValue: "draft" }, // draft, active, closed, archived
    metadata: { type: dataTypes.JSONB, defaultValue: {} }
  }, { tableName: "okr_objectives", timestamps: true, paranoid: true }) as ObjectiveModel;

  Objective.associate = (models: any) => {
    models.Objective.belongsTo(models.Business, { foreignKey: "businessId" });
    if(models.User) models.Objective.belongsTo(models.User, { foreignKey: "ownerUserId", as: "owner" });
    if(models.Department) models.Objective.belongsTo(models.Department, { foreignKey: "departmentId" });
    models.Objective.hasMany(models.KeyResult, { foreignKey: "objectiveId", as: "keyResults" });
    models.Objective.hasMany(models.OKRProgressUpdate, { foreignKey: "objectiveId", as: "progressUpdates" });
    models.Objective.hasMany(models.OKREvaluation, { foreignKey: "objectiveId", as: "evaluations" });
  };
  return Objective;
};
`);

// -- KeyResult --
fs.writeFileSync(path.join(modelsPath, 'KeyResult.ts'), `
import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type KeyResultModel = ModelStatic<any> & { associate?: (models: any) => void; };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): KeyResultModel => {
  const KeyResult = sequelize.define("KeyResult", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    businessId: { type: dataTypes.UUID, allowNull: false },
    objectiveId: { type: dataTypes.UUID, allowNull: false },
    title: { type: dataTypes.STRING(500), allowNull: false },
    metric: { type: dataTypes.STRING(120), allowNull: false }, // count, currency, percentage, boolean
    baselineValue: { type: dataTypes.FLOAT, defaultValue: 0 },
    targetValue: { type: dataTypes.FLOAT, allowNull: false },
    currentValue: { type: dataTypes.FLOAT, defaultValue: 0 },
    weight: { type: dataTypes.FLOAT, defaultValue: 1.0 },
    dataSource: { type: dataTypes.STRING(120), defaultValue: "manual" }, // manual, finance, crm, projects
    status: { type: dataTypes.STRING(50), defaultValue: "on_track" }, // on_track, at_risk, off_track, achieved
    metadata: { type: dataTypes.JSONB, defaultValue: {} }
  }, { tableName: "okr_key_results", timestamps: true, paranoid: true }) as KeyResultModel;

  KeyResult.associate = (models: any) => {
    models.KeyResult.belongsTo(models.Business, { foreignKey: "businessId" });
    models.KeyResult.belongsTo(models.Objective, { foreignKey: "objectiveId" });
    models.KeyResult.hasMany(models.OKRProgressUpdate, { foreignKey: "keyResultId" });
  };
  return KeyResult;
};
`);

// -- OKRProgressUpdate --
fs.writeFileSync(path.join(modelsPath, 'OKRProgressUpdate.ts'), `
import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type OKRProgressUpdateModel = ModelStatic<any> & { associate?: (models: any) => void; };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): OKRProgressUpdateModel => {
  const OKRProgressUpdate = sequelize.define("OKRProgressUpdate", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    businessId: { type: dataTypes.UUID, allowNull: false },
    objectiveId: { type: dataTypes.UUID, allowNull: false },
    keyResultId: { type: dataTypes.UUID, allowNull: true },
    updatedByUserId: { type: dataTypes.UUID, allowNull: false },
    progressValue: { type: dataTypes.FLOAT, allowNull: false },
    progressPercent: { type: dataTypes.FLOAT, defaultValue: 0 },
    comment: { type: dataTypes.TEXT, allowNull: true },
    blockers: { type: dataTypes.JSONB, defaultValue: [] }
  }, { tableName: "okr_progress_updates", timestamps: true }) as OKRProgressUpdateModel;

  OKRProgressUpdate.associate = (models: any) => {
    models.OKRProgressUpdate.belongsTo(models.Business, { foreignKey: "businessId" });
    models.OKRProgressUpdate.belongsTo(models.Objective, { foreignKey: "objectiveId" });
    models.OKRProgressUpdate.belongsTo(models.KeyResult, { foreignKey: "keyResultId" });
    if(models.User) models.OKRProgressUpdate.belongsTo(models.User, { foreignKey: "updatedByUserId", as: "updatedBy" });
  };
  return OKRProgressUpdate;
};
`);

// -- OKREvaluation --
fs.writeFileSync(path.join(modelsPath, 'OKREvaluation.ts'), `
import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type OKREvaluationModel = ModelStatic<any> & { associate?: (models: any) => void; };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): OKREvaluationModel => {
  const OKREvaluation = sequelize.define("OKREvaluation", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    businessId: { type: dataTypes.UUID, allowNull: false },
    objectiveId: { type: dataTypes.UUID, allowNull: false },
    evaluatedByUserId: { type: dataTypes.UUID, allowNull: false },
    score: { type: dataTypes.FLOAT, allowNull: false },
    rating: { type: dataTypes.STRING(50), allowNull: true },
    summary: { type: dataTypes.TEXT, allowNull: true },
    recommendation: { type: dataTypes.TEXT, allowNull: true },
    evaluationData: { type: dataTypes.JSONB, defaultValue: {} }
  }, { tableName: "okr_evaluations", timestamps: true, paranoid: true }) as OKREvaluationModel;

  OKREvaluation.associate = (models: any) => {
    models.OKREvaluation.belongsTo(models.Business, { foreignKey: "businessId" });
    models.OKREvaluation.belongsTo(models.Objective, { foreignKey: "objectiveId" });
    if(models.User) models.OKREvaluation.belongsTo(models.User, { foreignKey: "evaluatedByUserId", as: "evaluator" });
  };
  return OKREvaluation;
};
`);

ensureDir(path.join(src, 'modules', 'okr'));

// -- Service --
fs.writeFileSync(path.join(src, 'modules', 'okr', 'okr.service.ts'), `
import { db } from '../../models';
import { InternalNotifier } from '../notification/notification.service';

export class OKRService {

  // -- Objective --
  async createObjective(businessId: string, ownerUserId: string | null, data: any) {
    return db.Objective.create({ ...data, businessId, ownerUserId: ownerUserId || data.ownerUserId });
  }

  async updateObjective(businessId: string, id: string, data: any) {
    const obj = await db.Objective.findOne({ where: { id, businessId } });
    if (!obj) throw new Error("Objective not found");
    return obj.update(data);
  }

  async getObjective(businessId: string, id: string) {
    return db.Objective.findOne({
      where: { id, businessId },
      include: [
        { model: db.KeyResult, as: 'keyResults' },
        { model: db.User, as: 'owner', attributes: ['id', 'email', 'firstName', 'lastName'] },
        { model: db.Department, attributes: ['id', 'name'] }
      ]
    });
  }

  async listObjectives(businessId: string, query: any, page: number, size: number) {
    const where: any = { businessId };
    if (query.level) where.level = query.level;
    if (query.ownerUserId) where.ownerUserId = query.ownerUserId;
    if (query.departmentId) where.departmentId = query.departmentId;
    if (query.periodType) where.periodType = query.periodType;
    if (query.status) where.status = query.status;

    return db.Objective.findAndCountAll({
      where,
      offset: (page - 1) * size,
      limit: size,
      include: [{ model: db.User, as: 'owner', attributes: ['id', 'email'] }, { model: db.KeyResult, as: 'keyResults' }]
    });
  }

  // -- Key Result --
  async createKeyResult(businessId: string, objectiveId: string, data: any) {
    const kr = await db.KeyResult.create({ ...data, businessId, objectiveId });
    return kr;
  }

  async updateKeyResult(businessId: string, id: string, data: any) {
    const kr = await db.KeyResult.findOne({ where: { id, businessId } });
    if (!kr) throw new Error("KeyResult not found");
    return kr.update(data);
  }

  // -- Progress Update --
  async logProgressUpdate(businessId: string, updatedByUserId: string, data: any) {
    let kr = null;
    if (data.keyResultId) {
      kr = await db.KeyResult.findOne({ where: { id: data.keyResultId, businessId } });
      if (!kr) throw new Error("KeyResult not found");
    }

    const obj = await db.Objective.findOne({ where: { id: data.objectiveId, businessId } });
    if (!obj) throw new Error("Objective not found");

    const progressValue = data.progressValue;
    let progressPercent = 0;
    if (kr && kr.targetValue !== kr.baselineValue) {
      progressPercent = ((progressValue - kr.baselineValue) / (kr.targetValue - kr.baselineValue)) * 100;
      if (progressPercent > 100) progressPercent = 100;
      if (progressPercent < 0) progressPercent = 0;
    }

    const update = await db.OKRProgressUpdate.create({
      ...data,
      businessId,
      updatedByUserId,
      progressPercent
    });

    if (kr) {
      await kr.update({ currentValue: progressValue });
      await this.calculateObjectiveProgress(businessId, obj.id);
    }

    // Notify Owner
    if (obj.ownerUserId && obj.ownerUserId !== updatedByUserId) {
      await InternalNotifier.send({
        businessId, recipientUserId: obj.ownerUserId, moduleKey: 'okr',
        type: 'okr_progress_update', title: 'OKR Progress Update',
        message: \`A new progress update was logged for "\${obj.title}".\`,
        entityType: 'okr_objective', entityId: obj.id
      });
    }

    return update;
  }

  async calculateObjectiveProgress(businessId: string, objectiveId: string) {
    const obj = await db.Objective.findOne({ where: { id: objectiveId, businessId }, include: [{ model: db.KeyResult, as: 'keyResults' }] });
    if (!obj) return;

    if (!obj.keyResults || obj.keyResults.length === 0) {
      return 0; // No KRs
    }

    let totalWeight = 0;
    let weightedProgress = 0;

    for (const kr of obj.keyResults) {
      let pct = 0;
      if (kr.targetValue !== kr.baselineValue) {
         pct = ((kr.currentValue - kr.baselineValue) / (kr.targetValue - kr.baselineValue)) * 100;
      }
      if (pct > 100) pct = 100;
      if (pct < 0) pct = 0;

      const w = kr.weight || 1;
      totalWeight += w;
      weightedProgress += (pct * w);
    }

    const overallProgress = totalWeight > 0 ? (weightedProgress / totalWeight) : 0;
    
    // We can store the overallProgress in a metadata field or a new column on Objective, but we'll put it in metadata for now.
    const metadata = obj.metadata || {};
    metadata.calculatedProgress = overallProgress;
    await obj.update({ metadata });

    return overallProgress;
  }

  // -- Evaluation --
  async evaluateObjective(businessId: string, evaluatedByUserId: string, data: any) {
    const obj = await db.Objective.findOne({ where: { id: data.objectiveId, businessId } });
    if (!obj) throw new Error("Objective not found");

    const evaluation = await db.OKREvaluation.create({
      ...data,
      businessId,
      evaluatedByUserId
    });

    if (data.status) {
      await obj.update({ status: data.status });
    }

    // Notify Owner
    if (obj.ownerUserId && obj.ownerUserId !== evaluatedByUserId) {
      await InternalNotifier.send({
        businessId, recipientUserId: obj.ownerUserId, moduleKey: 'okr',
        type: 'okr_evaluation', title: 'OKR Evaluation Completed',
        message: \`Your objective "\${obj.title}" has been evaluated.\`,
        entityType: 'okr_objective', entityId: obj.id
      });
    }

    return evaluation;
  }

}
`);

// -- Controller --
fs.writeFileSync(path.join(src, 'modules', 'okr', 'okr.controller.ts'), `
import type { Request, Response } from 'express';
import { OKRService } from './okr.service';
import { AuditLogService } from '../../services/auditLog.service';

export class OKRController {
  private service = new OKRService();

  createObjective = async (req: Request, res: Response) => {
    try {
      const obj = await this.service.createObjective(req.user!.businessId, req.user!.id, req.body);
      await AuditLogService.log('CREATE_OBJECTIVE', 'okr_objective', String(obj.id), null, obj, req);
      res.status(201).json({ objective: obj });
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  };

  updateObjective = async (req: Request, res: Response) => {
    try {
      const obj = await this.service.updateObjective(req.user!.businessId, req.params.id, req.body);
      await AuditLogService.log('UPDATE_OBJECTIVE', 'okr_objective', String(obj.id), null, req.body, req);
      res.json({ objective: obj });
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  };

  getObjective = async (req: Request, res: Response) => {
    const obj = await this.service.getObjective(req.user!.businessId, req.params.id);
    if (!obj) return res.status(404).json({ message: 'Not found' });
    res.json({ objective: obj });
  };

  listObjectives = async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const size = parseInt(req.query.size as string) || 20;
    res.json(await this.service.listObjectives(req.user!.businessId, req.query, page, size));
  };

  createKeyResult = async (req: Request, res: Response) => {
    try {
      const kr = await this.service.createKeyResult(req.user!.businessId, req.body.objectiveId, req.body);
      await AuditLogService.log('CREATE_KEY_RESULT', 'okr_key_result', String(kr.id), null, kr, req);
      res.status(201).json({ keyResult: kr });
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  };

  updateKeyResult = async (req: Request, res: Response) => {
    try {
      const kr = await this.service.updateKeyResult(req.user!.businessId, req.params.id, req.body);
      await AuditLogService.log('UPDATE_KEY_RESULT', 'okr_key_result', String(kr.id), null, req.body, req);
      res.json({ keyResult: kr });
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  };

  logProgressUpdate = async (req: Request, res: Response) => {
    try {
      const update = await this.service.logProgressUpdate(req.user!.businessId, req.user!.id, req.body);
      await AuditLogService.log('LOG_OKR_PROGRESS', 'okr_progress_update', String(update.id), null, update, req);
      res.status(201).json({ progressUpdate: update });
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  };

  evaluateObjective = async (req: Request, res: Response) => {
    try {
      const evaluation = await this.service.evaluateObjective(req.user!.businessId, req.user!.id, req.body);
      await AuditLogService.log('EVALUATE_OBJECTIVE', 'okr_evaluation', String(evaluation.id), null, evaluation, req);
      res.status(201).json({ evaluation });
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  };
}
`);

// -- Routes --
fs.writeFileSync(path.join(src, 'modules', 'okr', 'okr.routes.ts'), `
import { Router } from 'express';
import { authRequired } from '../../middlewares/auth';
import { requireRole } from '../../middlewares/role';
import { requireActiveModule } from '../../middlewares/module';
import { asyncHandler } from '../../utils/asyncHandler';
import { OKRController } from './okr.controller';

const router = Router();
const controller = new OKRController();

router.use(authRequired, requireActiveModule('okr'));

// Objective
router.post('/objectives', asyncHandler(controller.createObjective));
router.get('/objectives', asyncHandler(controller.listObjectives));
router.get('/objectives/:id', asyncHandler(controller.getObjective));
router.patch('/objectives/:id', asyncHandler(controller.updateObjective));

// Key Result
router.post('/key-results', asyncHandler(controller.createKeyResult));
router.patch('/key-results/:id', asyncHandler(controller.updateKeyResult));

// Progress Update
router.post('/progress', asyncHandler(controller.logProgressUpdate));

// Evaluation
router.post('/evaluations', requireRole('HR_MANAGER', 'BUSINESS_ADMIN', 'DEPARTMENT_HEAD'), asyncHandler(controller.evaluateObjective));

export const okrRoutes = router;
`);

console.log('OKR Scaffolding Created.');
