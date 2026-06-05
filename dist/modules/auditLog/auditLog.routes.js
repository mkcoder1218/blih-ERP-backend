"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.auditLogRoutes = void 0;
const express_1 = require("express");
const auth_1 = require("../../middlewares/auth");
const role_1 = require("../../middlewares/role");
const asyncHandler_1 = require("../../utils/asyncHandler");
const auditLog_controller_1 = require("./auditLog.controller");
const router = (0, express_1.Router)();
const controller = new auditLog_controller_1.AuditLogController();
router.use(auth_1.authRequired);
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
router.get("/", (0, role_1.requireRole)("BUSINESS_ADMIN"), (0, asyncHandler_1.asyncHandler)(controller.list));
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
router.get("/:id", (0, role_1.requireRole)("BUSINESS_ADMIN"), (0, asyncHandler_1.asyncHandler)(controller.get));
exports.auditLogRoutes = router;
