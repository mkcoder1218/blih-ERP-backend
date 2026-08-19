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
Object.defineProperty(exports, "__esModule", { value: true });
exports.BusinessModuleController = void 0;
const businessModule_service_1 = require("./businessModule.service");
const auditLog_service_1 = require("../../services/auditLog.service");
class BusinessModuleController {
    constructor() {
        this.service = new businessModule_service_1.BusinessModuleService();
        this.list = async (req, res) => {
            // If PLATFORM_SUPER_ADMIN and passed ?businessId=..., use that. Else use req.user.businessId.
            let businessId = req.user.businessId;
            if (req.user.isPlatformSuperAdmin && req.query.businessId)
                businessId = req.query.businessId;
            res.json({ modules: await this.service.list(businessId) });
        };
        this.get = async (req, res, next) => {
            let businessId = req.user.businessId;
            if (req.user.isPlatformSuperAdmin && req.query.businessId)
                businessId = req.query.businessId;
            const mod = await this.service.getById(req.params.id, businessId);
            if (!mod)
                return next({ statusCode: 404, message: 'Not found' });
            res.json({ module: mod });
        };
        this.update = async (req, res, next) => {
            // Only PLATFORM_SUPER_ADMIN can update. Business Admin cannot update status directly via this API.
            let businessId = req.user.businessId;
            if (req.user.isPlatformSuperAdmin && req.body.businessId)
                businessId = req.body.businessId;
            // Safety: ensure it genuinely belongs to that business
            const beforeData = await this.service.getById(req.params.id, businessId);
            if (!beforeData)
                return next({ statusCode: 404, message: 'Not found' });
            const mod = await this.service.update(req.params.id, businessId, req.body);
            await auditLog_service_1.AuditLogService.log('UPDATE', 'businessModule', mod.id, beforeData, mod, req);
            res.json({ module: mod });
        };
        this.toggleModule = async (req, res) => {
            const { businessId, moduleKey, moduleName, status } = req.body;
            if (!businessId || !moduleKey) {
                return res.status(400).json({ message: "businessId and moduleKey are required" });
            }
            const { db } = await Promise.resolve().then(() => __importStar(require('../../models')));
            const [mod] = await db.BusinessModule.findOrCreate({
                where: { businessId, moduleKey },
                defaults: {
                    businessId,
                    moduleKey,
                    moduleName: moduleName || moduleKey.toUpperCase(),
                    status: status || 'active',
                    enabledAt: new Date()
                }
            });
            if (status && mod.status !== status) {
                await mod.update({ status, enabledAt: status === 'active' ? new Date() : mod.enabledAt });
            }
            res.json({ module: mod });
        };
    }
}
exports.BusinessModuleController = BusinessModuleController;
