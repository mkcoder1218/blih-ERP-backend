"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationPreferenceRoutes = void 0;
const express_1 = require("express");
const auth_1 = require("../../middlewares/auth");
const validate_1 = require("../../middlewares/validate");
const asyncHandler_1 = require("../../utils/asyncHandler");
const notification_validator_1 = require("../../validators/notification.validator");
const preference_controller_1 = require("./preference.controller");
const router = (0, express_1.Router)();
const controller = new preference_controller_1.PreferenceController();
router.use(auth_1.authRequired);
/**
 * @openapi
 * /api/notification-preferences:
 *   get:
 *     tags: [notificationPreference]
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
router.get('/', (0, asyncHandler_1.asyncHandler)(controller.listMine));
/**
 * @openapi
 * /api/notification-preferences:
 *   post:
 *     tags: [notificationPreference]
 *     summary: POST index
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
router.post('/', (0, validate_1.validate)(notification_validator_1.preferenceUpdateSchema), (0, asyncHandler_1.asyncHandler)(controller.updateMine));
exports.notificationPreferenceRoutes = router;
