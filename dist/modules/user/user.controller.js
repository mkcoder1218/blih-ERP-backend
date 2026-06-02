"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserController = void 0;
const user_service_1 = require("./user.service");
const auditLog_service_1 = require("../../services/auditLog.service");
class UserController {
    constructor() {
        this.list = async (req, res) => {
            const search = req.query.search || "";
            const page = parseInt(req.query.page) || 1;
            const size = parseInt(req.query.size) || 20;
            const permission = req.query.permission || "";
            const result = await this.service.list(req.user.businessId, search, page, size, permission);
            res.json(result);
        };
        this.get = async (req, res, next) => {
            const user = await this.service.getById(req.params.id, req.user.businessId);
            if (!user)
                return next({ statusCode: 404, message: "User not found" });
            res.json({ user });
        };
        this.create = async (req, res) => {
            const user = await this.service.create(req.user, req.body);
            await auditLog_service_1.AuditLogService.log("CREATE", "user", user.id, null, user, req);
            res.status(201).json({ user });
        };
        this.update = async (req, res, next) => {
            const beforeData = await this.service.getById(req.params.id, req.user.businessId);
            const user = await this.service.update(req.params.id, req.user, req.body);
            if (!user)
                return next({ statusCode: 404, message: "User not found" });
            await auditLog_service_1.AuditLogService.log("UPDATE", "user", req.params.id, beforeData, user, req);
            res.json({ user });
        };
        this.remove = async (req, res, next) => {
            const beforeData = await this.service.getById(req.params.id, req.user.businessId);
            const ok = await this.service.softDelete(req.params.id, req.user);
            if (!ok)
                return next({ statusCode: 404, message: "User not found" });
            await auditLog_service_1.AuditLogService.log("DELETE", "user", req.params.id, beforeData, null, req);
            res.json({ ok: true });
        };
        this.service = new user_service_1.UserService();
    }
}
exports.UserController = UserController;
