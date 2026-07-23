import express, { Router } from "express";
import cors, { type CorsOptions } from "cors";
import swaggerUi from "swagger-ui-express";

import { addRequestId } from "./middlewares/requestId";
import {
  authRateLimiter,
  compressResponses,
  globalRateLimiter,
  preventParameterPollution,
  sanitizePayload,
  securityHeaders,
} from "./middlewares/security";
import { notFound } from "./middlewares/notFound";
import { errorHandler } from "./middlewares/errorHandler";

import { env } from "./config/env";
import { swaggerSpec } from "./config/swagger";

import { authRoutes } from "./modules/auth/auth.routes";
import { businessRoutes } from "./modules/business/business.routes";
import { roleRoutes } from "./modules/role/role.routes";
import { userRoutes } from "./modules/user/user.routes";
import { planRoutes } from "./modules/plan/plan.routes";
import { sectorFocusRoutes } from "./modules/sectorFocus/sectorFocus.routes";
import { businessModuleRoutes } from "./modules/businessModule/businessModule.routes";
import { auditLogRoutes } from "./modules/auditLog/auditLog.routes";
import { departmentRoutes } from "./modules/department/department.routes";
import { positionRoutes } from "./modules/position/position.routes";
import { businessUserProfileRoutes } from "./modules/businessUserProfile/profile.routes";
import { approvalWorkflowRoutes } from "./modules/approvalWorkflow/workflow.routes";
import { approvalRequestRoutes } from "./modules/approvalRequest/request.routes";
import { formDefinitionRoutes } from "./modules/formDefinition/definition.routes";
import { formSubmissionRoutes } from "./modules/formSubmission/submission.routes";
import { fileRoutes } from "./modules/file/file.routes";
import { attachmentRoutes } from "./modules/attachment/attachment.routes";
import { notificationRoutes } from "./modules/notification/notification.routes";
import { notificationPreferenceRoutes } from "./modules/notificationPreference/preference.routes";
import { activityRoutes } from "./modules/activityLog/activity.routes";
import { dashboardRoutes } from "./modules/dashboardWidget/widget.routes";
import { savedViewRoutes } from "./modules/savedView/view.routes";
import { moduleTemplateRoutes } from "./modules/moduleTemplate/template.routes";

import {
  hrRoutes,
  publicRecruitmentRoutes,
} from "./modules/hr/hr.routes";

import {
  offerLetterRoutes,
  publicOfferLetterRoutes,
} from "./modules/hr/offerLetter.routes";

import {
  candidateOnboardingRoutes,
  publicCandidateOnboardingRoutes,
} from "./modules/hr/candidateOnboarding.routes";

import {
  employmentContractRoutes,
} from "./modules/hr/employmentContract.routes";

import {
  crmRoutes,
  publicCRMRoutes,
} from "./modules/crm/crm.routes";

import { projectsRoutes } from "./modules/projects/projects.routes";
import { financeRoutes } from "./modules/finance/finance.routes";
import { brainRoutes } from "./modules/brain/brain.routes";
import { okrRoutes } from "./modules/okr/okr.routes";
import { clientPortalRoutes } from "./modules/clientPortal/clientPortal.routes";
import { reportingRoutes } from "./modules/reporting/reporting.routes";
import { settingsRoutes } from "./modules/settings/settings.routes";
import { subscriptionRoutes } from "./modules/subscription/subscription.routes";
import { adminOpsRoutes } from "./modules/adminOps/adminOps.routes";
import { peopleRoutes } from "./modules/people/people.routes";
import { permissionRoutes } from "./modules/permission/permission.routes";
import { attendanceMeRoutes } from "./modules/attendanceMe/attendanceMe.routes";
import { attendanceHrRoutes } from "./modules/attendanceHr/attendanceHr.routes";
import { attendanceHrLateReasonsRoutes } from "./modules/attendanceHrLateReasons/lateReasons.routes";
import { attendanceRequestsRoutes } from "./modules/attendanceRequests/attendanceRequests.routes";
import { overtimeRoutes } from "./modules/overtime/overtime.routes";
import { specialRequestsRoutes } from "./modules/specialRequests/specialRequests.routes";
import { leaveRoutes } from "./modules/leave/leave.routes";
import { policyRoutes } from "./modules/policy/policy.routes";
import { devicesRoutes } from "./modules/devices/devices.routes";
import { attendanceTelegramRoutes } from "./modules/attendanceTelegram/attendanceTelegram.routes";
import { inventoryRoutes } from "./modules/inventory/inventory.routes";
import { calendarRoutes } from "./modules/calendar/calendar.routes";
import { googleCalendarWebhookRoutes } from "./modules/calendar/googleCalendarWebhook.routes";
import { userExemptionsRoutes } from "./modules/userExemptions/userExemptions.routes";
import { smtpRoutes } from "./modules/smtp/smtp.routes";

