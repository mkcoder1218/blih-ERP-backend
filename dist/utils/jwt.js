"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.signAccessToken = signAccessToken;
exports.signRefreshToken = signRefreshToken;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../config/env");
function signAccessToken(user) {
    const payload = {
        businessId: user.businessId,
        isPlatformSuperAdmin: Boolean(user.isPlatformSuperAdmin)
    };
    return jsonwebtoken_1.default.sign(payload, env_1.env.jwtAccessSecret, {
        subject: user.id,
        expiresIn: env_1.env.jwtAccessExpiresIn
    });
}
function signRefreshToken(user) {
    const payload = {
        businessId: user.businessId,
        isPlatformSuperAdmin: Boolean(user.isPlatformSuperAdmin),
        type: "refresh"
    };
    return jsonwebtoken_1.default.sign(payload, env_1.env.jwtRefreshSecret, {
        subject: user.id,
        expiresIn: env_1.env.jwtRefreshExpiresIn
    });
}
