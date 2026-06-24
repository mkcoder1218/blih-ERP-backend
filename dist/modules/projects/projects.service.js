"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectsService = exports.PROJECT_WORKFLOW_FORMS = void 0;
const models_1 = require("../../models");
const notification_service_1 = require("../notification/notification.service");
const projectCode_1 = require("./projectCode");
const sequelize_1 = require("sequelize");
const clientPortal_service_1 = require("../clientPortal/clientPortal.service");
const PROJECT_STATUS_TRANSITIONS = {
    DRAFT: ["PLANNED", "CANCELLED", "ARCHIVED"],
    PLANNED: ["ACTIVE", "ON_HOLD", "CANCELLED", "ARCHIVED"],
    ACTIVE: ["ON_HOLD", "COMPLETED", "CANCELLED", "ARCHIVED"],
    ON_HOLD: ["ACTIVE", "CANCELLED", "ARCHIVED"],
    COMPLETED: ["ARCHIVED"],
    CANCELLED: ["ARCHIVED"],
    ARCHIVED: []
};
const TASK_STATUS_TRANSITIONS = {
    BACKLOG: ["TODO", "IN_PROGRESS", "IN_REVIEW", "BLOCKED", "DONE", "CANCELLED"],
    TODO: ["BACKLOG", "IN_PROGRESS", "IN_REVIEW", "BLOCKED", "DONE", "CANCELLED"],
    IN_PROGRESS: ["BACKLOG", "TODO", "IN_REVIEW", "BLOCKED", "DONE", "CANCELLED"],
    IN_REVIEW: ["BACKLOG", "TODO", "IN_PROGRESS", "BLOCKED", "DONE", "CANCELLED"],
    BLOCKED: ["BACKLOG", "TODO", "IN_PROGRESS", "IN_REVIEW", "DONE", "CANCELLED"],
    DONE: ["BACKLOG", "TODO", "IN_PROGRESS", "IN_REVIEW", "BLOCKED", "CANCELLED"],
    CANCELLED: ["BACKLOG", "TODO", "IN_PROGRESS", "IN_REVIEW", "BLOCKED", "DONE"]
};
const WORKFLOW_STATUS_TRANSITIONS = {
    draft: ["submitted", "archived"],
    submitted: ["approved", "rejected", "returned-for-revision", "archived"],
    approved: ["archived"],
    rejected: ["archived", "returned-for-revision"],
    "returned-for-revision": ["draft", "submitted", "archived"],
    archived: []
};
exports.PROJECT_WORKFLOW_FORMS = [
    {
        key: "project_brief",
        name: "Project Brief",
        group: "setup",
        entity: "project",
        approvalChain: ["Project Manager", "Business Admin"],
        requiredFields: ["objective", "scope", "stakeholders", "budget", "startDate", "endDate"],
        schema: {
            objective: { label: "Objective", type: "textarea", required: true },
            scope: { label: "Scope", type: "textarea", required: true },
            stakeholders: { label: "Stakeholders", type: "textarea", required: true },
            budget: { label: "Budget", type: "number", required: true },
            startDate: { label: "Start date", type: "date", required: true },
            endDate: { label: "End date", type: "date", required: true },
            risks: { label: "Known risks", type: "textarea" }
        }
    },
    {
        key: "project_kickoff",
        name: "Project Kick-off",
        group: "setup",
        entity: "project",
        approvalChain: ["Project Manager", "Business Admin"],
        requiredFields: ["meetingDate", "attendees", "communicationPlan", "successCriteria"],
        schema: {
            meetingDate: { label: "Meeting date", type: "date", required: true },
            attendees: { label: "Attendees", type: "textarea", required: true },
            communicationPlan: { label: "Communication plan", type: "textarea", required: true },
            successCriteria: { label: "Success criteria", type: "textarea", required: true },
            notes: { label: "Notes", type: "textarea" }
        }
    },
    {
        key: "milestone_setup",
        name: "Milestone Setup",
        group: "milestones",
        entity: "milestone",
        approvalChain: ["Project Manager"],
        requiredFields: ["milestones"],
        schema: {
            milestones: { label: "Milestones", type: "milestone-list", required: true }
        }
    },
    {
        key: "task_assignment",
        name: "Task Assignment",
        group: "tasks",
        entity: "task",
        approvalChain: ["Project Manager"],
        requiredFields: ["tasks"],
        schema: {
            tasks: { label: "Tasks", type: "task-list", required: true }
        }
    },
    {
        key: "internal_deliverable_approval",
        name: "Internal Deliverable Approval",
        group: "deliverables",
        entity: "task",
        approvalChain: ["Project Manager", "Internal Reviewer"],
        requiredFields: ["deliverableTitle", "deliverableSummary", "reviewOutcome"],
        schema: {
            deliverableTitle: { label: "Deliverable title", type: "text", required: true },
            deliverableSummary: { label: "Deliverable summary", type: "textarea", required: true },
            reviewOutcome: { label: "Review outcome", type: "select", required: true, options: ["ready", "needs_revision", "blocked"] },
            reviewerEmployeeId: { label: "Reviewer", type: "employee" },
            notes: { label: "Review notes", type: "textarea" }
        }
    },
    {
        key: "client_deliverable_approval",
        name: "Client Deliverable Approval",
        group: "deliverables",
        entity: "task",
        approvalChain: ["Project Manager", "Client Approver"],
        requiredFields: ["deliverableTitle", "clientDecision"],
        schema: {
            deliverableTitle: { label: "Deliverable title", type: "text", required: true },
            clientDecision: { label: "Client decision", type: "select", required: true, options: ["approved", "rejected", "conditional"] },
            clientFeedback: { label: "Client feedback", type: "textarea" },
            revisionDueDate: { label: "Revision due date", type: "date" },
            fileNotes: { label: "Linked file notes", type: "textarea" }
        }
    },
    {
        key: "change_request",
        name: "Change Request",
        group: "change_requests",
        entity: "project",
        approvalChain: ["Project Manager", "Business Admin"],
        requiredFields: ["changeTitle", "scopeImpact", "timelineImpact", "budgetImpact"],
        schema: {
            changeTitle: { label: "Change title", type: "text", required: true },
            scopeImpact: { label: "Scope impact", type: "textarea", required: true },
            timelineImpact: { label: "Timeline impact", type: "textarea", required: true },
            budgetImpact: { label: "Budget impact", type: "number", required: true },
            newEndDate: { label: "New end date", type: "date" },
            affectedMilestones: { label: "Affected milestones", type: "milestone-list" },
            rationale: { label: "Rationale", type: "textarea" }
        }
    },
    {
        key: "issue_bug_report",
        name: "Issue / Bug Report",
        group: "issues",
        entity: "task",
        approvalChain: ["Project Manager"],
        requiredFields: ["issueTitle", "severity", "issueStatus"],
        schema: {
            issueTitle: { label: "Issue title", type: "text", required: true },
            severity: { label: "Severity", type: "select", required: true, options: ["low", "medium", "high", "critical"] },
            issueStatus: { label: "Status", type: "select", required: true, options: ["open", "assigned", "in_progress", "resolved", "closed"] },
            assignedEmployeeId: { label: "Assignee", type: "employee" },
            linkedTaskId: { label: "Linked task", type: "task" },
            rootCause: { label: "Root cause", type: "textarea" },
            resolution: { label: "Resolution", type: "textarea" }
        }
    },
    {
        key: "risk_log",
        name: "Risk Log",
        group: "risks",
        entity: "project",
        approvalChain: ["Project Manager"],
        requiredFields: ["riskTitle", "likelihood", "impact", "ownerEmployeeId", "mitigation"],
        schema: {
            riskTitle: { label: "Risk title", type: "text", required: true },
            likelihood: { label: "Likelihood", type: "number", required: true },
            impact: { label: "Impact", type: "number", required: true },
            ownerEmployeeId: { label: "Owner", type: "employee", required: true },
            mitigation: { label: "Mitigation", type: "textarea", required: true },
            contingency: { label: "Contingency", type: "textarea" },
            riskStatus: { label: "Status", type: "select", options: ["open", "monitoring", "mitigated", "closed"] }
        }
    },
    { key: "completion_record", name: "Completion Record", group: "closure", entity: "project" },
    { key: "client_approval", name: "Client Approval", group: "deliverables", entity: "project" },
    { key: "final_project_closure", name: "Final Project Closure", group: "closure", entity: "project" },
    { key: "lessons_learned", name: "Lessons Learned", group: "lessons", entity: "project" },
    { key: "project_evaluation_summary", name: "Project Evaluation Summary", group: "evaluations", entity: "project" },
    { key: "client_feedback_summary", name: "Client Feedback Summary", group: "evaluations", entity: "project" },
    { key: "resource_handover", name: "Resource Handover", group: "closure", entity: "project" },
    { key: "post_implementation_review", name: "Post-implementation Review", group: "evaluations", entity: "project" }
];
function normalizeProjectStatus(status) {
    if (!status)
        return status;
    const normalized = status.toUpperCase();
    if (normalized === "PLANNING")
        return "PLANNED";
    return normalized;
}
function normalizeTaskStatus(status) {
    if (!status)
        return status;
    const normalized = status.toUpperCase();
    if (normalized === "REVIEW")
        return "IN_REVIEW";
    return normalized;
}
function normalizeTaskPriority(priority) {
    if (!priority)
        return priority;
    if (priority.toUpperCase() === "NORMAL")
        return "MEDIUM";
    return priority.toUpperCase();
}
function sanitizeCommentBody(body) {
    return String(body || "")
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
        .replace(/<[^>]+>/g, "")
        .replace(/\u0000/g, "")
        .trim();
}
class ProjectsService {
    constructor() {
        this.clientPortal = new clientPortal_service_1.ClientPortalService();
    }
    async provisionForms(businessId) {
        const templates = exports.PROJECT_WORKFLOW_FORMS.map((form) => ({ key: form.key, title: `${form.name} Form` }));
        for (const t of templates) {
            const existing = await models_1.db.FormDefinition.findOne({ where: { businessId, key: t.key } });
            if (!existing) {
                await models_1.db.FormDefinition.create({
                    businessId, name: t.title, key: t.key, visibility: 'internal',
                    version: 1, schema: { type: 'object', properties: {} }
                });
            }
        }
    }
    async createProject(businessId, data) {
        const code = data.code || await (0, projectCode_1.generateProjectCode)(businessId, data.title);
        if (data.ownerEmployeeId)
            await this.ensureEmployee(businessId, data.ownerEmployeeId);
        if (data.managerEmployeeId)
            await this.ensureEmployee(businessId, data.managerEmployeeId);
        const clientId = await this.resolveProjectClient(businessId, data);
        const project = await models_1.db.Project.create({
            ...data,
            code,
            businessId,
            clientId,
            status: normalizeProjectStatus(data.status) || "DRAFT",
            priority: data.priority || "NORMAL"
        });
        if (data.clientPortalUser && clientId) {
            const portalUser = await this.clientPortal.createPortalUser(businessId, { ...data.clientPortalUser, clientId });
            const portalMetadata = portalUser.metadata || {};
            project.dataValues.clientPortalUser = {
                id: portalUser.id,
                email: portalUser.email,
                fullName: portalUser.fullName,
                temporaryPassword: portalMetadata.temporaryPassword || data.clientPortalUser.password || null
            };
        }
        await this.ensureOwnerManagerMembers(businessId, project);
        return project;
    }
    async createProjectFromDeal(businessId, dealId, projectManagerUserId) {
        const d = await models_1.db.Deal.findOne({ where: { id: dealId, businessId, status: 'won' } });
        if (!d)
            throw new Error("Won Deal not found");
        const code = await (0, projectCode_1.generateProjectCode)(businessId, d.title);
        return models_1.db.Project.create({
            businessId,
            dealId: d.id,
            clientId: d.clientId,
            projectManagerUserId,
            title: d.title,
            code,
            currency: d.currency,
            budget: d.value,
            status: 'PLANNED',
            metadata: { source: 'deal_conversion', originalDealId: dealId }
        });
    }
    async getProjects(businessId, userId, bypass, page, size, filters = {}) {
        const where = { businessId };
        if (filters.status)
            where.status = filters.status;
        if (filters.priority)
            where.priority = filters.priority;
        if (filters.search) {
            where[sequelize_1.Op.or] = [
                { title: { [sequelize_1.Op.iLike]: `%${filters.search}%` } },
                { code: { [sequelize_1.Op.iLike]: `%${filters.search}%` } }
            ];
        }
        if (!bypass) {
            const employee = await models_1.db.EmployeeRecord.findOne({ where: { businessId, userId } });
            const memberProjectIds = employee
                ? (await models_1.db.ProjectMember.findAll({ where: { businessId, employeeId: employee.id }, attributes: ["projectId"] })).map((m) => m.projectId)
                : [];
            where[sequelize_1.Op.or] = [
                { projectManagerUserId: userId },
                ...(employee ? [{ ownerEmployeeId: employee.id }, { managerEmployeeId: employee.id }] : []),
                ...(memberProjectIds.length ? [{ id: { [sequelize_1.Op.in]: memberProjectIds } }] : [])
            ];
        }
        return models_1.db.Project.findAndCountAll({
            where,
            offset: (page - 1) * size,
            limit: size,
            order: [["createdAt", "DESC"]],
            include: this.projectIncludes()
        });
    }
    async getProjectById(businessId, id) {
        const project = await models_1.db.Project.findOne({ where: { id, businessId }, include: this.projectIncludes() });
        if (!project)
            throw new Error("Project not found");
        return project;
    }
    async listWorkflowForms(businessId, projectId, filters = {}) {
        await this.ensureProject(businessId, projectId);
        const where = { businessId, projectId };
        if (filters.group)
            where.workflowGroup = filters.group;
        if (filters.formKey)
            where.formKey = filters.formKey;
        if (filters.status)
            where.status = filters.status;
        if (filters.milestoneId)
            where.milestoneId = filters.milestoneId;
        if (filters.taskId)
            where.taskId = filters.taskId;
        return models_1.db.ProjectWorkflowForm.findAll({
            where,
            order: [["createdAt", "DESC"]],
            include: this.workflowIncludes()
        });
    }
    async getWorkflowCatalog() {
        return exports.PROJECT_WORKFLOW_FORMS;
    }
    async createWorkflowForm(businessId, userId, projectId, data) {
        const project = await this.ensureProject(businessId, projectId);
        const definition = this.ensureWorkflowDefinition(data.formKey);
        await this.ensureWorkflowPrerequisites(businessId, projectId, definition.key);
        if (data.status === "submitted")
            this.validateWorkflowData(definition, data.data || {});
        await this.ensureWorkflowLinks(businessId, projectId, data);
        const form = await models_1.db.ProjectWorkflowForm.create({
            businessId,
            projectId,
            milestoneId: data.milestoneId || null,
            taskId: data.taskId || null,
            fileAssetId: data.fileAssetId || null,
            formKey: definition.key,
            formName: definition.name,
            workflowGroup: data.workflowGroup || definition.group,
            status: data.status || "draft",
            submittedByUserId: data.status === "submitted" ? userId : null,
            submittedAt: data.status === "submitted" ? new Date() : null,
            data: data.data || {},
            adapters: this.normalizeAdapters(data.adapters),
            metadata: { ...(data.metadata || {}), mappedEntity: definition.entity, approvalChain: definition.approvalChain || [] }
        });
        await this.logWorkflowActivity(businessId, projectId, userId, "PROJECT_WORKFLOW_FORM_CREATED", null, form);
        if (form.status === "submitted")
            await this.logWorkflowActivity(businessId, projectId, userId, "PROJECT_WORKFLOW_FORM_SUBMITTED", null, form);
        if (form.status === "submitted")
            await this.notifyProjectManagers(businessId, project, userId, "Workflow form submitted", `${form.formName} was submitted for ${project.title}.`, form.id);
        return form;
    }
    async updateWorkflowForm(businessId, userId, projectId, formId, data) {
        await this.ensureProject(businessId, projectId);
        const form = await models_1.db.ProjectWorkflowForm.findOne({ where: { id: formId, businessId, projectId } });
        if (!form)
            throw new Error("Workflow form not found");
        if (["approved", "archived"].includes(form.status) && data.data)
            throw new Error("Approved or archived workflow forms cannot be edited");
        const before = form.toJSON ? form.toJSON() : { ...form };
        await this.ensureWorkflowLinks(businessId, projectId, data);
        await form.update({
            milestoneId: data.milestoneId ?? form.milestoneId,
            taskId: data.taskId ?? form.taskId,
            fileAssetId: data.fileAssetId ?? form.fileAssetId,
            workflowGroup: data.workflowGroup ?? form.workflowGroup,
            data: data.data ?? form.data,
            adapters: data.adapters ? this.normalizeAdapters(data.adapters) : form.adapters,
            metadata: data.metadata ? { ...(form.metadata || {}), ...data.metadata } : form.metadata
        });
        await this.logWorkflowActivity(businessId, projectId, userId, "PROJECT_WORKFLOW_FORM_UPDATED", before, form);
        return form;
    }
    async changeWorkflowFormStatus(businessId, userId, projectId, formId, status, metadata = {}) {
        const project = await this.ensureProject(businessId, projectId);
        const form = await models_1.db.ProjectWorkflowForm.findOne({ where: { id: formId, businessId, projectId } });
        if (!form)
            throw new Error("Workflow form not found");
        const nextStatus = String(status || "").toLowerCase();
        const current = String(form.status || "draft").toLowerCase();
        if (!WORKFLOW_STATUS_TRANSITIONS[current]?.includes(nextStatus)) {
            throw new Error(`Invalid workflow status transition from ${current} to ${nextStatus}`);
        }
        const before = form.toJSON ? form.toJSON() : { ...form };
        if (nextStatus === "submitted")
            this.validateWorkflowData(this.ensureWorkflowDefinition(form.formKey), form.data || {});
        await form.update({
            status: nextStatus,
            submittedByUserId: nextStatus === "submitted" ? userId : form.submittedByUserId,
            reviewedByUserId: ["approved", "rejected", "returned-for-revision"].includes(nextStatus) ? userId : form.reviewedByUserId,
            submittedAt: nextStatus === "submitted" ? new Date() : form.submittedAt,
            reviewedAt: ["approved", "rejected", "returned-for-revision"].includes(nextStatus) ? new Date() : form.reviewedAt,
            archivedAt: nextStatus === "archived" ? new Date() : form.archivedAt,
            metadata: { ...(form.metadata || {}), ...metadata }
        });
        const activityByStatus = {
            submitted: "PROJECT_WORKFLOW_FORM_SUBMITTED",
            approved: "PROJECT_WORKFLOW_FORM_APPROVED",
            rejected: "PROJECT_WORKFLOW_FORM_REJECTED",
            "returned-for-revision": "PROJECT_WORKFLOW_FORM_REVISION_REQUESTED",
            archived: "PROJECT_WORKFLOW_FORM_ARCHIVED"
        };
        await this.logWorkflowActivity(businessId, projectId, userId, activityByStatus[nextStatus] || "PROJECT_WORKFLOW_FORM_STATUS_CHANGED", before, form);
        if (nextStatus === "approved")
            await this.handleWorkflowApproval(businessId, userId, project, form);
        if (nextStatus === "rejected")
            await this.handleWorkflowRejection(businessId, userId, project, form);
        await this.notifyProjectManagers(businessId, project, userId, "Workflow form updated", `${form.formName} is now ${nextStatus}.`, form.id);
        return form;
    }
    async updateProject(businessId, id, data) {
        const project = await this.ensureProject(businessId, id);
        const before = project.toJSON ? project.toJSON() : { ...project };
        const startDate = data.startDate ?? project.startDate;
        const endDate = data.endDate ?? project.endDate;
        if (startDate && endDate && endDate < startDate)
            throw new Error("endDate must be on or after startDate");
        if (data.ownerEmployeeId)
            await this.ensureEmployee(businessId, data.ownerEmployeeId);
        if (data.managerEmployeeId)
            await this.ensureEmployee(businessId, data.managerEmployeeId);
        const nextClientId = data.clientId || data.newClient ? await this.resolveProjectClient(businessId, { ...data, projectManagerUserId: data.projectManagerUserId || project.projectManagerUserId }) : data.clientId;
        const updateData = { ...data };
        delete updateData.newClient;
        delete updateData.clientPortalUser;
        if (data.clientId !== undefined || data.newClient)
            updateData.clientId = nextClientId || null;
        await project.update(updateData);
        if (data.clientPortalUser && (project.clientId || nextClientId)) {
            const portalUser = await this.clientPortal.createPortalUser(businessId, { ...data.clientPortalUser, clientId: nextClientId || project.clientId });
            const portalMetadata = portalUser.metadata || {};
            project.dataValues.clientPortalUser = {
                id: portalUser.id,
                email: portalUser.email,
                fullName: portalUser.fullName,
                temporaryPassword: portalMetadata.temporaryPassword || data.clientPortalUser.password || null
            };
        }
        await this.ensureOwnerManagerMembers(businessId, project);
        return { before, project };
    }
    async changeProjectStatus(businessId, id, nextStatus) {
        const project = await this.ensureProject(businessId, id);
        const before = project.toJSON ? project.toJSON() : { ...project };
        const currentStatus = normalizeProjectStatus(project.status) || "DRAFT";
        const normalizedNext = normalizeProjectStatus(nextStatus);
        if (!normalizedNext)
            throw new Error("Status is required");
        if (currentStatus === normalizedNext)
            return { before, project };
        const allowed = PROJECT_STATUS_TRANSITIONS[currentStatus] || [];
        if (!allowed.includes(normalizedNext)) {
            throw new Error(`Invalid project status transition from ${currentStatus} to ${normalizedNext}`);
        }
        await project.update({ status: normalizedNext });
        return { before, project };
    }
    async archiveProject(businessId, id) {
        return this.changeProjectStatus(businessId, id, "ARCHIVED");
    }
    async createMilestone(businessId, data) {
        return models_1.db.ProjectMilestone.create({ ...data, businessId });
    }
    async updateMilestone(businessId, id, data) {
        const m = await models_1.db.ProjectMilestone.findOne({ where: { id, businessId } });
        if (!m)
            throw new Error("Milestone not found");
        return m.update(data);
    }
    async listMilestones(businessId, projectId) {
        return models_1.db.ProjectMilestone.findAll({ where: { businessId, projectId } });
    }
    async createTask(businessId, data) {
        const project = await models_1.db.Project.findOne({ where: { id: data.projectId, businessId } });
        if (!project)
            throw new Error("Project not found");
        const code = data.code || await (0, projectCode_1.generateTaskCode)(businessId, project.code);
        const t = await models_1.db.ProjectTask.create({ ...data, code, businessId, weight: this.normalizeTaskWeight(data.weight) });
        if (t.assignedToUserId)
            await this.notify(businessId, t.assignedToUserId, 'Task Assigned', 'You have been assigned a new project task.', 'project_task', t.id);
        return t;
    }
    async createNestedTask(businessId, projectId, data) {
        const project = await this.ensureProject(businessId, projectId);
        if (data.assigneeEmployeeId)
            await this.ensureEmployee(businessId, data.assigneeEmployeeId);
        const code = await (0, projectCode_1.generateTaskCode)(businessId, project.code);
        const task = await models_1.db.ProjectTask.create({
            ...data,
            businessId,
            projectId,
            code,
            status: normalizeTaskStatus(data.status) || "TODO",
            priority: normalizeTaskPriority(data.priority) || "MEDIUM",
            weight: this.normalizeTaskWeight(data.weight)
        });
        await this.recalculateProjectProgress(businessId, projectId);
        return task;
    }
    async listNestedTasks(businessId, projectId, page, size, filters = {}) {
        await this.ensureProject(businessId, projectId);
        const where = { businessId, projectId };
        if (filters.status)
            where.status = filters.status;
        if (filters.priority)
            where.priority = filters.priority;
        if (filters.assigneeEmployeeId)
            where.assigneeEmployeeId = filters.assigneeEmployeeId;
        if (filters.search) {
            where[sequelize_1.Op.or] = [
                { title: { [sequelize_1.Op.iLike]: `%${filters.search}%` } },
                { code: { [sequelize_1.Op.iLike]: `%${filters.search}%` } }
            ];
        }
        return models_1.db.ProjectTask.findAndCountAll({
            where,
            offset: (page - 1) * size,
            limit: size,
            order: [["createdAt", "DESC"]],
            include: this.taskIncludes()
        });
    }
    async getNestedTask(businessId, projectId, taskId) {
        await this.ensureProject(businessId, projectId);
        const task = await models_1.db.ProjectTask.findOne({ where: { id: taskId, businessId, projectId }, include: this.taskIncludes() });
        if (!task)
            throw new Error("Task not found");
        return task;
    }
    async updateNestedTask(businessId, projectId, taskId, data) {
        const task = await this.ensureProjectTask(businessId, projectId, taskId);
        const before = task.toJSON ? task.toJSON() : { ...task };
        const startDate = data.startDate ?? task.startDate;
        const dueDate = data.dueDate ?? task.dueDate;
        if (startDate && dueDate && dueDate < startDate)
            throw new Error("dueDate must be on or after startDate");
        if (data.assigneeEmployeeId)
            await this.ensureEmployee(businessId, data.assigneeEmployeeId);
        if (data.priority)
            data.priority = normalizeTaskPriority(data.priority);
        if (data.weight !== undefined)
            data.weight = this.normalizeTaskWeight(data.weight);
        await task.update(data);
        await this.recalculateProjectProgress(businessId, projectId);
        return { before, task };
    }
    async deleteNestedTask(businessId, projectId, taskId) {
        const task = await this.ensureProjectTask(businessId, projectId, taskId);
        const before = task.toJSON ? task.toJSON() : { ...task };
        await task.destroy();
        await this.recalculateProjectProgress(businessId, projectId);
        return { before, task };
    }
    async assignNestedTask(businessId, projectId, taskId, assigneeEmployeeId) {
        const task = await this.ensureProjectTask(businessId, projectId, taskId);
        await this.ensureEmployee(businessId, assigneeEmployeeId);
        const before = task.toJSON ? task.toJSON() : { ...task };
        await task.update({ assigneeEmployeeId });
        return { before, task };
    }
    async changeNestedTaskStatus(businessId, projectId, taskId, nextStatus) {
        const task = await this.ensureProjectTask(businessId, projectId, taskId);
        const before = task.toJSON ? task.toJSON() : { ...task };
        const currentStatus = normalizeTaskStatus(task.status) || "TODO";
        const normalizedNext = normalizeTaskStatus(nextStatus);
        if (!normalizedNext)
            throw new Error("Status is required");
        if (currentStatus !== normalizedNext) {
            const allowed = TASK_STATUS_TRANSITIONS[currentStatus] || [];
            if (!allowed.includes(normalizedNext)) {
                throw new Error(`Invalid task status transition from ${currentStatus} to ${normalizedNext}`);
            }
            await task.update({ status: normalizedNext });
            await this.recalculateProjectProgress(businessId, projectId);
        }
        return { before, task };
    }
    async getMyTasks(businessId, userId, page, size, filters = {}) {
        const employee = await models_1.db.EmployeeRecord.findOne({ where: { businessId, userId } });
        if (!employee)
            return { rows: [], count: 0 };
        const where = { businessId, assigneeEmployeeId: employee.id };
        if (filters.status)
            where.status = filters.status;
        if (filters.priority)
            where.priority = filters.priority;
        return models_1.db.ProjectTask.findAndCountAll({
            where,
            offset: (page - 1) * size,
            limit: size,
            order: [["createdAt", "DESC"]],
            include: this.taskIncludes()
        });
    }
    async addMember(businessId, data) {
        await this.ensureProject(businessId, data.projectId);
        await this.ensureEmployee(businessId, data.employeeId);
        await this.ensureNotMember(businessId, data.projectId, data.employeeId);
        return models_1.db.ProjectMember.create({ ...data, role: data.role || "MEMBER", businessId });
    }
    async listMembers(businessId, projectId) {
        await this.ensureProject(businessId, projectId);
        return models_1.db.ProjectMember.findAll({
            where: { businessId, projectId },
            order: [["createdAt", "ASC"]],
            include: [{ model: models_1.db.EmployeeRecord, as: "employee", include: [{ model: models_1.db.User, as: "user", attributes: ["id", "fullName", "email"] }] }]
        });
    }
    async updateMember(businessId, projectId, memberId, data) {
        await this.ensureProject(businessId, projectId);
        const member = await models_1.db.ProjectMember.findOne({ where: { id: memberId, businessId, projectId } });
        if (!member)
            throw new Error("Project member not found");
        const before = member.toJSON ? member.toJSON() : { ...member };
        await member.update(data);
        return { before, member };
    }
    async removeMember(businessId, projectId, memberId) {
        await this.ensureProject(businessId, projectId);
        const member = await models_1.db.ProjectMember.findOne({ where: { id: memberId, businessId, projectId } });
        if (!member)
            throw new Error("Project member not found");
        const before = member.toJSON ? member.toJSON() : { ...member };
        await member.destroy();
        return { before, member };
    }
    async bulkAddMembers(businessId, projectId, members) {
        await this.ensureProject(businessId, projectId);
        const seen = new Set();
        for (const member of members) {
            if (seen.has(member.employeeId))
                throw new Error("Duplicate employee in bulk member request");
            seen.add(member.employeeId);
            await this.ensureEmployee(businessId, member.employeeId);
            await this.ensureNotMember(businessId, projectId, member.employeeId);
        }
        return models_1.db.ProjectMember.bulkCreate(members.map((member) => ({
            ...member,
            businessId,
            projectId,
            role: member.role || "MEMBER"
        })));
    }
    async listTaskComments(businessId, projectId, taskId) {
        await this.ensureProjectTask(businessId, projectId, taskId);
        return models_1.db.TaskComment.findAll({
            where: { businessId, projectId, taskId },
            order: [["createdAt", "ASC"]],
            include: [{ model: models_1.db.EmployeeRecord, as: "author", include: [{ model: models_1.db.User, as: "user", attributes: ["id", "fullName", "email"] }] }]
        });
    }
    async addTaskComment(businessId, userId, projectId, taskId, data) {
        await this.ensureProjectTask(businessId, projectId, taskId);
        const author = await this.ensureEmployeeForUser(businessId, userId);
        const body = sanitizeCommentBody(data.body);
        if (!body)
            throw new Error("Comment body is required");
        const comment = await models_1.db.TaskComment.create({ ...data, body, projectId, taskId, authorEmployeeId: author.id, businessId });
        await this.logActivity(businessId, {
            projectId,
            taskId,
            actorEmployeeId: author.id,
            action: "TASK_COMMENTED",
            entityType: "task_comment",
            entityId: comment.id,
            after: comment.toJSON ? comment.toJSON() : comment
        });
        return comment;
    }
    async updateTaskComment(businessId, userId, projectId, taskId, commentId, data) {
        await this.ensureProjectTask(businessId, projectId, taskId);
        const actor = await this.ensureEmployeeForUser(businessId, userId);
        const comment = await models_1.db.TaskComment.findOne({ where: { id: commentId, businessId, projectId, taskId } });
        if (!comment)
            throw new Error("Comment not found");
        const before = comment.toJSON ? comment.toJSON() : { ...comment };
        const body = sanitizeCommentBody(data.body);
        if (!body)
            throw new Error("Comment body is required");
        await comment.update({ body, metadata: data.metadata ?? comment.metadata });
        await this.logActivity(businessId, {
            projectId,
            taskId,
            actorEmployeeId: actor.id,
            action: "TASK_COMMENT_UPDATED",
            entityType: "task_comment",
            entityId: comment.id,
            before,
            after: comment.toJSON ? comment.toJSON() : comment
        });
        return { before, comment };
    }
    async deleteTaskComment(businessId, userId, projectId, taskId, commentId) {
        await this.ensureProjectTask(businessId, projectId, taskId);
        const actor = await this.ensureEmployeeForUser(businessId, userId);
        const comment = await models_1.db.TaskComment.findOne({ where: { id: commentId, businessId, projectId, taskId } });
        if (!comment)
            throw new Error("Comment not found");
        const before = comment.toJSON ? comment.toJSON() : { ...comment };
        await comment.destroy();
        await this.logActivity(businessId, {
            projectId,
            taskId,
            actorEmployeeId: actor.id,
            action: "TASK_COMMENT_DELETED",
            entityType: "task_comment",
            entityId: comment.id,
            before
        });
        return { before, comment };
    }
    async logActivity(businessId, data) {
        return models_1.db.ProjectActivityLog.create({ ...data, businessId });
    }
    async ensureProject(businessId, projectId) {
        const project = await models_1.db.Project.findOne({ where: { id: projectId, businessId } });
        if (!project)
            throw new Error("Project not found");
        return project;
    }
    ensureWorkflowDefinition(formKey) {
        const definition = exports.PROJECT_WORKFLOW_FORMS.find((form) => form.key === formKey);
        if (!definition)
            throw new Error("Unsupported project workflow form");
        return definition;
    }
    async ensureWorkflowPrerequisites(businessId, projectId, formKey) {
        const approved = async (key) => Boolean(await models_1.db.ProjectWorkflowForm.findOne({ where: { businessId, projectId, formKey: key, status: "approved" } }));
        if (formKey === "project_kickoff" && !(await approved("project_brief")))
            throw new Error("Project Brief must be approved before Kick-off creation");
        if (formKey === "milestone_setup" && !(await approved("project_kickoff")))
            throw new Error("Project Kick-off must be approved before Milestone Setup creation");
    }
    validateWorkflowData(definition, data) {
        for (const field of definition.requiredFields || []) {
            const value = data?.[field];
            const emptyArray = Array.isArray(value) && value.length === 0;
            if (value === undefined || value === null || value === "" || emptyArray) {
                throw new Error(`${definition.name} requires ${field}`);
            }
        }
    }
    async handleWorkflowApproval(businessId, userId, project, form) {
        if (form.formKey === "milestone_setup")
            await this.applyMilestoneSetup(businessId, userId, project.id, form);
        if (form.formKey === "task_assignment")
            await this.applyTaskAssignment(businessId, userId, project, form);
        if (form.formKey === "change_request")
            await this.applyChangeRequest(businessId, userId, project, form);
        if (form.formKey === "issue_bug_report")
            await this.applyIssueWorkflow(businessId, userId, project, form);
        if (form.formKey === "risk_log")
            await this.applyRiskWorkflow(businessId, userId, project, form);
    }
    async handleWorkflowRejection(businessId, userId, project, form) {
        if (form.formKey === "client_deliverable_approval")
            await this.createClientRevisionTask(businessId, userId, project, form);
    }
    async applyMilestoneSetup(businessId, userId, projectId, form) {
        const milestones = Array.isArray(form.data?.milestones) ? form.data.milestones : [];
        const generatedIds = [];
        for (const item of milestones) {
            if (!item?.name)
                continue;
            const where = item.id ? { id: item.id, businessId, projectId } : { businessId, projectId, name: item.name };
            const existing = await models_1.db.ProjectMilestone.findOne({ where });
            const before = existing ? (existing.toJSON ? existing.toJSON() : { ...existing }) : null;
            const payload = {
                projectId,
                name: item.name,
                description: item.description || null,
                dueDate: item.dueDate || null,
                billingPercent: Number(item.billingPercent || 0),
                status: item.status || "pending",
                metadata: { ...(existing?.metadata || {}), generatedFromWorkflowFormId: form.id }
            };
            const milestone = existing ? await existing.update(payload) : await models_1.db.ProjectMilestone.create({ ...payload, businessId });
            generatedIds.push(milestone.id);
            await this.logActivity(businessId, {
                projectId,
                actorEmployeeId: await this.actorEmployeeId(businessId, userId),
                action: existing ? "PROJECT_MILESTONE_UPDATED_FROM_WORKFLOW" : "PROJECT_MILESTONE_GENERATED_FROM_WORKFLOW",
                entityType: "project_milestone",
                entityId: milestone.id,
                before,
                after: milestone.toJSON ? milestone.toJSON() : milestone
            });
        }
        await form.update({ metadata: { ...(form.metadata || {}), generatedMilestoneIds: generatedIds } });
    }
    async applyTaskAssignment(businessId, userId, project, form) {
        const tasks = Array.isArray(form.data?.tasks) ? form.data.tasks : [];
        const generatedIds = [];
        for (const item of tasks) {
            if (!item?.title)
                continue;
            if (item.assigneeEmployeeId)
                await this.ensureEmployee(businessId, item.assigneeEmployeeId);
            if (item.milestoneId) {
                const milestone = await models_1.db.ProjectMilestone.findOne({ where: { id: item.milestoneId, businessId, projectId: project.id } });
                if (!milestone)
                    throw new Error("Milestone not found for project");
            }
            const assignee = item.assigneeEmployeeId ? await models_1.db.EmployeeRecord.findOne({ where: { id: item.assigneeEmployeeId, businessId } }) : null;
            const where = item.id ? { id: item.id, businessId, projectId: project.id } : { businessId, projectId: project.id, title: item.title };
            const existing = await models_1.db.ProjectTask.findOne({ where });
            const before = existing ? (existing.toJSON ? existing.toJSON() : { ...existing }) : null;
            const payload = {
                projectId: project.id,
                milestoneId: item.milestoneId || null,
                assigneeEmployeeId: item.assigneeEmployeeId || null,
                assignedToUserId: item.assignedToUserId || assignee?.userId || null,
                title: item.title,
                description: item.description || null,
                priority: normalizeTaskPriority(item.priority) || "MEDIUM",
                status: normalizeTaskStatus(item.status) || "TODO",
                startDate: item.startDate || null,
                dueDate: item.dueDate || null,
                estimatedHours: Number(item.estimatedHours || 0),
                weight: this.normalizeTaskWeight(item.weight),
                metadata: { ...(existing?.metadata || {}), generatedFromWorkflowFormId: form.id }
            };
            const task = existing ? await existing.update(payload) : await models_1.db.ProjectTask.create({ ...payload, businessId, code: await (0, projectCode_1.generateTaskCode)(businessId, project.code) });
            generatedIds.push(task.id);
            await this.logActivity(businessId, {
                projectId: project.id,
                taskId: task.id,
                actorEmployeeId: await this.actorEmployeeId(businessId, userId),
                action: existing ? "PROJECT_TASK_UPDATED_FROM_WORKFLOW" : "PROJECT_TASK_GENERATED_FROM_WORKFLOW",
                entityType: "project_task",
                entityId: task.id,
                before,
                after: task.toJSON ? task.toJSON() : task
            });
            if (payload.assignedToUserId)
                await this.notify(businessId, payload.assignedToUserId, "Task Assigned", `You have been assigned ${task.title}.`, "project_task", task.id);
        }
        await this.recalculateProjectProgress(businessId, project.id);
        await form.update({ metadata: { ...(form.metadata || {}), generatedTaskIds: generatedIds } });
    }
    async actorEmployeeId(businessId, userId) {
        const actor = await models_1.db.EmployeeRecord.findOne({ where: { businessId, userId } });
        return actor?.id || null;
    }
    async createClientRevisionTask(businessId, userId, project, form) {
        const title = `Revise ${form.data?.deliverableTitle || form.formName}`;
        const existing = await models_1.db.ProjectTask.findOne({ where: { businessId, projectId: project.id, title } });
        if (existing?.metadata?.generatedFromWorkflowFormId && existing.metadata.generatedFromWorkflowFormId !== form.id)
            return existing;
        if (existing)
            return existing;
        const task = await models_1.db.ProjectTask.create({
            businessId,
            projectId: project.id,
            code: await (0, projectCode_1.generateTaskCode)(businessId, project.code),
            title,
            description: form.data?.clientFeedback || "Client requested deliverable revision.",
            priority: "HIGH",
            status: "TODO",
            dueDate: form.data?.revisionDueDate || null,
            metadata: { generatedFromWorkflowFormId: form.id, reason: "client_deliverable_rejection" }
        });
        await this.recalculateProjectProgress(businessId, project.id);
        await this.logActivity(businessId, {
            projectId: project.id,
            taskId: task.id,
            actorEmployeeId: await this.actorEmployeeId(businessId, userId),
            action: "PROJECT_REVISION_TASK_GENERATED_FROM_CLIENT_REJECTION",
            entityType: "project_task",
            entityId: task.id,
            after: task.toJSON ? task.toJSON() : task
        });
        if (project.projectManagerUserId)
            await this.notify(businessId, project.projectManagerUserId, "Client Rejection Requires Revision", `${title} was created from client feedback.`, "project_task", task.id);
        await form.update({ metadata: { ...(form.metadata || {}), revisionTaskId: task.id } });
        return task;
    }
    async applyChangeRequest(businessId, userId, project, form) {
        const before = project.toJSON ? project.toJSON() : { ...project };
        const metadata = {
            ...(project.metadata || {}),
            scope: { ...(project.metadata?.scope || {}), latestApprovedChange: form.data?.scopeImpact || null },
            timeline: { ...(project.metadata?.timeline || {}), latestApprovedChange: form.data?.timelineImpact || null },
            budget: {
                ...(project.metadata?.budget || {}),
                latestApprovedChangeAmount: Number(form.data?.budgetImpact || 0),
                latestApprovedChangeFormId: form.id
            },
            approvedChangeRequests: [...(project.metadata?.approvedChangeRequests || []), form.id],
            adapterActions: this.pendingAdapterActions(form.adapters)
        };
        await project.update({
            description: form.data?.scopeImpact ? `${project.description || ""}\n\nApproved scope change: ${form.data.scopeImpact}`.trim() : project.description,
            endDate: form.data?.newEndDate || project.endDate,
            budget: Number(project.budget || 0) + Number(form.data?.budgetImpact || 0),
            metadata
        });
        await this.logActivity(businessId, {
            projectId: project.id,
            actorEmployeeId: await this.actorEmployeeId(businessId, userId),
            action: "PROJECT_CHANGE_REQUEST_APPLIED",
            entityType: "project",
            entityId: project.id,
            before,
            after: project.toJSON ? project.toJSON() : project
        });
        const affected = Array.isArray(form.data?.affectedMilestones) ? form.data.affectedMilestones : [];
        for (const item of affected) {
            if (!item?.id && !item?.name)
                continue;
            const where = item.id ? { id: item.id, businessId, projectId: project.id } : { businessId, projectId: project.id, name: item.name };
            const milestone = await models_1.db.ProjectMilestone.findOne({ where });
            if (!milestone)
                continue;
            const milestoneBefore = milestone.toJSON ? milestone.toJSON() : { ...milestone };
            await milestone.update({
                name: item.name || milestone.name,
                description: item.description ?? milestone.description,
                dueDate: item.dueDate || milestone.dueDate,
                billingPercent: item.billingPercent ?? milestone.billingPercent,
                metadata: { ...(milestone.metadata || {}), latestApprovedChangeFormId: form.id }
            });
            await this.logActivity(businessId, {
                projectId: project.id,
                actorEmployeeId: await this.actorEmployeeId(businessId, userId),
                action: "PROJECT_MILESTONE_UPDATED_FROM_CHANGE_REQUEST",
                entityType: "project_milestone",
                entityId: milestone.id,
                before: milestoneBefore,
                after: milestone.toJSON ? milestone.toJSON() : milestone
            });
        }
    }
    async applyIssueWorkflow(businessId, userId, project, form) {
        if (form.data?.assignedEmployeeId)
            await this.ensureEmployee(businessId, form.data.assignedEmployeeId);
        if (form.data?.linkedTaskId)
            await this.ensureProjectTask(businessId, project.id, form.data.linkedTaskId);
        const assignee = form.data?.assignedEmployeeId ? await models_1.db.EmployeeRecord.findOne({ where: { businessId, id: form.data.assignedEmployeeId } }) : null;
        await form.update({
            taskId: form.data?.linkedTaskId || form.taskId || null,
            metadata: {
                ...(form.metadata || {}),
                issue: {
                    severity: form.data?.severity,
                    status: form.data?.issueStatus,
                    assignedEmployeeId: form.data?.assignedEmployeeId || null,
                    rootCause: form.data?.rootCause || null,
                    resolution: form.data?.resolution || null
                }
            }
        });
        await this.logActivity(businessId, {
            projectId: project.id,
            taskId: form.data?.linkedTaskId || form.taskId || null,
            actorEmployeeId: await this.actorEmployeeId(businessId, userId),
            action: "PROJECT_ISSUE_WORKFLOW_APPLIED",
            entityType: "project_workflow_form",
            entityId: form.id,
            after: form.toJSON ? form.toJSON() : form
        });
        if (assignee?.userId)
            await this.notify(businessId, assignee.userId, "Issue Assigned", `${form.data?.issueTitle || "An issue"} was assigned to you.`, "project_workflow_form", form.id);
    }
    async applyRiskWorkflow(businessId, userId, project, form) {
        if (form.data?.ownerEmployeeId)
            await this.ensureEmployee(businessId, form.data.ownerEmployeeId);
        const likelihood = this.clampedScore(form.data?.likelihood);
        const impact = this.clampedScore(form.data?.impact);
        const score = likelihood * impact;
        await form.update({
            metadata: {
                ...(form.metadata || {}),
                risk: {
                    likelihood,
                    impact,
                    score,
                    level: score >= 16 ? "critical" : score >= 9 ? "high" : score >= 4 ? "medium" : "low",
                    ownerEmployeeId: form.data?.ownerEmployeeId || null,
                    mitigation: form.data?.mitigation || null,
                    status: form.data?.riskStatus || "open"
                }
            }
        });
        await this.logActivity(businessId, {
            projectId: project.id,
            actorEmployeeId: await this.actorEmployeeId(businessId, userId),
            action: "PROJECT_RISK_WORKFLOW_APPLIED",
            entityType: "project_workflow_form",
            entityId: form.id,
            after: form.toJSON ? form.toJSON() : form
        });
        const owner = form.data?.ownerEmployeeId ? await models_1.db.EmployeeRecord.findOne({ where: { businessId, id: form.data.ownerEmployeeId } }) : null;
        if (owner?.userId)
            await this.notify(businessId, owner.userId, "Risk Ownership Assigned", `${form.data?.riskTitle || "A project risk"} is assigned to you.`, "project_workflow_form", form.id);
        if (score >= 16) {
            for (const recipientUserId of await this.projectStakeholderUserIds(project)) {
                await this.notify(businessId, recipientUserId, "Critical Project Risk", `${form.data?.riskTitle || "A project risk"} has a critical score of ${score}.`, "project_workflow_form", form.id);
            }
        }
    }
    clampedScore(value) {
        const parsed = Number(value || 0);
        if (!Number.isFinite(parsed))
            return 0;
        return Math.min(5, Math.max(0, parsed));
    }
    pendingAdapterActions(adapters = {}) {
        return Object.entries(adapters || {}).filter(([, value]) => value?.enabled).map(([key, value]) => ({ adapter: key, status: "pending_confirmation", config: value.config || {} }));
    }
    async projectStakeholderUserIds(project) {
        const userIds = new Set();
        if (project.projectManagerUserId)
            userIds.add(project.projectManagerUserId);
        for (const employeeId of [project.ownerEmployeeId, project.managerEmployeeId].filter(Boolean)) {
            const employee = await models_1.db.EmployeeRecord.findOne({ where: { businessId: project.businessId, id: employeeId } });
            if (employee?.userId)
                userIds.add(employee.userId);
        }
        return Array.from(userIds);
    }
    async ensureWorkflowLinks(businessId, projectId, data) {
        if (data.milestoneId) {
            const milestone = await models_1.db.ProjectMilestone.findOne({ where: { id: data.milestoneId, businessId, projectId } });
            if (!milestone)
                throw new Error("Milestone not found for project");
        }
        if (data.taskId) {
            await this.ensureProjectTask(businessId, projectId, data.taskId);
        }
        if (data.fileAssetId && models_1.db.FileAsset) {
            const file = await models_1.db.FileAsset.findOne({ where: { id: data.fileAssetId, businessId } });
            if (!file)
                throw new Error("File not found");
        }
    }
    normalizeAdapters(adapters = {}) {
        const allowed = ["crm", "finance", "hr", "performance", "brain", "n8n"];
        return allowed.reduce((acc, key) => {
            if (adapters[key])
                acc[key] = { enabled: Boolean(adapters[key].enabled), config: adapters[key].config || {} };
            return acc;
        }, {});
    }
    workflowIncludes() {
        return [
            { model: models_1.db.ProjectMilestone, as: "milestone", attributes: ["id", "name", "status", "dueDate"] },
            { model: models_1.db.ProjectTask, as: "task", attributes: ["id", "code", "title", "status"] },
            { model: models_1.db.User, as: "submitter", attributes: ["id", "fullName", "email"] },
            { model: models_1.db.User, as: "reviewer", attributes: ["id", "fullName", "email"] }
        ];
    }
    async logWorkflowActivity(businessId, projectId, userId, action, before, form) {
        let actorEmployeeId = null;
        try {
            const actor = await models_1.db.EmployeeRecord.findOne({ where: { businessId, userId } });
            actorEmployeeId = actor?.id || null;
        }
        catch { }
        await this.logActivity(businessId, {
            projectId,
            taskId: form.taskId || null,
            actorEmployeeId,
            action,
            entityType: "project_workflow_form",
            entityId: form.id,
            before,
            after: form.toJSON ? form.toJSON() : form
        });
    }
    async notifyProjectManagers(businessId, project, actorUserId, title, message, entityId) {
        const recipients = [project.projectManagerUserId].filter((id) => id && id !== actorUserId);
        for (const recipientUserId of recipients) {
            await this.notify(businessId, recipientUserId, title, message, "project_workflow_form", entityId);
        }
    }
    async ensureTask(businessId, taskId) {
        const task = await models_1.db.ProjectTask.findOne({ where: { id: taskId, businessId } });
        if (!task)
            throw new Error("Task not found");
        return task;
    }
    async ensureProjectTask(businessId, projectId, taskId) {
        await this.ensureProject(businessId, projectId);
        const task = await models_1.db.ProjectTask.findOne({ where: { id: taskId, businessId, projectId } });
        if (!task)
            throw new Error("Task not found");
        return task;
    }
    async recalculateProjectProgress(businessId, projectId) {
        const project = await this.ensureProject(businessId, projectId);
        const tasks = await models_1.db.ProjectTask.findAll({ where: { businessId, projectId } });
        const progressTasks = tasks.filter((task) => normalizeTaskStatus(task.status) !== "CANCELLED");
        const totalTasks = progressTasks.length;
        const completedTasks = progressTasks.filter((task) => normalizeTaskStatus(task.status) === "DONE").length;
        const totalWeight = progressTasks.reduce((sum, task) => sum + this.taskWeight(task), 0);
        const completedWeight = progressTasks
            .filter((task) => normalizeTaskStatus(task.status) === "DONE")
            .reduce((sum, task) => sum + this.taskWeight(task), 0);
        const progressPercent = totalWeight ? Math.round((completedWeight / totalWeight) * 100) : 0;
        const beforeProgressPercent = Number(project.progressPercent || 0);
        const metadata = { ...(project.metadata || {}), progress: { totalTasks, completedTasks, totalWeight, completedWeight, progressPercent } };
        await project.update({ metadata, progressPercent });
        if (beforeProgressPercent !== progressPercent) {
            await this.logActivity(businessId, {
                projectId,
                action: "PROJECT_PROGRESS_UPDATED",
                entityType: "project",
                entityId: projectId,
                before: { progressPercent: beforeProgressPercent },
                after: { progressPercent, totalTasks, completedTasks }
            });
        }
        return metadata.progress;
    }
    normalizeTaskWeight(weight) {
        const parsed = Number(weight ?? 1);
        return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
    }
    taskWeight(task) {
        return this.normalizeTaskWeight(task.weight ?? task.metadata?.weight);
    }
    async ensureEmployee(businessId, employeeId) {
        const employee = await models_1.db.EmployeeRecord.findOne({ where: { id: employeeId, businessId } });
        if (!employee)
            throw new Error("Employee not found");
        return employee;
    }
    async resolveProjectClient(businessId, data) {
        if (data.clientId) {
            const client = await models_1.db.Client.findOne({ where: { id: data.clientId, businessId } });
            if (!client)
                throw new Error("Client not found");
            return client.id;
        }
        if (!data.newClient)
            return null;
        const companyName = String(data.newClient.companyName || "").trim();
        if (!companyName)
            throw new Error("Client company name is required");
        const client = await models_1.db.Client.create({
            businessId,
            accountManagerUserId: data.newClient.accountManagerUserId || data.projectManagerUserId || null,
            companyName,
            contactName: data.newClient.contactName || null,
            email: data.newClient.email || null,
            phone: data.newClient.phone || null,
            industry: data.newClient.industry || null,
            status: "active"
        });
        return client.id;
    }
    async ensureEmployeeForUser(businessId, userId) {
        const employee = await models_1.db.EmployeeRecord.findOne({ where: { businessId, userId } });
        if (!employee)
            throw new Error("Employee not found");
        return employee;
    }
    async ensureNotMember(businessId, projectId, employeeId) {
        const existing = await models_1.db.ProjectMember.findOne({ where: { businessId, projectId, employeeId } });
        if (existing)
            throw new Error("Employee is already a project member");
    }
    async ensureOwnerManagerMembers(businessId, project) {
        const memberIds = [project.ownerEmployeeId, project.managerEmployeeId].filter(Boolean);
        for (const employeeId of new Set(memberIds)) {
            await this.ensureEmployee(businessId, employeeId);
            const existing = await models_1.db.ProjectMember.findOne({ where: { businessId, projectId: project.id, employeeId } });
            if (!existing) {
                await models_1.db.ProjectMember.create({
                    businessId,
                    projectId: project.id,
                    employeeId,
                    role: employeeId === project.ownerEmployeeId ? "OWNER" : "MANAGER",
                    allocationPercent: 100,
                    status: "active"
                });
            }
        }
    }
    projectIncludes() {
        return [
            { model: models_1.db.EmployeeRecord, as: "owner", include: [{ model: models_1.db.User, as: "user", attributes: ["id", "fullName", "email"] }] },
            { model: models_1.db.EmployeeRecord, as: "manager", include: [{ model: models_1.db.User, as: "user", attributes: ["id", "fullName", "email"] }] },
            { model: models_1.db.Client, attributes: ["id", "companyName", "contactName", "email", "phone"] },
            { model: models_1.db.ProjectMember, as: "members", include: [{ model: models_1.db.EmployeeRecord, as: "employee", include: [{ model: models_1.db.User, as: "user", attributes: ["id", "fullName", "email"] }] }] }
        ];
    }
    taskIncludes() {
        return [
            { model: models_1.db.Project, attributes: ["id", "title", "code", "status", "businessId"] },
            { model: models_1.db.EmployeeRecord, as: "employeeAssignee", include: [{ model: models_1.db.User, as: "user", attributes: ["id", "fullName", "email"] }] }
        ];
    }
    async assignTask(businessId, id, assignedToUserId) {
        const t = await models_1.db.ProjectTask.findOne({ where: { id, businessId } });
        if (!t)
            throw new Error("Task not found");
        await t.update({ assignedToUserId });
        await this.notify(businessId, assignedToUserId, 'Task Assigned', 'You have been explicitly assigned to a project task.', 'project_task', id);
        return t;
    }
    async updateTaskStatus(businessId, id, status) {
        const t = await models_1.db.ProjectTask.findOne({ where: { id, businessId } });
        if (!t)
            throw new Error("Task not found");
        await t.update({ status });
        return t;
    }
    async listTasks(businessId, projectId) {
        return models_1.db.ProjectTask.findAndCountAll({ where: { businessId, projectId } });
    }
    async createIssue(businessId, data) {
        const i = await models_1.db.ProjectIssue.create({ ...data, businessId });
        if (i.assignedToUserId)
            await this.notify(businessId, i.assignedToUserId, 'Issue Assigned', 'You have an active issue assignment.', 'project_issue', i.id);
        return i;
    }
    async listIssues(businessId, projectId) {
        return models_1.db.ProjectIssue.findAndCountAll({ where: { businessId, projectId } });
    }
    async createChangeRequest(businessId, data) {
        return models_1.db.ProjectChangeRequest.create({ ...data, businessId });
    }
    async listChangeRequests(businessId, projectId) {
        return models_1.db.ProjectChangeRequest.findAndCountAll({ where: { businessId, projectId } });
    }
    async getProjectProgress(businessId, projectId) {
        // Calculates abstract completion percentage based on mapped tasks 
        const tasks = await models_1.db.ProjectTask.findAll({ where: { businessId, projectId } });
        if (tasks.length === 0)
            return { totalTasks: 0, completedTasks: 0, progressPercent: 0 };
        const completed = tasks.filter((t) => t.status === 'done').length;
        const progressPercent = Math.round((completed / tasks.length) * 100);
        return { totalTasks: tasks.length, completedTasks: completed, progressPercent };
    }
    async notify(businessId, recipientUserId, title, message, entityType, entityId) {
        try {
            await notification_service_1.InternalNotifier.send({ businessId, recipientUserId, moduleKey: 'projects', type: 'assignment', title, message, entityType, entityId });
        }
        catch (e) { }
    }
}
exports.ProjectsService = ProjectsService;
