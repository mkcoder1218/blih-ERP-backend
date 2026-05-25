
import { Router } from "express";
import { authRequired } from "../../middlewares/auth";
import { requireRole } from "../../middlewares/role";
import { requireActiveModule } from "../../middlewares/requireActiveModule";
import { asyncHandler } from "../../utils/asyncHandler";
import { FinanceController } from "./finance.controller";

const router = Router();
const controller = new FinanceController();

router.use(requireActiveModule('finance'));
router.use(authRequired);

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
router.post("/templates", requireRole("BUSINESS_ADMIN", "FINANCE_MANAGER"), asyncHandler(controller.seedForms));

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
router.post("/invoices", requireRole("FINANCE_MANAGER", "BUSINESS_ADMIN"), asyncHandler(controller.createInvoice));
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
router.get("/invoices", asyncHandler(controller.listInvoices));
router.post(
  "/invoices/from-deal/:id",
  requireRole("FINANCE_MANAGER", "BUSINESS_ADMIN"),
  asyncHandler(controller.generateInvoiceFromDeal)
);
router.post(
  "/invoices/from-milestone/:id",
  requireRole("FINANCE_MANAGER", "BUSINESS_ADMIN"),
  asyncHandler(controller.generateInvoiceFromMilestone)
);
router.post("/payments", requireRole("FINANCE_MANAGER", "BUSINESS_ADMIN"), asyncHandler(controller.recordPayment));

// Expenses
router.post("/expenses", asyncHandler(controller.createExpense));
router.get("/expenses", asyncHandler(controller.listExpenses));
router.post(
  "/expenses/:id/approve",
  requireRole("FINANCE_MANAGER", "BUSINESS_ADMIN", "DEPARTMENT_HEAD"),
  asyncHandler(controller.approveExpense)
);

// Budgets
router.post("/budgets", requireRole("FINANCE_MANAGER", "BUSINESS_ADMIN"), asyncHandler(controller.createBudget));
router.get("/budgets", asyncHandler(controller.listBudgets));

export const financeRoutes = router;
