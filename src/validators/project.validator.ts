import Joi from "joi";

const uuid = Joi.string().uuid();
const dateOnly = Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/);
const projectStatus = Joi.string().valid("DRAFT", "PLANNED", "ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED", "ARCHIVED");
const projectPriority = Joi.string().valid("LOW", "NORMAL", "HIGH", "URGENT");

const projectDateWindow = (value: any, helpers: any) => {
  if (value.startDate && value.endDate && value.endDate < value.startDate) {
    return helpers.error("any.invalid", { message: "endDate must be on or after startDate" });
  }
  return value;
};

export const createProjectSchema = Joi.object({
  clientId: uuid.optional().allow(null, ""),
  newClient: Joi.object({
    companyName: Joi.string().min(2).max(255).required(),
    contactName: Joi.string().max(255).optional().allow(null, ""),
    email: Joi.string().email().max(255).optional().allow(null, ""),
    phone: Joi.string().max(50).optional().allow(null, ""),
    industry: Joi.string().max(120).optional().allow(null, ""),
    accountManagerUserId: uuid.optional().allow(null, "")
  }).optional(),
  clientPortalUser: Joi.object({
    fullName: Joi.string().max(255).optional().allow(null, ""),
    email: Joi.string().email().max(255).optional().allow(null, ""),
    phone: Joi.string().max(50).optional().allow(null, ""),
    password: Joi.string().min(6).max(128).optional().allow(null, ""),
    status: Joi.string().valid("active", "inactive", "invited").optional(),
    metadata: Joi.object().optional()
  }).optional(),
  dealId: uuid.optional().allow(null, ""),
  ownerEmployeeId: uuid.optional().allow(null, ""),
  managerEmployeeId: uuid.optional().allow(null, ""),
  projectManagerUserId: uuid.optional().allow(null, ""),
  title: Joi.string().min(2).max(255).required(),
  code: Joi.string().max(50).optional().allow(null, ""),
  type: Joi.string().max(100).optional(),
  description: Joi.string().max(5000).optional().allow(null, ""),
  startDate: dateOnly.optional().allow(null, ""),
  endDate: dateOnly.optional().allow(null, ""),
  budget: Joi.number().min(0).optional(),
  currency: Joi.string().max(10).optional(),
  priority: projectPriority.optional(),
  status: projectStatus.optional(),
  metadata: Joi.object().optional()
}).custom((value, helpers) => {
  if (!value.dealId && !value.title) return helpers.error("any.required", { message: "title is required unless dealId is provided" });
  return projectDateWindow(value, helpers);
});

export const updateProjectSchema = Joi.object({
  clientId: uuid.optional().allow(null, ""),
  newClient: Joi.object({
    companyName: Joi.string().min(2).max(255).required(),
    contactName: Joi.string().max(255).optional().allow(null, ""),
    email: Joi.string().email().max(255).optional().allow(null, ""),
    phone: Joi.string().max(50).optional().allow(null, ""),
    industry: Joi.string().max(120).optional().allow(null, ""),
    accountManagerUserId: uuid.optional().allow(null, "")
  }).optional(),
  clientPortalUser: Joi.object({
    fullName: Joi.string().max(255).optional().allow(null, ""),
    email: Joi.string().email().max(255).optional().allow(null, ""),
    phone: Joi.string().max(50).optional().allow(null, ""),
    password: Joi.string().min(6).max(128).optional().allow(null, ""),
    status: Joi.string().valid("active", "inactive", "invited").optional(),
    metadata: Joi.object().optional()
  }).optional(),
  dealId: uuid.optional().allow(null, ""),
  ownerEmployeeId: uuid.optional().allow(null, ""),
  managerEmployeeId: uuid.optional().allow(null, ""),
  projectManagerUserId: uuid.optional().allow(null, ""),
  title: Joi.string().min(2).max(255).optional(),
  code: Joi.string().max(50).optional().allow(null, ""),
  type: Joi.string().max(100).optional(),
  description: Joi.string().max(5000).optional().allow(null, ""),
  startDate: dateOnly.optional().allow(null, ""),
  endDate: dateOnly.optional().allow(null, ""),
  budget: Joi.number().min(0).optional(),
  currency: Joi.string().max(10).optional(),
  priority: projectPriority.optional(),
  metadata: Joi.object().optional()
}).min(1).custom(projectDateWindow);

export const listProjectsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).optional().default(1),
  size: Joi.number().integer().min(1).max(100).optional().default(20),
  status: projectStatus.optional(),
  priority: projectPriority.optional(),
  search: Joi.string().max(120).optional().allow("", null)
});

