"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationRoutes = void 0;
const express_1 = require("express");
const auth_1 = require("../../middlewares/auth");
const role_1 = require("../../middlewares/role");
const validate_1 = require("../../middlewares/validate");
const asyncHandler_1 = require("../../utils/asyncHandler");
const notification_validator_1 = require("../../validators/notification.validator");
const notification_controller_1 = require("./notification.controller");
const router = (0, express_1.Router)();
const controller = new notification_controller_1.NotificationController();
router.use(auth_1.authRequired);
/**
 * @openapi
 * /api/notifications:
 *   get:
 *     tags: [notification]
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
 * /api/notifications/unread-count:
 *   get:
 *     tags: [notification]
 *     summary: GET /unread-count
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
router.get('/unread-count', (0, asyncHandler_1.asyncHandler)(controller.unreadCount));
/**
 * @openapi
 * /api/notifications/bulk:
 *   post:
 *     tags: [notification]
 *     summary: POST /bulk
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
router.post('/bulk', (0, role_1.requireRole)('BUSINESS_ADMIN'), (0, validate_1.validate)(notification_validator_1.bulkNotificationSchema), (0, asyncHandler_1.asyncHandler)(controller.bulkCreate));
/**
 * @openapi
 * /api/notifications/{id}/read:
 *   patch:
 *     tags: [notification]
 *     summary: PATCH /:id/read
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
router.patch('/:id/read', (0, asyncHandler_1.asyncHandler)(controller.markRead));
/**
 * @openapi
 * /api/notifications/read-all:
 *   patch:
 *     tags: [notification]
 *     summary: PATCH /read-all
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
router.patch('/read-all', (0, asyncHandler_1.asyncHandler)(controller.markAllRead));
/**
 * @openapi
 * /api/notifications/{id}:
 *   delete:
 *     tags: [notification]
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
router.delete('/:id', (0, asyncHandler_1.asyncHandler)(controller.archive));
exports.notificationRoutes = router;
