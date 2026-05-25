"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateBusinessSchema = exports.createBusinessSchema = void 0;
const joi_1 = __importDefault(require("joi"));
exports.createBusinessSchema = joi_1.default.object({
    name: joi_1.default.string().min(2).max(200).required(),
    slug: joi_1.default.string().min(2).max(120).regex(/^[a-z0-9-]+$/).required(),
    email: joi_1.default.string().email().max(320).required(),
    phone: joi_1.default.string().max(50).required(),
    status: joi_1.default.string().valid("active", "inactive").optional(),
    planId: joi_1.default.string().uuid().required(),
    settings: joi_1.default.object().optional()
});
exports.updateBusinessSchema = joi_1.default.object({
    name: joi_1.default.string().min(2).max(200).optional(),
    slug: joi_1.default.string().min(2).max(120).regex(/^[a-z0-9-]+$/).optional(),
    email: joi_1.default.string().email().max(320).optional().allow(null, ""),
    phone: joi_1.default.string().max(50).optional().allow(null, ""),
    status: joi_1.default.string().valid("active", "inactive").optional(),
    planId: joi_1.default.string().uuid().optional(),
    settings: joi_1.default.object().optional()
}).min(1);
