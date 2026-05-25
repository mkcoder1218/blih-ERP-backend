"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createStepSchema = exports.createWorkflowSchema = void 0;
const joi_1 = __importDefault(require("joi"));
exports.createWorkflowSchema = joi_1.default.object({
    name: joi_1.default.string().max(200).required(),
    key: joi_1.default.string().max(120).required(),
    moduleKey: joi_1.default.string().max(120).required(),
    entityType: joi_1.default.string().max(120).required(),
    description: joi_1.default.string().allow(null, '').optional(),
    status: joi_1.default.string().valid('active', 'inactive').optional(),
    settings: joi_1.default.object().optional()
});
exports.createStepSchema = joi_1.default.object({
    workflowId: joi_1.default.string().uuid().required(),
    stepOrder: joi_1.default.number().required(),
    approverType: joi_1.default.string().valid('user', 'role', 'department').required(),
    approverRoleId: joi_1.default.string().uuid().allow(null).optional(),
    approverUserId: joi_1.default.string().uuid().allow(null).optional(),
    approverDepartmentId: joi_1.default.string().uuid().allow(null).optional(),
    actionRequired: joi_1.default.string().valid('any', 'all').optional(),
    isFinalStep: joi_1.default.boolean().optional(),
    settings: joi_1.default.object().optional()
});
