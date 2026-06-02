"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fileRoutes = void 0;
const express_1 = require("express");
const auth_1 = require("../../middlewares/auth");
const upload_1 = require("../../middlewares/upload");
const asyncHandler_1 = require("../../utils/asyncHandler");
const file_controller_1 = require("./file.controller");
const router = (0, express_1.Router)();
const controller = new file_controller_1.FileController();
// Allow OPTIONS preflight through without auth — CORS headers are set at app level
router.options('*', (req, res) => {
    console.log(`[PREFLIGHT] OPTIONS ${req.path} origin=${req.headers.origin ?? 'none'}`);
    res.sendStatus(204);
});
// Token-based download — no auth header needed, token is in query string.
// This allows direct browser/IDM opens without fetch() interception.
router.get('/:id/download', (0, asyncHandler_1.asyncHandler)(controller.download));
router.use(auth_1.authRequired);
router.get('/', (0, asyncHandler_1.asyncHandler)(controller.list));
// Issue a short-lived signed token for a file (requires auth)
router.get('/:id/token', (0, asyncHandler_1.asyncHandler)(controller.getDownloadToken));
router.post('/upload', upload_1.upload.single('file'), (0, asyncHandler_1.asyncHandler)(controller.uploadSingle));
router.post('/upload/bulk', upload_1.upload.array('files', 10), (0, asyncHandler_1.asyncHandler)(controller.uploadMultiple));
router.delete('/:id', (0, asyncHandler_1.asyncHandler)(controller.remove));
exports.fileRoutes = router;
