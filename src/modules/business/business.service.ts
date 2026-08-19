import { BusinessDAL } from "./business.dal";
import { slugify } from "../../utils/slugify";
import { TemplateService } from "../moduleTemplate/template.service";
import { db } from "../../models";
import { roleDomainForKey } from "../../models/Role";
import { seedEthiopianLeaveTemplatesForBusiness } from "../leave/seed/ethiopianLeaveTemplates.seed";

export class BusinessService {
  private templateService = new TemplateService();
  private dal: BusinessDAL;

  constructor() {
    this.dal = new BusinessDAL();
  }

  async create(data: any) {
    const payload: any = { ...data };
    if (!payload.slug && payload.name) payload.slug = slugify(payload.name);

    // Ensure slug is unique — check including soft-deleted rows (paranoid: false)
    // because the unique index covers all rows regardless of deletedAt.
    let slug = payload.slug;
    const existing = await db.Business.findOne({ where: { slug }, paranoid: false });
    if (existing) {
      if (existing.deletedAt) {
        // A previously-deleted business had this slug — append a short timestamp suffix
        slug = `${slug}-${Date.now().toString(36)}`;
        payload.slug = slug;
      } else {
        throw new Error(`A business with slug "${slug}" already exists. Please choose a different name or slug.`);
      }
    }

    const business = await this.dal.create(payload);

    // Default business settings (minimal baseline; can be expanded later)
    await db.BusinessSetting.findOrCreate({
      where: { businessId: business.id },
      defaults: { businessId: business.id, key: "general", value: { locale: "en", timezone: "UTC" } }
    });

    // Create default roles scoped to this business, copying permissions from global system roles (businessId = null).
    const roleKeys = [
      "BUSINESS_ADMIN",
      "HR_MANAGER",
      "FINANCE_MANAGER",
      "CRM_MANAGER",
      "PROJECT_MANAGER",
      "DEPARTMENT_HEAD",
      "EMPLOYEE",
      "CLIENT"
    ];

    for (const key of roleKeys) {
      const globalRole = await db.Role.findOne({ where: { businessId: null, key } });
      const [role] = await db.Role.findOrCreate({
        where: { businessId: business.id, key },
        defaults: { businessId: business.id, key, name: key.replace(/_/g, " "), description: null, isSystemRole: false, domain: roleDomainForKey(key) }
      });
      if (globalRole) {
        const perms = await globalRole.getPermissions();
        await role.setPermissions(perms);
      }
    }

    if (business.planId) {
      const planModules = await db.PlanModule.findAll({ where: { planId: business.planId, isEnabled: true } });
      for (const pm of planModules) {
        await db.BusinessModule.create({
          businessId: business.id,
          moduleKey: pm.moduleKey,
          moduleName: pm.moduleName,
          status: "active",
          enabledAt: new Date()
        });

        try {
          await this.templateService.applyTemplate(business.id, pm.moduleKey, false);
        } catch(err) {
          console.warn(`Failed to auto-apply template for ${pm.moduleKey} on business setup:`, err);
        }
      }
    }

    await seedEthiopianLeaveTemplatesForBusiness(business.id);

    return business;
  }

  listAll() {
    return this.dal.findAll({}, { order: [["createdAt", "DESC"]] });
  }

  getById(id: string) {
    return this.dal.findById(id);
  }

  update(id: string, data: any) {
    const payload = { ...data };
    if (payload.name && !payload.slug) payload.slug = slugify(payload.name);
    return this.dal.update(id, payload);
  }

  softDelete(id: string) {
    return this.dal.softDelete(id);
  }

