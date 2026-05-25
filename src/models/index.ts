import { DataTypes } from "sequelize";
import { sequelize } from "../database/sequelize";

import defineBusiness from "./Business";
import defineUser from "./User";
import defineRole from "./Role";
import definePermission from "./Permission";
import defineRolePermission from "./RolePermission";
import defineUserRole from "./UserRole";
import definePlan from "./Plan";
import definePlanModule from "./PlanModule";
import defineBusinessModule from "./BusinessModule";
import defineSectorFocus from "./SectorFocus";
import defineAuditLog from "./AuditLog";
import defineDepartment from "./Department";
import definePosition from "./Position";
import defineBusinessUserProfile from "./BusinessUserProfile";
import defineApprovalWorkflow from "./ApprovalWorkflow";
import defineApprovalStep from "./ApprovalStep";
import defineApprovalRequest from "./ApprovalRequest";
import defineApprovalAction from "./ApprovalAction";
import defineFormDefinition from "./FormDefinition";
import defineFormField from "./FormField";
import defineFormSubmission from "./FormSubmission";
import defineFileAsset from "./FileAsset";
import defineEntityAttachment from "./EntityAttachment";
import defineNotification from "./Notification";
import defineNotificationPreference from "./NotificationPreference";
import defineActivityLog from "./ActivityLog";
import defineDashboardWidget from "./DashboardWidget";
import defineSavedView from "./SavedView";
import defineModuleTemplate from "./ModuleTemplate";
import defineModuleTemplateForm from "./ModuleTemplateForm";
import defineModuleTemplateWorkflow from "./ModuleTemplateWorkflow";
import defineEmployeeRecord from "./EmployeeRecord";
import defineLeaveBalance from "./LeaveBalance";
import defineAttendanceRecord from "./AttendanceRecord";
import defineLead from "./Lead";
import defineClient from "./Client";
import defineDeal from "./Deal";
import defineInteraction from "./Interaction";
import defineProject from "./Project";
import defineProjectMilestone from "./ProjectMilestone";
import defineProjectTask from "./ProjectTask";
import defineProjectIssue from "./ProjectIssue";
import defineInvoice from "./Invoice";
import defineInvoiceItem from "./InvoiceItem";
import definePayment from "./Payment";
import defineExpense from "./Expense";
import defineBudget from "./Budget";
import defineKnowledgeCategory from "./KnowledgeCategory";
import defineKnowledgeArticle from "./KnowledgeArticle";
import defineKnowledgeRevision from "./KnowledgeRevision";
import defineTrainingMaterial from "./TrainingMaterial";
import defineObjective from "./Objective";
import defineKeyResult from "./KeyResult";
import defineOKRProgressUpdate from "./OKRProgressUpdate";
import defineOKREvaluation from "./OKREvaluation";
import defineClientPortalUser from "./ClientPortalUser";
import defineClientPortalAccess from "./ClientPortalAccess";
import defineClientRequest from "./ClientRequest";
import defineClientFeedback from "./ClientFeedback";
import defineReportDefinition from "./ReportDefinition";
import defineReportRun from "./ReportRun";
import defineMetricSnapshot from "./MetricSnapshot";
import defineBusinessSetting from "./BusinessSetting";
import defineBusinessBranding from "./BusinessBranding";
import defineBusinessLocalization from "./BusinessLocalization";
import defineSubscription from "./Subscription";
import defineSubscriptionInvoice from "./SubscriptionInvoice";
import defineSubscriptionPayment from "./SubscriptionPayment";
import defineUsageLimit from "./UsageLimit";
import defineSupportAccessLog from "./SupportAccessLog";
import defineAdminImpersonationSession from "./AdminImpersonationSession";
import defineSystemHealthLog from "./SystemHealthLog";
import defineBackgroundJobLog from "./BackgroundJobLog";
import defineHRCase from "./HRCase";
import defineJobOpening from "./JobOpening";
import defineJobApplication from "./JobApplication";
import defineInterview from "./Interview";
import defineOnboardingTask from "./OnboardingTask";
import definePerformanceReview from "./PerformanceReview";
import defineTrainingRecord from "./TrainingRecord";
import defineDisciplinaryCase from "./DisciplinaryCase";
import defineExitProcess from "./ExitProcess";
import defineProposal from "./Proposal";
import defineProjectChangeRequest from "./ProjectChangeRequest";
import defineVendor from "./Vendor";

