
import { Router } from "express";
import { authRequired } from "../../middlewares/auth";
import { requireAnyPermission } from "../../middlewares/permission";
import { requireActiveModule } from "../../middlewares/requireActiveModule";
import { asyncHandler } from "../../utils/asyncHandler";
import { FinanceController } from "./finance.controller";

const router = Router();
const controller = new FinanceController();

router.use(requireActiveModule('finance'));
router.use(authRequired);

router.post(
  "/templates",
  requireAnyPermission("finance.manage"),
  asyncHandler(controller.seedForms)
);

// Full workforce dashboard (finance managers only)
router.get(
  "/workforce",
  requireAnyPermission("finance.read", "finance.manage", "payroll.read"),
  asyncHandler(controller.workforce)
);
// Self-scoped workforce data (own payslip / salary) — finance.mine users
router.get(
  "/workforce/me",
  requireAnyPermission("finance.mine", "finance.read", "finance.manage"),
  asyncHandler(controller.workforceMe)
);
router.get(
  "/workforce/export/:tab",
  requireAnyPermission("finance.read", "finance.manage"),
  asyncHandler(controller.exportWorkforce)
);

// Invoices
router.post(
  "/invoices",
  requireAnyPermission("finance.manage"),
  asyncHandler(controller.createInvoice)
);
router.get(
  "/invoices",
  requireAnyPermission("finance.read", "finance.manage"),
  asyncHandler(controller.listInvoices)
);
router.post(
  "/invoices/from-deal/:id",
  requireAnyPermission("finance.manage"),
  asyncHandler(controller.generateInvoiceFromDeal)
);
router.post(
  "/invoices/from-milestone/:id",
  requireAnyPermission("finance.manage"),
  asyncHandler(controller.generateInvoiceFromMilestone)
);
router.post(
  "/payments",
  requireAnyPermission("finance.manage"),
  asyncHandler(controller.recordPayment)
);

// Expenses — any authenticated user can submit; approve requires finance.manage
router.post("/expenses", asyncHandler(controller.createExpense));
router.get(
  "/expenses",
  requireAnyPermission("finance.read", "finance.manage", "expense.submit", "finance.mine"),
  asyncHandler(controller.listExpenses)
);
router.post(
  "/expenses/:id/approve",
  requireAnyPermission("finance.manage"),
  asyncHandler(controller.approveExpense)
);
router.post(
  "/expenses/:id/reject",
  requireAnyPermission("finance.manage"),
  asyncHandler(controller.rejectExpense)
);

router.post(
  "/salary-adjustments/:id/:action(approve|reject)",
  requireAnyPermission("finance.manage"),
  asyncHandler(controller.decideSalaryRequest)
);

router.post(
  "/budget-reallocations/:id/:action(approve|reject)",
  requireAnyPermission("finance.manage"),
  asyncHandler(controller.decideBudgetReallocation)
);
router.post(
  "/budget-reallocations",
  requireAnyPermission("finance.manage"),
  asyncHandler(controller.createBudgetReallocation)
);

// Budgets
router.post(
  "/budgets",
  requireAnyPermission("finance.manage"),
  asyncHandler(controller.createBudget)
);
router.get(
  "/budgets",
  requireAnyPermission("finance.read", "finance.manage", "budget.read"),
  asyncHandler(controller.listBudgets)
);

// Payroll Templates
router.get(
  "/payroll-templates",
  requireAnyPermission("finance.read", "finance.manage", "payroll.read", "payroll.run"),
  asyncHandler(controller.listPayrollTemplates)
);
router.post(
  "/payroll-templates",
  requireAnyPermission("finance.manage", "payroll.run"),
  asyncHandler(controller.createPayrollTemplate)
);
router.put(
  "/payroll-templates/:id",
  requireAnyPermission("finance.manage", "payroll.run"),
  asyncHandler(controller.updatePayrollTemplate)
);
router.delete(
  "/payroll-templates/:id",
  requireAnyPermission("finance.manage"),
  asyncHandler(controller.deletePayrollTemplate)
);
router.post(
  "/payroll-templates/preview",
  requireAnyPermission("finance.read", "finance.manage", "payroll.read", "payroll.run"),
  asyncHandler(controller.previewPayrollCalculation)
);

// Employee Payroll Links
router.get(
  "/payroll-dashboard",
  requireAnyPermission("finance.read", "finance.manage", "payroll.read", "payroll.run"),
  asyncHandler(controller.getPayrollDashboard)
);
router.get(
  "/employee-salaries",
  requireAnyPermission("salary_employee_read", "finance.manage"),
  asyncHandler(controller.listEmployeeSalaries)
);
router.get(
  "/employee-salaries/export",
  requireAnyPermission("salary_employee_read", "finance.manage"),
  asyncHandler(controller.exportEmployeeSalaries)
);
router.post(
  "/payroll-links",
  requireAnyPermission("finance.manage", "payroll.run", "salary_employee_read"),
  asyncHandler(controller.linkEmployeeToTemplate)
);
router.post(
  "/payroll-links/bulk",
  requireAnyPermission("finance.manage", "payroll.run", "salary_employee_read"),
  asyncHandler(controller.bulkLinkEmployeesToTemplate)
);
router.delete(
  "/payroll-links/:userId",
  requireAnyPermission("finance.manage"),
  asyncHandler(controller.unlinkEmployee)
);

export const financeRoutes = router;