  /**
   * Permanently removes a business and ALL associated data.
   * Deletes in dependency order (children before parents) to avoid FK violations.
   */
  async purge(id: string): Promise<boolean> {
    const business = await db.Business.findByPk(id, { paranoid: false });
    if (!business) return false;

    const bId = id;
    const opts = { where: { businessId: bId }, force: true };

    // ── Recruitment / HR ──────────────────────────────────────────────────────
    // InterviewerNote → InterviewSkill → Interview → JobApplication → JobOpening
    const interviews = await db.Interview.findAll({ where: { businessId: bId }, paranoid: false, attributes: ['id'] });
    const interviewIds = interviews.map((i: any) => i.id);
    if (interviewIds.length) {
      await db.InterviewerNote.destroy({ where: { interviewId: interviewIds }, force: true });
      await db.InterviewSkill.destroy({ where: { interviewId: interviewIds }, force: true });
    }
    await db.Interview.destroy(opts);
    await db.JobApplication.destroy(opts);
    await db.JobOpening.destroy(opts);
    await db.RecruitmentTemplate.destroy(opts);
    await db.CandidateOnboarding.destroy(opts);
    await db.OfferLetter.destroy(opts);
    await db.OfferLetterTemplate.destroy(opts);

    // ── HR Records ────────────────────────────────────────────────────────────
    await db.ExitProcess.destroy(opts);
    await db.DisciplinaryCase.destroy(opts);
    await db.PerformanceReview.destroy(opts);
    await db.TrainingRecord.destroy(opts);
    await db.HRCase.destroy(opts);
    await db.OnboardingTask.destroy(opts);
    await db.AttendanceRecord.destroy(opts);
    await db.LeaveBalance.destroy(opts);
    await db.EmployeeRecord.destroy(opts);

    // ── OKR ───────────────────────────────────────────────────────────────────
    await db.OKREvaluation.destroy(opts);
    await db.OKRProgressUpdate.destroy(opts);
    await db.KeyResult.destroy(opts);
    await db.Objective.destroy(opts);

    // ── Projects ──────────────────────────────────────────────────────────────
    await db.ProjectChangeRequest.destroy(opts);
    await db.ProjectIssue.destroy(opts);
    await db.ProjectTask.destroy(opts);
    await db.ProjectMilestone.destroy(opts);
    await db.Project.destroy(opts);
    await db.Proposal.destroy(opts);

    // ── Finance ───────────────────────────────────────────────────────────────
    // InvoiceItem has its own businessId — no subquery needed
    await db.InvoiceItem.destroy({ where: { businessId: bId }, force: true });
    await db.Invoice.destroy(opts);
    await db.Payment.destroy(opts);
    await db.Expense.destroy(opts);
    await db.Budget.destroy(opts);

    // ── CRM ───────────────────────────────────────────────────────────────────
    await db.ClientFeedback.destroy(opts);
    await db.ClientRequest.destroy(opts);
    await db.ClientPortalAccess.destroy(opts);
    await db.ClientPortalUser.destroy(opts);
    await db.Interaction.destroy(opts);
    await db.Deal.destroy(opts);
    await db.Client.destroy(opts);
    await db.Lead.destroy(opts);
    await db.Vendor.destroy(opts);

    // ── Knowledge / Training ──────────────────────────────────────────────────
    await db.KnowledgeRevision.destroy(opts);
    await db.KnowledgeArticle.destroy(opts);
    await db.KnowledgeCategory.destroy(opts);
    await db.TrainingMaterial.destroy(opts);

    // ── Reporting / Analytics ─────────────────────────────────────────────────
    await db.ReportRun.destroy(opts);
    await db.ReportDefinition.destroy(opts);
    await db.MetricSnapshot.destroy(opts);

    // ── Forms / Approvals ─────────────────────────────────────────────────────
    await db.FormSubmission.destroy(opts);
    await db.FormField.destroy(opts);
    await db.FormDefinition.destroy(opts);
    await db.ApprovalAction.destroy(opts);
    await db.ApprovalRequest.destroy(opts);
    await db.ApprovalStep.destroy(opts);
    await db.ApprovalWorkflow.destroy(opts);

    // ── Files / Attachments ───────────────────────────────────────────────────
    await db.EntityAttachment.destroy(opts);
    await db.FileAsset.destroy(opts);

    // ── Notifications / Activity ──────────────────────────────────────────────
    await db.NotificationPreference.destroy(opts);
    await db.Notification.destroy(opts);
    await db.ActivityLog.destroy(opts);
    await db.AuditLog.destroy(opts);

    // ── UI / Preferences ──────────────────────────────────────────────────────
    await db.DashboardWidget.destroy(opts);
    await db.SavedView.destroy(opts);
    await db.ProfileDraft.destroy(opts);
    await db.ProfileTemplate.destroy(opts);
    await db.BusinessUserProfile.destroy(opts);

    // ── Org structure ─────────────────────────────────────────────────────────
    await db.Position.destroy(opts);
    await db.Department.destroy(opts);

    // ── Subscriptions ─────────────────────────────────────────────────────────
    await db.SubscriptionPayment.destroy(opts);
    await db.SubscriptionInvoice.destroy(opts);
    await db.Subscription.destroy(opts);
    await db.UsageLimit.destroy(opts);

    // ── Admin / Support ───────────────────────────────────────────────────────
    await db.AdminImpersonationSession.destroy(opts);
    await db.SupportAccessLog.destroy(opts);
    await db.BackgroundJobLog.destroy(opts);
    // SystemHealthLog is platform-wide, not business-scoped — skip it

    // ── Skills (business-scoped) ──────────────────────────────────────────────
    await db.Skill.destroy(opts);

    // ── Business settings / branding ──────────────────────────────────────────
    await db.BusinessSetting.destroy(opts);
    await db.BusinessBranding.destroy(opts);
    await db.BusinessLocalization.destroy(opts);
    await db.BusinessModule.destroy(opts);

    // ── Users & Roles ─────────────────────────────────────────────────────────
    const users = await db.User.findAll({ where: { businessId: bId }, paranoid: false, attributes: ['id'] });
    const userIds = users.map((u: any) => u.id);
    if (userIds.length) {
      await db.UserRole.destroy({ where: { userId: userIds }, force: true });
    }
    await db.User.destroy({ where: { businessId: bId }, force: true });

    const roles = await db.Role.findAll({ where: { businessId: bId }, paranoid: false, attributes: ['id'] });
    const roleIds = roles.map((r: any) => r.id);
    if (roleIds.length) {
      await db.RolePermission.destroy({ where: { roleId: roleIds }, force: true });
    }
    await db.Role.destroy({ where: { businessId: bId }, force: true });

    // ── Finally, the business itself ──────────────────────────────────────────
    await db.Business.destroy({ where: { id: bId }, force: true });

    return true;
  }
}