export type DB = {
  sequelize: typeof sequelize;
  Business: any;
  User: any;
  Role: any;
  Permission: any;
  RolePermission: any;
  UserRole: any;
  Plan: any;
  PlanModule: any;
  SectorFocus: any;
  BusinessModule: any;
  AuditLog: any;
  Department: any;
  Position: any;
  BusinessUserProfile: any;
  ApprovalWorkflow: any;
  ApprovalStep: any;
  ApprovalRequest: any;
  ApprovalAction: any;
  FormDefinition: any;
  FormField: any;
  FormSubmission: any;
  FileAsset: any;
  EntityAttachment: any;
  Notification: any;
  NotificationPreference: any;
  ActivityLog: any;
  DashboardWidget: any;
  SavedView: any;
  ModuleTemplate: any;
  ModuleTemplateForm: any;
  ModuleTemplateWorkflow: any;
  EmployeeRecord: any;
  LeaveBalance: any;
  AttendanceRecord: any;
  Lead: any;
  Client: any;
  Deal: any;
  Interaction: any;
  Project: any;
  ProjectMilestone: any;
  ProjectTask: any;
  ProjectIssue: any;
  Invoice: any;
  InvoiceItem: any;
  Payment: any;
  Expense: any;
  Budget: any;
  KnowledgeCategory: any;
  KnowledgeArticle: any;
  KnowledgeRevision: any;
  TrainingMaterial: any;
  Objective: any;
  KeyResult: any;
  OKRProgressUpdate: any;
  OKREvaluation: any;
  ClientPortalUser: any;
  ClientPortalAccess: any;
  ClientRequest: any;
  ClientFeedback: any;
  ReportDefinition: any;
  ReportRun: any;
  MetricSnapshot: any;
  BusinessSetting: any;
  BusinessBranding: any;
  BusinessLocalization: any;
  Subscription: any;
  SubscriptionInvoice: any;
  SubscriptionPayment: any;
  UsageLimit: any;
  SupportAccessLog: any;
  AdminImpersonationSession: any;
  SystemHealthLog: any;
  BackgroundJobLog: any;
  HRCase: any;
  JobOpening: any;
  JobApplication: any;
  Interview: any;
  OnboardingTask: any;
  PerformanceReview: any;
  TrainingRecord: any;
  DisciplinaryCase: any;
  ExitProcess: any;
  Proposal: any;
  ProjectChangeRequest: any;
  Vendor: any;
};

