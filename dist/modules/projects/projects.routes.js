"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.projectsRoutes = void 0;
const express_1 = require("express");
const auth_1 = require("../../middlewares/auth");
const role_1 = require("../../middlewares/role");
const requireActiveModule_1 = require("../../middlewares/requireActiveModule");
const validate_1 = require("../../middlewares/validate");
const asyncHandler_1 = require("../../utils/asyncHandler");
const projects_controller_1 = require("./projects.controller");
const project_validator_1 = require("../../validators/project.validator");
const router = (0, express_1.Router)();
const controller = new projects_controller_1.ProjectsController();
// App boundary
router.use((0, requireActiveModule_1.requireActiveModule)('projects'));
router.use(auth_1.authRequired);
/**
 * @openapi
 * /api/v1/projects/templates:
 *   post:
 *     tags: [projects]
 *     summary: POST /templates
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 *       400:
 *         $ref: '#/components/responses/400'
 *       401:
 *         $ref: '#/components/responses/401'
 *       403:
 *         $ref: '#/components/responses/403'
 *       404:
 *         $ref: '#/components/responses/404'
 *       500:
 *         $ref: '#/components/responses/500'
 */
router.post('/templates', (0, role_1.requireRole)('BUSINESS_ADMIN'), (0, asyncHandler_1.asyncHandler)(controller.seedForms));
// Project
/**
 * @openapi
 * /api/v1/projects:
 *   post:
 *     tags: [projects]
 *     summary: POST index
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 *       400:
 *         $ref: '#/components/responses/400'
 *       401:
 *         $ref: '#/components/responses/401'
 *       403:
 *         $ref: '#/components/responses/403'
 *       404:
 *         $ref: '#/components/responses/404'
 *       500:
 *         $ref: '#/components/responses/500'
 */
router.post('/', (0, validate_1.validate)(project_validator_1.createProjectSchema), (0, asyncHandler_1.asyncHandler)(controller.createProject));
/**
 * @openapi
 * /api/v1/projects:
 *   get:
 *     tags: [projects]
 *     summary: GET index
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: size
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Success
 *       400:
 *         $ref: '#/components/responses/400'
 *       401:
 *         $ref: '#/components/responses/401'
 *       403:
 *         $ref: '#/components/responses/403'
 *       404:
 *         $ref: '#/components/responses/404'
 *       500:
 *         $ref: '#/components/responses/500'
 */
