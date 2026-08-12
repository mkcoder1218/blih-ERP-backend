
import { Router } from 'express';
import { authRequired } from '../../middlewares/auth';
import { requireRole } from '../../middlewares/role';
import { requireAnyPermission } from '../../middlewares/permission';
import { requireActiveModule } from '../../middlewares/requireActiveModule';
import { validate } from '../../middlewares/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { ProjectsController } from './projects.controller';
import { TaskCommentsController } from './task-comments.controller';
import {
  addProjectMemberSchema,
  assignProjectTaskSchema,
  bulkAddProjectMembersSchema,
  changeProjectTaskStatusSchema,
  changeProjectWorkflowFormStatusSchema,
  changeProjectStatusSchema,
  createNestedProjectTaskSchema,
  createProjectSchema,
  createProjectWorkflowFormSchema,
  createTaskCommentSchema,
  listProjectTasksQuerySchema,
  listProjectWorkflowFormsQuerySchema,
  listProjectsQuerySchema,
  projectMemberParamsSchema,
  projectMembersParamsSchema,
  projectIdParamsSchema,
  taskCommentParamsSchema,
  projectTaskParamsSchema,
  projectTasksParamsSchema,
  projectWorkflowFormParamsSchema,
  updateNestedProjectTaskSchema,
  updateProjectMemberSchema,
  updateProjectWorkflowFormSchema,
  updateTaskCommentSchema,
  updateProjectSchema
} from '../../validators/project.validator';

const router = Router();
const controller = new ProjectsController();
const taskCommentsController = new TaskCommentsController();

