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
    priceMonthly: joi_1.default.number().min(0).default(0),
    description: joi_1.default.string().allow(null, ''),
    basePrice: joi_1.default.number().min(0).required(),
    billingCycle: joi_1.default.string().valid('monthly', 'yearly').required(),
    includedSeats: joi_1.default.number().integer().min(0).required(),
    extraSeatPrice: joi_1.default.number().min(0).required(),
    currency: joi_1.default.string().length(3).default('ETB'),
    isActive: joi_1.default.boolean().default(true),
    sortOrder: joi_1.default.number().integer().default(0),
    userLimit: joi_1.default.number().allow(null).optional(),
    status: joi_1.default.string().valid('active', 'inactive').optional(),
    settings: joi_1.default.object().optional()
});
exports.updatePlanSchema = joi_1.default.object({
    name: joi_1.default.string().max(120).optional(),
    key: joi_1.default.string().max(50).optional(),
    priceMonthly: joi_1.default.number().min(0).optional(),
    description: joi_1.default.string().allow(null, ''),
    basePrice: joi_1.default.number().min(0),
    billingCycle: joi_1.default.string().valid('monthly', 'yearly'),
    includedSeats: joi_1.default.number().integer().min(0),
    extraSeatPrice: joi_1.default.number().min(0),
    currency: joi_1.default.string().length(3),
    isActive: joi_1.default.boolean(),
    sortOrder: joi_1.default.number().integer(),
    userLimit: joi_1.default.number().allow(null).optional(),
    status: joi_1.default.string().valid('active', 'inactive').optional(),
    settings: joi_1.default.object().optional()
}).min(1);
