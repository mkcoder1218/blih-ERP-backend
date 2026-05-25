"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loginSchema = exports.registerSchema = void 0;
const joi_1 = __importDefault(require("joi"));
exports.registerSchema = joi_1.default.object({
    businessId: joi_1.default.string().uuid().required(),
    email: joi_1.default.string().email().max(320).required(),
    fullName: joi_1.default.string().min(2).max(200).required(),
    password: joi_1.default.string().min(8).max(72).required()
});
exports.loginSchema = joi_1.default.object({
    businessId: joi_1.default.string().uuid().required(),
    email: joi_1.default.string().email().max(320).required(),
    password: joi_1.default.string().min(8).max(72).required()
});
