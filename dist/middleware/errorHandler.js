"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = errorHandler;
function errorHandler(err, req, res, next) {
    const status = err.statusCode || err.status || 500;
    const message = err.message || "Internal server error";
    const details = err.details || undefined;
    if (status >= 500) {
        // eslint-disable-next-line no-console
        console.error(err);
    }
    res.status(status).json({ error: { message, details } });
}
