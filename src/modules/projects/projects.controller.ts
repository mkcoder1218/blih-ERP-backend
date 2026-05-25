
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
      let p: any = null;
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
