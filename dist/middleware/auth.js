"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRequired = authRequired;
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
async function authRequired(req, res, next) {
    try {
        const token = parseBearer(req);
        if (!token)
            return next({ statusCode: 401, message: "Missing access token" });
        const payload = jsonwebtoken_1.default.verify(token, env_1.config.jwt.accessSecret);
        const user = await models_1.models.User.findByPk(payload.sub, {
            include: [
                {
                    model: models_1.models.Role,
                    through: { attributes: [] },
                    include: [{ model: models_1.models.Permission, through: { attributes: [] } }]
                }
            ]
        });
        if (!user || user.deletedAt)
            return next({ statusCode: 401, message: "Invalid user" });
        if (!user.isActive)
            return next({ statusCode: 403, message: "User is inactive" });
        const roles = (user.Roles || []).map((r) => r.name);
        const permissions = new Set();
        (user.Roles || []).forEach((r) => {
            (r.Permissions || []).forEach((p) => permissions.add(p.key));
        });
        req.user = {
            id: user.id,
            email: user.email,
            fullName: user.fullName,
            businessId: user.businessId,
            isPlatformSuperAdmin: Boolean(user.isPlatformSuperAdmin) || roles.includes("PLATFORM_SUPER_ADMIN"),
            roles,
            permissions: Array.from(permissions)
        };
        next();
    }
    catch {
        return next({ statusCode: 401, message: "Invalid or expired token" });
    }
}
