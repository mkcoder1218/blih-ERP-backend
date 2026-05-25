"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateProfileSchema = exports.createProfileSchema = void 0;
const joi_1 = __importDefault(require("joi"));
exports.createProfileSchema = joi_1.default.object({
    userId: joi_1.default.string().uuid().required(),
    departmentId: joi_1.default.string().uuid().allow(null).optional(),
    positionId: joi_1.default.string().uuid().allow(null).optional(),
    employeeCode: joi_1.default.string().max(100).allow(null, '').optional(),
    workEmail: joi_1.default.string().email().max(320).allow(null, '').optional(),
    workPhone: joi_1.default.string().max(50).allow(null, '').optional(),
    employmentType: joi_1.default.string().max(50).allow(null, '').optional(),
    joinedAt: joi_1.default.date().iso().allow(null).optional(),
    status: joi_1.default.string().valid('active', 'inactive').optional(),
    settings: joi_1.default.object().optional()
});
exports.updateProfileSchema = joi_1.default.object({
    departmentId: joi_1.default.string().uuid().allow(null).optional(),
    positionId: joi_1.default.string().uuid().allow(null).optional(),
    employeeCode: joi_1.default.string().max(100).allow(null, '').optional(),
    workEmail: joi_1.default.string().email().max(320).allow(null, '').optional(),
    workPhone: joi_1.default.string().max(50).allow(null, '').optional(),
    employmentType: joi_1.default.string().max(50).allow(null, '').optional(),
    joinedAt: joi_1.default.date().iso().allow(null).optional(),
    status: joi_1.default.string().valid('active', 'inactive').optional(),
    settings: joi_1.default.object().optional()
}).min(1);
