"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClientPortalController = void 0;
const clientPortal_service_1 = require("./clientPortal.service");
const auditLog_service_1 = require("../../services/auditLog.service");
class ClientPortalController {
    constructor() {
        this.service = new clientPortal_service_1.ClientPortalService();
        // Internal CRM usage
        this.createPortalUser = async (req, res) => {
            try {
                const user = await this.service.createPortalUser(req.user.businessId, req.body);
                await auditLog_service_1.AuditLogService.log("CREATE_PORTAL_USER", "client_portal_user", String(user.id), null, user, req);
                res.status(201).json({
                    portalUser: user,
                });
            }
            catch (error) {
                res.status(400).json({
                    message: error?.message ?? "Unable to create portal user.",
                });
            }
        };
        this.createPortalAccess = async (req, res) => {
            try {
                const access = await this.service.createPortalAccess(req.user.businessId, req.body);
                await auditLog_service_1.AuditLogService.log("CREATE_PORTAL_ACCESS", "client_portal_access", String(access.id), null, access, req);
                res.status(201).json({
                    portalAccess: access,
                });
            }
            catch (error) {
                res.status(400).json({
                    message: error?.message ??
                        "Unable to create portal access.",
                });
            }
        };
        // External portal usage
        this.getClientProjects = async (req, res) => {
            const portalUser = requirePortalUser(req);
            const projects = await this.service.getClientProjects(req.user.businessId, portalUser.clientId, portalUser.id);
            res.json({
                projects,
            });
        };
        this.getClientInvoices = async (req, res) => {
            const portalUser = requirePortalUser(req);
            const invoices = await this.service.getClientInvoices(req.user.businessId, portalUser.clientId);
            res.json({
                invoices,
            });
        };
        this.submitRequest = async (req, res) => {
            try {
                const portalUser = requirePortalUser(req);
                const request = await this.service.submitRequest(req.user.businessId, portalUser.clientId, portalUser.id, req.body);
                res.status(201).json({
                    request,
                });
            }
            catch (error) {
                res.status(400).json({
                    message: error?.message ??
                        "Unable to submit client request.",
                });
            }
        };
        this.submitFeedback = async (req, res) => {
            try {
                const portalUser = requirePortalUser(req);
                const feedback = await this.service.submitFeedback(req.user.businessId, portalUser.clientId, portalUser.id, req.body);
                res.status(201).json({
                    feedback,
                });
            }
            catch (error) {
                res.status(400).json({
                    message: error?.message ??
                        "Unable to submit client feedback.",
                });
            }
        };
    }
}
exports.ClientPortalController = ClientPortalController;
function requirePortalUser(req) {
    if (!req.portalUser) {
        throw new Error("Client portal user context is missing.");
    }
    return req.portalUser;
}
