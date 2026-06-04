import { Router } from "express";
import { authRequired } from "../../middlewares/auth";
import { requireRole } from "../../middlewares/role";
import { asyncHandler } from "../../utils/asyncHandler";
import { AuditLogController } from "./auditLog.controller";

const router = Router();
const controller = new AuditLogController();

router.use(authRequired);

/**
 * @openapi
 * /api/audit-logs:
 *   get:
 *     tags: [auditLog]
 *     summary: List audit logs (paginated, filterable). Super admin sees all businesses.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: query, name: page, schema: { type: integer } }
 *       - { in: query, name: size, schema: { type: integer } }
 *       - { in: query, name: businessId, schema: { type: string } }
 *       - { in: query, name: userId, schema: { type: string } }
 *       - { in: query, name: action, schema: { type: string } }
 *       - { in: query, name: entityType, schema: { type: string } }
 *       - { in: query, name: category, schema: { type: string, enum: [success, warning, error] } }
 *       - { in: query, name: search, schema: { type: string } }
 *       - { in: query, name: dateFrom, schema: { type: string, format: date } }
 *       - { in: query, name: dateTo, schema: { type: string, format: date } }
 *     responses:
 *       200:
 *         description: Paginated audit log list
 */
router.get("/", requireRole("BUSINESS_ADMIN"), asyncHandler(controller.list));

/**
 * @openapi
 * /api/audit-logs/{id}:
 *   get:
 *     tags: [auditLog]
 *     summary: Get single audit log entry by ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Audit log detail
 */
router.get("/:id", requireRole("BUSINESS_ADMIN"), asyncHandler(controller.get));

export const auditLogRoutes = router;
