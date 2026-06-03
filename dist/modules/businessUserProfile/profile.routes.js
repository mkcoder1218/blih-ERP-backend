"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.businessUserProfileRoutes = void 0;
const express_1 = require("express");
const auth_1 = require("../../middlewares/auth");
const role_1 = require("../../middlewares/role");
const validate_1 = require("../../middlewares/validate");
const asyncHandler_1 = require("../../utils/asyncHandler");
const businessUserProfile_validator_1 = require("../../validators/businessUserProfile.validator");
const profile_controller_1 = require("./profile.controller");
const profileImageUpload_1 = require("../../middlewares/profileImageUpload");
const router = (0, express_1.Router)();
const controller = new profile_controller_1.ProfileController();
router.use(auth_1.authRequired);
// 'Me' route is accessible by the user themselves
/**
 * @openapi
 * /api/profiles/me:
 *   get:
 *     tags: [businessUserProfile]
 *     summary: GET /me
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
router.get('/me', (0, asyncHandler_1.asyncHandler)(controller.getMe));
router.patch('/me', profileImageUpload_1.uploadProfileImage.single("profileImage"), (0, asyncHandler_1.asyncHandler)(controller.updateMe));
router.get('/me/documents', (0, asyncHandler_1.asyncHandler)(controller.listMyDocuments));
router.post('/me/documents', profileImageUpload_1.uploadProfileImage.single("document"), (0, asyncHandler_1.asyncHandler)(controller.uploadMyDocument));
router.get('/user/:userId', (0, asyncHandler_1.asyncHandler)(controller.getByUser));
router.get('/user/:userId/documents', (0, asyncHandler_1.asyncHandler)(controller.listUserDocuments));
router.post('/user/:userId/documents', profileImageUpload_1.uploadProfileImage.single("document"), (0, asyncHandler_1.asyncHandler)(controller.uploadUserDocument));
// Listing all requires Business Admin
/**
 * @openapi
 * /api/profiles:
 *   get:
 *     tags: [businessUserProfile]
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
router.get('/', (0, role_1.requireRole)('BUSINESS_ADMIN'), (0, asyncHandler_1.asyncHandler)(controller.list));
/**
 * @openapi
 * /api/profiles/{id}:
 *   get:
 *     tags: [businessUserProfile]
 *     summary: GET /:id
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
router.get('/:id', (0, role_1.requireRole)('BUSINESS_ADMIN'), (0, asyncHandler_1.asyncHandler)(controller.get));
// Admin can mutate
/**
 * @openapi
 * /api/profiles:
 *   post:
 *     tags: [businessUserProfile]
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
router.post('/', (0, role_1.requireRole)('BUSINESS_ADMIN'), (0, validate_1.validate)(businessUserProfile_validator_1.createProfileSchema), (0, asyncHandler_1.asyncHandler)(controller.create));
/**
 * @openapi
 * /api/profiles/{id}:
 *   patch:
 *     tags: [businessUserProfile]
 *     summary: PATCH /:id
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
router.patch('/:id', (0, role_1.requireRole)('BUSINESS_ADMIN'), (0, validate_1.validate)(businessUserProfile_validator_1.updateProfileSchema), (0, asyncHandler_1.asyncHandler)(controller.update));
/**
 * @openapi
 * /api/profiles/{id}:
 *   delete:
 *     tags: [businessUserProfile]
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
router.delete('/:id', (0, role_1.requireRole)('BUSINESS_ADMIN'), (0, asyncHandler_1.asyncHandler)(controller.remove));
exports.businessUserProfileRoutes = router;
