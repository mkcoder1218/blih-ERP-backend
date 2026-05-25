const fs = require('fs');
const path = require('path');

const root = process.cwd();
const src = path.join(root, 'src');
const modelsPath = path.join(src, 'models');
const ensureDir = (d) => fs.mkdirSync(d, { recursive: true });

// 1. ProjectChangeRequest Model
fs.writeFileSync(path.join(modelsPath, 'ProjectChangeRequest.ts'), `
import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type ProjectChangeRequestModel = ModelStatic<any> & { associate?: (models: any) => void; };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): ProjectChangeRequestModel => {
  const ProjectChangeRequest = sequelize.define("ProjectChangeRequest", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    businessId: { type: dataTypes.UUID, allowNull: false },
    projectId: { type: dataTypes.UUID, allowNull: false },
    requestedByUserId: { type: dataTypes.UUID, allowNull: false },
    title: { type: dataTypes.STRING(255), allowNull: false },
    description: { type: dataTypes.TEXT, allowNull: false },
    impactOnCost: { type: dataTypes.FLOAT, defaultValue: 0 },
    impactOnTimeline: { type: dataTypes.INTEGER, defaultValue: 0, comment: 'days' },
    priority: { type: dataTypes.STRING(50), defaultValue: "normal" },
    status: { type: dataTypes.STRING(50), defaultValue: "pending" }, // pending, approved, rejected, implemented
    metadata: { type: dataTypes.JSONB, defaultValue: {} }
  }, { tableName: "project_change_requests", timestamps: true, paranoid: true }) as ProjectChangeRequestModel;

  ProjectChangeRequest.associate = (models: any) => {
    models.ProjectChangeRequest.belongsTo(models.Business, { foreignKey: "businessId" });
    models.ProjectChangeRequest.belongsTo(models.Project, { foreignKey: "projectId" });
    if(models.User) {
       models.ProjectChangeRequest.belongsTo(models.User, { foreignKey: "requestedByUserId", as: "requester" });
    }
  };
  return ProjectChangeRequest;
};
`);

// 2. Full Projects Service Replacement
fs.writeFileSync(path.join(src, 'modules', 'projects', 'projects.service.ts'), `
import { db } from '../../models';
import { InternalNotifier } from '../notification/notification.service';

export class ProjectsService {
  
  async provisionForms(businessId: string) {
     const templates = [
        { key: 'project_brief', title: 'Project Brief Form' },
        { key: 'project_kickoff', title: 'Project Kick-off Form' },
        { key: 'milestone_setup', title: 'Milestone Setup Form' },
        { key: 'task_assignment', title: 'Task Assignment Form' },
        { key: 'internal_deliverable_approval', title: 'Internal Deliverable Approval Form' },
        { key: 'client_deliverable_approval', title: 'Client Deliverable Approval Form' },
        { key: 'change_request', title: 'Change Request Form' },
        { key: 'issue_bug_report', title: 'Issue / Bug Report Form' },
        { key: 'risk_log', title: 'Risk Log Form' },
        { key: 'completion_record', title: 'Completion Record Form' },
        { key: 'client_approval', title: 'Client Approval Form' },
        { key: 'final_project_closure', title: 'Final Project Closure Form' },
        { key: 'lessons_learned', title: 'Lessons Learned Form' }
     ];
     for (const t of templates) {
        const existing = await db.FormDefinition.findOne({ where: { businessId, key: t.key } });
        if (!existing) {
           await db.FormDefinition.create({
              businessId, name: t.title, key: t.key, visibility: 'internal',
              version: 1, schema: { type: 'object', properties: {} }
           });
        }
     }
  }

  async createProject(businessId: string, data: any) {
    return db.Project.create({ ...data, businessId });
  }

  async createProjectFromDeal(businessId: string, dealId: string, projectManagerUserId: string) {
    const d = await db.Deal.findOne({ where: { id: dealId, businessId, status: 'won' } });
    if(!d) throw new Error("Won Deal not found");
    
    return db.Project.create({
      businessId,
      dealId: d.id,
      clientId: d.clientId,
      projectManagerUserId,
      title: d.title,
      currency: d.currency,
      budget: d.value,
      status: 'planning',
      metadata: { source: 'deal_conversion', originalDealId: dealId }
    });
  }

  async getProjects(businessId: string, userId: string, bypass: boolean, page: number, size: number) {
    const where: any = { businessId };
    if (!bypass) {
       // Deep restrictions based on explicit roles can be added, currently bypass is used at controller level 
       // For simple assignments:
       where.projectManagerUserId = userId; 
    }
    return db.Project.findAndCountAll({ where, offset: (page-1)*size, limit: size });
  }

  async createMilestone(businessId: string, data: any) {
    return db.ProjectMilestone.create({ ...data, businessId });
  }

  async updateMilestone(businessId: string, id: string, data: any) {
    const m = await db.ProjectMilestone.findOne({ where: { id, businessId } });
    if(!m) throw new Error("Milestone not found");
    return m.update(data);
  }

  async listMilestones(businessId: string, projectId: string) {
    return db.ProjectMilestone.findAll({ where: { businessId, projectId } });
  }

  async createTask(businessId: string, data: any) {
    const t = await db.ProjectTask.create({ ...data, businessId });
    if (t.assignedToUserId) await this.notify(businessId, t.assignedToUserId, 'Task Assigned', 'You have been assigned a new project task.', 'project_task', t.id);
    return t;
  }

  async assignTask(businessId: string, id: string, assignedToUserId: string) {
    const t = await db.ProjectTask.findOne({ where: { id, businessId } });
    if(!t) throw new Error("Task not found");
    await t.update({ assignedToUserId });
    await this.notify(businessId, assignedToUserId, 'Task Assigned', 'You have been explicitly assigned to a project task.', 'project_task', id);
    return t;
  }

  async updateTaskStatus(businessId: string, id: string, status: string) {
    const t = await db.ProjectTask.findOne({ where: { id, businessId } });
    if(!t) throw new Error("Task not found");
    await t.update({ status });
    return t;
  }

  async listTasks(businessId: string, projectId: string) {
    return db.ProjectTask.findAndCountAll({ where: { businessId, projectId } });
  }

  async createIssue(businessId: string, data: any) {
    const i = await db.ProjectIssue.create({ ...data, businessId });
    if (i.assignedToUserId) await this.notify(businessId, i.assignedToUserId, 'Issue Assigned', 'You have an active issue assignment.', 'project_issue', i.id);
    return i;
  }

  async listIssues(businessId: string, projectId: string) {
    return db.ProjectIssue.findAndCountAll({ where: { businessId, projectId } });
  }

  async createChangeRequest(businessId: string, data: any) {
    return db.ProjectChangeRequest.create({ ...data, businessId });
  }

  async listChangeRequests(businessId: string, projectId: string) {
    return db.ProjectChangeRequest.findAndCountAll({ where: { businessId, projectId } });
  }

  async getProjectProgress(businessId: string, projectId: string) {
    // Calculates abstract completion percentage based on mapped tasks 
    const tasks = await db.ProjectTask.findAll({ where: { businessId, projectId } });
    if (tasks.length === 0) return { totalTasks: 0, completedTasks: 0, progressPercent: 0 };
    
    const completed = tasks.filter((t: any) => t.status === 'done').length;
    const progressPercent = Math.round((completed / tasks.length) * 100);
    return { totalTasks: tasks.length, completedTasks: completed, progressPercent };
  }

  private async notify(businessId: string, recipientUserId: string, title: string, message: string, entityType: string, entityId: string) {
    try {
      await InternalNotifier.send({ businessId, recipientUserId, moduleKey: 'projects', type: 'assignment', title, message, entityType, entityId });
    } catch(e) {}
  }
}
`);

