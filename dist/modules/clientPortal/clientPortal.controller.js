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
                await auditLog_service_1.AuditLogService.log('CREATE_PORTAL_USER', 'client_portal_user', String(user.id), null, user, req);
                res.status(201).json({ portalUser: user });
            }
            catch (e) {
                res.status(400).json({ message: e.message });
            }
        };
        this.createPortalAccess = async (req, res) => {
            try {
                const access = await this.service.createPortalAccess(req.user.businessId, req.body);
                await auditLog_service_1.AuditLogService.log('CREATE_PORTAL_ACCESS', 'client_portal_access', String(access.id), null, access, req);
                res.status(201).json({ portalAccess: access });
            }
            catch (e) {
                res.status(400).json({ message: e.message });
            }
        };
        // External Portal usage
        this.getClientProjects = async (req, res) => {
            const data = await this.service.getClientProjects(req.user.businessId, req.portalUser.clientId, req.portalUser.id);
            res.json({ projects: data });
        };
        this.getClientInvoices = async (req, res) => {
            const data = await this.service.getClientInvoices(req.user.businessId, req.portalUser.clientId);
            res.json({ invoices: data });
        };
        this.submitRequest = async (req, res) => {
            try {
                const requestObj = await this.service.submitRequest(req.user.businessId, req.portalUser.clientId, req.portalUser.id, req.body);
                res.status(201).json({ request: requestObj });
            }
            catch (e) {
                res.status(400).json({ message: e.message });
            }
        };
        this.submitFeedback = async (req, res) => {
            try {
                const fb = await this.service.submitFeedback(req.user.businessId, req.portalUser.clientId, req.portalUser.id, req.body);
                res.status(201).json({ feedback: fb });
            }
            catch (e) {
                res.status(400).json({ message: e.message });
            }
        };
    }
}
exports.ClientPortalController = ClientPortalController;
