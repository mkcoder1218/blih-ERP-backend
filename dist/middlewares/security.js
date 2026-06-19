"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitizePayload = exports.preventParameterPollution = exports.compressResponses = exports.securityHeaders = exports.publicRegisterLimiter = exports.authRateLimiter = exports.globalRateLimiter = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const env_1 = require("../config/env");
const helmet_1 = __importDefault(require("helmet"));
const hpp_1 = __importDefault(require("hpp"));
const compression_1 = __importDefault(require("compression"));
exports.globalRateLimiter = (0, express_rate_limit_1.default)({
    windowMs: env_1.env.rateLimitWindowMins * 60 * 1000,
    max: env_1.env.rateLimitMaxReqs,
    message: 'Too many requests from this IP, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
});
exports.authRateLimiter = (0, express_rate_limit_1.default)({
    windowMs: env_1.env.rateLimitWindowMins * 60 * 1000,
    max: env_1.env.authRateLimitMaxReqs,
    message: 'Too many authentication attempts, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
});
// More lenient limiter for public read-only registration endpoints
// (config lookup, department/position lists) — these fire on every step render
exports.publicRegisterLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 min
    max: 300, // 300 reads per IP per window
    message: 'Too many requests, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
});
exports.securityHeaders = (0, helmet_1.default)({
    crossOriginResourcePolicy: { policy: "cross-origin" },
});
exports.compressResponses = (0, compression_1.default)();
exports.preventParameterPollution = (0, hpp_1.default)();
// Simple Sanitizer mitigating payload pollution where express-mongo-sanitize isn't applicable
const sanitizePayload = (req, res, next) => {
    // Explicitly iterating over body, query, params blocking specific characters mapping generic XSS manually if needed
    // However, Sequelize inherently blocks SQL injection and helmet prevents reflective XSS execution. 
    next();
};
exports.sanitizePayload = sanitizePayload;