// App boundary
router.use(requireActiveModule('projects'));
router.use(authRequired);

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
router.post('/templates', requireRole('BUSINESS_ADMIN'), asyncHandler(controller.seedForms));

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
router.post('/', requireAnyPermission('project.create', 'project.manage'), validate(createProjectSchema), asyncHandler(controller.createProject));
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
router.get('/', validate(listProjectsQuerySchema, "query"), asyncHandler(controller.listProjects));
router.get('/my-tasks', validate(listProjectTasksQuerySchema, "query"), asyncHandler(controller.myTasks));
router.get('/workflow/catalog', asyncHandler(controller.workflowCatalog));
router.get('/:projectId([0-9a-fA-F-]{36})/members', validate(projectMembersParamsSchema, "params"), asyncHandler(controller.listMembers));
router.post('/:projectId([0-9a-fA-F-]{36})/members', requireAnyPermission('project.manage'), validate(projectMembersParamsSchema, "params"), validate(addProjectMemberSchema), asyncHandler(controller.addMember));
router.post('/:projectId([0-9a-fA-F-]{36})/members/bulk', requireAnyPermission('project.manage'), validate(projectMembersParamsSchema, "params"), validate(bulkAddProjectMembersSchema), asyncHandler(controller.bulkAddMembers));
router.patch('/:projectId([0-9a-fA-F-]{36})/members/:memberId([0-9a-fA-F-]{36})', requireAnyPermission('project.manage'), validate(projectMemberParamsSchema, "params"), validate(updateProjectMemberSchema), asyncHandler(controller.updateMember));
router.delete('/:projectId([0-9a-fA-F-]{36})/members/:memberId([0-9a-fA-F-]{36})', requireAnyPermission('project.manage'), validate(projectMemberParamsSchema, "params"), asyncHandler(controller.removeMember));
router.get('/:projectId([0-9a-fA-F-]{36})/tasks', validate(projectTasksParamsSchema, "params"), validate(listProjectTasksQuerySchema, "query"), asyncHandler(controller.listNestedTasks));
router.post('/:projectId([0-9a-fA-F-]{36})/tasks', requireAnyPermission('project.task', 'project.manage'), validate(projectTasksParamsSchema, "params"), validate(createNestedProjectTaskSchema), asyncHandler(controller.createNestedTask));
router.get('/:projectId([0-9a-fA-F-]{36})/tasks/:taskId([0-9a-fA-F-]{36})/comments', validate(projectTaskParamsSchema, "params"), asyncHandler(taskCommentsController.list));
router.post('/:projectId([0-9a-fA-F-]{36})/tasks/:taskId([0-9a-fA-F-]{36})/comments', validate(projectTaskParamsSchema, "params"), validate(createTaskCommentSchema), asyncHandler(taskCommentsController.create));
router.patch('/:projectId([0-9a-fA-F-]{36})/tasks/:taskId([0-9a-fA-F-]{36})/comments/:commentId([0-9a-fA-F-]{36})', validate(taskCommentParamsSchema, "params"), validate(updateTaskCommentSchema), asyncHandler(taskCommentsController.update));
router.delete('/:projectId([0-9a-fA-F-]{36})/tasks/:taskId([0-9a-fA-F-]{36})/comments/:commentId([0-9a-fA-F-]{36})', validate(taskCommentParamsSchema, "params"), asyncHandler(taskCommentsController.remove));
router.get('/:projectId([0-9a-fA-F-]{36})/tasks/:taskId([0-9a-fA-F-]{36})', validate(projectTaskParamsSchema, "params"), asyncHandler(controller.viewNestedTask));
router.patch('/:projectId([0-9a-fA-F-]{36})/tasks/:taskId([0-9a-fA-F-]{36})', requireAnyPermission('project.task', 'project.manage'), validate(projectTaskParamsSchema, "params"), validate(updateNestedProjectTaskSchema), asyncHandler(controller.updateNestedTask));
router.delete('/:projectId([0-9a-fA-F-]{36})/tasks/:taskId([0-9a-fA-F-]{36})', requireAnyPermission('project.task', 'project.manage'), validate(projectTaskParamsSchema, "params"), asyncHandler(controller.deleteNestedTask));
router.patch('/:projectId([0-9a-fA-F-]{36})/tasks/:taskId([0-9a-fA-F-]{36})/assign', requireAnyPermission('project.task', 'project.manage'), validate(projectTaskParamsSchema, "params"), validate(assignProjectTaskSchema), asyncHandler(controller.assignNestedTask));
router.patch('/:projectId([0-9a-fA-F-]{36})/tasks/:taskId([0-9a-fA-F-]{36})/status', requireAnyPermission('project.task', 'project.manage'), validate(projectTaskParamsSchema, "params"), validate(changeProjectTaskStatusSchema), asyncHandler(controller.changeNestedTaskStatus));
router.get('/:projectId([0-9a-fA-F-]{36})/workflow-forms', validate(projectMembersParamsSchema, "params"), validate(listProjectWorkflowFormsQuerySchema, "query"), asyncHandler(controller.listWorkflowForms));
router.post('/:projectId([0-9a-fA-F-]{36})/workflow-forms', validate(projectMembersParamsSchema, "params"), validate(createProjectWorkflowFormSchema), asyncHandler(controller.createWorkflowForm));
router.patch('/:projectId([0-9a-fA-F-]{36})/workflow-forms/:formId([0-9a-fA-F-]{36})', validate(projectWorkflowFormParamsSchema, "params"), validate(updateProjectWorkflowFormSchema), asyncHandler(controller.updateWorkflowForm));
router.patch('/:projectId([0-9a-fA-F-]{36})/workflow-forms/:formId([0-9a-fA-F-]{36})/status', validate(projectWorkflowFormParamsSchema, "params"), validate(changeProjectWorkflowFormStatusSchema), asyncHandler(controller.changeWorkflowFormStatus));
router.get('/:id([0-9a-fA-F-]{36})', validate(projectIdParamsSchema, "params"), asyncHandler(controller.viewProject));
router.patch('/:id([0-9a-fA-F-]{36})', requireAnyPermission('project.manage'), validate(projectIdParamsSchema, "params"), validate(updateProjectSchema), asyncHandler(controller.updateProject));
router.patch('/:id([0-9a-fA-F-]{36})/status', requireAnyPermission('project.manage'), validate(projectIdParamsSchema, "params"), validate(changeProjectStatusSchema), asyncHandler(controller.changeProjectStatus));
router.patch('/:id([0-9a-fA-F-]{36})/archive', requireAnyPermission('project.manage'), validate(projectIdParamsSchema, "params"), asyncHandler(controller.archiveProject));
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
router.get('/:id/progress', asyncHandler(controller.getProjectProgress));

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
router.post('/milestones', requireAnyPermission('project.manage'), asyncHandler(controller.createMilestone));
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
router.get('/milestones', asyncHandler(controller.listMilestones));

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
router.post('/tasks', requireAnyPermission('project.task', 'project.manage'), asyncHandler(controller.createTask));
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
router.get('/tasks', asyncHandler(controller.listTasks));
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
router.patch('/tasks/:id/assign', requireAnyPermission('project.task', 'project.manage'), asyncHandler(controller.assignTask));
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
router.patch('/tasks/:id/status', requireAnyPermission('project.task', 'project.manage'), asyncHandler(controller.updateTaskStatus));

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
router.post('/issues', requireAnyPermission('project.task', 'project.manage'), asyncHandler(controller.createIssue));
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
router.get('/issues', asyncHandler(controller.listIssues));

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
router.post('/change-requests', requireAnyPermission('project.manage'), asyncHandler(controller.createChangeRequest));
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
router.get('/change-requests', asyncHandler(controller.listChangeRequests));

export const projectsRoutes = router;
