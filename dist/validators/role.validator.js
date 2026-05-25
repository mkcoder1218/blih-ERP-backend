"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateRoleSchema = exports.createRoleSchema = void 0;
const joi_1 = __importDefault(require("joi"));
exports.createRoleSchema = joi_1.default.object({
    name: joi_1.default.string().min(2).max(120).required(),
    key: joi_1.default.string().min(2).max(120).regex(/^[A-Z0-9_]+$/).required(),
    description: joi_1.default.string().max(255).optional().allow(null, ""),
    permissionKeys: joi_1.default.array().items(joi_1.default.string().max(170)).default([])
});
exports.updateRoleSchema = joi_1.default.object({
    name: joi_1.default.string().min(2).max(120).optional(),
    key: joi_1.default.string().min(2).max(120).regex(/^[A-Z0-9_]+$/).optional(),
    description: joi_1.default.string().max(255).optional().allow(null, ""),
    permissionKeys: joi_1.default.array().items(joi_1.default.string().max(170)).optional()
}).min(1);
