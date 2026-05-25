"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.submitDataSchema = void 0;
const joi_1 = __importDefault(require("joi"));
exports.submitDataSchema = joi_1.default.object({
    formDefinitionId: joi_1.default.string().uuid().required(),
    entityType: joi_1.default.string().max(120).allow(null, '').optional(),
    entityId: joi_1.default.string().max(120).allow(null, '').optional(),
    data: joi_1.default.object().required(),
    status: joi_1.default.string().valid('draft', 'submitted').required()
});
