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
                    p = await this.service.createProject(req.user.businessId, req.body);
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
                const bypass = req.user.isPlatformSuperAdmin || (res.locals.hasRole && res.locals.hasRole('BUSINESS_ADMIN'));
                const page = parseInt(req.query.page) || 1;
                const size = parseInt(req.query.size) || 20;
                const data = await this.service.getProjects(req.user.businessId, req.user.id, bypass, page, size);
                (0, response_1.paginationResponse)(res, data.rows, data.count, page, size);
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
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
    }
}
exports.ProjectsController = ProjectsController;
