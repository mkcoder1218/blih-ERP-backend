"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.viewSchema = exports.widgetSchema = void 0;
const joi_1 = __importDefault(require("joi"));
exports.widgetSchema = joi_1.default.object({
    moduleKey: joi_1.default.string().max(120).required(),
    title: joi_1.default.string().max(255).required(),
    key: joi_1.default.string().max(120).required(),
    widgetType: joi_1.default.string().valid('count', 'chart', 'table', 'list', 'progress', 'alert').required(),
    config: joi_1.default.object().optional(),
    position: joi_1.default.object().optional(),
    visibility: joi_1.default.string().valid('private', 'role', 'business').optional(),
    status: joi_1.default.string().valid('active', 'inactive').optional()
});
exports.viewSchema = joi_1.default.object({
    moduleKey: joi_1.default.string().max(120).required(),
    entityType: joi_1.default.string().max(120).required(),
    name: joi_1.default.string().max(255).required(),
    filters: joi_1.default.object().optional(),
    columns: joi_1.default.array().optional(),
    sort: joi_1.default.object().optional(),
    isDefault: joi_1.default.boolean().optional()
});
