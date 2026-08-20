"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importStar(require("express"));
const cors_1 = __importDefault(require("cors"));
const swagger_ui_express_1 = __importDefault(require("swagger-ui-express"));
const requestId_1 = require("./middlewares/requestId");
const security_1 = require("./middlewares/security");
const notFound_1 = require("./middlewares/notFound");
const errorHandler_1 = require("./middlewares/errorHandler");
const env_1 = require("./config/env");
const swagger_1 = require("./config/swagger");
const auth_routes_1 = require("./modules/auth/auth.routes");
const business_routes_1 = require("./modules/business/business.routes");
const role_routes_1 = require("./modules/role/role.routes");
const user_routes_1 = require("./modules/user/user.routes");
const plan_routes_1 = require("./modules/plan/plan.routes");
const sectorFocus_routes_1 = require("./modules/sectorFocus/sectorFocus.routes");
const businessModule_routes_1 = require("./modules/businessModule/businessModule.routes");
const auditLog_routes_1 = require("./modules/auditLog/auditLog.routes");
const department_routes_1 = require("./modules/department/department.routes");
const position_routes_1 = require("./modules/position/position.routes");
const profile_routes_1 = require("./modules/businessUserProfile/profile.routes");
const workflow_routes_1 = require("./modules/approvalWorkflow/workflow.routes");
const request_routes_1 = require("./modules/approvalRequest/request.routes");
const definition_routes_1 = require("./modules/formDefinition/definition.routes");
const submission_routes_1 = require("./modules/formSubmission/submission.routes");
const file_routes_1 = require("./modules/file/file.routes");
const attachment_routes_1 = require("./modules/attachment/attachment.routes");
const notification_routes_1 = require("./modules/notification/notification.routes");
const preference_routes_1 = require("./modules/notificationPreference/preference.routes");
const activity_routes_1 = require("./modules/activityLog/activity.routes");
const widget_routes_1 = require("./modules/dashboardWidget/widget.routes");
const view_routes_1 = require("./modules/savedView/view.routes");
const template_routes_1 = require("./modules/moduleTemplate/template.routes");
const hr_routes_1 = require("./modules/hr/hr.routes");
const offerLetter_routes_1 = require("./modules/hr/offerLetter.routes");
const candidateOnboarding_routes_1 = require("./modules/hr/candidateOnboarding.routes");
const employmentContract_routes_1 = require("./modules/hr/employmentContract.routes");
const crm_routes_1 = require("./modules/crm/crm.routes");
const projects_routes_1 = require("./modules/projects/projects.routes");
const finance_routes_1 = require("./modules/finance/finance.routes");
const brain_routes_1 = require("./modules/brain/brain.routes");
const okr_routes_1 = require("./modules/okr/okr.routes");
const clientPortal_routes_1 = require("./modules/clientPortal/clientPortal.routes");
const reporting_routes_1 = require("./modules/reporting/reporting.routes");
const settings_routes_1 = require("./modules/settings/settings.routes");
const subscription_routes_1 = require("./modules/subscription/subscription.routes");
const adminOps_routes_1 = require("./modules/adminOps/adminOps.routes");
const people_routes_1 = require("./modules/people/people.routes");
const permission_routes_1 = require("./modules/permission/permission.routes");
const attendanceMe_routes_1 = require("./modules/attendanceMe/attendanceMe.routes");
const attendanceHr_routes_1 = require("./modules/attendanceHr/attendanceHr.routes");
const lateReasons_routes_1 = require("./modules/attendanceHrLateReasons/lateReasons.routes");
const attendanceRequests_routes_1 = require("./modules/attendanceRequests/attendanceRequests.routes");
const overtime_routes_1 = require("./modules/overtime/overtime.routes");
const specialRequests_routes_1 = require("./modules/specialRequests/specialRequests.routes");
const leave_routes_1 = require("./modules/leave/leave.routes");
const policy_routes_1 = require("./modules/policy/policy.routes");
const devices_routes_1 = require("./modules/devices/devices.routes");
const attendanceTelegram_routes_1 = require("./modules/attendanceTelegram/attendanceTelegram.routes");
const inventory_routes_1 = require("./modules/inventory/inventory.routes");
const calendar_routes_1 = require("./modules/calendar/calendar.routes");
const googleCalendarWebhook_routes_1 = require("./modules/calendar/googleCalendarWebhook.routes");
const userExemptions_routes_1 = require("./modules/userExemptions/userExemptions.routes");
const smtp_routes_1 = require("./modules/smtp/smtp.routes");
const app = (0, express_1.default)();
/**
 * CORS must run before security middleware.
 *
 * Browsers send an OPTIONS preflight request before many authenticated
 * requests. If the preflight response does not include the correct CORS
 * headers, the browser blocks the actual request.
 */