export const projectIdParamsSchema = Joi.object({
  id: uuid.required()
});

export const projectMembersParamsSchema = Joi.object({
  projectId: uuid.required()
});

export const projectMemberParamsSchema = Joi.object({
  projectId: uuid.required(),
  memberId: uuid.required()
});

export const projectTasksParamsSchema = Joi.object({
  projectId: uuid.required()
});

export const projectTaskParamsSchema = Joi.object({
  projectId: uuid.required(),
  taskId: uuid.required()
});

export const taskCommentParamsSchema = Joi.object({
  projectId: uuid.required(),
  taskId: uuid.required(),
  commentId: uuid.required()
});

export const changeProjectStatusSchema = Joi.object({
  status: projectStatus.required()
});

const projectMemberRole = Joi.string().valid("OWNER", "MANAGER", "MEMBER", "VIEWER", "STAKEHOLDER");

export const addProjectMemberSchema = Joi.object({
  employeeId: uuid.required(),
  role: projectMemberRole.optional().default("MEMBER"),
  allocationPercent: Joi.number().min(0).max(100).optional(),
  startDate: dateOnly.optional().allow(null, ""),
  endDate: dateOnly.optional().allow(null, ""),
  status: Joi.string().valid("active", "inactive", "removed").optional(),
  metadata: Joi.object().optional()
}).custom(projectDateWindow);

export const updateProjectMemberSchema = Joi.object({
  role: projectMemberRole.optional(),
  allocationPercent: Joi.number().min(0).max(100).optional(),
  startDate: dateOnly.optional().allow(null, ""),
  endDate: dateOnly.optional().allow(null, ""),
  status: Joi.string().valid("active", "inactive", "removed").optional(),
  metadata: Joi.object().optional()
}).min(1).custom(projectDateWindow);

export const bulkAddProjectMembersSchema = Joi.object({
  members: Joi.array().items(addProjectMemberSchema).min(1).max(100).required()
});

const taskStatus = Joi.string().valid("BACKLOG", "TODO", "IN_PROGRESS", "IN_REVIEW", "BLOCKED", "DONE", "CANCELLED");
const taskPriority = Joi.string().valid("LOW", "MEDIUM", "HIGH", "URGENT");
const workflowStatus = Joi.string().valid("draft", "submitted", "approved", "rejected", "returned-for-revision", "archived");
const workflowGroup = Joi.string().valid("setup", "milestones", "tasks", "deliverables", "change_requests", "issues", "risks", "closure", "lessons", "evaluations");

export const listProjectTasksQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).optional().default(1),
  size: Joi.number().integer().min(1).max(100).optional().default(50),
  status: taskStatus.optional(),
  priority: taskPriority.optional(),
  assigneeEmployeeId: uuid.optional().allow("", null),
  search: Joi.string().max(120).optional().allow("", null)
});

export const createNestedProjectTaskSchema = Joi.object({
  milestoneId: uuid.optional().allow(null, ""),
  assigneeEmployeeId: uuid.optional().allow(null, ""),
  assignedToUserId: uuid.optional().allow(null, ""),
  title: Joi.string().min(2).max(255).required(),
  description: Joi.string().max(5000).optional().allow(null, ""),
  priority: taskPriority.optional().default("MEDIUM"),
  status: taskStatus.optional().default("TODO"),
  startDate: dateOnly.optional().allow(null, ""),
  dueDate: dateOnly.optional().allow(null, ""),
  estimatedHours: Joi.number().min(0).optional(),
  actualHours: Joi.number().min(0).optional(),
  weight: Joi.number().min(0.1).optional(),
  metadata: Joi.object().optional()
}).custom((value, helpers) => {
  if (value.startDate && value.dueDate && value.dueDate < value.startDate) {
    return helpers.error("any.invalid", { message: "dueDate must be on or after startDate" });
  }
  return value;
});

export const updateNestedProjectTaskSchema = Joi.object({
  milestoneId: uuid.optional().allow(null, ""),
  assigneeEmployeeId: uuid.optional().allow(null, ""),
  assignedToUserId: uuid.optional().allow(null, ""),
  title: Joi.string().min(2).max(255).optional(),
  description: Joi.string().max(5000).optional().allow(null, ""),
  priority: taskPriority.optional(),
  startDate: dateOnly.optional().allow(null, ""),
  dueDate: dateOnly.optional().allow(null, ""),
  estimatedHours: Joi.number().min(0).optional(),
  actualHours: Joi.number().min(0).optional(),
  weight: Joi.number().min(0.1).optional(),
  metadata: Joi.object().optional()
}).min(1).custom((value, helpers) => {
  if (value.startDate && value.dueDate && value.dueDate < value.startDate) {
    return helpers.error("any.invalid", { message: "dueDate must be on or after startDate" });
  }
  return value;
});

