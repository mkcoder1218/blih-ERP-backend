"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedPlatformSuperAdminFromEnv = seedPlatformSuperAdminFromEnv;
const bcrypt_1 = __importDefault(require("bcrypt"));
const env_1 = require("../config/env");
const models_1 = require("../models");
async function ensurePlatformBusiness() {
    const [plan] = await models_1.db.Plan.findOrCreate({
        where: { key: "free" },
        defaults: { key: "free", name: "Free", priceMonthly: 0, userLimit: 5, status: "active" }
    });
    const [business] = await models_1.db.Business.findOrCreate({
        where: { slug: "platform" },
        defaults: {
            name: "Platform",
            slug: "platform",
            email: env_1.env.platformAdmin?.email || "platform@example.com",
            phone: "+0000000000",
            status: "active",
            planId: plan.id
        }
    });
    return business;
}
async function seedPlatformSuperAdminFromEnv() {
    const name = env_1.env.platformAdmin?.name;
    const email = env_1.env.platformAdmin?.email;
    const password = env_1.env.platformAdmin?.password;
    // If any are missing, do nothing (non-fatal).
    if (!name || !email || !password)
        return;
    const platformBusiness = await ensurePlatformBusiness();
    const existing = await models_1.db.User.findOne({ where: { businessId: platformBusiness.id, email } });
    if (existing)
        return;
    const hashed = await bcrypt_1.default.hash(password, env_1.env.bcryptSaltRounds);
    const user = await models_1.db.User.create({
        businessId: platformBusiness.id,
        fullName: name,
        email,
        password: hashed,
        phone: null,
        status: "active",
        isPlatformSuperAdmin: true
    });
    const platformRole = await models_1.db.Role.findOne({ where: { businessId: null, key: "PLATFORM_SUPER_ADMIN" } });
    if (platformRole)
        await user.setRoles([platformRole]);
}
