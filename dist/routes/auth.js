"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const validate_1 = require("../middleware/validate");
const auth_1 = require("../validators/auth");
const models_1 = require("../models");
const env_1 = require("../config/env");
const router = (0, express_1.Router)();
function signAccessToken(user) {
    const options = {
        subject: String(user.id),
        expiresIn: env_1.config.jwt.accessExpiresIn
    };
    return jsonwebtoken_1.default.sign({ businessId: user.businessId }, env_1.config.jwt.accessSecret, options);
}
router.post("/register", (0, validate_1.validate)(auth_1.registerSchema), async (req, res, next) => {
    try {
        const { businessId, email, fullName, password } = req.body;
        const business = await models_1.models.Business.findByPk(businessId);
        if (!business || business.deletedAt)
            return next({ statusCode: 404, message: "Business not found" });
        if (!business.isActive)
            return next({ statusCode: 403, message: "Business is inactive" });
        const existing = await models_1.models.User.findOne({ where: { businessId, email } });
        if (existing && !existing.deletedAt)
            return next({ statusCode: 409, message: "Email already exists" });
        const passwordHash = await bcrypt_1.default.hash(password, env_1.config.bcrypt.saltRounds);
        const user = await models_1.models.User.create({
            businessId,
            email,
            fullName,
            passwordHash,
            isActive: true,
            isPlatformSuperAdmin: false
        });
        const token = signAccessToken(user);
        res.status(201).json({
            user: { id: user.id, businessId: user.businessId, email: user.email, fullName: user.fullName },
            accessToken: token
        });
    }
    catch (err) {
        next(err);
    }
});
router.post("/login", (0, validate_1.validate)(auth_1.loginSchema), async (req, res, next) => {
    try {
        const { businessId, email, password } = req.body;
        const user = await models_1.models.User.findOne({ where: { businessId, email } });
        if (!user || user.deletedAt)
            return next({ statusCode: 401, message: "Invalid credentials" });
        if (!user.isActive)
            return next({ statusCode: 403, message: "User is inactive" });
        const ok = await bcrypt_1.default.compare(password, user.passwordHash);
        if (!ok)
            return next({ statusCode: 401, message: "Invalid credentials" });
        const token = signAccessToken(user);
        res.json({
            user: { id: user.id, businessId: user.businessId, email: user.email, fullName: user.fullName },
            accessToken: token
        });
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
