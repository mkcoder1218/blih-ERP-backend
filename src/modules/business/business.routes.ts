import { Router } from "express";
import { authRequired } from "../../middlewares/auth";
import { requireRole } from "../../middlewares/role";
import { requirePermission } from "../../middlewares/permission";
import { validate } from "../../middlewares/validate";
import { asyncHandler } from "../../utils/asyncHandler";
import { createBusinessSchema, updateBusinessSchema } from "../../validators/business.validator";
import { BusinessController } from "./business.controller";
import { createBusinessAdminSchema } from "../../validators/businessAdmin.validator";
import { BusinessAdminController } from "./businessAdmin.controller";

const router = Router();
const controller = new BusinessController();
const adminController = new BusinessAdminController();

router.use(authRequired);

/**
 * @openapi
 * /api/v1/business:
 *   get:
 *     tags: [business]
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
router.get("/", requireRole("PLATFORM_SUPER_ADMIN"), requirePermission("business.read"), asyncHandler(controller.list));
/**
 * @openapi
 * /api/v1/business/{id}:
 *   get:
 *     tags: [business]
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
router.get("/:id", requireRole("PLATFORM_SUPER_ADMIN"), requirePermission("business.read"), asyncHandler(controller.get));
router.post(
  "/",
  requireRole("PLATFORM_SUPER_ADMIN"),
  requirePermission("business.create"),
  validate(createBusinessSchema),
  asyncHandler(controller.create)
);

/**
 * @openapi
 * /api/v1/businesses/{businessId}/admin:
 *   post:
 *     tags: [business]
 *     summary: Create first Business Admin for a business
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: businessId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       201:
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
router.post(
  "/:businessId/admin",
  requireRole("PLATFORM_SUPER_ADMIN"),
  requirePermission("user.create"),
  validate(createBusinessAdminSchema),
  asyncHandler(adminController.createBusinessAdmin)
);
router.patch(
  "/:id",
  requireRole("PLATFORM_SUPER_ADMIN"),
  requirePermission("business.update"),
  validate(updateBusinessSchema),
  asyncHandler(controller.update)
);
router.delete(
  "/:id",
  requireRole("PLATFORM_SUPER_ADMIN"),
  requirePermission("business.delete"),
  asyncHandler(controller.remove)
);

export const businessRoutes = router;
