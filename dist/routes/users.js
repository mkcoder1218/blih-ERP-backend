"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcrypt_1 = __importDefault(require("bcrypt"));
const auth_1 = require("../middleware/auth");
const validate_1 = require("../middleware/validate");
const tenant_1 = require("../middleware/tenant");
const user_1 = require("../validators/user");
const models_1 = require("../models");
const env_1 = require("../config/env");
const router = (0, express_1.Router)();
router.use(auth_1.authRequired);
router.get("/", async (req, res, next) => {
    try {
        const where = { deletedAt: null, ...(0, tenant_1.tenantWhere)(req) };
        const users = await models_1.models.User.findAll({ where, attributes: { exclude: ["passwordHash"] } });
        res.json({ users });
    }
    catch (err) {
        next(err);
    }
});
router.get("/:id", async (req, res, next) => {
    try {
        const user = await models_1.models.User.findByPk(req.params.id, { attributes: { exclude: ["passwordHash"] } });
        if (!user || user.deletedAt)
            return next({ statusCode: 404, message: "User not found" });
        if (!req.user?.isPlatformSuperAdmin && user.businessId !== req.user?.businessId) {
            return next({ statusCode: 403, message: "Forbidden (tenant)" });
        }
        res.json({ user });
    }
    catch (err) {
        next(err);
    }
});
router.post("/", (0, validate_1.validate)(user_1.createUserSchema), (0, tenant_1.enforceTenantParam)("businessId"), async (req, res, next) => {
    try {
        const body = req.body;
        const businessId = req.user?.isPlatformSuperAdmin ? (body.businessId || req.user?.businessId) : req.user?.businessId;
        if (!businessId)
            return next({ statusCode: 400, message: "businessId is required" });
        const business = await models_1.models.Business.findByPk(businessId);
        if (!business || business.deletedAt)
            return next({ statusCode: 404, message: "Business not found" });
        const existing = await models_1.models.User.findOne({ where: { businessId, email: body.email } });
        if (existing && !existing.deletedAt)
            return next({ statusCode: 409, message: "Email already exists" });
        const passwordHash = await bcrypt_1.default.hash(body.password, env_1.config.bcrypt.saltRounds);
        const user = await models_1.models.User.create({
            businessId,
            email: body.email,
            fullName: body.fullName,
            passwordHash,
            isActive: body.isActive !== undefined ? body.isActive : true,
            isPlatformSuperAdmin: req.user?.isPlatformSuperAdmin ? Boolean(body.isPlatformSuperAdmin) : false,
            deletedAt: null
        });
        res.status(201).json({
            user: {
                id: user.id,
                businessId: user.businessId,
                email: user.email,
                fullName: user.fullName,
                isActive: user.isActive,
                isPlatformSuperAdmin: user.isPlatformSuperAdmin
            }
        });
    }
    catch (err) {
        next(err);
    }
});
router.patch("/:id", (0, validate_1.validate)(user_1.updateUserSchema), async (req, res, next) => {
    try {
        const user = await models_1.models.User.findByPk(req.params.id);
        if (!user || user.deletedAt)
            return next({ statusCode: 404, message: "User not found" });
        if (!req.user?.isPlatformSuperAdmin && user.businessId !== req.user?.businessId) {
            return next({ statusCode: 403, message: "Forbidden (tenant)" });
        }
        const update = { ...req.body };
        if (update.password) {
            update.passwordHash = await bcrypt_1.default.hash(update.password, env_1.config.bcrypt.saltRounds);
            delete update.password;
        }
        if (!req.user?.isPlatformSuperAdmin)
            delete update.isPlatformSuperAdmin;
        await user.update(update);
        res.json({
            user: {
                id: user.id,
                businessId: user.businessId,
                email: user.email,
                fullName: user.fullName,
                isActive: user.isActive,
                isPlatformSuperAdmin: user.isPlatformSuperAdmin
            }
        });
    }
    catch (err) {
        next(err);
    }
});
router.delete("/:id", async (req, res, next) => {
    try {
        const user = await models_1.models.User.findByPk(req.params.id);
        if (!user || user.deletedAt)
            return next({ statusCode: 404, message: "User not found" });
        if (!req.user?.isPlatformSuperAdmin && user.businessId !== req.user?.businessId) {
            return next({ statusCode: 403, message: "Forbidden (tenant)" });
        }
        await user.update({ deletedAt: new Date(), isActive: false });
        res.json({ ok: true });
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
