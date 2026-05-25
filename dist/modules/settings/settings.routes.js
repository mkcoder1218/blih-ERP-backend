"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.settingsRoutes = void 0;
const express_1 = require("express");
const auth_1 = require("../../middlewares/auth");
const role_1 = require("../../middlewares/role");
const asyncHandler_1 = require("../../utils/asyncHandler");
const settings_controller_1 = require("./settings.controller");
const router = (0, express_1.Router)();
const controller = new settings_controller_1.SettingsController();
// Open/Public access mapping (still requires basic identity wrapper or explicit business ID passed)
// The getPublicConfiguration handles identity via user or query param, allowing unauthenticated UI to fetch brand config if passing query.
/**
 * @openapi
 * /api/v1/settings/public:
 *   get:
 *     tags: [settings]
 *     summary: GET /public
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
router.get('/public', (0, asyncHandler_1.asyncHandler)(controller.getPublicConfiguration));
// Protected Management
/**
 * @openapi
 * /api/v1/settings/branding:
 *   patch:
 *     tags: [settings]
 *     summary: PATCH /branding
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
router.patch('/branding', auth_1.authRequired, (0, role_1.requireRole)('BUSINESS_ADMIN'), (0, asyncHandler_1.asyncHandler)(controller.updateBranding));
/**
 * @openapi
 * /api/v1/settings/localization:
 *   patch:
 *     tags: [settings]
 *     summary: PATCH /localization
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
router.patch('/localization', auth_1.authRequired, (0, role_1.requireRole)('BUSINESS_ADMIN'), (0, asyncHandler_1.asyncHandler)(controller.updateLocalization));
// Raw Settings
/**
 * @openapi
 * /api/v1/settings:
 *   get:
 *     tags: [settings]
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
router.get('/', auth_1.authRequired, (0, role_1.requireRole)('BUSINESS_ADMIN'), (0, asyncHandler_1.asyncHandler)(controller.listSettings));
/**
 * @openapi
 * /api/v1/settings:
 *   post:
 *     tags: [settings]
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
router.post('/', auth_1.authRequired, (0, role_1.requireRole)('BUSINESS_ADMIN'), (0, asyncHandler_1.asyncHandler)(controller.setSetting));
/**
 * @openapi
 * /api/v1/settings/{key}:
 *   delete:
 *     tags: [settings]
 *     summary: DELETE /:key
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: key
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
router.delete('/:key', auth_1.authRequired, (0, role_1.requireRole)('BUSINESS_ADMIN'), (0, asyncHandler_1.asyncHandler)(controller.deleteSetting));
// Utility init
/**
 * @openapi
 * /api/v1/settings/init:
 *   post:
 *     tags: [settings]
 *     summary: POST /init
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
router.post('/init', auth_1.authRequired, (0, role_1.requireRole)('BUSINESS_ADMIN'), (0, asyncHandler_1.asyncHandler)(controller.initializeDefaults));
exports.settingsRoutes = router;
