"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateUserSchema = exports.createUserSchema = void 0;
const joi_1 = __importDefault(require("joi"));
exports.createUserSchema = joi_1.default.object({
    businessId: joi_1.default.string().uuid().optional(),
    fullName: joi_1.default.string().min(2).max(200).required(),
    email: joi_1.default.string().email().max(320).required(),
    password: joi_1.default.string().min(8).max(72).required(),
    phone: joi_1.default.string().max(50).optional().allow(null, ""),
    status: joi_1.default.string().valid("active", "inactive").optional(),
    isPlatformSuperAdmin: joi_1.default.boolean().optional(),
    roleKeys: joi_1.default.array().items(joi_1.default.string().max(120)).default([])
});
exports.updateUserSchema = joi_1.default.object({
    fullName: joi_1.default.string().min(2).max(200).optional(),
    email: joi_1.default.string().email().max(320).optional(),
    password: joi_1.default.string().min(8).max(72).optional(),
    phone: joi_1.default.string().max(50).optional().allow(null, ""),
    status: joi_1.default.string().valid("active", "inactive").optional(),
    isPlatformSuperAdmin: joi_1.default.boolean().optional(),
    roleKeys: joi_1.default.array().items(joi_1.default.string().max(120)).optional()
}).min(1);
