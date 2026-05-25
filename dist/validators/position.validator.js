"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updatePositionSchema = exports.createPositionSchema = void 0;
const joi_1 = __importDefault(require("joi"));
exports.createPositionSchema = joi_1.default.object({
    departmentId: joi_1.default.string().uuid().required(),
    title: joi_1.default.string().max(120).required(),
    key: joi_1.default.string().max(120).required(),
    level: joi_1.default.number().min(1).optional(),
    description: joi_1.default.string().allow(null, '').optional(),
    status: joi_1.default.string().valid('active', 'inactive').optional()
});
exports.updatePositionSchema = joi_1.default.object({
    departmentId: joi_1.default.string().uuid().optional(),
    title: joi_1.default.string().max(120).optional(),
    key: joi_1.default.string().max(120).optional(),
    level: joi_1.default.number().min(1).optional(),
    description: joi_1.default.string().allow(null, '').optional(),
    status: joi_1.default.string().valid('active', 'inactive').optional()
}).min(1);
