"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectsController = void 0;
const projects_service_1 = require("./projects.service");
const auditLog_service_1 = require("../../services/auditLog.service");
const response_1 = require("../../utils/response");
class ProjectsController {
    constructor() {
        this.service = new projects_service_1.ProjectsService();
        this.seedForms = async (req, res) => {
            await this.service.provisionForms(req.user.businessId);
            (0, response_1.successResponse)(res, null, "Project forms seeded successfully.");
        };
        this.createProject = async (req, res) => {
            try {
                let p = null;
                if (req.body.dealId) {
                    p = await this.service.createProjectFromDeal(req.user.businessId, req.body.dealId, req.body.projectManagerUserId);
                }
                else {
                    p = await this.service.createProject(req.user.businessId, {
                        ...req.body,
                        projectManagerUserId: req.body.projectManagerUserId || req.user.id
                    });
                }
                await auditLog_service_1.AuditLogService.log('CREATE_PROJECT', 'project', String(p.id), null, p, req);
                (0, response_1.successResponse)(res, p, "Project created", 201);
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        this.listProjects = async (req, res) => {
            try {
                const permissions = new Set(req.user.permissions || []);
                const bypass = req.user.isPlatformSuperAdmin ||
                    (res.locals.hasRole && res.locals.hasRole('BUSINESS_ADMIN')) ||
                    permissions.has("project.read") ||
                    permissions.has("project.manage");
                const page = Number(req.query.page) || 1;
                const size = Number(req.query.size) || 20;
                const data = await this.service.getProjects(req.user.businessId, req.user.id, bypass, page, size, req.query);
                (0, response_1.paginationResponse)(res, data.rows, data.count, page, size);
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        this.viewProject = async (req, res) => {
            try {
                const project = await this.service.getProjectById(req.user.businessId, req.params.id);
                (0, response_1.successResponse)(res, project);
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message, e.message === "Project not found" ? 404 : 400);
            }
        };
        this.updateProject = async (req, res) => {
            try {
                const { before, project } = await this.service.updateProject(req.user.businessId, req.params.id, req.body);
                await auditLog_service_1.AuditLogService.log('UPDATE_PROJECT', 'project', String(project.id), before, project, req);
                await this.service.logActivity(req.user.businessId, {
                    projectId: project.id,
                    action: "PROJECT_UPDATED",
                    entityType: "project",
                    entityId: project.id,
                    before,
                    after: project.toJSON ? project.toJSON() : project
                });
                (0, response_1.successResponse)(res, project, "Project updated");
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message, e.message === "Project not found" ? 404 : 400);
            }
        };
        this.changeProjectStatus = async (req, res) => {
            try {
                const { before, project } = await this.service.changeProjectStatus(req.user.businessId, req.params.id, req.body.status);
                await auditLog_service_1.AuditLogService.log('CHANGE_PROJECT_STATUS', 'project', String(project.id), before, project, req);
                await this.service.logActivity(req.user.businessId, {
                    projectId: project.id,
                    action: "PROJECT_STATUS_CHANGED",
                    entityType: "project",
                    entityId: project.id,
                    before,
                    after: project.toJSON ? project.toJSON() : project
                });
                (0, response_1.successResponse)(res, project, "Project status changed");
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message, e.message === "Project not found" ? 404 : 400);
            }
        };
        this.archiveProject = async (req, res) => {
            try {
                const { before, project } = await this.service.archiveProject(req.user.businessId, req.params.id);
                await auditLog_service_1.AuditLogService.log('ARCHIVE_PROJECT', 'project', String(project.id), before, project, req);
                await this.service.logActivity(req.user.businessId, {
                    projectId: project.id,
                    action: "PROJECT_ARCHIVED",
                    entityType: "project",
                    entityId: project.id,
                    before,
                    after: project.toJSON ? project.toJSON() : project
                });
                (0, response_1.successResponse)(res, project, "Project archived");
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message, e.message === "Project not found" ? 404 : 400);
            }
        };
        this.listMembers = async (req, res) => {
            try {
                const members = await this.service.listMembers(req.user.businessId, req.params.projectId);
                (0, response_1.successResponse)(res, members);
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message, e.message === "Project not found" ? 404 : 400);
            }
        };
        this.addMember = async (req, res) => {
            try {
                const member = await this.service.addMember(req.user.businessId, { ...req.body, projectId: req.params.projectId });
                await auditLog_service_1.AuditLogService.log('ADD_PROJECT_MEMBER', 'project_member', String(member.id), null, member, req);
                await this.service.logActivity(req.user.businessId, {
                    projectId: req.params.projectId,
                    actorEmployeeId: member.employeeId,
                    action: "PROJECT_MEMBER_ADDED",
                    entityType: "project_member",
                    entityId: member.id,
                    after: member.toJSON ? member.toJSON() : member
                });
                (0, response_1.successResponse)(res, member, "Project member added", 201);
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message, e.message === "Project not found" || e.message === "Employee not found" ? 404 : 400);
            }
        };
        this.bulkAddMembers = async (req, res) => {
            try {
                const members = await this.service.bulkAddMembers(req.user.businessId, req.params.projectId, req.body.members);
                await auditLog_service_1.AuditLogService.log('BULK_ADD_PROJECT_MEMBERS', 'project_member', req.params.projectId, null, members, req);
                for (const member of members) {
                    await this.service.logActivity(req.user.businessId, {
                        projectId: req.params.projectId,
                        actorEmployeeId: member.employeeId,
                        action: "PROJECT_MEMBER_ADDED",
                        entityType: "project_member",
                        entityId: member.id,
                        after: member.toJSON ? member.toJSON() : member
                    });
                }
                (0, response_1.successResponse)(res, members, "Project members added", 201);
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message, e.message === "Project not found" || e.message === "Employee not found" ? 404 : 400);
            }
        };
        this.updateMember = async (req, res) => {
            try {
                const { before, member } = await this.service.updateMember(req.user.businessId, req.params.projectId, req.params.memberId, req.body);
                const action = before.role !== member.role ? "CHANGE_PROJECT_MEMBER_ROLE" : "UPDATE_PROJECT_MEMBER";
                await auditLog_service_1.AuditLogService.log(action, 'project_member', String(member.id), before, member, req);
                await this.service.logActivity(req.user.businessId, {
                    projectId: req.params.projectId,
                    actorEmployeeId: member.employeeId,
                    action: before.role !== member.role ? "PROJECT_MEMBER_ROLE_CHANGED" : "PROJECT_MEMBER_UPDATED",
                    entityType: "project_member",
                    entityId: member.id,
                    before,
                    after: member.toJSON ? member.toJSON() : member
                });
                (0, response_1.successResponse)(res, member, "Project member updated");
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message, e.message === "Project not found" || e.message === "Project member not found" ? 404 : 400);
            }
        };
        this.removeMember = async (req, res) => {
            try {
                const { before, member } = await this.service.removeMember(req.user.businessId, req.params.projectId, req.params.memberId);
                await auditLog_service_1.AuditLogService.log('REMOVE_PROJECT_MEMBER', 'project_member', String(member.id), before, null, req);
                await this.service.logActivity(req.user.businessId, {
                    projectId: req.params.projectId,
                    actorEmployeeId: before.employeeId,
                    action: "PROJECT_MEMBER_REMOVED",
                    entityType: "project_member",
                    entityId: member.id,
                    before
                });
                (0, response_1.successResponse)(res, null, "Project member removed");
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message, e.message === "Project not found" || e.message === "Project member not found" ? 404 : 400);
            }
        };
        this.createNestedTask = async (req, res) => {
            try {
                const task = await this.service.createNestedTask(req.user.businessId, req.params.projectId, req.body);
                await auditLog_service_1.AuditLogService.log('CREATE_PROJECT_TASK', 'project_task', String(task.id), null, task, req);
                await this.service.logActivity(req.user.businessId, {
                    projectId: req.params.projectId,
                    taskId: task.id,
                    actorEmployeeId: task.assigneeEmployeeId,
                    action: "PROJECT_TASK_CREATED",
                    entityType: "project_task",
                    entityId: task.id,
                    after: task.toJSON ? task.toJSON() : task
                });
                (0, response_1.successResponse)(res, task, "Task created", 201);
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message, e.message === "Project not found" || e.message === "Employee not found" ? 404 : 400);
            }
        };
        this.listNestedTasks = async (req, res) => {
            try {
                const page = Number(req.query.page) || 1;
                const size = Number(req.query.size) || 50;
                const data = await this.service.listNestedTasks(req.user.businessId, req.params.projectId, page, size, req.query);
                (0, response_1.paginationResponse)(res, data.rows, data.count, page, size);
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message, e.message === "Project not found" ? 404 : 400);
            }
        };
        this.viewNestedTask = async (req, res) => {
            try {
                const task = await this.service.getNestedTask(req.user.businessId, req.params.projectId, req.params.taskId);
                (0, response_1.successResponse)(res, task);
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message, e.message === "Project not found" || e.message === "Task not found" ? 404 : 400);
            }
        };
        this.updateNestedTask = async (req, res) => {
            try {
                const { before, task } = await this.service.updateNestedTask(req.user.businessId, req.params.projectId, req.params.taskId, req.body);
                await auditLog_service_1.AuditLogService.log('UPDATE_PROJECT_TASK', 'project_task', String(task.id), before, task, req);
                await this.service.logActivity(req.user.businessId, {
                    projectId: req.params.projectId,
                    taskId: task.id,
                    actorEmployeeId: task.assigneeEmployeeId,
                    action: "PROJECT_TASK_UPDATED",
                    entityType: "project_task",
                    entityId: task.id,
                    before,
                    after: task.toJSON ? task.toJSON() : task
                });
                (0, response_1.successResponse)(res, task, "Task updated");
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message, e.message === "Project not found" || e.message === "Task not found" || e.message === "Employee not found" ? 404 : 400);
            }
        };
        this.deleteNestedTask = async (req, res) => {
            try {
                const { before, task } = await this.service.deleteNestedTask(req.user.businessId, req.params.projectId, req.params.taskId);
                await auditLog_service_1.AuditLogService.log('DELETE_PROJECT_TASK', 'project_task', String(task.id), before, null, req);
                await this.service.logActivity(req.user.businessId, {
                    projectId: req.params.projectId,
                    taskId: task.id,
                    action: "PROJECT_TASK_DELETED",
                    entityType: "project_task",
                    entityId: task.id,
                    before
                });
                (0, response_1.successResponse)(res, null, "Task deleted");
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message, e.message === "Project not found" || e.message === "Task not found" ? 404 : 400);
            }
        };
        this.assignNestedTask = async (req, res) => {
            try {
                const { before, task } = await this.service.assignNestedTask(req.user.businessId, req.params.projectId, req.params.taskId, req.body.assigneeEmployeeId);
                await auditLog_service_1.AuditLogService.log('ASSIGN_PROJECT_TASK', 'project_task', String(task.id), before, task, req);
                await this.service.logActivity(req.user.businessId, {
                    projectId: req.params.projectId,
                    taskId: task.id,
                    actorEmployeeId: task.assigneeEmployeeId,
                    action: "PROJECT_TASK_ASSIGNED",
                    entityType: "project_task",
                    entityId: task.id,
                    before,
                    after: task.toJSON ? task.toJSON() : task
                });
                (0, response_1.successResponse)(res, task, "Task assigned");
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message, e.message === "Project not found" || e.message === "Task not found" || e.message === "Employee not found" ? 404 : 400);
            }
        };
        this.changeNestedTaskStatus = async (req, res) => {
            try {
                const { before, task } = await this.service.changeNestedTaskStatus(req.user.businessId, req.params.projectId, req.params.taskId, req.body.status);
                await auditLog_service_1.AuditLogService.log('CHANGE_PROJECT_TASK_STATUS', 'project_task', String(task.id), before, task, req);
                await this.service.logActivity(req.user.businessId, {
                    projectId: req.params.projectId,
                    taskId: task.id,
                    actorEmployeeId: task.assigneeEmployeeId,
                    action: "PROJECT_TASK_STATUS_CHANGED",
                    entityType: "project_task",
                    entityId: task.id,
                    before,
                    after: task.toJSON ? task.toJSON() : task
                });
                (0, response_1.successResponse)(res, task, "Task status changed");
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message, e.message === "Project not found" || e.message === "Task not found" ? 404 : 400);
            }
        };
        this.myTasks = async (req, res) => {
            try {
                const page = Number(req.query.page) || 1;
                const size = Number(req.query.size) || 50;
                const data = await this.service.getMyTasks(req.user.businessId, req.user.id, page, size, req.query);
                (0, response_1.paginationResponse)(res, data.rows, data.count, page, size);
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        this.listTaskComments = async (req, res) => {
            try {
                const comments = await this.service.listTaskComments(req.user.businessId, req.params.projectId, req.params.taskId);
                (0, response_1.successResponse)(res, comments);
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message, e.message === "Project not found" || e.message === "Task not found" ? 404 : 400);
            }
        };
        this.createTaskComment = async (req, res) => {
            try {
                const comment = await this.service.addTaskComment(req.user.businessId, req.user.id, req.params.projectId, req.params.taskId, req.body);
                await auditLog_service_1.AuditLogService.log('CREATE_TASK_COMMENT', 'task_comment', String(comment.id), null, comment, req);
                (0, response_1.successResponse)(res, comment, "Comment created", 201);
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message, e.message === "Project not found" || e.message === "Task not found" || e.message === "Employee not found" ? 404 : 400);
            }
        };
        this.updateTaskComment = async (req, res) => {
            try {
                const { before, comment } = await this.service.updateTaskComment(req.user.businessId, req.user.id, req.params.projectId, req.params.taskId, req.params.commentId, req.body);
                await auditLog_service_1.AuditLogService.log('UPDATE_TASK_COMMENT', 'task_comment', String(comment.id), before, comment, req);
                (0, response_1.successResponse)(res, comment, "Comment updated");
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message, e.message === "Project not found" || e.message === "Task not found" || e.message === "Comment not found" || e.message === "Employee not found" ? 404 : 400);
            }
        };
        this.deleteTaskComment = async (req, res) => {
            try {
                const { before, comment } = await this.service.deleteTaskComment(req.user.businessId, req.user.id, req.params.projectId, req.params.taskId, req.params.commentId);
                await auditLog_service_1.AuditLogService.log('DELETE_TASK_COMMENT', 'task_comment', String(comment.id), before, null, req);
                (0, response_1.successResponse)(res, null, "Comment deleted");
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message, e.message === "Project not found" || e.message === "Task not found" || e.message === "Comment not found" || e.message === "Employee not found" ? 404 : 400);
            }
        };
        this.createMilestone = async (req, res) => {
            try {
                const m = await this.service.createMilestone(req.user.businessId, req.body);
                await auditLog_service_1.AuditLogService.log('CREATE_MILESTONE', 'project_milestone', String(m.id), null, m, req);
                (0, response_1.successResponse)(res, m, "Milestone created", 201);
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        this.listMilestones = async (req, res) => {
            try {
                if (!req.query.projectId)
                    return (0, response_1.errorResponse)(res, "projectId is required");
                const data = await this.service.listMilestones(req.user.businessId, req.query.projectId);
                (0, response_1.successResponse)(res, data);
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        this.createTask = async (req, res) => {
            try {
                const t = await this.service.createTask(req.user.businessId, req.body);
                await auditLog_service_1.AuditLogService.log('CREATE_TASK', 'project_task', String(t.id), null, t, req);
                (0, response_1.successResponse)(res, t, "Task created", 201);
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        this.assignTask = async (req, res) => {
            try {
                const t = await this.service.assignTask(req.user.businessId, req.params.id, req.body.assignedToUserId);
                (0, response_1.successResponse)(res, t);
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        this.updateTaskStatus = async (req, res) => {
            try {
                const t = await this.service.updateTaskStatus(req.user.businessId, req.params.id, req.body.status);
                (0, response_1.successResponse)(res, t);
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        this.listTasks = async (req, res) => {
            try {
                if (!req.query.projectId)
                    return (0, response_1.errorResponse)(res, "projectId is required");
                const data = await this.service.listTasks(req.user.businessId, req.query.projectId);
                (0, response_1.successResponse)(res, data);
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        this.createIssue = async (req, res) => {
            try {
                const mappedBody = { ...req.body, reportedByUserId: req.user.id };
                const i = await this.service.createIssue(req.user.businessId, mappedBody);
                await auditLog_service_1.AuditLogService.log('CREATE_ISSUE', 'project_issue', String(i.id), null, i, req);
                (0, response_1.successResponse)(res, i, "Issue created", 201);
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        this.listIssues = async (req, res) => {
            try {
                if (!req.query.projectId)
                    return (0, response_1.errorResponse)(res, "projectId is required");
                const data = await this.service.listIssues(req.user.businessId, req.query.projectId);
                (0, response_1.successResponse)(res, data);
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        this.createChangeRequest = async (req, res) => {
            try {
                const mappedBody = { ...req.body, requestedByUserId: req.user.id };
                const cr = await this.service.createChangeRequest(req.user.businessId, mappedBody);
                await auditLog_service_1.AuditLogService.log('CREATE_CHANGE_REQUEST', 'project_change_request', String(cr.id), null, cr, req);
                (0, response_1.successResponse)(res, cr, "Change Request created", 201);
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        this.listChangeRequests = async (req, res) => {
            try {
                if (!req.query.projectId)
                    return (0, response_1.errorResponse)(res, "projectId is required");
                const data = await this.service.listChangeRequests(req.user.businessId, req.query.projectId);
                (0, response_1.successResponse)(res, data);
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        this.getProjectProgress = async (req, res) => {
            try {
                const data = await this.service.getProjectProgress(req.user.businessId, req.params.id);
                (0, response_1.successResponse)(res, data);
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        this.workflowCatalog = async (_req, res) => {
            try {
                const data = await this.service.getWorkflowCatalog();
                (0, response_1.successResponse)(res, data);
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        this.listWorkflowForms = async (req, res) => {
            try {
                const data = await this.service.listWorkflowForms(req.user.businessId, req.params.projectId, req.query);
                (0, response_1.successResponse)(res, data);
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message, e.message === "Project not found" ? 404 : 400);
            }
        };
        this.createWorkflowForm = async (req, res) => {
            try {
                const form = await this.service.createWorkflowForm(req.user.businessId, req.user.id, req.params.projectId, req.body);
                await auditLog_service_1.AuditLogService.log('CREATE_PROJECT_WORKFLOW_FORM', 'project_workflow_form', String(form.id), null, form, req);
                (0, response_1.successResponse)(res, form, "Project workflow form created", 201);
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message, e.message.includes("not found") ? 404 : 400);
            }
        };
        this.updateWorkflowForm = async (req, res) => {
            try {
                const form = await this.service.updateWorkflowForm(req.user.businessId, req.user.id, req.params.projectId, req.params.formId, req.body);
                await auditLog_service_1.AuditLogService.log('UPDATE_PROJECT_WORKFLOW_FORM', 'project_workflow_form', String(form.id), null, form, req);
                (0, response_1.successResponse)(res, form, "Project workflow form updated");
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message, e.message.includes("not found") ? 404 : 400);
            }
        };
        this.changeWorkflowFormStatus = async (req, res) => {
            try {
                const form = await this.service.changeWorkflowFormStatus(req.user.businessId, req.user.id, req.params.projectId, req.params.formId, req.body.status, req.body.metadata);
                await auditLog_service_1.AuditLogService.log('CHANGE_PROJECT_WORKFLOW_FORM_STATUS', 'project_workflow_form', String(form.id), null, form, req);
                (0, response_1.successResponse)(res, form, "Project workflow form status updated");
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message, e.message.includes("not found") ? 404 : 400);
            }
        };
    }
}
exports.ProjectsController = ProjectsController;
