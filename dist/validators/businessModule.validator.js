"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateBusinessModuleSchema = void 0;
const joi_1 = __importDefault(require("joi"));
exports.updateBusinessModuleSchema = joi_1.default.object({
    status: joi_1.default.string().valid('active', 'inactive').optional(),
    settings: joi_1.default.object().optional()
}).min(1);
