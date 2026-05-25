"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updatePlanSchema = exports.createPlanSchema = void 0;
const joi_1 = __importDefault(require("joi"));
exports.createPlanSchema = joi_1.default.object({
    name: joi_1.default.string().max(120).required(),
    key: joi_1.default.string().max(50).required(),
    priceMonthly: joi_1.default.number().min(0).required(),
    userLimit: joi_1.default.number().allow(null).optional(),
    status: joi_1.default.string().valid('active', 'inactive').optional(),
    settings: joi_1.default.object().optional()
});
exports.updatePlanSchema = joi_1.default.object({
    name: joi_1.default.string().max(120).optional(),
    key: joi_1.default.string().max(50).optional(),
    priceMonthly: joi_1.default.number().min(0).optional(),
    userLimit: joi_1.default.number().allow(null).optional(),
    status: joi_1.default.string().valid('active', 'inactive').optional(),
    settings: joi_1.default.object().optional()
}).min(1);