// 3. Update Controller logic
fs.writeFileSync(path.join(src, 'modules', 'projects', 'projects.controller.ts'), `
import type { Request, Response } from 'express';
import { ProjectsService } from './projects.service';
import { AuditLogService } from '../../services/auditLog.service';
import { errorResponse, successResponse, paginationResponse } from '../../utils/response';

export class ProjectsController {
  private service = new ProjectsService();

  seedForms = async (req: Request, res: Response) => {
    await this.service.provisionForms(req.user!.businessId);
    successResponse(res, null, "Project forms seeded successfully.");
  };

  createProject = async (req: Request, res: Response) => {
    try {
      let p = null;
      if (req.body.dealId) {
         p = await this.service.createProjectFromDeal(req.user!.businessId, req.body.dealId, req.body.projectManagerUserId);
      } else {
         p = await this.service.createProject(req.user!.businessId, req.body);
      }
      await AuditLogService.log('CREATE_PROJECT', 'project', String(p.id), null, p, req);
      successResponse(res, p, "Project created", 201);
    } catch(e: any) { errorResponse(res, e.message); }
  };

  listProjects = async (req: Request, res: Response) => {
    try {
      const bypass = req.user!.isPlatformSuperAdmin || (res.locals.hasRole && res.locals.hasRole('BUSINESS_ADMIN'));
      const page = parseInt(req.query.page as string) || 1;
      const size = parseInt(req.query.size as string) || 20;
      const data = await this.service.getProjects(req.user!.businessId, req.user!.id, bypass, page, size);
      paginationResponse(res, data.rows, data.count, page, size);
    } catch(e: any) { errorResponse(res, e.message); }
  };

  createMilestone = async (req: Request, res: Response) => {
    try {
      const m = await this.service.createMilestone(req.user!.businessId, req.body);
      await AuditLogService.log('CREATE_MILESTONE', 'project_milestone', String(m.id), null, m, req);
      successResponse(res, m, "Milestone created", 201);
    } catch(e: any) { errorResponse(res, e.message); }
  };

  listMilestones = async (req: Request, res: Response) => {
    try {
      if(!req.query.projectId) return errorResponse(res, "projectId is required");
      const data = await this.service.listMilestones(req.user!.businessId, req.query.projectId as string);
      successResponse(res, data);
    } catch(e: any) { errorResponse(res, e.message); }
  };

  createTask = async (req: Request, res: Response) => {
    try {
      const t = await this.service.createTask(req.user!.businessId, req.body);
      await AuditLogService.log('CREATE_TASK', 'project_task', String(t.id), null, t, req);
      successResponse(res, t, "Task created", 201);
    } catch(e: any) { errorResponse(res, e.message); }
  };

  assignTask = async (req: Request, res: Response) => {
    try {
      const t = await this.service.assignTask(req.user!.businessId, req.params.id, req.body.assignedToUserId);
      successResponse(res, t);
    } catch(e: any) { errorResponse(res, e.message); }
  };

  updateTaskStatus = async (req: Request, res: Response) => {
    try {
      const t = await this.service.updateTaskStatus(req.user!.businessId, req.params.id, req.body.status);
      successResponse(res, t);
    } catch(e: any) { errorResponse(res, e.message); }
  };

  listTasks = async (req: Request, res: Response) => {
    try {
      if(!req.query.projectId) return errorResponse(res, "projectId is required");
      const data = await this.service.listTasks(req.user!.businessId, req.query.projectId as string);
      successResponse(res, data);
    } catch(e: any) { errorResponse(res, e.message); }
  };

  createIssue = async (req: Request, res: Response) => {
    try {
       const mappedBody = { ...req.body, reportedByUserId: req.user!.id };
       const i = await this.service.createIssue(req.user!.businessId, mappedBody);
       await AuditLogService.log('CREATE_ISSUE', 'project_issue', String(i.id), null, i, req);
       successResponse(res, i, "Issue created", 201);
    } catch(e: any) { errorResponse(res, e.message); }
  };

  listIssues = async (req: Request, res: Response) => {
    try {
      if(!req.query.projectId) return errorResponse(res, "projectId is required");
      const data = await this.service.listIssues(req.user!.businessId, req.query.projectId as string);
      successResponse(res, data);
    } catch(e: any) { errorResponse(res, e.message); }
  };
  
  createChangeRequest = async (req: Request, res: Response) => {
    try {
       const mappedBody = { ...req.body, requestedByUserId: req.user!.id };
       const cr = await this.service.createChangeRequest(req.user!.businessId, mappedBody);
       await AuditLogService.log('CREATE_CHANGE_REQUEST', 'project_change_request', String(cr.id), null, cr, req);
       successResponse(res, cr, "Change Request created", 201);
    } catch(e: any) { errorResponse(res, e.message); }
  };

  listChangeRequests = async (req: Request, res: Response) => {
    try {
      if(!req.query.projectId) return errorResponse(res, "projectId is required");
      const data = await this.service.listChangeRequests(req.user!.businessId, req.query.projectId as string);
      successResponse(res, data);
    } catch(e: any) { errorResponse(res, e.message); }
  };

  getProjectProgress = async (req: Request, res: Response) => {
    try {
      const data = await this.service.getProjectProgress(req.user!.businessId, req.params.id);
      successResponse(res, data);
    } catch(e: any) { errorResponse(res, e.message); }
  }
}
`);

