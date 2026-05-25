"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateUserSchema = exports.createUserSchema = void 0;
const joi_1 = __importDefault(require("joi"));
exports.createUserSchema = joi_1.default.object({
    businessId: joi_1.default.string().uuid().optional(),
    email: joi_1.default.string().email().max(320).required(),
    fullName: joi_1.default.string().min(2).max(200).required(),
    password: joi_1.default.string().min(8).max(72).required(),
    isActive: joi_1.default.boolean().optional(),
    isPlatformSuperAdmin: joi_1.default.boolean().optional()
});
exports.updateUserSchema = joi_1.default.object({
    email: joi_1.default.string().email().max(320).optional(),
    fullName: joi_1.default.string().min(2).max(200).optional(),
    password: joi_1.default.string().min(8).max(72).optional(),
    isActive: joi_1.default.boolean().optional(),
    isPlatformSuperAdmin: joi_1.default.boolean().optional()
}).min(1);
