"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const env_1 = require("../../config/env");
const models_1 = require("../../models");
const jwt_1 = require("../../utils/jwt");
const apiResponse_1 = require("../../utils/apiResponse");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
class AuthController {
    constructor() {
        this.register = async (req, res, next) => {
            const { businessId, fullName, email, password, phone } = req.body;
            const business = await models_1.db.Business.findByPk(businessId);
            if (!business)
                return next({ statusCode: 404, message: "Business not found" });
            const existing = await models_1.db.User.findOne({ where: { businessId, email } });
            if (existing)
                return next({ statusCode: 409, message: "Email already exists" });
            const hashed = await bcrypt_1.default.hash(password, env_1.env.bcryptSaltRounds);
            const user = await models_1.db.User.create({
                businessId,
                fullName,
                email,
                password: hashed,
                phone: phone || null,
                status: "active",
                isPlatformSuperAdmin: false
            });
            const count = await models_1.db.User.count({ where: { businessId } });
            const businessAdminRole = await models_1.db.Role.findOne({ where: { businessId: null, key: "BUSINESS_ADMIN" } });
            if (businessAdminRole && count === 1) {
                await user.setRoles([businessAdminRole]);
            }
            const token = (0, jwt_1.signAccessToken)(user);
            const refreshToken = (0, jwt_1.signRefreshToken)(user);
            return (0, apiResponse_1.ok)(res, {
                user: { id: user.id, businessId: user.businessId, fullName: user.fullName, email: user.email },
                accessToken: token,
                refreshToken
            }, "Registered", 201);
        };
        this.login = async (req, res, next) => {
            const { email, password } = req.body;
            const matches = await models_1.db.User.findAll({
                where: { email },
                include: [{ model: models_1.db.Business, attributes: ["id", "name", "slug", "status"] }]
            });
            if (!matches.length)
                return next({ statusCode: 401, message: "Invalid credentials" });
            // If there's a platform super admin user for this email, allow login without workspace selection.
            const platformCandidate = matches.find((u) => Boolean(u.isPlatformSuperAdmin));
            if (platformCandidate) {
                return this.finishLoginForUser(platformCandidate, password, res, next);
            }
            if (matches.length > 1) {
                // Validate password against any one active user; if none match, reject.
                let anyValid = false;
                for (const u of matches) {
                    if (u.deletedAt || u.status !== "active")
                        continue;
                    // eslint-disable-next-line no-await-in-loop
                    if (await bcrypt_1.default.compare(password, u.password)) {
                        anyValid = true;
                        break;
                    }
                }
                if (!anyValid)
                    return next({ statusCode: 401, message: "Invalid credentials" });
                const businesses = matches
                    .map((u) => u.Business)
                    .filter(Boolean)
                    .map((b) => ({ id: b.id, name: b.name, slug: b.slug, status: b.status }));
                return (0, apiResponse_1.ok)(res, { requiresWorkspaceSelection: true, businesses }, "Select workspace");
            }
            return this.finishLoginForUser(matches[0], password, res, next);
        };
        this.selectWorkspace = async (req, res, next) => {
            const { businessId, email, password } = req.body;
            const user = await models_1.db.User.findOne({ where: { businessId, email } });
            if (!user)
                return next({ statusCode: 401, message: "Invalid credentials" });
            return this.finishLoginForUser(user, password, res, next);
        };
        this.finishLoginForUser = async (user, password, res, next) => {
            if (user.deletedAt)
                return next({ statusCode: 403, message: "User is deleted" });
            if (user.status !== "active")
                return next({ statusCode: 403, message: "User is not active" });
            const okPass = await bcrypt_1.default.compare(password, user.password);
            if (!okPass)
                return next({ statusCode: 401, message: "Invalid credentials" });
            await user.update({ lastLoginAt: new Date() });
            const token = (0, jwt_1.signAccessToken)(user);
            const refreshToken = (0, jwt_1.signRefreshToken)(user);
            // Build same payload shape as /me
            const fullUser = await models_1.db.User.findByPk(user.id, {
                attributes: ["id", "businessId", "fullName", "email", "phone", "status", "isPlatformSuperAdmin", "lastLoginAt", "createdAt", "updatedAt"],
                include: [
                    { model: models_1.db.Business, attributes: ["id", "name", "slug", "email", "phone", "status", "planId", "createdAt", "updatedAt"] },
                    {
                        model: models_1.db.Role,
                        through: { attributes: [] },
                        include: [{ model: models_1.db.Permission, through: { attributes: [] } }]
                    }
                ]
            });
            const enabledModules = await models_1.db.BusinessModule.findAll({
                where: { businessId: user.businessId, status: "active" },
                attributes: ["moduleKey", "moduleName", "status", "enabledAt"]
            });
            const roles = (fullUser.Roles || []).map((r) => r.key);
            const permissionsSet = new Set();
            (fullUser.Roles || []).forEach((r) => (r.Permissions || []).forEach((p) => permissionsSet.add(p.key)));
            return (0, apiResponse_1.ok)(res, {
                accessToken: token,
                refreshToken,
                user: {
                    id: fullUser.id,
                    businessId: fullUser.businessId,
                    fullName: fullUser.fullName,
                    email: fullUser.email,
                    phone: fullUser.phone,
                    status: fullUser.status,
                    isPlatformSuperAdmin: Boolean(fullUser.isPlatformSuperAdmin) || roles.includes("PLATFORM_SUPER_ADMIN"),
                    lastLoginAt: fullUser.lastLoginAt
                },
                business: fullUser.Business || null,
                roles,
                permissions: Array.from(permissionsSet),
                enabledModules
            }, "Logged in");
        };
        this.me = async (req, res, next) => {
            if (!req.user?.id)
                return next({ statusCode: 401, message: "Unauthorized" });
            const user = await models_1.db.User.findByPk(req.user.id, {
                attributes: ["id", "businessId", "fullName", "email", "phone", "status", "isPlatformSuperAdmin", "lastLoginAt", "createdAt", "updatedAt"],
                include: [
                    { model: models_1.db.Business, attributes: ["id", "name", "slug", "email", "phone", "status", "planId", "createdAt", "updatedAt"] },
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
                return next({ statusCode: 403, message: "User is deleted" });
            if (user.status !== "active")
                return next({ statusCode: 403, message: "User is not active" });
            const enabledModules = await models_1.db.BusinessModule.findAll({
                where: { businessId: user.businessId, status: "active" },
                attributes: ["moduleKey", "moduleName", "status", "enabledAt"]
            });
            const roles = (user.Roles || []).map((r) => r.key);
            const permissionsSet = new Set();
            (user.Roles || []).forEach((r) => (r.Permissions || []).forEach((p) => permissionsSet.add(p.key)));
            return (0, apiResponse_1.ok)(res, {
                user: {
                    id: user.id,
                    businessId: user.businessId,
                    fullName: user.fullName,
                    email: user.email,
                    phone: user.phone,
                    status: user.status,
                    isPlatformSuperAdmin: Boolean(user.isPlatformSuperAdmin) || roles.includes("PLATFORM_SUPER_ADMIN"),
                    lastLoginAt: user.lastLoginAt
                },
                business: user.Business || null,
                roles,
                permissions: Array.from(permissionsSet),
                enabledModules
            });
        };
        this.logout = async (_req, res) => {
            // Stateless JWT: frontend should drop token.
            return (0, apiResponse_1.ok)(res, { ok: true }, "Logged out");
        };
        this.refresh = async (req, res, next) => {
            const { refreshToken } = req.body || {};
            if (!refreshToken)
                return next({ statusCode: 400, message: "Missing refreshToken" });
            try {
                const decoded = jsonwebtoken_1.default.verify(refreshToken, env_1.env.jwtRefreshSecret);
                if (decoded?.type !== "refresh")
                    return next({ statusCode: 401, message: "Invalid refresh token" });
                const userId = decoded.sub;
                const user = await models_1.db.User.findByPk(userId);
                if (!user)
                    return next({ statusCode: 401, message: "Invalid refresh token" });
                if (user.deletedAt)
                    return next({ statusCode: 403, message: "User is deleted" });
                if (user.status !== "active")
                    return next({ statusCode: 403, message: "User is not active" });
                const accessToken = (0, jwt_1.signAccessToken)(user);
                const newRefreshToken = (0, jwt_1.signRefreshToken)(user);
                return (0, apiResponse_1.ok)(res, { accessToken, refreshToken: newRefreshToken }, "Refreshed");
            }
            catch {
                return next({ statusCode: 401, message: "Invalid refresh token" });
            }
        };
    }
}
exports.AuthController = AuthController;
