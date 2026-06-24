"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.selectWorkspaceSchema = exports.loginSchema = exports.publicRegisterSchema = exports.registerSchema = void 0;
const joi_1 = __importDefault(require("joi"));
exports.registerSchema = joi_1.default.object({
    businessId: joi_1.default.string().uuid().required(),
    fullName: joi_1.default.string().min(2).max(200).required(),
    email: joi_1.default.string().email().max(320).required(),
    password: joi_1.default.string().min(8).max(72).required(),
    phone: joi_1.default.string().max(50).allow(null, "").optional(),
    departmentId: joi_1.default.string().uuid().allow(null, "").optional(),
    positionId: joi_1.default.string().uuid().allow(null, "").optional(),
    address: joi_1.default.string().max(500).allow(null, "").optional()
});
// Public self-registration — uses slug instead of businessId
exports.publicRegisterSchema = joi_1.default.object({
    businessSlug: joi_1.default.string().min(2).max(100).required(),
    fullName: joi_1.default.string().min(2).max(200).required(),
    email: joi_1.default.string().email().max(320).required(),
    password: joi_1.default.string().min(8).max(72).required(),
    phone: joi_1.default.string().max(50).allow(null, '').optional(),
    dateOfBirth: joi_1.default.string().allow(null, '').optional(),
    nationalId: joi_1.default.string().max(100).allow(null, '').optional(),
    address: joi_1.default.string().max(500).allow(null, '').optional(),
    city: joi_1.default.string().max(100).allow(null, '').optional(),
    country: joi_1.default.string().max(100).allow(null, '').optional(),
    zipCode: joi_1.default.string().max(20).allow(null, '').optional(),
    gender: joi_1.default.string().max(20).allow(null, '').optional(),
    maritalStatus: joi_1.default.string().max(30).allow(null, '').optional(),
    nationality: joi_1.default.string().max(100).allow(null, '').optional(),
    requestedRoleKey: joi_1.default.string().max(50).allow(null, '').optional(),
    employmentType: joi_1.default.string().max(50).allow(null, '').optional(),
    internPaymentType: joi_1.default.string().valid('paid', 'unpaid').allow(null, '').optional(),
    hireDate: joi_1.default.string().allow(null, '').optional(),
    departmentId: joi_1.default.string().uuid().allow(null, '').optional(),
    positionId: joi_1.default.string().uuid().allow(null, '').optional(),
    emergencyName: joi_1.default.string().max(200).allow(null, '').optional(),
    emergencyPhone: joi_1.default.string().max(50).allow(null, '').optional(),
    emergencyRelationship: joi_1.default.string().max(100).allow(null, '').optional(),
    bankName: joi_1.default.string().max(200).allow(null, '').optional(),
    bankAccount: joi_1.default.string().max(100).allow(null, '').optional(),
    onboardingId: joi_1.default.string().guid({ version: ['uuidv4'] }).allow(null, '').optional(),
    resourceAcknowledgements: joi_1.default.string().allow(null, '').optional(),
    policyAcknowledgements: joi_1.default.string().allow(null, '').optional(),
});
exports.loginSchema = joi_1.default.object({
    email: joi_1.default.string().trim().lowercase().email({ tlds: { allow: false } }).max(320).required(),
    password: joi_1.default.string().trim().min(8).max(72).required()
});
exports.selectWorkspaceSchema = joi_1.default.object({
    businessId: joi_1.default.string().uuid().required(),
    email: joi_1.default.string().trim().lowercase().email({ tlds: { allow: false } }).max(320).required(),
    password: joi_1.default.string().trim().min(8).max(72).required()
});
