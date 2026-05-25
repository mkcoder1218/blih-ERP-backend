"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateDepartmentSchema = exports.createDepartmentSchema = void 0;
const joi_1 = __importDefault(require("joi"));
exports.createDepartmentSchema = joi_1.default.object({
    name: joi_1.default.string().max(120).required(),
    key: joi_1.default.string().max(120).required(),
    description: joi_1.default.string().allow(null, '').optional(),
    status: joi_1.default.string().valid('active', 'inactive').optional(),
    parentDepartmentId: joi_1.default.string().uuid().allow(null).optional()
});
exports.updateDepartmentSchema = joi_1.default.object({
    name: joi_1.default.string().max(120).optional(),
    key: joi_1.default.string().max(120).optional(),
    description: joi_1.default.string().allow(null, '').optional(),
    status: joi_1.default.string().valid('active', 'inactive').optional(),
    parentDepartmentId: joi_1.default.string().uuid().allow(null).optional()
}).min(1);
