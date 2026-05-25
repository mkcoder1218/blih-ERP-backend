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
const requestId_1 = require("./middlewares/requestId");
const security_1 = require("./middlewares/security");
const env_1 = require("./config/env");
const cors_1 = __importDefault(require("cors"));
const notFound_1 = require("./middlewares/notFound");
const errorHandler_1 = require("./middlewares/errorHandler");
const auth_routes_1 = require("./modules/auth/auth.routes");
const business_routes_1 = require("./modules/business/business.routes");
const user_routes_1 = require("./modules/user/user.routes");
const hr_routes_1 = require("./modules/hr/hr.routes");
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
const swagger_ui_express_1 = __importDefault(require("swagger-ui-express"));
const swagger_1 = require("./config/swagger");
const app = (0, express_1.default)();
app.use(requestId_1.addRequestId);
app.use(security_1.securityHeaders);
app.use(security_1.compressResponses);
app.use(security_1.preventParameterPollution);
app.use(security_1.sanitizePayload);
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
app.use((0, cors_1.default)({ origin: env_1.env.corsOrigins }));
app.use(`/api/${env_1.env.apiVersion}`, security_1.globalRateLimiter);
const apiRouter = (0, express_1.Router)();
apiRouter.get("/status", (req, res) => {
    res.json({ status: "OK", version: env_1.env.apiVersion });
});
apiRouter.use("/auth", auth_routes_1.authRoutes);
apiRouter.use("/users", user_routes_1.userRoutes);
apiRouter.use("/businesses", business_routes_1.businessRoutes);
apiRouter.use("/hr/public", hr_routes_1.publicRecruitmentRoutes);
apiRouter.use("/hr", hr_routes_1.hrRoutes);
apiRouter.use("/crm/public", crm_routes_1.publicCRMRoutes);
apiRouter.use("/crm", crm_routes_1.crmRoutes);
apiRouter.use("/projects", projects_routes_1.projectsRoutes);
apiRouter.use("/finance", finance_routes_1.financeRoutes);
apiRouter.use("/brain", brain_routes_1.brainRoutes);
apiRouter.use("/okr", okr_routes_1.okrRoutes);
apiRouter.use("/client-portal", clientPortal_routes_1.clientPortalRoutes);
apiRouter.use("/reporting", reporting_routes_1.reportingRoutes);
apiRouter.use("/settings", settings_routes_1.settingsRoutes);
apiRouter.use("/subscription", subscription_routes_1.subscriptionRoutes);
apiRouter.use("/admin-ops", adminOps_routes_1.adminOpsRoutes);
app.use(`/api/${env_1.env.apiVersion}`, apiRouter);
// Health stays out of versioning
app.get('/health', (req, res) => res.json({ status: 'UP' }));
// Swagger documentation
app.use('/api-docs', swagger_ui_express_1.default.serve, swagger_ui_express_1.default.setup(swagger_1.swaggerSpec, {
    customSiteTitle: 'Blih ERP API Docs',
    customCss: '.swagger-ui .topbar { display: none }',
    swaggerOptions: { persistAuthorization: true }
}));
app.get('/api-docs.json', (_req, res) => res.json(swagger_1.swaggerSpec));
app.use(notFound_1.notFound);
app.use(errorHandler_1.errorHandler);
exports.default = app;
