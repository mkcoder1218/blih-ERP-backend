"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createFormFieldSchema = exports.createFormDefSchema = void 0;
const joi_1 = __importDefault(require("joi"));
exports.createFormDefSchema = joi_1.default.object({
    name: joi_1.default.string().max(200).required(),
    key: joi_1.default.string().max(120).required(),
    moduleKey: joi_1.default.string().max(120).required(),
    description: joi_1.default.string().allow(null, '').optional(),
    status: joi_1.default.string().valid('active', 'inactive', 'archived').optional(),
    requiresApproval: joi_1.default.boolean().optional(),
    approvalWorkflowId: joi_1.default.string().uuid().allow(null).optional(),
    settings: joi_1.default.object().optional()
});
exports.createFormFieldSchema = joi_1.default.object({
    formDefinitionId: joi_1.default.string().uuid().required(),
    label: joi_1.default.string().max(200).required(),
    key: joi_1.default.string().max(120).required(),
    type: joi_1.default.string().max(50).required(),
    required: joi_1.default.boolean().optional(),
    options: joi_1.default.array().allow(null).optional(),
    validationRules: joi_1.default.object().optional(),
    orderIndex: joi_1.default.number().optional(),
    visibilityRules: joi_1.default.object().optional(),
    settings: joi_1.default.object().optional()
});
