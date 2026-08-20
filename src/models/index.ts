import { DataTypes } from "sequelize";
import { sequelize } from "../database/sequelize";

import defineBusiness from "./Business";
import defineUser from "./User";
import defineRole from "./Role";
import definePermission from "./Permission";
import defineRolePermission from "./RolePermission";
import defineUserRole from "./UserRole";
import definePlan from "./Plan";
import defineExitReason from "./ExitReason";
import definePlanModule from "./PlanModule";
import defineBusinessModule from "./BusinessModule";
import defineSectorFocus from "./SectorFocus";
import defineProfileTemplate from "./ProfileTemplate";
import defineProfileDraft from "./ProfileDraft";
import defineAuditLog from "./AuditLog";
import defineDepartment from "./Department";
import definePosition from "./Position";
import definePositionCompetency from "./PositionCompetency";
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
import defineEmployeeProbation from "./EmployeeProbation";
import defineEmployeeProbationCriterion from "./EmployeeProbationCriterion";
import defineLeaveBalance from "./LeaveBalance";
import defineAttendanceRecord from "./AttendanceRecord";
import defineLead from "./Lead";
import defineClient from "./Client";
import defineDeal from "./Deal";
import defineInteraction from "./Interaction";
import defineProject from "./Project";
import defineProjectMilestone from "./ProjectMilestone";
import defineProjectMember from "./ProjectMember";
import defineProjectTask from "./ProjectTask";
import defineTaskComment from "./TaskComment";
import defineProjectIssue from "./ProjectIssue";
import defineProjectActivityLog from "./ProjectActivityLog";
import defineProjectWorkflowForm from "./ProjectWorkflowForm";
import defineInvoice from "./Invoice";
import defineInvoiceItem from "./InvoiceItem";
import definePayment from "./Payment";
import defineExpense from "./Expense";
import defineBudget from "./Budget";
import defineSalaryAdjustmentRequest from "./SalaryAdjustmentRequest";
import definePayrollRecord from "./PayrollRecord";
import defineFinanceBenefit from "./FinanceBenefit";
import defineFinanceBenefitEnrollment from "./FinanceBenefitEnrollment";
import defineBudgetReallocationRequest from "./BudgetReallocationRequest";
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
import defineSubscriptionPolicy from "./SubscriptionPolicy";
import defineUsageLimit from "./UsageLimit";
import defineFeature from "./Feature";
import definePlanFeature from "./PlanFeature";
import defineUsageRecord from "./UsageRecord";
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
import defineExitClearanceStep from "./ExitClearanceStep";
import defineExitInterview from "./ExitInterview";
import defineExitDocument from "./ExitDocument";
import defineProposal from "./Proposal";
import defineProjectChangeRequest from "./ProjectChangeRequest";
import defineVendor from "./Vendor";
import defineOfferLetterTemplate from "./OfferLetterTemplate";
import defineOfferLetter from "./OfferLetter";
import defineRecruitmentTemplate from "./RecruitmentTemplate";
import definePayrollTemplate from "./PayrollTemplate";
import defineEmployeePayrollLink from "./EmployeePayrollLink";
import defineSalaryDeduction from "./SalaryDeduction";
import defineSkill from "./Skill";
import defineInterviewSkill from "./InterviewSkill";
import defineInterviewerNote from "./InterviewerNote";
import defineCandidateOnboarding from "./CandidateOnboarding";
import defineBusinessAttendanceSettings from "./BusinessAttendanceSettings";
import defineAttendanceEvent from "./AttendanceEvent";
import defineAttendanceLateReason from "./AttendanceLateReason";
import defineAttendanceLateExplanation from "./AttendanceLateExplanation";
import defineAttendanceRequest from "./AttendanceRequest";
import defineAttendanceDailyReason from "./AttendanceDailyReason";
import defineOvertimeRequest from "./OvertimeRequest";
import defineSpecialRequest from "./SpecialRequest";
import defineLeaveTemplate from "./LeaveTemplate";
import defineLeaveRequest from "./LeaveRequest";
import definePromotionRequest from "./PromotionRequest";
import defineHREvent from "./HREvent";
import defineUserCalendarEvent from "./UserCalendarEvent";
import defineUserCalendarMeetingRequest from "./UserCalendarMeetingRequest";
import defineCalendarSyncRetryJob from "./CalendarSyncRetryJob";
import defineCalendarSyncAuditLog from "./CalendarSyncAuditLog";
import definePolicy from "./Policy";
import definePolicyAcceptance from "./PolicyAcceptance";
import defineInventoryItem from "./InventoryItem";
import defineTrustedDevice from "./TrustedDevice";
import defineTelegramBotSetting from "./TelegramBotSetting";
import defineTelegramAccountLink from "./TelegramAccountLink";
import defineTelegramLinkCode from "./TelegramLinkCode";
import defineTelegramNotificationLog from "./TelegramNotificationLog";
import defineUserExemption from "./UserExemption";
import defineSmtpProvider from "./SmtpProvider";
import defineBusinessSmtpSetting from "./BusinessSmtpSetting";
import defineEmploymentContractTemplate from "./EmploymentContractTemplate";
import defineEmploymentContract from "./EmploymentContract";

