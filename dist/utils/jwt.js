"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.signAccessToken = signAccessToken;
exports.signRefreshToken = signRefreshToken;
exports.signDownloadToken = signDownloadToken;
exports.verifyDownloadToken = verifyDownloadToken;
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
/** Sign a short-lived (60s) download token scoped to a specific file asset. */
function signDownloadToken(userId, businessId, fileId) {
    return jsonwebtoken_1.default.sign({ type: "download", fileId, businessId }, env_1.env.jwtAccessSecret, { subject: userId, expiresIn: "60s" });
}
/** Verify a download token. Returns the payload or throws. */
function verifyDownloadToken(token) {
    const decoded = jsonwebtoken_1.default.verify(token, env_1.env.jwtAccessSecret);
    if (decoded?.type !== "download")
        throw new Error("Invalid download token");
    return { fileId: decoded.fileId, businessId: decoded.businessId, sub: decoded.sub };
}
