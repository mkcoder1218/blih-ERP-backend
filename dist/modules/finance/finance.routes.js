"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.financeRoutes = void 0;
const express_1 = require("express");
const auth_1 = require("../../middlewares/auth");
const role_1 = require("../../middlewares/role");
const requireActiveModule_1 = require("../../middlewares/requireActiveModule");
const asyncHandler_1 = require("../../utils/asyncHandler");
const finance_controller_1 = require("./finance.controller");
const router = (0, express_1.Router)();
const controller = new finance_controller_1.FinanceController();
router.use((0, requireActiveModule_1.requireActiveModule)('finance'));
router.use(auth_1.authRequired);
/**
 * @openapi
 * /api/v1/finance/templates:
 *   post:
 *     tags: [finance]
 *     summary: Seed Finance forms
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
router.post("/templates", (0, role_1.requireRole)("BUSINESS_ADMIN", "FINANCE_MANAGER"), (0, asyncHandler_1.asyncHandler)(controller.seedForms));
// Invoices
/**
 * @openapi
 * /api/v1/finance/invoices:
 *   post:
 *     tags: [finance]
 *     summary: Create invoice
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Created
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
router.post("/invoices", (0, role_1.requireRole)("FINANCE_MANAGER", "BUSINESS_ADMIN"), (0, asyncHandler_1.asyncHandler)(controller.createInvoice));
/**
 * @openapi
 * /api/v1/finance/invoices:
 *   get:
 *     tags: [finance]
 *     summary: List invoices
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: size
 *         schema: { type: integer }
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *       - in: query
 *         name: status
 *         schema: { type: string }
 *       - in: query
 *         name: clientId
 *         schema: { type: string }
 *       - in: query
 *         name: projectId
 *         schema: { type: string }
 *       - in: query
 *         name: dealId
 *         schema: { type: string }
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
router.get("/invoices", (0, asyncHandler_1.asyncHandler)(controller.listInvoices));
router.post("/invoices/from-deal/:id", (0, role_1.requireRole)("FINANCE_MANAGER", "BUSINESS_ADMIN"), (0, asyncHandler_1.asyncHandler)(controller.generateInvoiceFromDeal));
router.post("/invoices/from-milestone/:id", (0, role_1.requireRole)("FINANCE_MANAGER", "BUSINESS_ADMIN"), (0, asyncHandler_1.asyncHandler)(controller.generateInvoiceFromMilestone));
router.post("/payments", (0, role_1.requireRole)("FINANCE_MANAGER", "BUSINESS_ADMIN"), (0, asyncHandler_1.asyncHandler)(controller.recordPayment));
// Expenses
router.post("/expenses", (0, asyncHandler_1.asyncHandler)(controller.createExpense));
router.get("/expenses", (0, asyncHandler_1.asyncHandler)(controller.listExpenses));
router.post("/expenses/:id/approve", (0, role_1.requireRole)("FINANCE_MANAGER", "BUSINESS_ADMIN", "DEPARTMENT_HEAD"), (0, asyncHandler_1.asyncHandler)(controller.approveExpense));
// Budgets
router.post("/budgets", (0, role_1.requireRole)("FINANCE_MANAGER", "BUSINESS_ADMIN"), (0, asyncHandler_1.asyncHandler)(controller.createBudget));
router.get("/budgets", (0, asyncHandler_1.asyncHandler)(controller.listBudgets));
exports.financeRoutes = router;