const app = express();

/**
 * CORS must run before security middleware.
 *
 * Browsers send an OPTIONS preflight request before many authenticated
 * requests. If the preflight response does not include the correct CORS
 * headers, the browser blocks the actual request.
 */
const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    console.log(
      `[CORS] incoming origin: '${origin ?? "none"}'`,
    );

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
    if (
      env.nodeEnv !== "production" &&
      /^https?:\/\/localhost(:\d+)?$/.test(origin)
    ) {
      console.log(
        `[CORS] allowed (localhost dev): ${origin}`,
      );

      return callback(null, true);
    }

    /**
     * During production, only allow configured origins.
     */
    if (env.corsOrigins.includes(origin)) {
      console.log(
        `[CORS] allowed (allowlist): ${origin}`,
      );

      return callback(null, true);
    }

    console.log(
      `[CORS] BLOCKED: '${origin}' not in [${env.corsOrigins.join(
        ", ",
      )}]`,
    );

    return callback(
      new Error(
        `CORS: origin '${origin}' not allowed`,
      ),
    );
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

app.use(cors(corsOptions));

app.options(
  "*",
  cors(corsOptions),
);

app.use(addRequestId);
app.use(securityHeaders);
app.use(compressResponses);
app.use(preventParameterPollution);
app.use(sanitizePayload);

app.use(
  express.json({
    limit: "10mb",
  }),
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "10mb",
  }),
);

app.use(
  "/uploads",
  express.static("uploads"),
);

/**
 * Re-enable before production if needed.
 */
// app.use(
//   `/api/${env.apiVersion}`,
//   globalRateLimiter,
// );

const apiRouter = Router();

/**
 * Public HR routes
 */
apiRouter.use(
  "/hr/public/offers",
  publicOfferLetterRoutes,
);

/**
 * Legacy public offer route.
 *
 * This keeps previously stored offer links working.
 */
apiRouter.use(
  "/offer-letters",
  publicOfferLetterRoutes,
);

apiRouter.use(
  "/hr/public/onboarding",
  publicCandidateOnboardingRoutes,
);

apiRouter.use(
  "/hr/public",
  publicRecruitmentRoutes,
);

/**
 * API status
 */
apiRouter.get(
  "/status",
  (_req, res) => {
    return res.json({
      status: "OK",
      version: env.apiVersion,
    });
  },
);

/**
 * Authentication and user management
 */
apiRouter.use(
  "/auth",
  authRoutes,
);

apiRouter.use(
  "/users",
  userRoutes,
);

apiRouter.use(
  "/user-exemptions",
  userExemptionsRoutes,
);

apiRouter.use(
  "/businesses",
  businessRoutes,
);

apiRouter.use(
  "/plans",
  planRoutes,
);

apiRouter.use(
  "/sector-focuses",
  sectorFocusRoutes,
);

/**
 * HR onboarding
 */
apiRouter.use(
  "/hr/onboarding",
  candidateOnboardingRoutes,
);

/**
 * Employment contracts
 *
 * Base endpoint:
 * /api/v1/hr/employment-contracts
 */
apiRouter.use(
  "/hr/employment-contracts",
  employmentContractRoutes,
);

/**
 * General HR routes
 */
apiRouter.use(
  "/hr",
  hrRoutes,
);

/**
 * Offer letters
 *
 * Offer letters remain separate from employment contracts.
 */
apiRouter.use(
  "/offer-letters",
  offerLetterRoutes,
);

/**
 * CRM
 */
apiRouter.use(
  "/crm/public",
  publicCRMRoutes,
);

apiRouter.use(
  "/crm",
  crmRoutes,
);

/**
 * Projects
 */
apiRouter.use(
  "/projects",
  projectsRoutes,
);

/**
 * Finance
 */
apiRouter.use(
  "/finance",
  financeRoutes,
);

/**
 * Brain / AI
 */
apiRouter.use(
  "/brain",
  brainRoutes,
);

/**
 * OKR
 */
apiRouter.use(
  "/okr",
  okrRoutes,
);

/**
 * Client portal
 */
apiRouter.use(
  "/client-portal",
  clientPortalRoutes,
);

/**
 * Reporting
 */
apiRouter.use(
  "/reporting",
  reportingRoutes,
);