const corsOptions = {
    origin: (origin, callback) => {
        console.log(`[CORS] incoming origin: '${origin ?? "none"}'`);
        /**
         * Allow requests with no Origin header.
         *
         * Examples:
         * - Postman
         * - curl
         * - server-to-server requests
         */
        if (!origin) {
            return callback(null, true);
        }
        /**
         * During development, allow localhost on any port.
         */
        if (env_1.env.nodeEnv !== "production" &&
            /^https?:\/\/localhost(:\d+)?$/.test(origin)) {
            console.log(`[CORS] allowed (localhost dev): ${origin}`);
            return callback(null, true);
        }
        /**
         * During production, only allow configured origins.
         */
        if (env_1.env.corsOrigins.includes(origin)) {
            console.log(`[CORS] allowed (allowlist): ${origin}`);
            return callback(null, true);
        }
        console.log(`[CORS] BLOCKED: '${origin}' not in [${env_1.env.corsOrigins.join(", ")}]`);
        return callback(new Error(`CORS: origin '${origin}' not allowed`));
    },
    credentials: true,
    methods: [
        "GET",
        "POST",
        "PUT",
        "PATCH",
        "DELETE",
        "OPTIONS",
    ],
    allowedHeaders: [
        "Content-Type",
        "Authorization",
        "X-Request-Id",
        "x-api-key",
    ],
    exposedHeaders: [
        "Content-Disposition",
    ],
};
app.use((0, cors_1.default)(corsOptions));
app.options("*", (0, cors_1.default)(corsOptions));
app.use(requestId_1.addRequestId);
app.use(security_1.securityHeaders);
app.use(security_1.compressResponses);
app.use(security_1.preventParameterPollution);
app.use(security_1.sanitizePayload);
app.use(express_1.default.json({
    limit: "10mb",
}));
app.use(express_1.default.urlencoded({
    extended: true,
    limit: "10mb",
}));
app.use("/uploads", express_1.default.static("uploads"));
/**
 * Re-enable before production if needed.
 */
// app.use(
//   `/api/${env.apiVersion}`,
//   globalRateLimiter,
// );
const apiRouter = (0, express_1.Router)();
/**
 * Public HR routes
 */
apiRouter.use("/hr/public/offers", offerLetter_routes_1.publicOfferLetterRoutes);
/**
 * Legacy public offer route.
 *
 * This keeps previously stored offer links working.
 */
apiRouter.use("/offer-letters", offerLetter_routes_1.publicOfferLetterRoutes);
apiRouter.use("/hr/public/onboarding", candidateOnboarding_routes_1.publicCandidateOnboardingRoutes);
apiRouter.use("/hr/public", hr_routes_1.publicRecruitmentRoutes);
/**
 * API status
 */
apiRouter.get("/status", (_req, res) => {
    return res.json({
        status: "OK",
        version: env_1.env.apiVersion,
    });
});
/**
 * Authentication and user management
 */
apiRouter.use("/auth", auth_routes_1.authRoutes);
apiRouter.use("/users", user_routes_1.userRoutes);
apiRouter.use("/user-exemptions", userExemptions_routes_1.userExemptionsRoutes);
apiRouter.use("/businesses", business_routes_1.businessRoutes);
apiRouter.use("/plans", plan_routes_1.planRoutes);
apiRouter.use("/sector-focuses", sectorFocus_routes_1.sectorFocusRoutes);
/**
 * HR onboarding
 */
apiRouter.use("/hr/onboarding", candidateOnboarding_routes_1.candidateOnboardingRoutes);
/**
 * Employment contracts
 *
 * Base endpoint:
 * /api/v1/hr/employment-contracts
 */
apiRouter.use("/hr/employment-contracts", employmentContract_routes_1.employmentContractRoutes);
/**
 * General HR routes
 */
apiRouter.use("/hr", hr_routes_1.hrRoutes);
/**
 * Offer letters
 *
 * Offer letters remain separate from employment contracts.
 */
apiRouter.use("/offer-letters", offerLetter_routes_1.offerLetterRoutes);
/**
 * CRM
 */
apiRouter.use("/crm/public", crm_routes_1.publicCRMRoutes);
apiRouter.use("/crm", crm_routes_1.crmRoutes);
/**
 * Projects
 */
apiRouter.use("/projects", projects_routes_1.projectsRoutes);
/**
 * Finance
 */
apiRouter.use("/finance", finance_routes_1.financeRoutes);
/**
 * Brain / AI
 */
apiRouter.use("/brain", brain_routes_1.brainRoutes);
/**
 * OKR
 */
apiRouter.use("/okr", okr_routes_1.okrRoutes);
/**
 * Client portal
 */
apiRouter.use("/client-portal", clientPortal_routes_1.clientPortalRoutes);
/**
 * Reporting
 */
apiRouter.use("/reporting", reporting_routes_1.reportingRoutes);
/**
 * Settings
 */
