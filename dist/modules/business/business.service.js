"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BusinessService = void 0;
const business_dal_1 = require("./business.dal");
const slugify_1 = require("../../utils/slugify");
const template_service_1 = require("../moduleTemplate/template.service");
const models_1 = require("../../models");
const Role_1 = require("../../models/Role");
class BusinessService {
    constructor() {
        this.templateService = new template_service_1.TemplateService();
        this.dal = new business_dal_1.BusinessDAL();
    }
    async create(data) {
        const payload = { ...data };
        if (!payload.slug && payload.name)
            payload.slug = (0, slugify_1.slugify)(payload.name);
        // Ensure slug is unique — check including soft-deleted rows (paranoid: false)
        // because the unique index covers all rows regardless of deletedAt.
        let slug = payload.slug;
        const existing = await models_1.db.Business.findOne({ where: { slug }, paranoid: false });
        if (existing) {
            if (existing.deletedAt) {
                // A previously-deleted business had this slug — append a short timestamp suffix
                slug = `${slug}-${Date.now().toString(36)}`;
                payload.slug = slug;
            }
            else {
                throw new Error(`A business with slug "${slug}" already exists. Please choose a different name or slug.`);
            }
        }
        const business = await this.dal.create(payload);
        // Default business settings (minimal baseline; can be expanded later)
        await models_1.db.BusinessSetting.findOrCreate({
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
            const globalRole = await models_1.db.Role.findOne({ where: { businessId: null, key } });
            const [role] = await models_1.db.Role.findOrCreate({
                where: { businessId: business.id, key },
                defaults: { businessId: business.id, key, name: key.replace(/_/g, " "), description: null, isSystemRole: false, domain: (0, Role_1.roleDomainForKey)(key) }
            });
            if (globalRole) {
                const perms = await globalRole.getPermissions();
                await role.setPermissions(perms);
            }
        }
        if (business.planId) {
            const planModules = await models_1.db.PlanModule.findAll({ where: { planId: business.planId, isEnabled: true } });
            for (const pm of planModules) {
                await models_1.db.BusinessModule.create({
                    businessId: business.id,
                    moduleKey: pm.moduleKey,
                    moduleName: pm.moduleName,
                    status: "active",
                    enabledAt: new Date()
                });
                try {
                    await this.templateService.applyTemplate(business.id, pm.moduleKey, false);
                }
                catch (err) {
                    console.warn(`Failed to auto-apply template for ${pm.moduleKey} on business setup:`, err);
                }
            }
        }
        return business;
    }
    listAll() {
        return this.dal.findAll({}, { order: [["createdAt", "DESC"]] });
    }
    getById(id) {
        return this.dal.findById(id);
    }
    update(id, data) {
        const payload = { ...data };
        if (payload.name && !payload.slug)
            payload.slug = (0, slugify_1.slugify)(payload.name);
        return this.dal.update(id, payload);
    }
    softDelete(id) {
        return this.dal.softDelete(id);
    }
    /**
     * Permanently removes a business and ALL associated data.
     * Deletes in dependency order (children before parents) to avoid FK violations.
     */
    async purge(id) {
        const business = await models_1.db.Business.findByPk(id, { paranoid: false });
        if (!business)
            return false;
        const bId = id;
        const opts = { where: { businessId: bId }, force: true };
        // ── Recruitment / HR ──────────────────────────────────────────────────────
        // InterviewerNote → InterviewSkill → Interview → JobApplication → JobOpening
        const interviews = await models_1.db.Interview.findAll({ where: { businessId: bId }, paranoid: false, attributes: ['id'] });
        const interviewIds = interviews.map((i) => i.id);
        if (interviewIds.length) {
            await models_1.db.InterviewerNote.destroy({ where: { interviewId: interviewIds }, force: true });
            await models_1.db.InterviewSkill.destroy({ where: { interviewId: interviewIds }, force: true });
        }
        await models_1.db.Interview.destroy(opts);
        await models_1.db.JobApplication.destroy(opts);
        await models_1.db.JobOpening.destroy(opts);
        await models_1.db.RecruitmentTemplate.destroy(opts);
        await models_1.db.CandidateOnboarding.destroy(opts);
        await models_1.db.OfferLetter.destroy(opts);
        await models_1.db.OfferLetterTemplate.destroy(opts);
        // ── HR Records ────────────────────────────────────────────────────────────
        await models_1.db.ExitProcess.destroy(opts);
        await models_1.db.DisciplinaryCase.destroy(opts);
        await models_1.db.PerformanceReview.destroy(opts);
        await models_1.db.TrainingRecord.destroy(opts);
        await models_1.db.HRCase.destroy(opts);
        await models_1.db.OnboardingTask.destroy(opts);
        await models_1.db.AttendanceRecord.destroy(opts);
        await models_1.db.LeaveBalance.destroy(opts);
        await models_1.db.EmployeeRecord.destroy(opts);
        // ── OKR ───────────────────────────────────────────────────────────────────
        await models_1.db.OKREvaluation.destroy(opts);
        await models_1.db.OKRProgressUpdate.destroy(opts);
        await models_1.db.KeyResult.destroy(opts);
        await models_1.db.Objective.destroy(opts);
        // ── Projects ──────────────────────────────────────────────────────────────
        await models_1.db.ProjectChangeRequest.destroy(opts);
        await models_1.db.ProjectIssue.destroy(opts);
        await models_1.db.ProjectTask.destroy(opts);
        await models_1.db.ProjectMilestone.destroy(opts);
        await models_1.db.Project.destroy(opts);
        await models_1.db.Proposal.destroy(opts);
        // ── Finance ───────────────────────────────────────────────────────────────
        // InvoiceItem has its own businessId — no subquery needed
        await models_1.db.InvoiceItem.destroy({ where: { businessId: bId }, force: true });
        await models_1.db.Invoice.destroy(opts);
        await models_1.db.Payment.destroy(opts);
        await models_1.db.Expense.destroy(opts);
        await models_1.db.Budget.destroy(opts);
        // ── CRM ───────────────────────────────────────────────────────────────────
        await models_1.db.ClientFeedback.destroy(opts);
        await models_1.db.ClientRequest.destroy(opts);
        await models_1.db.ClientPortalAccess.destroy(opts);
        await models_1.db.ClientPortalUser.destroy(opts);
        await models_1.db.Interaction.destroy(opts);
        await models_1.db.Deal.destroy(opts);
        await models_1.db.Client.destroy(opts);
        await models_1.db.Lead.destroy(opts);
        await models_1.db.Vendor.destroy(opts);
        // ── Knowledge / Training ──────────────────────────────────────────────────
        await models_1.db.KnowledgeRevision.destroy(opts);
        await models_1.db.KnowledgeArticle.destroy(opts);
        await models_1.db.KnowledgeCategory.destroy(opts);
        await models_1.db.TrainingMaterial.destroy(opts);
        // ── Reporting / Analytics ─────────────────────────────────────────────────
        await models_1.db.ReportRun.destroy(opts);
        await models_1.db.ReportDefinition.destroy(opts);
        await models_1.db.MetricSnapshot.destroy(opts);
        // ── Forms / Approvals ─────────────────────────────────────────────────────
        await models_1.db.FormSubmission.destroy(opts);
        await models_1.db.FormField.destroy(opts);
        await models_1.db.FormDefinition.destroy(opts);
        await models_1.db.ApprovalAction.destroy(opts);
        await models_1.db.ApprovalRequest.destroy(opts);
        await models_1.db.ApprovalStep.destroy(opts);
        await models_1.db.ApprovalWorkflow.destroy(opts);
        // ── Files / Attachments ───────────────────────────────────────────────────
        await models_1.db.EntityAttachment.destroy(opts);
        await models_1.db.FileAsset.destroy(opts);
        // ── Notifications / Activity ──────────────────────────────────────────────
        await models_1.db.NotificationPreference.destroy(opts);
        await models_1.db.Notification.destroy(opts);
        await models_1.db.ActivityLog.destroy(opts);
        await models_1.db.AuditLog.destroy(opts);
        // ── UI / Preferences ──────────────────────────────────────────────────────
        await models_1.db.DashboardWidget.destroy(opts);
        await models_1.db.SavedView.destroy(opts);
        await models_1.db.ProfileDraft.destroy(opts);
        await models_1.db.ProfileTemplate.destroy(opts);
        await models_1.db.BusinessUserProfile.destroy(opts);
        // ── Org structure ─────────────────────────────────────────────────────────
        await models_1.db.Position.destroy(opts);
        await models_1.db.Department.destroy(opts);
        // ── Subscriptions ─────────────────────────────────────────────────────────
        await models_1.db.SubscriptionPayment.destroy(opts);
        await models_1.db.SubscriptionInvoice.destroy(opts);
        await models_1.db.Subscription.destroy(opts);
        await models_1.db.UsageLimit.destroy(opts);
        // ── Admin / Support ───────────────────────────────────────────────────────
        await models_1.db.AdminImpersonationSession.destroy(opts);
        await models_1.db.SupportAccessLog.destroy(opts);
        await models_1.db.BackgroundJobLog.destroy(opts);
        // SystemHealthLog is platform-wide, not business-scoped — skip it
        // ── Skills (business-scoped) ──────────────────────────────────────────────
        await models_1.db.Skill.destroy(opts);
        // ── Business settings / branding ──────────────────────────────────────────
        await models_1.db.BusinessSetting.destroy(opts);
        await models_1.db.BusinessBranding.destroy(opts);
        await models_1.db.BusinessLocalization.destroy(opts);
        await models_1.db.BusinessModule.destroy(opts);
        // ── Users & Roles ─────────────────────────────────────────────────────────
        const users = await models_1.db.User.findAll({ where: { businessId: bId }, paranoid: false, attributes: ['id'] });
        const userIds = users.map((u) => u.id);
        if (userIds.length) {
            await models_1.db.UserRole.destroy({ where: { userId: userIds }, force: true });
        }
        await models_1.db.User.destroy({ where: { businessId: bId }, force: true });
        const roles = await models_1.db.Role.findAll({ where: { businessId: bId }, paranoid: false, attributes: ['id'] });
        const roleIds = roles.map((r) => r.id);
        if (roleIds.length) {
            await models_1.db.RolePermission.destroy({ where: { roleId: roleIds }, force: true });
        }
        await models_1.db.Role.destroy({ where: { businessId: bId }, force: true });
        // ── Finally, the business itself ──────────────────────────────────────────
        await models_1.db.Business.destroy({ where: { id: bId }, force: true });
        return true;
    }
}
exports.BusinessService = BusinessService;