export const assignProjectTaskSchema = Joi.object({
  assigneeEmployeeId: uuid.required()
});

export const changeProjectTaskStatusSchema = Joi.object({
  status: taskStatus.required()
});

export const projectWorkflowFormParamsSchema = Joi.object({
  projectId: uuid.required(),
  formId: uuid.required()
});

export const listProjectWorkflowFormsQuerySchema = Joi.object({
  group: workflowGroup.optional(),
  formKey: Joi.string().max(120).optional(),
  status: workflowStatus.optional(),
  milestoneId: uuid.optional().allow("", null),
  taskId: uuid.optional().allow("", null)
});

const workflowAdaptersSchema = Joi.object({
  crm: Joi.object({ enabled: Joi.boolean().optional(), config: Joi.object().optional() }).optional(),
  finance: Joi.object({ enabled: Joi.boolean().optional(), config: Joi.object().optional() }).optional(),
  hr: Joi.object({ enabled: Joi.boolean().optional(), config: Joi.object().optional() }).optional(),
  performance: Joi.object({ enabled: Joi.boolean().optional(), config: Joi.object().optional() }).optional(),
  brain: Joi.object({ enabled: Joi.boolean().optional(), config: Joi.object().optional() }).optional(),
  n8n: Joi.object({ enabled: Joi.boolean().optional(), config: Joi.object().optional() }).optional()
}).optional();

export const createProjectWorkflowFormSchema = Joi.object({
  formKey: Joi.string().max(120).required(),
  workflowGroup: workflowGroup.optional(),
  milestoneId: uuid.optional().allow(null, ""),
  taskId: uuid.optional().allow(null, ""),
  fileAssetId: uuid.optional().allow(null, ""),
  status: Joi.string().valid("draft", "submitted").optional(),
  data: Joi.object().optional(),
  adapters: workflowAdaptersSchema,
  metadata: Joi.object().optional()
});

export const updateProjectWorkflowFormSchema = Joi.object({
  workflowGroup: workflowGroup.optional(),
  milestoneId: uuid.optional().allow(null, ""),
  taskId: uuid.optional().allow(null, ""),
  fileAssetId: uuid.optional().allow(null, ""),
  data: Joi.object().optional(),
  adapters: workflowAdaptersSchema,
  metadata: Joi.object().optional()
}).min(1);

export const changeProjectWorkflowFormStatusSchema = Joi.object({
  status: workflowStatus.required(),
  metadata: Joi.object().optional()
});

export const createProjectMemberSchema = Joi.object({
  projectId: uuid.required(),
  employeeId: uuid.required(),
  role: Joi.string().max(80).optional(),
  allocationPercent: Joi.number().min(0).max(100).optional(),
  startDate: dateOnly.optional().allow(null, ""),
  endDate: dateOnly.optional().allow(null, ""),
  status: Joi.string().valid("active", "inactive", "removed").optional(),
  metadata: Joi.object().optional()
});

export const createProjectTaskSchema = Joi.object({
  projectId: uuid.required(),
  milestoneId: uuid.optional().allow(null, ""),
  assigneeEmployeeId: uuid.optional().allow(null, ""),
  assignedToUserId: uuid.optional().allow(null, ""),
  code: Joi.string().max(60).optional().allow(null, ""),
  title: Joi.string().min(2).max(255).required(),
  description: Joi.string().max(5000).optional().allow(null, ""),
  priority: Joi.string().valid("low", "normal", "high", "urgent").optional(),
  status: Joi.string().valid("todo", "in_progress", "review", "done").optional(),
  startDate: dateOnly.optional().allow(null, ""),
  dueDate: dateOnly.optional().allow(null, ""),
  estimatedHours: Joi.number().min(0).optional(),
  actualHours: Joi.number().min(0).optional(),
  metadata: Joi.object().optional()
});

export const createTaskCommentSchema = Joi.object({
  body: Joi.string().min(1).max(10000).required(),
  metadata: Joi.object().optional()
});

export const updateTaskCommentSchema = Joi.object({
  body: Joi.string().min(1).max(10000).required(),
  metadata: Joi.object().optional()
});
