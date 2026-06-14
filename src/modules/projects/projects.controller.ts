
import type { Request, Response } from 'express';
import { ProjectsService } from './projects.service';
import { AuditLogService } from '../../services/auditLog.service';
import { errorResponse, successResponse, paginationResponse } from '../../utils/response';
import { db } from '../../models';

export class ProjectsController {
  private service = new ProjectsService();

  private hasFullProjectAccess(req: Request) {
    const permissions = new Set(req.user!.permissions || []);
    return Boolean(
      req.user!.isPlatformSuperAdmin ||
      (req.user!.roles || []).includes("BUSINESS_ADMIN") ||
      permissions.has("project.read") ||
      permissions.has("project.manage")
    );
  }

  private async canAccessProject(req: Request, projectId: string) {
    if (this.hasFullProjectAccess(req)) return true;
    const employee = await db.EmployeeRecord.findOne({ where: { businessId: req.user!.businessId, userId: req.user!.id }, attributes: ["id"] });
    if (!employee) return false;
    const project = await db.Project.findOne({
      where: { id: projectId, businessId: req.user!.businessId },
      attributes: ["id", "ownerEmployeeId", "managerEmployeeId", "projectManagerUserId"]
    });
    if (!project) return false;
    if (project.projectManagerUserId === req.user!.id || project.ownerEmployeeId === employee.id || project.managerEmployeeId === employee.id) return true;
    const [member, task] = await Promise.all([
      db.ProjectMember.findOne({ where: { businessId: req.user!.businessId, projectId, employeeId: employee.id }, attributes: ["id"] }),
      db.ProjectTask.findOne({ where: { businessId: req.user!.businessId, projectId, assigneeEmployeeId: employee.id }, attributes: ["id"] })
    ]);
    return Boolean(member || task);
  }

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
         p = await this.service.createProject(req.user!.businessId, {
           ...req.body,
           projectManagerUserId: req.body.projectManagerUserId || req.user!.id
         });
      }
      await AuditLogService.log('CREATE_PROJECT', 'project', String(p.id), null, p, req);
      successResponse(res, p, "Project created", 201);
    } catch(e: any) { errorResponse(res, e.message); }
  };

  listProjects = async (req: Request, res: Response) => {
    try {
      const permissions = new Set(req.user!.permissions || []);
      const bypass =
        req.user!.isPlatformSuperAdmin ||
        (res.locals.hasRole && res.locals.hasRole('BUSINESS_ADMIN')) ||
        permissions.has("project.read") ||
        permissions.has("project.manage");
      const page = Number(req.query.page) || 1;
      const size = Number(req.query.size) || 20;
      const data = await this.service.getProjects(req.user!.businessId, req.user!.id, bypass, page, size, req.query);
      paginationResponse(res, data.rows, data.count, page, size);
    } catch(e: any) { errorResponse(res, e.message); }
  };

  viewProject = async (req: Request, res: Response) => {
    try {
      if (!(await this.canAccessProject(req, req.params.id))) return errorResponse(res, "Project not found", 404);
      const project = await this.service.getProjectById(req.user!.businessId, req.params.id);
      successResponse(res, project);
    } catch(e: any) { errorResponse(res, e.message, e.message === "Project not found" ? 404 : 400); }
  };

  updateProject = async (req: Request, res: Response) => {
    try {
      const { before, project } = await this.service.updateProject(req.user!.businessId, req.params.id, req.body);
      await AuditLogService.log('UPDATE_PROJECT', 'project', String(project.id), before, project, req);
      await this.service.logActivity(req.user!.businessId, {
        projectId: project.id,
        action: "PROJECT_UPDATED",
        entityType: "project",
        entityId: project.id,
        before,
        after: project.toJSON ? project.toJSON() : project
      });
      successResponse(res, project, "Project updated");
    } catch(e: any) { errorResponse(res, e.message, e.message === "Project not found" ? 404 : 400); }
  };

  changeProjectStatus = async (req: Request, res: Response) => {
    try {
      const { before, project } = await this.service.changeProjectStatus(req.user!.businessId, req.params.id, req.body.status);
      await AuditLogService.log('CHANGE_PROJECT_STATUS', 'project', String(project.id), before, project, req);
      await this.service.logActivity(req.user!.businessId, {
        projectId: project.id,
        action: "PROJECT_STATUS_CHANGED",
        entityType: "project",
        entityId: project.id,
        before,
        after: project.toJSON ? project.toJSON() : project
      });
      successResponse(res, project, "Project status changed");
    } catch(e: any) { errorResponse(res, e.message, e.message === "Project not found" ? 404 : 400); }
  };

  archiveProject = async (req: Request, res: Response) => {
    try {
      const { before, project } = await this.service.archiveProject(req.user!.businessId, req.params.id);
      await AuditLogService.log('ARCHIVE_PROJECT', 'project', String(project.id), before, project, req);
      await this.service.logActivity(req.user!.businessId, {
        projectId: project.id,
        action: "PROJECT_ARCHIVED",
        entityType: "project",
        entityId: project.id,
        before,
        after: project.toJSON ? project.toJSON() : project
      });
      successResponse(res, project, "Project archived");
    } catch(e: any) { errorResponse(res, e.message, e.message === "Project not found" ? 404 : 400); }
  };

  listMembers = async (req: Request, res: Response) => {
    try {
      const members = await this.service.listMembers(req.user!.businessId, req.params.projectId);
      successResponse(res, members);
    } catch(e: any) { errorResponse(res, e.message, e.message === "Project not found" ? 404 : 400); }
  };

  addMember = async (req: Request, res: Response) => {
    try {
      const member = await this.service.addMember(req.user!.businessId, { ...req.body, projectId: req.params.projectId });
      await AuditLogService.log('ADD_PROJECT_MEMBER', 'project_member', String(member.id), null, member, req);
      await this.service.logActivity(req.user!.businessId, {
        projectId: req.params.projectId,
        actorEmployeeId: member.employeeId,
        action: "PROJECT_MEMBER_ADDED",
        entityType: "project_member",
        entityId: member.id,
        after: member.toJSON ? member.toJSON() : member
      });
      successResponse(res, member, "Project member added", 201);
    } catch(e: any) { errorResponse(res, e.message, e.message === "Project not found" || e.message === "Employee not found" ? 404 : 400); }
  };

  bulkAddMembers = async (req: Request, res: Response) => {
    try {
      const members = await this.service.bulkAddMembers(req.user!.businessId, req.params.projectId, req.body.members);
      await AuditLogService.log('BULK_ADD_PROJECT_MEMBERS', 'project_member', req.params.projectId, null, members, req);
      for (const member of members) {
        await this.service.logActivity(req.user!.businessId, {
          projectId: req.params.projectId,
          actorEmployeeId: member.employeeId,
          action: "PROJECT_MEMBER_ADDED",
          entityType: "project_member",
          entityId: member.id,
          after: member.toJSON ? member.toJSON() : member
        });
      }
      successResponse(res, members, "Project members added", 201);
    } catch(e: any) { errorResponse(res, e.message, e.message === "Project not found" || e.message === "Employee not found" ? 404 : 400); }
  };

  updateMember = async (req: Request, res: Response) => {
    try {
      const { before, member } = await this.service.updateMember(req.user!.businessId, req.params.projectId, req.params.memberId, req.body);
      const action = before.role !== member.role ? "CHANGE_PROJECT_MEMBER_ROLE" : "UPDATE_PROJECT_MEMBER";
      await AuditLogService.log(action, 'project_member', String(member.id), before, member, req);
      await this.service.logActivity(req.user!.businessId, {
        projectId: req.params.projectId,
        actorEmployeeId: member.employeeId,
        action: before.role !== member.role ? "PROJECT_MEMBER_ROLE_CHANGED" : "PROJECT_MEMBER_UPDATED",
        entityType: "project_member",
        entityId: member.id,
        before,
        after: member.toJSON ? member.toJSON() : member
      });
      successResponse(res, member, "Project member updated");
    } catch(e: any) { errorResponse(res, e.message, e.message === "Project not found" || e.message === "Project member not found" ? 404 : 400); }
  };

  removeMember = async (req: Request, res: Response) => {
    try {
      const { before, member } = await this.service.removeMember(req.user!.businessId, req.params.projectId, req.params.memberId);
      await AuditLogService.log('REMOVE_PROJECT_MEMBER', 'project_member', String(member.id), before, null, req);
      await this.service.logActivity(req.user!.businessId, {
        projectId: req.params.projectId,
        actorEmployeeId: before.employeeId,
        action: "PROJECT_MEMBER_REMOVED",
        entityType: "project_member",
        entityId: member.id,
        before
      });
      successResponse(res, null, "Project member removed");
    } catch(e: any) { errorResponse(res, e.message, e.message === "Project not found" || e.message === "Project member not found" ? 404 : 400); }
  };

  createNestedTask = async (req: Request, res: Response) => {
    try {
      if (!(await this.canAccessProject(req, req.params.projectId))) return errorResponse(res, "Project not found", 404);
      const task = await this.service.createNestedTask(req.user!.businessId, req.params.projectId, req.body);
      await AuditLogService.log('CREATE_PROJECT_TASK', 'project_task', String(task.id), null, task, req);
      await this.service.logActivity(req.user!.businessId, {
        projectId: req.params.projectId,
        taskId: task.id,
        actorEmployeeId: task.assigneeEmployeeId,
        action: "PROJECT_TASK_CREATED",
        entityType: "project_task",
        entityId: task.id,
        after: task.toJSON ? task.toJSON() : task
      });
      successResponse(res, task, "Task created", 201);
    } catch(e: any) { errorResponse(res, e.message, e.message === "Project not found" || e.message === "Employee not found" ? 404 : 400); }
  };

  listNestedTasks = async (req: Request, res: Response) => {
    try {
      if (!(await this.canAccessProject(req, req.params.projectId))) return errorResponse(res, "Project not found", 404);
      const page = Number(req.query.page) || 1;
      const size = Number(req.query.size) || 50;
      const data = await this.service.listNestedTasks(req.user!.businessId, req.params.projectId, page, size, req.query);
      paginationResponse(res, data.rows, data.count, page, size);
    } catch(e: any) { errorResponse(res, e.message, e.message === "Project not found" ? 404 : 400); }
  };

  viewNestedTask = async (req: Request, res: Response) => {
    try {
      const task = await this.service.getNestedTask(req.user!.businessId, req.params.projectId, req.params.taskId);
      successResponse(res, task);
    } catch(e: any) { errorResponse(res, e.message, e.message === "Project not found" || e.message === "Task not found" ? 404 : 400); }
  };

  updateNestedTask = async (req: Request, res: Response) => {
    try {
      const { before, task } = await this.service.updateNestedTask(req.user!.businessId, req.params.projectId, req.params.taskId, req.body);
      await AuditLogService.log('UPDATE_PROJECT_TASK', 'project_task', String(task.id), before, task, req);
      await this.service.logActivity(req.user!.businessId, {
        projectId: req.params.projectId,
        taskId: task.id,
        actorEmployeeId: task.assigneeEmployeeId,
        action: "PROJECT_TASK_UPDATED",
        entityType: "project_task",
        entityId: task.id,
        before,
        after: task.toJSON ? task.toJSON() : task
      });
      successResponse(res, task, "Task updated");
    } catch(e: any) { errorResponse(res, e.message, e.message === "Project not found" || e.message === "Task not found" || e.message === "Employee not found" ? 404 : 400); }
  };

  deleteNestedTask = async (req: Request, res: Response) => {
    try {
      const { before, task } = await this.service.deleteNestedTask(req.user!.businessId, req.params.projectId, req.params.taskId);
      await AuditLogService.log('DELETE_PROJECT_TASK', 'project_task', String(task.id), before, null, req);
      await this.service.logActivity(req.user!.businessId, {
        projectId: req.params.projectId,
        taskId: task.id,
        action: "PROJECT_TASK_DELETED",
        entityType: "project_task",
        entityId: task.id,
        before
      });
      successResponse(res, null, "Task deleted");
    } catch(e: any) { errorResponse(res, e.message, e.message === "Project not found" || e.message === "Task not found" ? 404 : 400); }
  };

  assignNestedTask = async (req: Request, res: Response) => {
    try {
      const { before, task } = await this.service.assignNestedTask(req.user!.businessId, req.params.projectId, req.params.taskId, req.body.assigneeEmployeeId);
      await AuditLogService.log('ASSIGN_PROJECT_TASK', 'project_task', String(task.id), before, task, req);
      await this.service.logActivity(req.user!.businessId, {
        projectId: req.params.projectId,
        taskId: task.id,
        actorEmployeeId: task.assigneeEmployeeId,
        action: "PROJECT_TASK_ASSIGNED",
        entityType: "project_task",
        entityId: task.id,
        before,
        after: task.toJSON ? task.toJSON() : task
      });
      successResponse(res, task, "Task assigned");
    } catch(e: any) { errorResponse(res, e.message, e.message === "Project not found" || e.message === "Task not found" || e.message === "Employee not found" ? 404 : 400); }
  };

  changeNestedTaskStatus = async (req: Request, res: Response) => {
    try {
      if (!(await this.canAccessProject(req, req.params.projectId))) return errorResponse(res, "Project not found", 404);
      const { before, task } = await this.service.changeNestedTaskStatus(req.user!.businessId, req.params.projectId, req.params.taskId, req.body.status);
      await AuditLogService.log('CHANGE_PROJECT_TASK_STATUS', 'project_task', String(task.id), before, task, req);
      await this.service.logActivity(req.user!.businessId, {
        projectId: req.params.projectId,
        taskId: task.id,
        actorEmployeeId: task.assigneeEmployeeId,
        action: "PROJECT_TASK_STATUS_CHANGED",
        entityType: "project_task",
        entityId: task.id,
        before,
        after: task.toJSON ? task.toJSON() : task
      });
      successResponse(res, task, "Task status changed");
    } catch(e: any) { errorResponse(res, e.message, e.message === "Project not found" || e.message === "Task not found" ? 404 : 400); }
  };

  myTasks = async (req: Request, res: Response) => {
    try {
      const page = Number(req.query.page) || 1;
      const size = Number(req.query.size) || 50;
      const data = await this.service.getMyTasks(req.user!.businessId, req.user!.id, page, size, req.query);
      paginationResponse(res, data.rows, data.count, page, size);
    } catch(e: any) { errorResponse(res, e.message); }
  };

  listTaskComments = async (req: Request, res: Response) => {
    try {
      const comments = await this.service.listTaskComments(req.user!.businessId, req.params.projectId, req.params.taskId);
      successResponse(res, comments);
    } catch(e: any) { errorResponse(res, e.message, e.message === "Project not found" || e.message === "Task not found" ? 404 : 400); }
  };

  createTaskComment = async (req: Request, res: Response) => {
    try {
      const comment = await this.service.addTaskComment(req.user!.businessId, req.user!.id, req.params.projectId, req.params.taskId, req.body);
      await AuditLogService.log('CREATE_TASK_COMMENT', 'task_comment', String(comment.id), null, comment, req);
      successResponse(res, comment, "Comment created", 201);
    } catch(e: any) { errorResponse(res, e.message, e.message === "Project not found" || e.message === "Task not found" || e.message === "Employee not found" ? 404 : 400); }
  };

  updateTaskComment = async (req: Request, res: Response) => {
    try {
      const { before, comment } = await this.service.updateTaskComment(req.user!.businessId, req.user!.id, req.params.projectId, req.params.taskId, req.params.commentId, req.body);
      await AuditLogService.log('UPDATE_TASK_COMMENT', 'task_comment', String(comment.id), before, comment, req);
      successResponse(res, comment, "Comment updated");
    } catch(e: any) { errorResponse(res, e.message, e.message === "Project not found" || e.message === "Task not found" || e.message === "Comment not found" || e.message === "Employee not found" ? 404 : 400); }
  };

  deleteTaskComment = async (req: Request, res: Response) => {
    try {
      const { before, comment } = await this.service.deleteTaskComment(req.user!.businessId, req.user!.id, req.params.projectId, req.params.taskId, req.params.commentId);
      await AuditLogService.log('DELETE_TASK_COMMENT', 'task_comment', String(comment.id), before, null, req);
      successResponse(res, null, "Comment deleted");
    } catch(e: any) { errorResponse(res, e.message, e.message === "Project not found" || e.message === "Task not found" || e.message === "Comment not found" || e.message === "Employee not found" ? 404 : 400); }
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

  workflowCatalog = async (_req: Request, res: Response) => {
    try {
      const data = await this.service.getWorkflowCatalog();
      successResponse(res, data);
    } catch(e: any) { errorResponse(res, e.message); }
  };

  listWorkflowForms = async (req: Request, res: Response) => {
    try {
      const data = await this.service.listWorkflowForms(req.user!.businessId, req.params.projectId, req.query);
      successResponse(res, data);
    } catch(e: any) { errorResponse(res, e.message, e.message === "Project not found" ? 404 : 400); }
  };

  createWorkflowForm = async (req: Request, res: Response) => {
    try {
      const form = await this.service.createWorkflowForm(req.user!.businessId, req.user!.id, req.params.projectId, req.body);
      await AuditLogService.log('CREATE_PROJECT_WORKFLOW_FORM', 'project_workflow_form', String(form.id), null, form, req);
      successResponse(res, form, "Project workflow form created", 201);
    } catch(e: any) { errorResponse(res, e.message, e.message.includes("not found") ? 404 : 400); }
  };

  updateWorkflowForm = async (req: Request, res: Response) => {
    try {
      const form = await this.service.updateWorkflowForm(req.user!.businessId, req.user!.id, req.params.projectId, req.params.formId, req.body);
      await AuditLogService.log('UPDATE_PROJECT_WORKFLOW_FORM', 'project_workflow_form', String(form.id), null, form, req);
      successResponse(res, form, "Project workflow form updated");
    } catch(e: any) { errorResponse(res, e.message, e.message.includes("not found") ? 404 : 400); }
  };

  changeWorkflowFormStatus = async (req: Request, res: Response) => {
    try {
      const form = await this.service.changeWorkflowFormStatus(req.user!.businessId, req.user!.id, req.params.projectId, req.params.formId, req.body.status, req.body.metadata);
      await AuditLogService.log('CHANGE_PROJECT_WORKFLOW_FORM_STATUS', 'project_workflow_form', String(form.id), null, form, req);
      successResponse(res, form, "Project workflow form status updated");
    } catch(e: any) { errorResponse(res, e.message, e.message.includes("not found") ? 404 : 400); }
  };
}
