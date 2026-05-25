"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BusinessController = void 0;
const business_service_1 = require("./business.service");
const auditLog_service_1 = require("../../services/auditLog.service");
const apiResponse_1 = require("../../utils/apiResponse");
class BusinessController {
    constructor() {
        this.list = async (req, res) => {
            const businesses = await this.service.listAll();
            return (0, apiResponse_1.ok)(res, { businesses }, "Businesses");
        };
        this.get = async (req, res, next) => {
            const business = await this.service.getById(req.params.id);
            if (!business)
                return next({ statusCode: 404, message: "Business not found" });
            return (0, apiResponse_1.ok)(res, { business }, "Business");
        };
        this.create = async (req, res) => {
            const business = await this.service.create(req.body);
            await auditLog_service_1.AuditLogService.log("CREATE", "business", business.id, null, business, req);
            return (0, apiResponse_1.ok)(res, { business }, "Business created", 201);
        };
        this.update = async (req, res, next) => {
            const beforeData = await this.service.getById(req.params.id);
            const business = await this.service.update(req.params.id, req.body);
            if (!business)
                return next({ statusCode: 404, message: "Business not found" });
            await auditLog_service_1.AuditLogService.log("UPDATE", "business", req.params.id, beforeData, business, req);
            return (0, apiResponse_1.ok)(res, { business }, "Business updated");
        };
        this.remove = async (req, res, next) => {
            const beforeData = await this.service.getById(req.params.id);
            const deleted = await this.service.softDelete(req.params.id);
            if (!deleted)
                return next({ statusCode: 404, message: "Business not found" });
            await auditLog_service_1.AuditLogService.log("DELETE", "business", req.params.id, beforeData, null, req);
            return (0, apiResponse_1.ok)(res, { ok: true }, "Business deleted");
        };
        this.service = new business_service_1.BusinessService();
    }
}
exports.BusinessController = BusinessController;
