import { Router } from "express";
import { authRequired } from "../../middlewares/auth";
import { requirePermission } from "../../middlewares/permission";
import { validate } from "../../middlewares/validate";
import { asyncHandler } from "../../utils/asyncHandler";
import { createUserSchema, updateUserSchema } from "../../validators/user.validator";
import { UserController } from "./user.controller";

const router = Router();
const controller = new UserController();

router.use(authRequired);

/**
 * @openapi
 * /api/v1/users:
 *   get:
 *     tags: [users]
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
router.get("/", requirePermission("user.read"), asyncHandler(controller.list));
router.get("/me/preferences", asyncHandler(controller.getPreferences));
router.patch("/me/preferences", asyncHandler(controller.updatePreferences));

/**
 * @openapi
 * /api/v1/users/{id}:
 *   get:
 *     tags: [users]
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
router.get("/:id", requirePermission("user.read"), asyncHandler(controller.get));

/**
 * @openapi
 * /api/v1/users:
 *   post:
 *     tags: [users]
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
router.post("/", requirePermission("user.create"), validate(createUserSchema), asyncHandler(controller.create));

/**
 * @openapi
 * /api/v1/users/{id}:
 *   patch:
 *     tags: [users]
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
router.patch("/:id", requirePermission("user.update"), validate(updateUserSchema), asyncHandler(controller.update));

/**
 * @openapi
 * /api/v1/users/{id}:
 *   delete:
 *     tags: [users]
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
router.delete("/:id", requirePermission("user.delete"), asyncHandler(controller.remove));

export const userRoutes = router;
