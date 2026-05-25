
import { db } from '../../models';
import { InternalNotifier } from '../notification/notification.service';

export class ProjectsService {
  
  async provisionForms(businessId: string) {
     const templates = [
        { key: 'project_brief', title: 'Project Brief Form' },
        { key: 'project_kickoff', title: 'Project Kick-off Form' },
        { key: 'milestone_setup', title: 'Milestone Setup Form' },
        { key: 'task_assignment', title: 'Task Assignment Form' },
        { key: 'internal_deliverable_approval', title: 'Internal Deliverable Approval Form' },
        { key: 'client_deliverable_approval', title: 'Client Deliverable Approval Form' },
        { key: 'change_request', title: 'Change Request Form' },
        { key: 'issue_bug_report', title: 'Issue / Bug Report Form' },
        { key: 'risk_log', title: 'Risk Log Form' },
        { key: 'completion_record', title: 'Completion Record Form' },
        { key: 'client_approval', title: 'Client Approval Form' },
        { key: 'final_project_closure', title: 'Final Project Closure Form' },
        { key: 'lessons_learned', title: 'Lessons Learned Form' }
     ];
     for (const t of templates) {
        const existing = await db.FormDefinition.findOne({ where: { businessId, key: t.key } });
        if (!existing) {
           await db.FormDefinition.create({
              businessId, name: t.title, key: t.key, visibility: 'internal',
              version: 1, schema: { type: 'object', properties: {} }
           });
        }
     }
  }

  async createProject(businessId: string, data: any) {
    return db.Project.create({ ...data, businessId });
  }

  async createProjectFromDeal(businessId: string, dealId: string, projectManagerUserId: string) {
    const d = await db.Deal.findOne({ where: { id: dealId, businessId, status: 'won' } });
    if(!d) throw new Error("Won Deal not found");
    
    return db.Project.create({
      businessId,
      dealId: d.id,
      clientId: d.clientId,
      projectManagerUserId,
      title: d.title,
      currency: d.currency,
      budget: d.value,
      status: 'planning',
      metadata: { source: 'deal_conversion', originalDealId: dealId }
    });
  }

  async getProjects(businessId: string, userId: string, bypass: boolean, page: number, size: number) {
    const where: any = { businessId };
    if (!bypass) {
       // Deep restrictions based on explicit roles can be added, currently bypass is used at controller level 
       // For simple assignments:
       where.projectManagerUserId = userId; 
    }
    return db.Project.findAndCountAll({ where, offset: (page-1)*size, limit: size });
  }

  async createMilestone(businessId: string, data: any) {
    return db.ProjectMilestone.create({ ...data, businessId });
  }

  async updateMilestone(businessId: string, id: string, data: any) {
    const m = await db.ProjectMilestone.findOne({ where: { id, businessId } });
    if(!m) throw new Error("Milestone not found");
    return m.update(data);
  }

  async listMilestones(businessId: string, projectId: string) {
    return db.ProjectMilestone.findAll({ where: { businessId, projectId } });
  }

  async createTask(businessId: string, data: any) {
    const t = await db.ProjectTask.create({ ...data, businessId });
    if (t.assignedToUserId) await this.notify(businessId, t.assignedToUserId, 'Task Assigned', 'You have been assigned a new project task.', 'project_task', t.id);
    return t;
  }

  async assignTask(businessId: string, id: string, assignedToUserId: string) {
    const t = await db.ProjectTask.findOne({ where: { id, businessId } });
    if(!t) throw new Error("Task not found");
    await t.update({ assignedToUserId });
    await this.notify(businessId, assignedToUserId, 'Task Assigned', 'You have been explicitly assigned to a project task.', 'project_task', id);
    return t;
  }

  async updateTaskStatus(businessId: string, id: string, status: string) {
    const t = await db.ProjectTask.findOne({ where: { id, businessId } });
    if(!t) throw new Error("Task not found");
    await t.update({ status });
    return t;
  }

  async listTasks(businessId: string, projectId: string) {
    return db.ProjectTask.findAndCountAll({ where: { businessId, projectId } });
  }

  async createIssue(businessId: string, data: any) {
    const i = await db.ProjectIssue.create({ ...data, businessId });
    if (i.assignedToUserId) await this.notify(businessId, i.assignedToUserId, 'Issue Assigned', 'You have an active issue assignment.', 'project_issue', i.id);
    return i;
  }

  async listIssues(businessId: string, projectId: string) {
    return db.ProjectIssue.findAndCountAll({ where: { businessId, projectId } });
  }

  async createChangeRequest(businessId: string, data: any) {
    return db.ProjectChangeRequest.create({ ...data, businessId });
  }

  async listChangeRequests(businessId: string, projectId: string) {
    return db.ProjectChangeRequest.findAndCountAll({ where: { businessId, projectId } });
  }

  async getProjectProgress(businessId: string, projectId: string) {
    // Calculates abstract completion percentage based on mapped tasks 
    const tasks = await db.ProjectTask.findAll({ where: { businessId, projectId } });
    if (tasks.length === 0) return { totalTasks: 0, completedTasks: 0, progressPercent: 0 };
    
    const completed = tasks.filter((t: any) => t.status === 'done').length;
    const progressPercent = Math.round((completed / tasks.length) * 100);
    return { totalTasks: tasks.length, completedTasks: completed, progressPercent };
  }

  private async notify(businessId: string, recipientUserId: string, title: string, message: string, entityType: string, entityId: string) {
    try {
      await InternalNotifier.send({ businessId, recipientUserId, moduleKey: 'projects', type: 'assignment', title, message, entityType, entityId });
    } catch(e) {}
  }
}
