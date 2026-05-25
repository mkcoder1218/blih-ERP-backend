"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.paginationResponse = exports.errorResponse = exports.successResponse = void 0;
const successResponse = (res, data, message = "Success", statusCode = 200) => {
    res.status(statusCode).json({
        success: true,
        message,
        data,
        meta: {
            requestId: res.locals.requestId
        }
    });
};
exports.successResponse = successResponse;
const errorResponse = (res, message, statusCode = 400, details) => {
    res.status(statusCode).json({
        success: false,
        error: message,
        details,
        meta: {
            requestId: res.locals.requestId
        }
    });
};
exports.errorResponse = errorResponse;
const paginationResponse = (res, data, total, page, limit, message = "Success") => {
    res.status(200).json({
        success: true,
        message,
        data,
        meta: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
            requestId: res.locals.requestId
        }
    });
};
exports.paginationResponse = paginationResponse;
