"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateBusinessSchema = exports.createBusinessSchema = void 0;
const joi_1 = __importDefault(require("joi"));
exports.createBusinessSchema = joi_1.default.object({
    name: joi_1.default.string().min(2).max(200).required(),
    code: joi_1.default.string().min(2).max(50).regex(/^[A-Za-z0-9_-]+$/).required()
});
exports.updateBusinessSchema = joi_1.default.object({
    name: joi_1.default.string().min(2).max(200).optional(),
    code: joi_1.default.string().min(2).max(50).regex(/^[A-Za-z0-9_-]+$/).optional(),
    isActive: joi_1.default.boolean().optional()
}).min(1);
