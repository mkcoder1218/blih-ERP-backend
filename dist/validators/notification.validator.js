"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.preferenceUpdateSchema = exports.bulkNotificationSchema = void 0;
const joi_1 = __importDefault(require("joi"));
exports.bulkNotificationSchema = joi_1.default.object({
    recipientUserIds: joi_1.default.array().items(joi_1.default.string().uuid()).min(1).required(),
    moduleKey: joi_1.default.string().max(120).required(),
    type: joi_1.default.string().max(120).required(),
    title: joi_1.default.string().max(255).required(),
    message: joi_1.default.string().required(),
    entityType: joi_1.default.string().max(120).allow(null, '').optional(),
    entityId: joi_1.default.string().max(120).allow(null, '').optional(),
    priority: joi_1.default.string().valid('low', 'normal', 'high', 'urgent').optional()
});
exports.preferenceUpdateSchema = joi_1.default.object({
    channel: joi_1.default.string().valid('in_app', 'email', 'sms').required(),
    moduleKey: joi_1.default.string().max(120).allow(null, '').optional(),
    type: joi_1.default.string().max(120).allow(null, '').optional(),
    isEnabled: joi_1.default.boolean().required(),
    settings: joi_1.default.object().optional()
});