/**
 * Settings
 */
apiRouter.use(
  "/settings",
  settingsRoutes,
);

/**
 * SMTP
 */
apiRouter.use(
  "/smtp",
  smtpRoutes,
);

/**
 * Subscriptions
 */
apiRouter.use(
  "/subscription",
  subscriptionRoutes,
);

/**
 * Admin operations
 */
apiRouter.use(
  "/admin-ops",
  adminOpsRoutes,
);

/**
 * People
 */
apiRouter.use(
  "/people",
  peopleRoutes,
);

/**
 * Files and attachments
 */
apiRouter.use(
  "/files",
  fileRoutes,
);

apiRouter.use(
  "/attachments",
  attachmentRoutes,
);

/**
 * Auditing and activity
 */
apiRouter.use(
  "/audit-logs",
  auditLogRoutes,
);

apiRouter.use(
  "/activity-logs",
  activityRoutes,
);

/**
 * Notification management
 */
apiRouter.use(
  "/notification-preferences",
  notificationPreferenceRoutes,
);

apiRouter.use(
  "/notifications",
  notificationRoutes,
);

/**
 * Modules and templates
 */
apiRouter.use(
  "/business-modules",
  businessModuleRoutes,
);

apiRouter.use(
  "/module-templates",
  moduleTemplateRoutes,
);

/**
 * Dashboard and saved views
 */
apiRouter.use(
  "/dashboard-widgets",
  dashboardRoutes,
);

apiRouter.use(
  "/saved-views",
  savedViewRoutes,
);

/**
 * Organization structure
 */
apiRouter.use(
  "/departments",
  departmentRoutes,
);

apiRouter.use(
  "/positions",
  positionRoutes,
);

apiRouter.use(
  "/profiles",
  businessUserProfileRoutes,
);

/**
 * Devices
 */
apiRouter.use(
  "/devices",
  devicesRoutes,
);

/**
 * Roles and permissions
 */
apiRouter.use(
  "/roles",
  roleRoutes,
);

apiRouter.use(
  "/permissions",
  permissionRoutes,
);

/**
 * Attendance
 */
apiRouter.use(
  "/attendance",
  attendanceMeRoutes,
);

apiRouter.use(
  "/attendance/telegram",
  attendanceTelegramRoutes,
);

apiRouter.use(
  "/attendance/hr/late-reasons",
  attendanceHrLateReasonsRoutes,
);

apiRouter.use(
  "/attendance/hr",
  attendanceHrRoutes,
);

apiRouter.use(
  "/attendance-requests",
  attendanceRequestsRoutes,
);

apiRouter.use(
  "/attendance-special-requests",
  specialRequestsRoutes,
);

/**
 * Calendar
 */
apiRouter.use(
  "/google-calendar",
  googleCalendarWebhookRoutes,
);

apiRouter.use(
  "/calendar",
  calendarRoutes,
);

/**
 * Overtime
 */
apiRouter.use(
  "/overtime-requests",
  overtimeRoutes,
);

/**
 * Leave
 */
apiRouter.use(
  "/leave-requests",
  leaveRoutes,
);

/**
 * Policies
 */
apiRouter.use(
  "/policies",
  policyRoutes,
);

/**
 * Inventory
 */
apiRouter.use(
  "/inventory",
  inventoryRoutes,
);

/**
 * Forms
 */
apiRouter.use(
  "/form-definitions",
  formDefinitionRoutes,
);

apiRouter.use(
  "/form-submissions",
  formSubmissionRoutes,
);

/**
 * Approval workflows
 */
apiRouter.use(
  "/approval-workflows",
  approvalWorkflowRoutes,
);

apiRouter.use(
  "/approval-requests",
  approvalRequestRoutes,
);

/**
 * Mount versioned API.
 */
app.use(
  `/api/${env.apiVersion}`,
  apiRouter,
);

/**
 * Health endpoint is intentionally outside API versioning.
 */
app.get(
  "/health",
  (_req, res) => {
    return res.json({
      status: "UP",
    });
  },
);

/**
 * Swagger documentation
 */
app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(
    swaggerSpec,
    {
      customSiteTitle:
        "Blih ERP API Docs",

      customCss:
        ".swagger-ui .topbar { display: none }",

      swaggerOptions: {
        persistAuthorization: true,
      },
    },
  ),
);

app.get(
  "/api-docs.json",
  (_req, res) => {
    return res.json(
      swaggerSpec,
    );
  },
);

/**
 * 404 and centralized error handling.
 */
app.use(notFound);
app.use(errorHandler);

export default app;