router.get('/', (0, validate_1.validate)(project_validator_1.listProjectsQuerySchema, "query"), (0, asyncHandler_1.asyncHandler)(controller.listProjects));
router.get('/my-tasks', (0, validate_1.validate)(project_validator_1.listProjectTasksQuerySchema, "query"), (0, asyncHandler_1.asyncHandler)(controller.myTasks));
router.get('/workflow/catalog', (0, asyncHandler_1.asyncHandler)(controller.workflowCatalog));
router.get('/:projectId([0-9a-fA-F-]{36})/members', (0, validate_1.validate)(project_validator_1.projectMembersParamsSchema, "params"), (0, asyncHandler_1.asyncHandler)(controller.listMembers));
router.post('/:projectId([0-9a-fA-F-]{36})/members', (0, validate_1.validate)(project_validator_1.projectMembersParamsSchema, "params"), (0, validate_1.validate)(project_validator_1.addProjectMemberSchema), (0, asyncHandler_1.asyncHandler)(controller.addMember));
router.post('/:projectId([0-9a-fA-F-]{36})/members/bulk', (0, validate_1.validate)(project_validator_1.projectMembersParamsSchema, "params"), (0, validate_1.validate)(project_validator_1.bulkAddProjectMembersSchema), (0, asyncHandler_1.asyncHandler)(controller.bulkAddMembers));
router.patch('/:projectId([0-9a-fA-F-]{36})/members/:memberId([0-9a-fA-F-]{36})', (0, validate_1.validate)(project_validator_1.projectMemberParamsSchema, "params"), (0, validate_1.validate)(project_validator_1.updateProjectMemberSchema), (0, asyncHandler_1.asyncHandler)(controller.updateMember));
router.delete('/:projectId([0-9a-fA-F-]{36})/members/:memberId([0-9a-fA-F-]{36})', (0, validate_1.validate)(project_validator_1.projectMemberParamsSchema, "params"), (0, asyncHandler_1.asyncHandler)(controller.removeMember));
router.get('/:projectId([0-9a-fA-F-]{36})/tasks', (0, validate_1.validate)(project_validator_1.projectTasksParamsSchema, "params"), (0, validate_1.validate)(project_validator_1.listProjectTasksQuerySchema, "query"), (0, asyncHandler_1.asyncHandler)(controller.listNestedTasks));
router.post('/:projectId([0-9a-fA-F-]{36})/tasks', (0, validate_1.validate)(project_validator_1.projectTasksParamsSchema, "params"), (0, validate_1.validate)(project_validator_1.createNestedProjectTaskSchema), (0, asyncHandler_1.asyncHandler)(controller.createNestedTask));
router.get('/:projectId([0-9a-fA-F-]{36})/tasks/:taskId([0-9a-fA-F-]{36})/comments', (0, validate_1.validate)(project_validator_1.projectTaskParamsSchema, "params"), (0, asyncHandler_1.asyncHandler)(controller.listTaskComments));
router.post('/:projectId([0-9a-fA-F-]{36})/tasks/:taskId([0-9a-fA-F-]{36})/comments', (0, validate_1.validate)(project_validator_1.projectTaskParamsSchema, "params"), (0, validate_1.validate)(project_validator_1.createTaskCommentSchema), (0, asyncHandler_1.asyncHandler)(controller.createTaskComment));
router.patch('/:projectId([0-9a-fA-F-]{36})/tasks/:taskId([0-9a-fA-F-]{36})/comments/:commentId([0-9a-fA-F-]{36})', (0, validate_1.validate)(project_validator_1.taskCommentParamsSchema, "params"), (0, validate_1.validate)(project_validator_1.updateTaskCommentSchema), (0, asyncHandler_1.asyncHandler)(controller.updateTaskComment));
router.delete('/:projectId([0-9a-fA-F-]{36})/tasks/:taskId([0-9a-fA-F-]{36})/comments/:commentId([0-9a-fA-F-]{36})', (0, validate_1.validate)(project_validator_1.taskCommentParamsSchema, "params"), (0, asyncHandler_1.asyncHandler)(controller.deleteTaskComment));
router.get('/:projectId([0-9a-fA-F-]{36})/tasks/:taskId([0-9a-fA-F-]{36})', (0, validate_1.validate)(project_validator_1.projectTaskParamsSchema, "params"), (0, asyncHandler_1.asyncHandler)(controller.viewNestedTask));
router.patch('/:projectId([0-9a-fA-F-]{36})/tasks/:taskId([0-9a-fA-F-]{36})', (0, validate_1.validate)(project_validator_1.projectTaskParamsSchema, "params"), (0, validate_1.validate)(project_validator_1.updateNestedProjectTaskSchema), (0, asyncHandler_1.asyncHandler)(controller.updateNestedTask));
router.delete('/:projectId([0-9a-fA-F-]{36})/tasks/:taskId([0-9a-fA-F-]{36})', (0, validate_1.validate)(project_validator_1.projectTaskParamsSchema, "params"), (0, asyncHandler_1.asyncHandler)(controller.deleteNestedTask));
router.patch('/:projectId([0-9a-fA-F-]{36})/tasks/:taskId([0-9a-fA-F-]{36})/assign', (0, validate_1.validate)(project_validator_1.projectTaskParamsSchema, "params"), (0, validate_1.validate)(project_validator_1.assignProjectTaskSchema), (0, asyncHandler_1.asyncHandler)(controller.assignNestedTask));
router.patch('/:projectId([0-9a-fA-F-]{36})/tasks/:taskId([0-9a-fA-F-]{36})/status', (0, validate_1.validate)(project_validator_1.projectTaskParamsSchema, "params"), (0, validate_1.validate)(project_validator_1.changeProjectTaskStatusSchema), (0, asyncHandler_1.asyncHandler)(controller.changeNestedTaskStatus));
router.get('/:projectId([0-9a-fA-F-]{36})/workflow-forms', (0, validate_1.validate)(project_validator_1.projectMembersParamsSchema, "params"), (0, validate_1.validate)(project_validator_1.listProjectWorkflowFormsQuerySchema, "query"), (0, asyncHandler_1.asyncHandler)(controller.listWorkflowForms));
router.post('/:projectId([0-9a-fA-F-]{36})/workflow-forms', (0, validate_1.validate)(project_validator_1.projectMembersParamsSchema, "params"), (0, validate_1.validate)(project_validator_1.createProjectWorkflowFormSchema), (0, asyncHandler_1.asyncHandler)(controller.createWorkflowForm));
router.patch('/:projectId([0-9a-fA-F-]{36})/workflow-forms/:formId([0-9a-fA-F-]{36})', (0, validate_1.validate)(project_validator_1.projectWorkflowFormParamsSchema, "params"), (0, validate_1.validate)(project_validator_1.updateProjectWorkflowFormSchema), (0, asyncHandler_1.asyncHandler)(controller.updateWorkflowForm));
router.patch('/:projectId([0-9a-fA-F-]{36})/workflow-forms/:formId([0-9a-fA-F-]{36})/status', (0, validate_1.validate)(project_validator_1.projectWorkflowFormParamsSchema, "params"), (0, validate_1.validate)(project_validator_1.changeProjectWorkflowFormStatusSchema), (0, asyncHandler_1.asyncHandler)(controller.changeWorkflowFormStatus));
router.get('/:id([0-9a-fA-F-]{36})', (0, validate_1.validate)(project_validator_1.projectIdParamsSchema, "params"), (0, asyncHandler_1.asyncHandler)(controller.viewProject));
router.patch('/:id([0-9a-fA-F-]{36})', (0, validate_1.validate)(project_validator_1.projectIdParamsSchema, "params"), (0, validate_1.validate)(project_validator_1.updateProjectSchema), (0, asyncHandler_1.asyncHandler)(controller.updateProject));
router.patch('/:id([0-9a-fA-F-]{36})/status', (0, validate_1.validate)(project_validator_1.projectIdParamsSchema, "params"), (0, validate_1.validate)(project_validator_1.changeProjectStatusSchema), (0, asyncHandler_1.asyncHandler)(controller.changeProjectStatus));
router.patch('/:id([0-9a-fA-F-]{36})/archive', (0, validate_1.validate)(project_validator_1.projectIdParamsSchema, "params"), (0, asyncHandler_1.asyncHandler)(controller.archiveProject));
/**
 * @openapi
 * /api/v1/projects/{id}/progress:
 *   get:
 *     tags: [projects]
 *     summary: GET /:id/progress
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Success
 *       400:
 *         $ref: '#/components/responses/400'
 *       401:
 *         $ref: '#/components/responses/401'
 *       403:
 *         $ref: '#/components/responses/403'
 *       404:
 *         $ref: '#/components/responses/404'
 *       500:
 *         $ref: '#/components/responses/500'
 */
