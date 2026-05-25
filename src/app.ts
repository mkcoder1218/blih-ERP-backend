import express, { Router } from "express";
import { addRequestId } from "./middlewares/requestId";
import { globalRateLimiter, authRateLimiter, securityHeaders, compressResponses, preventParameterPollution, sanitizePayload } from "./middlewares/security";
import { env } from "./config/env";
import cors from "cors";

import { notFound } from "./middlewares/notFound";
import { errorHandler } from "./middlewares/errorHandler";

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
import { hrRoutes, publicRecruitmentRoutes } from "./modules/hr/hr.routes";
import { crmRoutes, publicCRMRoutes } from "./modules/crm/crm.routes";
import { projectsRoutes } from "./modules/projects/projects.routes";
import { financeRoutes } from "./modules/finance/finance.routes";
import { brainRoutes } from "./modules/brain/brain.routes";
import { okrRoutes } from "./modules/okr/okr.routes";
import { clientPortalRoutes } from "./modules/clientPortal/clientPortal.routes";
import { reportingRoutes } from "./modules/reporting/reporting.routes";
import { settingsRoutes } from "./modules/settings/settings.routes";
import { subscriptionRoutes } from "./modules/subscription/subscription.routes";
import { adminOpsRoutes } from "./modules/adminOps/adminOps.routes";

import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./config/swagger";

const app = express();


app.use(addRequestId);
app.use(securityHeaders);
app.use(compressResponses);
app.use(preventParameterPollution);
app.use(sanitizePayload);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({ origin: env.corsOrigins }));

app.use(`/api/${env.apiVersion}`, globalRateLimiter);

const apiRouter = Router();

apiRouter.get("/status", (req, res) => {
   res.json({ status: "OK", version: env.apiVersion });
});

apiRouter.use("/auth", authRoutes);
apiRouter.use("/users", userRoutes);
apiRouter.use("/businesses", businessRoutes);
apiRouter.use("/plans", planRoutes);
apiRouter.use("/sector-focuses", sectorFocusRoutes);
apiRouter.use("/hr/public", publicRecruitmentRoutes);
apiRouter.use("/hr", hrRoutes);
apiRouter.use("/crm/public", publicCRMRoutes);
apiRouter.use("/crm", crmRoutes);
apiRouter.use("/projects", projectsRoutes);
apiRouter.use("/finance", financeRoutes);
apiRouter.use("/brain", brainRoutes);
apiRouter.use("/okr", okrRoutes);
apiRouter.use("/client-portal", clientPortalRoutes);
apiRouter.use("/reporting", reportingRoutes);
apiRouter.use("/settings", settingsRoutes);
apiRouter.use("/subscription", subscriptionRoutes);
apiRouter.use("/admin-ops", adminOpsRoutes);

app.use(`/api/${env.apiVersion}`, apiRouter);

// Health stays out of versioning
app.get('/health', (req, res) => res.json({ status: 'UP' }));

// Swagger documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customSiteTitle: 'Blih ERP API Docs',
  customCss: '.swagger-ui .topbar { display: none }',
  swaggerOptions: { persistAuthorization: true }
}));
app.get('/api-docs.json', (_req, res) => res.json(swaggerSpec));

app.use(notFound);
app.use(errorHandler);

export default app;
