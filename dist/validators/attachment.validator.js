"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.attachEntitySchema = void 0;
const joi_1 = __importDefault(require("joi"));
exports.attachEntitySchema = joi_1.default.object({
    fileAssetId: joi_1.default.string().uuid().required(),
    entityType: joi_1.default.string().max(120).required(),
    entityId: joi_1.default.string().max(120).required(),
    moduleKey: joi_1.default.string().max(120).required(),
    attachmentType: joi_1.default.string().max(100).allow(null, '').optional()
});
