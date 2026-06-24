"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRequired = authRequired;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../config/env");
const models_1 = require("../models");
const employee_constants_1 = require("../constants/employee.constants");
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
        const decoded = jsonwebtoken_1.default.verify(token, env_1.env.jwtAccessSecret);
        const user = await models_1.db.User.findByPk(decoded.sub, {
            include: [
                {
                    model: models_1.db.Role,
                    through: { attributes: [] },
                    include: [{ model: models_1.db.Permission, through: { attributes: [] } }]
                }
            ]
        });
        if (!user)
            return next({ statusCode: 401, message: "Invalid user" });
        if (user.deletedAt)
            return next({ statusCode: 401, message: "User deleted" });
        if (user.status !== "active")
            return next({ statusCode: 403, message: "User is not active" });
        const employeeRecord = await models_1.db.EmployeeRecord.findOne({
            where: { businessId: user.businessId, userId: user.id },
            attributes: ["employmentStatus"],
        });
        if (employeeRecord?.employmentStatus === employee_constants_1.TERMINATED_EMPLOYMENT_STATUS) {
            return next({ statusCode: 403, message: "Employee has left the company" });
        }
        const roles = (user.Roles || []).map((r) => r.key);
        const permissions = new Set();
        (user.Roles || []).forEach((r) => {
            (r.Permissions || []).forEach((p) => permissions.add(p.key));
        });
        ["attendance.self", "profiles.self", "performance.self", "project.self", "project.task"].forEach((key) => permissions.add(key));
        req.user = {
            id: user.id,
            businessId: user.businessId,
            email: user.email,
            fullName: user.fullName,
            isPlatformSuperAdmin: Boolean(user.isPlatformSuperAdmin) || roles.includes("PLATFORM_SUPER_ADMIN"),
            roles,
            permissions: Array.from(permissions)
        };
        next();
    }
    catch {
        next({ statusCode: 401, message: "Invalid or expired token" });
    }
}