export const db: DB = {
  sequelize,
  Business: defineBusiness(sequelize, DataTypes),
  User: defineUser(sequelize, DataTypes),
  Role: defineRole(sequelize, DataTypes),
  Permission: definePermission(sequelize, DataTypes),
  RolePermission: defineRolePermission(sequelize, DataTypes),
  UserRole: defineUserRole(sequelize, DataTypes),
  Plan: definePlan(sequelize, DataTypes),
  PlanModule: definePlanModule(sequelize, DataTypes),
  SectorFocus: defineSectorFocus(sequelize, DataTypes),
  BusinessModule: defineBusinessModule(sequelize, DataTypes),
  AuditLog: defineAuditLog(sequelize, DataTypes),
  Department: defineDepartment(sequelize, DataTypes),
  Position: definePosition(sequelize, DataTypes),
  BusinessUserProfile: defineBusinessUserProfile(sequelize, DataTypes),
  ApprovalWorkflow: defineApprovalWorkflow(sequelize, DataTypes),
  ApprovalStep: defineApprovalStep(sequelize, DataTypes),
  ApprovalRequest: defineApprovalRequest(sequelize, DataTypes),
  ApprovalAction: defineApprovalAction(sequelize, DataTypes),
  FormDefinition: defineFormDefinition(sequelize, DataTypes),
  FormField: defineFormField(sequelize, DataTypes),
  FormSubmission: defineFormSubmission(sequelize, DataTypes),
  FileAsset: defineFileAsset(sequelize, DataTypes),
  EntityAttachment: defineEntityAttachment(sequelize, DataTypes),
  Notification: defineNotification(sequelize, DataTypes),
  NotificationPreference: defineNotificationPreference(sequelize, DataTypes),
  ActivityLog: defineActivityLog(sequelize, DataTypes),
  DashboardWidget: defineDashboardWidget(sequelize, DataTypes),
  SavedView: defineSavedView(sequelize, DataTypes),
  ModuleTemplate: defineModuleTemplate(sequelize, DataTypes),
  ModuleTemplateForm: defineModuleTemplateForm(sequelize, DataTypes),
  ModuleTemplateWorkflow: defineModuleTemplateWorkflow(sequelize, DataTypes),
  EmployeeRecord: defineEmployeeRecord(sequelize, DataTypes),
  LeaveBalance: defineLeaveBalance(sequelize, DataTypes),
  AttendanceRecord: defineAttendanceRecord(sequelize, DataTypes),
  Lead: defineLead(sequelize, DataTypes),
  Client: defineClient(sequelize, DataTypes),
  Deal: defineDeal(sequelize, DataTypes),
  Interaction: defineInteraction(sequelize, DataTypes),
  Project: defineProject(sequelize, DataTypes),
  ProjectMilestone: defineProjectMilestone(sequelize, DataTypes),
  ProjectTask: defineProjectTask(sequelize, DataTypes),
  ProjectIssue: defineProjectIssue(sequelize, DataTypes),
  Invoice: defineInvoice(sequelize, DataTypes),
  InvoiceItem: defineInvoiceItem(sequelize, DataTypes),
  Payment: definePayment(sequelize, DataTypes),
  Expense: defineExpense(sequelize, DataTypes),
  Budget: defineBudget(sequelize, DataTypes),
  KnowledgeCategory: defineKnowledgeCategory(sequelize, DataTypes),
  KnowledgeArticle: defineKnowledgeArticle(sequelize, DataTypes),
  KnowledgeRevision: defineKnowledgeRevision(sequelize, DataTypes),
  TrainingMaterial: defineTrainingMaterial(sequelize, DataTypes),
  Objective: defineObjective(sequelize, DataTypes),
  KeyResult: defineKeyResult(sequelize, DataTypes),
  OKRProgressUpdate: defineOKRProgressUpdate(sequelize, DataTypes),
  OKREvaluation: defineOKREvaluation(sequelize, DataTypes),
  ClientPortalUser: defineClientPortalUser(sequelize, DataTypes),
  ClientPortalAccess: defineClientPortalAccess(sequelize, DataTypes),
  ClientRequest: defineClientRequest(sequelize, DataTypes),
  ClientFeedback: defineClientFeedback(sequelize, DataTypes),
  ReportDefinition: defineReportDefinition(sequelize, DataTypes),
  ReportRun: defineReportRun(sequelize, DataTypes),
  MetricSnapshot: defineMetricSnapshot(sequelize, DataTypes),
  BusinessSetting: defineBusinessSetting(sequelize, DataTypes),
  BusinessBranding: defineBusinessBranding(sequelize, DataTypes),
  BusinessLocalization: defineBusinessLocalization(sequelize, DataTypes),
  Subscription: defineSubscription(sequelize, DataTypes),
  SubscriptionInvoice: defineSubscriptionInvoice(sequelize, DataTypes),
  SubscriptionPayment: defineSubscriptionPayment(sequelize, DataTypes),
  UsageLimit: defineUsageLimit(sequelize, DataTypes),
  SupportAccessLog: defineSupportAccessLog(sequelize, DataTypes),
  AdminImpersonationSession: defineAdminImpersonationSession(sequelize, DataTypes),
  SystemHealthLog: defineSystemHealthLog(sequelize, DataTypes),
  BackgroundJobLog: defineBackgroundJobLog(sequelize, DataTypes),
  HRCase: defineHRCase(sequelize, DataTypes),
  JobOpening: defineJobOpening(sequelize, DataTypes),
  JobApplication: defineJobApplication(sequelize, DataTypes),
  Interview: defineInterview(sequelize, DataTypes),
  OnboardingTask: defineOnboardingTask(sequelize, DataTypes),
  PerformanceReview: definePerformanceReview(sequelize, DataTypes),
  TrainingRecord: defineTrainingRecord(sequelize, DataTypes),
  DisciplinaryCase: defineDisciplinaryCase(sequelize, DataTypes),
  ExitProcess: defineExitProcess(sequelize, DataTypes),
  Proposal: defineProposal(sequelize, DataTypes),
  ProjectChangeRequest: defineProjectChangeRequest(sequelize, DataTypes),
  Vendor: defineVendor(sequelize, DataTypes)
};

Object.values(db).forEach((model: any) => {
  if (model && typeof model.associate === "function") model.associate(db);
});
