"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = (sequelize, dataTypes) => {
    const Business = sequelize.define("Business", {
        id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
        name: { type: dataTypes.STRING(200), allowNull: false },
        slug: { type: dataTypes.STRING(120), allowNull: false, unique: true },
        email: { type: dataTypes.STRING(320), allowNull: true },
        phone: { type: dataTypes.STRING(50), allowNull: true },
        status: { type: dataTypes.STRING(50), allowNull: false, defaultValue: "active" },
        planId: { type: dataTypes.UUID, allowNull: true },
        sectorFocusId: { type: dataTypes.UUID, allowNull: true },
        settings: { type: dataTypes.JSONB, allowNull: false, defaultValue: {} }
    }, {
        tableName: "businesses",
        timestamps: true,
        paranoid: true
    });
    Business.associate = (models) => {
        models.Business.hasMany(models.User, { foreignKey: "businessId" });
        models.Business.hasMany(models.Role, { foreignKey: "businessId" });
        models.Business.belongsTo(models.Plan, { foreignKey: "planId" });
        models.Business.belongsTo(models.SectorFocus, { foreignKey: "sectorFocusId" });
        models.Business.hasMany(models.BusinessModule, { foreignKey: "businessId", as: "modules" });
        models.Business.hasMany(models.AuditLog, { foreignKey: "businessId" });
        models.Business.hasMany(models.Department, { foreignKey: "businessId" });
        models.Business.hasMany(models.Position, { foreignKey: "businessId" });
        models.Business.hasMany(models.BusinessUserProfile, { foreignKey: "businessId" });
        models.Business.hasMany(models.ApprovalWorkflow, { foreignKey: "businessId" });
        models.Business.hasMany(models.ApprovalRequest, { foreignKey: "businessId" });
        models.Business.hasMany(models.ApprovalAction, { foreignKey: "businessId" });
        models.Business.hasMany(models.FormDefinition, { foreignKey: "businessId" });
        models.Business.hasMany(models.FormField, { foreignKey: "businessId" });
        models.Business.hasMany(models.FormSubmission, { foreignKey: "businessId" });
        models.Business.hasMany(models.FileAsset, { foreignKey: "businessId" });
        models.Business.hasMany(models.EntityAttachment, { foreignKey: "businessId" });
        models.Business.hasMany(models.Notification, { foreignKey: "businessId" });
        models.Business.hasMany(models.NotificationPreference, { foreignKey: "businessId" });
        models.Business.hasMany(models.ActivityLog, { foreignKey: "businessId" });
        models.Business.hasMany(models.DashboardWidget, { foreignKey: "businessId" });
        models.Business.hasMany(models.SavedView, { foreignKey: "businessId" });
        models.Business.hasMany(models.EmployeeRecord, { foreignKey: "businessId" });
        models.Business.hasMany(models.LeaveBalance, { foreignKey: "businessId" });
        models.Business.hasMany(models.AttendanceRecord, { foreignKey: "businessId" });
        models.Business.hasMany(models.Lead, { foreignKey: "businessId" });
        models.Business.hasMany(models.Client, { foreignKey: "businessId" });
        models.Business.hasMany(models.Deal, { foreignKey: "businessId" });
        models.Business.hasMany(models.Interaction, { foreignKey: "businessId" });
        models.Business.hasMany(models.Project, { foreignKey: "businessId" });
        models.Business.hasMany(models.ProjectMilestone, { foreignKey: "businessId" });
        models.Business.hasMany(models.ProjectTask, { foreignKey: "businessId" });
        models.Business.hasMany(models.ProjectIssue, { foreignKey: "businessId" });
        models.Business.hasMany(models.Invoice, { foreignKey: "businessId" });
        models.Business.hasMany(models.InvoiceItem, { foreignKey: "businessId" });
        models.Business.hasMany(models.Payment, { foreignKey: "businessId" });
        models.Business.hasMany(models.Expense, { foreignKey: "businessId" });
        models.Business.hasMany(models.Budget, { foreignKey: "businessId" });
        models.Business.hasMany(models.KnowledgeCategory, { foreignKey: "businessId" });
        models.Business.hasMany(models.KnowledgeArticle, { foreignKey: "businessId" });
        models.Business.hasMany(models.KnowledgeRevision, { foreignKey: "businessId" });
        models.Business.hasMany(models.TrainingMaterial, { foreignKey: "businessId" });
        models.Business.hasMany(models.Objective, { foreignKey: "businessId" });
        models.Business.hasMany(models.KeyResult, { foreignKey: "businessId" });
        models.Business.hasMany(models.OKRProgressUpdate, { foreignKey: "businessId" });
        models.Business.hasMany(models.OKREvaluation, { foreignKey: "businessId" });
        models.Business.hasMany(models.ClientPortalUser, { foreignKey: "businessId" });
        models.Business.hasMany(models.ClientPortalAccess, { foreignKey: "businessId" });
        models.Business.hasMany(models.ClientRequest, { foreignKey: "businessId" });
        models.Business.hasMany(models.ClientFeedback, { foreignKey: "businessId" });
        models.Business.hasMany(models.ReportDefinition, { foreignKey: "businessId" });
        models.Business.hasMany(models.ReportRun, { foreignKey: "businessId" });
        models.Business.hasMany(models.MetricSnapshot, { foreignKey: "businessId" });
        models.Business.hasMany(models.BusinessSetting, { foreignKey: "businessId" });
        models.Business.hasOne(models.BusinessBranding, { foreignKey: "businessId" });
        models.Business.hasOne(models.BusinessLocalization, { foreignKey: "businessId" });
        models.Business.hasOne(models.Subscription, { foreignKey: "businessId" });
        models.Business.hasMany(models.SubscriptionInvoice, { foreignKey: "businessId" });
        models.Business.hasMany(models.SubscriptionPayment, { foreignKey: "businessId" });
        models.Business.hasMany(models.UsageLimit, { foreignKey: "businessId" });
        models.Business.hasMany(models.SupportAccessLog, { foreignKey: "businessId" });
        models.Business.hasMany(models.AdminImpersonationSession, { foreignKey: "businessId" });
        models.Business.hasMany(models.BackgroundJobLog, { foreignKey: "businessId" });
        models.Business.hasMany(models.EmployeeRecord, { foreignKey: "businessId" });
        models.Business.hasMany(models.LeaveBalance, { foreignKey: "businessId" });
        models.Business.hasMany(models.AttendanceRecord, { foreignKey: "businessId" });
        models.Business.hasMany(models.HRCase, { foreignKey: "businessId" });
        models.Business.hasMany(models.JobOpening, { foreignKey: "businessId" });
        models.Business.hasMany(models.JobApplication, { foreignKey: "businessId" });
        models.Business.hasMany(models.Interview, { foreignKey: "businessId" });
        models.Business.hasMany(models.OnboardingTask, { foreignKey: "businessId" });
        models.Business.hasMany(models.PerformanceReview, { foreignKey: "businessId" });
        models.Business.hasMany(models.TrainingRecord, { foreignKey: "businessId" });
        models.Business.hasMany(models.DisciplinaryCase, { foreignKey: "businessId" });
        models.Business.hasMany(models.ExitProcess, { foreignKey: "businessId" });
        models.Business.hasMany(models.Proposal, { foreignKey: "businessId" });
        models.Business.hasMany(models.Project, { foreignKey: "businessId" });
        models.Business.hasMany(models.ProjectMilestone, { foreignKey: "businessId" });
        models.Business.hasMany(models.ProjectTask, { foreignKey: "businessId" });
        models.Business.hasMany(models.ProjectIssue, { foreignKey: "businessId" });
        models.Business.hasMany(models.ProjectChangeRequest, { foreignKey: "businessId" });
        models.Business.hasMany(models.Vendor, { foreignKey: "businessId" });
        models.Business.hasOne(models.BusinessAttendanceSettings, { foreignKey: "businessId", as: "attendanceSettings" });
    };
    return Business;
};
