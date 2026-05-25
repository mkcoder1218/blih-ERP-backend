"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BusinessAdminController = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const env_1 = require("../../config/env");
const models_1 = require("../../models");
const apiResponse_1 = require("../../utils/apiResponse");
class BusinessAdminController {
    constructor() {
        this.createBusinessAdmin = async (req, res, next) => {
            const { businessId } = req.params;
            const { fullName, email, phone, password } = req.body;
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
            const businessAdminRole = (await models_1.db.Role.findOne({ where: { businessId, key: "BUSINESS_ADMIN" } })) ||
                (await models_1.db.Role.findOne({ where: { businessId: null, key: "BUSINESS_ADMIN" } }));
            if (businessAdminRole) {
                await user.setRoles([businessAdminRole]);
            }
            return (0, apiResponse_1.ok)(res, { user: { id: user.id, businessId: user.businessId, fullName: user.fullName, email: user.email, phone: user.phone, status: user.status } }, "Business admin created", 201);
        };
    }
}
exports.BusinessAdminController = BusinessAdminController;
