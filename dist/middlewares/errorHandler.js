"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notFound = notFound;
exports.errorHandler = errorHandler;
const env_1 = require("../config/env");
function notFound(req, res, next) {
    res.status(404);
    const error = new Error(`Not Found - ${req.originalUrl}`);
    next(error);
}
function errorHandler(err, req, res, next) {
    const anyErr = err;
    const statusCode = typeof anyErr.statusCode === "number"
        ? anyErr.statusCode
        : res.statusCode !== 200
            ? res.statusCode
            : 500;
    res.status(statusCode);
    let message = anyErr.message || "Request failed";
    // Specifically obscure DB and strict token errors from the payload
    const isSuspicious = String(message).toLowerCase().includes('password') ||
        String(message).toLowerCase().includes('token') ||
        String(message).toLowerCase().includes('sequelize');
    if (isSuspicious && env_1.env.nodeEnv === 'production') {
        message = 'An internal system error occurred.';
    }
    const payload = {
        success: false,
        message,
        data: anyErr.details || null,
        requestId: res.locals.requestId
    };
    if (env_1.env.nodeEnv !== "production")
        payload.stack = err.stack;
    res.json(payload);
}
