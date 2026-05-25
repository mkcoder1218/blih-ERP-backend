"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createBusinessAdminSchema = void 0;
const joi_1 = __importDefault(require("joi"));
exports.createBusinessAdminSchema = joi_1.default.object({
    fullName: joi_1.default.string().min(2).max(200).required(),
    email: joi_1.default.string().email().max(320).required(),
    phone: joi_1.default.string().max(50).optional().allow(null, ""),
    password: joi_1.default.string().min(8).max(128).required()
});