// 4. Projects routes rewriting
fs.writeFileSync(path.join(src, 'modules', 'projects', 'projects.routes.ts'), `
import { Router } from 'express';
import { authRequired } from '../../middlewares/auth';
import { requireRole } from '../../middlewares/role';
import { requireActiveModule } from '../../middlewares/requireActiveModule';
import { asyncHandler } from '../../utils/asyncHandler';
import { ProjectsController } from './projects.controller';

const router = Router();
const controller = new ProjectsController();

// App boundary
router.use(requireActiveModule('projects'));
router.use(authRequired);

router.post('/templates', requireRole('BUSINESS_ADMIN'), asyncHandler(controller.seedForms));

// Project
router.post('/', asyncHandler(controller.createProject));
router.get('/', asyncHandler(controller.listProjects));
router.get('/:id/progress', asyncHandler(controller.getProjectProgress));

// Milestones
router.post('/milestones', asyncHandler(controller.createMilestone));
router.get('/milestones', asyncHandler(controller.listMilestones));

// Tasks
router.post('/tasks', asyncHandler(controller.createTask));
router.get('/tasks', asyncHandler(controller.listTasks));
router.patch('/tasks/:id/assign', asyncHandler(controller.assignTask));
router.patch('/tasks/:id/status', asyncHandler(controller.updateTaskStatus));

// Issues
router.post('/issues', asyncHandler(controller.createIssue));
router.get('/issues', asyncHandler(controller.listIssues));

// Change Requests
router.post('/change-requests', asyncHandler(controller.createChangeRequest));
router.get('/change-requests', asyncHandler(controller.listChangeRequests));

export const projectsRoutes = router;
`);

console.log("Projects Setup complete.");
