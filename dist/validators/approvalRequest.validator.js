"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.actRequestSchema = exports.submitRequestSchema = void 0;
const joi_1 = __importDefault(require("joi"));
exports.submitRequestSchema = joi_1.default.object({
    workflowId: joi_1.default.string().uuid().required(),
    entityType: joi_1.default.string().max(120).required(),
    entityId: joi_1.default.string().max(120).required(),
    submittedData: joi_1.default.object().optional()
});
exports.actRequestSchema = joi_1.default.object({
    action: joi_1.default.string().valid('approve', 'reject', 'return', 'cancel').required(),
    comment: joi_1.default.string().allow(null, '').optional(),
    actionData: joi_1.default.object().optional()
});