router.get('/:id/progress', (0, asyncHandler_1.asyncHandler)(controller.getProjectProgress));
// Milestones
/**
 * @openapi
 * /api/v1/projects/milestones:
 *   post:
 *     tags: [projects]
 *     summary: POST /milestones
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 *       400:
 *         $ref: '#/components/responses/400'
 *       401:
 *         $ref: '#/components/responses/401'
 *       403:
 *         $ref: '#/components/responses/403'
 *       404:
 *         $ref: '#/components/responses/404'
 *       500:
 *         $ref: '#/components/responses/500'
 */
router.post('/milestones', (0, asyncHandler_1.asyncHandler)(controller.createMilestone));
/**
 * @openapi
 * /api/v1/projects/milestones:
 *   get:
 *     tags: [projects]
 *     summary: GET /milestones
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: size
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Success
 *       400:
 *         $ref: '#/components/responses/400'
 *       401:
 *         $ref: '#/components/responses/401'
 *       403:
 *         $ref: '#/components/responses/403'
 *       404:
 *         $ref: '#/components/responses/404'
 *       500:
 *         $ref: '#/components/responses/500'
 */
router.get('/milestones', (0, asyncHandler_1.asyncHandler)(controller.listMilestones));
// Tasks
/**
 * @openapi
 * /api/v1/projects/tasks:
 *   post:
 *     tags: [projects]
 *     summary: POST /tasks
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 *       400:
 *         $ref: '#/components/responses/400'
 *       401:
 *         $ref: '#/components/responses/401'
 *       403:
 *         $ref: '#/components/responses/403'
 *       404:
 *         $ref: '#/components/responses/404'
 *       500:
 *         $ref: '#/components/responses/500'
 */