apiRouter.use("/settings", settings_routes_1.settingsRoutes);
/**
 * SMTP
 */
apiRouter.use("/smtp", smtp_routes_1.smtpRoutes);
/**
 * Subscriptions
 */
apiRouter.use("/subscription", subscription_routes_1.subscriptionRoutes);
/**
 * Admin operations
 */
apiRouter.use("/admin-ops", adminOps_routes_1.adminOpsRoutes);
/**
 * People
 */
apiRouter.use("/people", people_routes_1.peopleRoutes);
/**
 * Files and attachments
 */
apiRouter.use("/files", file_routes_1.fileRoutes);
apiRouter.use("/attachments", attachment_routes_1.attachmentRoutes);
/**
 * Auditing and activity
 */
apiRouter.use("/audit-logs", auditLog_routes_1.auditLogRoutes);
apiRouter.use("/activity-logs", activity_routes_1.activityRoutes);
/**
 * Notification management
 */
apiRouter.use("/notification-preferences", preference_routes_1.notificationPreferenceRoutes);
apiRouter.use("/notifications", notification_routes_1.notificationRoutes);
/**
 * Modules and templates
 */
apiRouter.use("/business-modules", businessModule_routes_1.businessModuleRoutes);
apiRouter.use("/module-templates", template_routes_1.moduleTemplateRoutes);
/**
 * Dashboard and saved views
 */
apiRouter.use("/dashboard-widgets", widget_routes_1.dashboardRoutes);
apiRouter.use("/saved-views", view_routes_1.savedViewRoutes);
/**
 * Organization structure
 */
apiRouter.use("/departments", department_routes_1.departmentRoutes);
apiRouter.use("/positions", position_routes_1.positionRoutes);
apiRouter.use("/profiles", profile_routes_1.businessUserProfileRoutes);
/**
 * Devices
 */
apiRouter.use("/devices", devices_routes_1.devicesRoutes);
/**
 * Roles and permissions
 */
apiRouter.use("/roles", role_routes_1.roleRoutes);
apiRouter.use("/permissions", permission_routes_1.permissionRoutes);
/**
 * Attendance
 */
apiRouter.use("/attendance", attendanceMe_routes_1.attendanceMeRoutes);
apiRouter.use("/attendance/telegram", attendanceTelegram_routes_1.attendanceTelegramRoutes);
apiRouter.use("/attendance/hr/late-reasons", lateReasons_routes_1.attendanceHrLateReasonsRoutes);
apiRouter.use("/attendance/hr", attendanceHr_routes_1.attendanceHrRoutes);
apiRouter.use("/attendance-requests", attendanceRequests_routes_1.attendanceRequestsRoutes);
apiRouter.use("/attendance-special-requests", specialRequests_routes_1.specialRequestsRoutes);
/**
 * Calendar
 */
apiRouter.use("/google-calendar", googleCalendarWebhook_routes_1.googleCalendarWebhookRoutes);
apiRouter.use("/calendar", calendar_routes_1.calendarRoutes);
/**
 * Overtime
 */
apiRouter.use("/overtime-requests", overtime_routes_1.overtimeRoutes);
/**
 * Leave
 */
apiRouter.use("/leave-requests", leave_routes_1.leaveRoutes);
/**
 * Policies
 */
apiRouter.use("/policies", policy_routes_1.policyRoutes);
/**
 * Inventory
 */
apiRouter.use("/inventory", inventory_routes_1.inventoryRoutes);
/**
 * Forms
 */
apiRouter.use("/form-definitions", definition_routes_1.formDefinitionRoutes);
apiRouter.use("/form-submissions", submission_routes_1.formSubmissionRoutes);
/**
 * Approval workflows
 */
apiRouter.use("/approval-workflows", workflow_routes_1.approvalWorkflowRoutes);
apiRouter.use("/approval-requests", request_routes_1.approvalRequestRoutes);
/**
 * Mount versioned API.
 */
app.use(`/api/${env_1.env.apiVersion}`, apiRouter);
/**
 * Health endpoint is intentionally outside API versioning.
 */
app.get("/health", (_req, res) => {
    return res.json({
        status: "UP",
    });
});
/**
 * Swagger documentation
 */
app.use("/api-docs", swagger_ui_express_1.default.serve, swagger_ui_express_1.default.setup(swagger_1.swaggerSpec, {
    customSiteTitle: "Blih ERP API Docs",
    customCss: ".swagger-ui .topbar { display: none }",
    swaggerOptions: {
        persistAuthorization: true,
    },
}));
app.get("/api-docs.json", (_req, res) => {
    return res.json(swagger_1.swaggerSpec);
});
/**
 * 404 and centralized error handling.
 */
app.use(notFound_1.notFound);
app.use(errorHandler_1.errorHandler);
exports.default = app;