export type DB = {
  sequelize: typeof sequelize;

  Business: any;
  BusinessAttendanceSettings: any;
  AttendanceEvent: any;
  AttendanceLateReason: any;
  AttendanceLateExplanation: any;
  AttendanceRequest: any;
  AttendanceDailyReason: any;
  OvertimeRequest: any;
  SpecialRequest: any;
  LeaveTemplate: any;
  LeaveRequest: any;

  User: any;
  Role: any;
  Permission: any;
  RolePermission: any;
  UserRole: any;

  Plan: any;
  PlanModule: any;
  SectorFocus: any;
  ProfileTemplate: any;
  ProfileDraft: any;
  BusinessModule: any;
  AuditLog: any;

  Department: any;
  Position: any;
  PositionCompetency: any;
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
  EmployeeProbation: any;
  EmployeeProbationCriterion: any;
  LeaveBalance: any;
  AttendanceRecord: any;

  Lead: any;
  Client: any;
  Deal: any;
  Interaction: any;

  Project: any;
  ProjectMilestone: any;
  ProjectMember: any;
  ProjectTask: any;
  TaskComment: any;
  ProjectIssue: any;
  ProjectActivityLog: any;
  ProjectWorkflowForm: any;

  Invoice: any;
  InvoiceItem: any;
  Payment: any;
  Expense: any;
  Budget: any;
  SalaryAdjustmentRequest: any;
  PayrollRecord: any;
  FinanceBenefit: any;
  FinanceBenefitEnrollment: any;
  BudgetReallocationRequest: any;

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
  SubscriptionPolicy: any;
  UsageLimit: any;

  Feature: any;
  PlanFeature: any;
  UsageRecord: any;

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
  ExitReason: any;
  ExitClearanceStep: any;
  ExitInterview: any;
  ExitDocument: any;

  Proposal: any;
  ProjectChangeRequest: any;
  Vendor: any;

  OfferLetterTemplate: any;
  OfferLetter: any;
  RecruitmentTemplate: any;

  EmploymentContractTemplate: any;
  EmploymentContract: any;

  PayrollTemplate: any;
  EmployeePayrollLink: any;
  SalaryDeduction: any;

  Skill: any;
  InterviewSkill: any;
  InterviewerNote: any;
  CandidateOnboarding: any;

  PromotionRequest: any;
  HREvent: any;

  UserCalendarEvent: any;
  UserCalendarMeetingRequest: any;
  CalendarSyncRetryJob: any;
  CalendarSyncAuditLog: any;

  Policy: any;
  PolicyAcceptance: any;
  InventoryItem: any;
  TrustedDevice: any;

  TelegramBotSetting: any;
  TelegramAccountLink: any;
  TelegramLinkCode: any;
  TelegramNotificationLog: any;

  UserExemption: any;
  SmtpProvider: any;
  BusinessSmtpSetting: any;
};

