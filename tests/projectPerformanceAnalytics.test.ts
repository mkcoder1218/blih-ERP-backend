import { HRPerformanceService } from '../src/modules/hr/performance.service';
import { db } from '../src/models';

jest.mock('../src/models', () => ({
  db: {
    EmployeeRecord: { findOne: jest.fn(), findAll: jest.fn() },
    ProjectTask: { findAll: jest.fn() },
    ProjectActivityLog: { findAll: jest.fn() },
    PerformanceReview: { findOne: jest.fn() },
    User: {},
    Department: {},
    Project: {}
  }
}));

const mockedDb = db as any;

describe('Project performance analytics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date('2026-06-05T12:00:00Z'));
    mockedDb.EmployeeRecord.findOne.mockResolvedValue({
      id: 'emp-1',
      userId: 'user-1',
      employeeCode: 'EMP-1',
      user: { id: 'user-1', fullName: 'Ada Lovelace', email: 'ada@example.com' },
      department: { id: 'dept-1', name: 'Engineering' }
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('uses task weight for completion and on-time evidence instead of simple task count', async () => {
    mockedDb.ProjectTask.findAll.mockResolvedValue([
      task({ id: 'small', status: 'DONE', weight: 1, dueDate: '2026-06-01', updatedAt: '2026-06-01T10:00:00Z' }),
      task({ id: 'large', status: 'TODO', weight: 4, dueDate: '2026-06-10' })
    ]);
    mockedDb.ProjectActivityLog.findAll.mockResolvedValue([]);

    const result = await new HRPerformanceService().getEmployeeEvaluationEvidence('biz-1', 'user-1', {});

    expect(result.projectMetrics.summary.assignedTasks).toBe(2);
    expect(result.projectMetrics.summary.assignedWeight).toBe(5);
    expect(result.projectMetrics.summary.completedWeight).toBe(1);
    expect(result.projectMetrics.summary.weightedCompletionRate).toBe(20);
    expect(result.projectMetrics.summary.onTimeCompletionRate).toBe(100);
  });

  it('excludes approved dependency/client/resource/management blockers from late penalties', async () => {
    mockedDb.ProjectTask.findAll.mockResolvedValue([
      task({
        id: 'blocked',
        status: 'BLOCKED',
        dueDate: '2026-06-01',
        metadata: { blocker: { type: 'dependency', approved: true } }
      })
    ]);
    mockedDb.ProjectActivityLog.findAll.mockResolvedValue([]);

    const result = await new HRPerformanceService().getEmployeeEvaluationEvidence('biz-1', 'user-1', {});

    expect(result.projectMetrics.summary.blockedTasks).toBe(1);
    expect(result.projectMetrics.summary.overdueTasks).toBe(0);
    expect(result.projectMetrics.summary.latePenaltyExcludedTasks).toBe(1);
    expect(result.projectMetrics.tasks[0].excludedLatePenalty).toBe(true);
  });

  it('counts reopened tasks from project activity logs', async () => {
    mockedDb.ProjectTask.findAll.mockResolvedValue([
      task({ id: 'reopened', status: 'IN_PROGRESS', weight: 3 })
    ]);
    mockedDb.ProjectActivityLog.findAll.mockResolvedValue([
      { taskId: 'reopened', before: { status: 'DONE' }, after: { status: 'IN_PROGRESS' } }
    ]);

    const result = await new HRPerformanceService().getEmployeeEvaluationEvidence('biz-1', 'user-1', {});

    expect(result.projectMetrics.summary.reopenedTasks).toBe(1);
    expect(result.projectMetrics.summary.reopenedWeight).toBe(3);
    expect(result.projectMetrics.tasks[0].reopened).toBe(true);
  });
});

function task(overrides: any) {
  return {
    id: 'task-1',
    code: 'TASK-1',
    title: 'Task',
    status: 'TODO',
    weight: 1,
    dueDate: null,
    updatedAt: '2026-06-05T10:00:00Z',
    metadata: {},
    Project: { id: 'project-1', code: 'PRJ-1', title: 'Project' },
    ...overrides
  };
}