router.post('/tasks', (0, asyncHandler_1.asyncHandler)(controller.createTask));
/**
 * @openapi
 * /api/v1/projects/tasks:
 *   get:
 *     tags: [projects]
 *     summary: GET /tasks
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: size
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Success
 *       400:
 *         $ref: '#/components/responses/400'
 *       401:
 *         $ref: '#/components/responses/401'
 *       403:
 *         $ref: '#/components/responses/403'
 *       404:
 *         $ref: '#/components/responses/404'
 *       500:
 *         $ref: '#/components/responses/500'
 */
router.get('/tasks', (0, asyncHandler_1.asyncHandler)(controller.listTasks));
/**
 * @openapi
 * /api/v1/projects/tasks/{id}/assign:
 *   patch:
 *     tags: [projects]
 *     summary: PATCH /tasks/:id/assign
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Success
 *       400:
 *         $ref: '#/components/responses/400'
 *       401:
 *         $ref: '#/components/responses/401'
 *       403:
 *         $ref: '#/components/responses/403'
 *       404:
 *         $ref: '#/components/responses/404'
 *       500:
 *         $ref: '#/components/responses/500'
 */
router.patch('/tasks/:id/assign', (0, asyncHandler_1.asyncHandler)(controller.assignTask));
/**
 * @openapi
 * /api/v1/projects/tasks/{id}/status:
 *   patch:
 *     tags: [projects]
 *     summary: PATCH /tasks/:id/status
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Success
 *       400:
 *         $ref: '#/components/responses/400'
 *       401:
 *         $ref: '#/components/responses/401'
 *       403:
 *         $ref: '#/components/responses/403'
 *       404:
 *         $ref: '#/components/responses/404'
 *       500:
 *         $ref: '#/components/responses/500'
 */
router.patch('/tasks/:id/status', (0, asyncHandler_1.asyncHandler)(controller.updateTaskStatus));
// Issues
/**
 * @openapi
 * /api/v1/projects/issues:
 *   post:
 *     tags: [projects]
 *     summary: POST /issues
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 *       400:
 *         $ref: '#/components/responses/400'
 *       401:
 *         $ref: '#/components/responses/401'
 *       403:
 *         $ref: '#/components/responses/403'
 *       404:
 *         $ref: '#/components/responses/404'
 *       500:
 *         $ref: '#/components/responses/500'
 */
router.post('/issues', (0, asyncHandler_1.asyncHandler)(controller.createIssue));
/**
 * @openapi
 * /api/v1/projects/issues:
 *   get:
 *     tags: [projects]
 *     summary: GET /issues
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: size
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Success
 *       400:
 *         $ref: '#/components/responses/400'
 *       401:
 *         $ref: '#/components/responses/401'
 *       403:
 *         $ref: '#/components/responses/403'
 *       404:
 *         $ref: '#/components/responses/404'
 *       500:
 *         $ref: '#/components/responses/500'
 */
router.get('/issues', (0, asyncHandler_1.asyncHandler)(controller.listIssues));
// Change Requests
/**
 * @openapi
 * /api/v1/projects/change-requests:
 *   post:
 *     tags: [projects]
 *     summary: POST /change-requests
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 *       400:
 *         $ref: '#/components/responses/400'
 *       401:
 *         $ref: '#/components/responses/401'
 *       403:
 *         $ref: '#/components/responses/403'
 *       404:
 *         $ref: '#/components/responses/404'
 *       500:
 *         $ref: '#/components/responses/500'
 */
router.post('/change-requests', (0, asyncHandler_1.asyncHandler)(controller.createChangeRequest));
/**
 * @openapi
 * /api/v1/projects/change-requests:
 *   get:
 *     tags: [projects]
 *     summary: GET /change-requests
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: size
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Success
 *       400:
 *         $ref: '#/components/responses/400'
 *       401:
 *         $ref: '#/components/responses/401'
 *       403:
 *         $ref: '#/components/responses/403'
 *       404:
 *         $ref: '#/components/responses/404'
 *       500:
 *         $ref: '#/components/responses/500'
 */
router.get('/change-requests', (0, asyncHandler_1.asyncHandler)(controller.listChangeRequests));
exports.projectsRoutes = router;