export const db: DB = {
  sequelize,

  Business: defineBusiness(sequelize, DataTypes),

  BusinessAttendanceSettings: defineBusinessAttendanceSettings(
    sequelize,
    DataTypes,
  ),

  AttendanceEvent: defineAttendanceEvent(sequelize, DataTypes),

  AttendanceLateReason: defineAttendanceLateReason(
    sequelize,
    DataTypes,
  ),

  AttendanceLateExplanation: defineAttendanceLateExplanation(
    sequelize,
    DataTypes,
  ),

  AttendanceRequest: defineAttendanceRequest(sequelize, DataTypes),

  AttendanceDailyReason: defineAttendanceDailyReason(
    sequelize,
    DataTypes,
  ),

  OvertimeRequest: defineOvertimeRequest(sequelize, DataTypes),

  SpecialRequest: defineSpecialRequest(sequelize, DataTypes),

  LeaveTemplate: defineLeaveTemplate(sequelize, DataTypes),

  LeaveRequest: defineLeaveRequest(sequelize, DataTypes),

  User: defineUser(sequelize, DataTypes),
  Role: defineRole(sequelize, DataTypes),
  Permission: definePermission(sequelize, DataTypes),

  RolePermission: defineRolePermission(sequelize, DataTypes),

  UserRole: defineUserRole(sequelize, DataTypes),

  Plan: definePlan(sequelize, DataTypes),

  PlanModule: definePlanModule(sequelize, DataTypes),

  SectorFocus: defineSectorFocus(sequelize, DataTypes),

  ProfileTemplate: defineProfileTemplate(sequelize, DataTypes),

  ProfileDraft: defineProfileDraft(sequelize, DataTypes),

  BusinessModule: defineBusinessModule(sequelize, DataTypes),

  AuditLog: defineAuditLog(sequelize, DataTypes),

  Department: defineDepartment(sequelize, DataTypes),

  Position: definePosition(sequelize, DataTypes),

  PositionCompetency: definePositionCompetency(
    sequelize,
    DataTypes,
  ),

  BusinessUserProfile: defineBusinessUserProfile(
    sequelize,
    DataTypes,
  ),

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

  NotificationPreference: defineNotificationPreference(
    sequelize,
    DataTypes,
  ),

  ActivityLog: defineActivityLog(sequelize, DataTypes),

  DashboardWidget: defineDashboardWidget(sequelize, DataTypes),

  SavedView: defineSavedView(sequelize, DataTypes),

  ModuleTemplate: defineModuleTemplate(sequelize, DataTypes),

  ModuleTemplateForm: defineModuleTemplateForm(
    sequelize,
    DataTypes,
  ),

  ModuleTemplateWorkflow: defineModuleTemplateWorkflow(
    sequelize,
    DataTypes,
  ),

  EmployeeRecord: defineEmployeeRecord(sequelize, DataTypes),

  EmployeeProbation: defineEmployeeProbation(sequelize, DataTypes),

  EmployeeProbationCriterion: defineEmployeeProbationCriterion(
    sequelize,
    DataTypes,
  ),

  LeaveBalance: defineLeaveBalance(sequelize, DataTypes),

  AttendanceRecord: defineAttendanceRecord(sequelize, DataTypes),

  Lead: defineLead(sequelize, DataTypes),
  Client: defineClient(sequelize, DataTypes),
  Deal: defineDeal(sequelize, DataTypes),

  Interaction: defineInteraction(sequelize, DataTypes),

  Project: defineProject(sequelize, DataTypes),

  ProjectMilestone: defineProjectMilestone(sequelize, DataTypes),

  ProjectMember: defineProjectMember(sequelize, DataTypes),

  ProjectTask: defineProjectTask(sequelize, DataTypes),

  TaskComment: defineTaskComment(sequelize, DataTypes),

  ProjectIssue: defineProjectIssue(sequelize, DataTypes),

  ProjectActivityLog: defineProjectActivityLog(
    sequelize,
    DataTypes,
  ),

  ProjectWorkflowForm: defineProjectWorkflowForm(
    sequelize,
    DataTypes,
  ),

  Invoice: defineInvoice(sequelize, DataTypes),

  InvoiceItem: defineInvoiceItem(sequelize, DataTypes),

  Payment: definePayment(sequelize, DataTypes),

  Expense: defineExpense(sequelize, DataTypes),

  Budget: defineBudget(sequelize, DataTypes),

  SalaryAdjustmentRequest: defineSalaryAdjustmentRequest(
    sequelize,
    DataTypes,
  ),

  PayrollRecord: definePayrollRecord(sequelize, DataTypes),

  FinanceBenefit: defineFinanceBenefit(sequelize, DataTypes),

  FinanceBenefitEnrollment: defineFinanceBenefitEnrollment(
    sequelize,
    DataTypes,
  ),

  BudgetReallocationRequest: defineBudgetReallocationRequest(
    sequelize,
    DataTypes,
  ),

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

  BusinessLocalization: defineBusinessLocalization(
    sequelize,
    DataTypes,
  ),

  Subscription: defineSubscription(sequelize, DataTypes),

  SubscriptionInvoice: defineSubscriptionInvoice(
    sequelize,
    DataTypes,
  ),

  SubscriptionPayment: defineSubscriptionPayment(
    sequelize,
    DataTypes,
  ),

  SubscriptionPolicy: defineSubscriptionPolicy(sequelize, DataTypes),

  UsageLimit: defineUsageLimit(sequelize, DataTypes),

  Feature: defineFeature(sequelize, DataTypes),

  PlanFeature: definePlanFeature(sequelize, DataTypes),

  UsageRecord: defineUsageRecord(sequelize, DataTypes),

  SupportAccessLog: defineSupportAccessLog(sequelize, DataTypes),

  AdminImpersonationSession: defineAdminImpersonationSession(
    sequelize,
    DataTypes,
  ),

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

  ExitReason: defineExitReason(sequelize, DataTypes),

  ExitProcess: defineExitProcess(sequelize, DataTypes),

  ExitClearanceStep: defineExitClearanceStep(sequelize, DataTypes),

  ExitInterview: defineExitInterview(sequelize, DataTypes),

  ExitDocument: defineExitDocument(sequelize, DataTypes),

  Proposal: defineProposal(sequelize, DataTypes),

  ProjectChangeRequest: defineProjectChangeRequest(
    sequelize,
    DataTypes,
  ),

  Vendor: defineVendor(sequelize, DataTypes),

  OfferLetterTemplate: defineOfferLetterTemplate(
    sequelize,
    DataTypes,
  ),

  OfferLetter: defineOfferLetter(sequelize, DataTypes),

  RecruitmentTemplate: defineRecruitmentTemplate(
    sequelize,
    DataTypes,
  ),

  EmploymentContractTemplate: defineEmploymentContractTemplate(
    sequelize,
    DataTypes,
  ),

  EmploymentContract: defineEmploymentContract(
    sequelize,
    DataTypes,
  ),

  PayrollTemplate: definePayrollTemplate(sequelize, DataTypes),

  EmployeePayrollLink: defineEmployeePayrollLink(
    sequelize,
    DataTypes,
  ),

  SalaryDeduction: defineSalaryDeduction(sequelize, DataTypes),

  Skill: defineSkill(sequelize, DataTypes),

  InterviewSkill: defineInterviewSkill(sequelize, DataTypes),

  InterviewerNote: defineInterviewerNote(sequelize, DataTypes),

  CandidateOnboarding: defineCandidateOnboarding(
    sequelize,
    DataTypes,
  ),

  PromotionRequest: definePromotionRequest(sequelize, DataTypes),

  HREvent: defineHREvent(sequelize, DataTypes),

  UserCalendarEvent: defineUserCalendarEvent(sequelize, DataTypes),

  UserCalendarMeetingRequest: defineUserCalendarMeetingRequest(
    sequelize,
    DataTypes,
  ),

  CalendarSyncRetryJob: defineCalendarSyncRetryJob(
    sequelize,
    DataTypes,
  ),

  CalendarSyncAuditLog: defineCalendarSyncAuditLog(
    sequelize,
    DataTypes,
  ),

  Policy: definePolicy(sequelize, DataTypes),

  PolicyAcceptance: definePolicyAcceptance(sequelize, DataTypes),

  InventoryItem: defineInventoryItem(sequelize, DataTypes),

  TrustedDevice: defineTrustedDevice(sequelize, DataTypes),

  TelegramBotSetting: defineTelegramBotSetting(
    sequelize,
    DataTypes,
  ),

  TelegramAccountLink: defineTelegramAccountLink(
    sequelize,
    DataTypes,
  ),

  TelegramLinkCode: defineTelegramLinkCode(sequelize, DataTypes),

  TelegramNotificationLog: defineTelegramNotificationLog(
    sequelize,
    DataTypes,
  ),

  UserExemption: defineUserExemption(sequelize, DataTypes),

  SmtpProvider: defineSmtpProvider(sequelize, DataTypes),

  BusinessSmtpSetting: defineBusinessSmtpSetting(
    sequelize,
    DataTypes,
  ),
};

Object.values(db).forEach((model: any) => {
  if (model && typeof model.associate === "function") {
    model.associate(db);
  }
});
