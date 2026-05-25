"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireActiveModule = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../config/env");
const models_1 = require("../models");
function parseBearer(req) {
    const header = req.headers.authorization;
    if (!header)
        return null;
    const [type, token] = header.split(" ");
    if (type !== "Bearer" || !token)
        return null;
    return token;
}
const requireActiveModule = (moduleKey) => {
    return async (req, _res, next) => {
        try {
            const token = parseBearer(req);
            if (!token)
                return next({ statusCode: 401, message: "Missing access token" });
            const decoded = jsonwebtoken_1.default.verify(token, env_1.env.jwtAccessSecret);
            const businessId = req.user?.businessId || decoded?.businessId;
            const roles = req.user?.roles || decoded?.roles || [];
            const isPlatformSuperAdmin = Boolean(req.user?.isPlatformSuperAdmin) ||
                Boolean(decoded?.isPlatformSuperAdmin) ||
                roles.includes("PLATFORM_SUPER_ADMIN");
            if (isPlatformSuperAdmin)
                return next();
            if (!businessId)
                return next({ statusCode: 401, message: "Invalid access token" });
            const bm = await models_1.db.BusinessModule.findOne({
                where: { businessId, moduleKey, status: "active" }
            });
            if (!bm)
                return next({ statusCode: 403, message: `Module '${moduleKey}' is not active` });
            next();
        }
        catch {
            next({ statusCode: 401, message: "Invalid or expired token" });
        }
    };
};
exports.requireActiveModule = requireActiveModule;
