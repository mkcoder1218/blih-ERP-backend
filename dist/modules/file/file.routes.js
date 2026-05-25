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
router.use(auth_1.authRequired);
/**
 * @openapi
 * /api/files:
 *   get:
 *     tags: [file]
 *     summary: GET index
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: size
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Success
 *       400:
 *         $ref: '#/components/responses/400'
 *       401:
 *         $ref: '#/components/responses/401'
 *       403:
 *         $ref: '#/components/responses/403'
 *       404:
 *         $ref: '#/components/responses/404'
 *       500:
 *         $ref: '#/components/responses/500'
 */
router.get('/', (0, asyncHandler_1.asyncHandler)(controller.list));
/**
 * @openapi
 * /api/files/{id}/download:
 *   get:
 *     tags: [file]
 *     summary: GET /:id/download
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Success
 *       400:
 *         $ref: '#/components/responses/400'
 *       401:
 *         $ref: '#/components/responses/401'
 *       403:
 *         $ref: '#/components/responses/403'
 *       404:
 *         $ref: '#/components/responses/404'
 *       500:
 *         $ref: '#/components/responses/500'
 */
router.get('/:id/download', (0, asyncHandler_1.asyncHandler)(controller.download));
/**
 * @openapi
 * /api/files/upload:
 *   post:
 *     tags: [file]
 *     summary: POST /upload
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 *       400:
 *         $ref: '#/components/responses/400'
 *       401:
 *         $ref: '#/components/responses/401'
 *       403:
 *         $ref: '#/components/responses/403'
 *       404:
 *         $ref: '#/components/responses/404'
 *       500:
 *         $ref: '#/components/responses/500'
 */
router.post('/upload', upload_1.upload.single('file'), (0, asyncHandler_1.asyncHandler)(controller.uploadSingle));
/**
 * @openapi
 * /api/files/upload/bulk:
 *   post:
 *     tags: [file]
 *     summary: POST /upload/bulk
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 *       400:
 *         $ref: '#/components/responses/400'
 *       401:
 *         $ref: '#/components/responses/401'
 *       403:
 *         $ref: '#/components/responses/403'
 *       404:
 *         $ref: '#/components/responses/404'
 *       500:
 *         $ref: '#/components/responses/500'
 */
router.post('/upload/bulk', upload_1.upload.array('files', 10), (0, asyncHandler_1.asyncHandler)(controller.uploadMultiple));
/**
 * @openapi
 * /api/files/{id}:
 *   delete:
 *     tags: [file]
 *     summary: DELETE /:id
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Success
 *       400:
 *         $ref: '#/components/responses/400'
 *       401:
 *         $ref: '#/components/responses/401'
 *       403:
 *         $ref: '#/components/responses/403'
 *       404:
 *         $ref: '#/components/responses/404'
 *       500:
 *         $ref: '#/components/responses/500'
 */
router.delete('/:id', (0, asyncHandler_1.asyncHandler)(controller.remove));
exports.fileRoutes = router;
