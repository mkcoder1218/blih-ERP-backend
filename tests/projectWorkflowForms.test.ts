import { PROJECT_WORKFLOW_FORMS, ProjectsService } from '../src/modules/projects/projects.service';
import { db } from '../src/models';

jest.mock('../src/models', () => ({
  db: {
    Project: { findOne: jest.fn() },
    ProjectMilestone: { findOne: jest.fn() },
    ProjectTask: { findOne: jest.fn() },
    ProjectWorkflowForm: { create: jest.fn(), findAll: jest.fn(), findOne: jest.fn() },
    ProjectActivityLog: { create: jest.fn() },
    EmployeeRecord: { findOne: jest.fn() },
    FileAsset: { findOne: jest.fn() },
    User: {}
  }
}));

const mockedDb = db as any;

describe('Project workflow forms', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedDb.Project.findOne.mockResolvedValue({ id: 'project-1', businessId: 'biz-1', title: 'Client Project', projectManagerUserId: null });
    mockedDb.ProjectActivityLog.create.mockResolvedValue({});
    mockedDb.EmployeeRecord.findOne.mockResolvedValue({ id: 'employee-1' });
  });

  it('exposes the client workflow catalog without creating a second project system', async () => {
    const catalog = await new ProjectsService().getWorkflowCatalog();
    expect(catalog).toHaveLength(17);
    expect(catalog.find((form) => form.key === 'project_brief')).toMatchObject({ group: 'setup', entity: 'project' });
    expect(catalog.find((form) => form.key === 'milestone_setup')).toMatchObject({ group: 'milestones', entity: 'milestone' });
    expect(catalog.find((form) => form.key === 'task_assignment')).toMatchObject({ group: 'tasks', entity: 'task' });
  });

  it('creates a task-linked workflow form on the existing project task', async () => {
    const created = workflowForm({ formKey: 'task_assignment', formName: 'Task Assignment', workflowGroup: 'tasks', taskId: 'task-1' });
    mockedDb.ProjectTask.findOne.mockResolvedValue({ id: 'task-1', projectId: 'project-1' });
    mockedDb.ProjectWorkflowForm.create.mockResolvedValue(created);

    const result = await new ProjectsService().createWorkflowForm('biz-1', 'user-1', 'project-1', {
      formKey: 'task_assignment',
      taskId: 'task-1',
      data: { summary: 'Assign implementation task' }
    });

    expect(mockedDb.ProjectTask.findOne).toHaveBeenCalledWith({ where: { id: 'task-1', businessId: 'biz-1', projectId: 'project-1' } });
    expect(mockedDb.ProjectWorkflowForm.create).toHaveBeenCalledWith(expect.objectContaining({
      projectId: 'project-1',
      taskId: 'task-1',
      formKey: 'task_assignment',
      workflowGroup: 'tasks'
    }));
    expect(result).toBe(created);
  });

  it('enforces workflow status transitions', async () => {
    const form = workflowForm({ status: 'draft' });
    mockedDb.ProjectWorkflowForm.findOne.mockResolvedValue(form);

    await expect(new ProjectsService().changeWorkflowFormStatus('biz-1', 'user-1', 'project-1', 'form-1', 'approved')).rejects.toThrow('Invalid workflow status transition');
  });
});

function workflowForm(overrides: any = {}) {
  return {
    id: 'form-1',
    projectId: 'project-1',
    taskId: null,
    status: 'draft',
    formKey: 'project_brief',
    formName: 'Project Brief',
    workflowGroup: 'setup',
    metadata: {},
    toJSON: jest.fn().mockReturnValue({ id: 'form-1' }),
    update: jest.fn(function (this: any, data: any) {
      Object.assign(this, data);
      return Promise.resolve(this);
    }),
    ...overrides
  };
}
