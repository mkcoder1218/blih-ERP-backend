"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ok = ok;
exports.fail = fail;
function ok(res, data, message = "OK", statusCode = 200) {
    const requestId = res.locals?.requestId;
    const payload = { success: true, message, data, requestId };
    return res.status(statusCode).json(payload);
}
function fail(res, message, statusCode = 400) {
    const requestId = res.locals?.requestId;
    const payload = { success: false, message, data: null, requestId };
    return res.status(statusCode).json(payload);
}
