"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.financeRoutes = void 0;
const express_1 = require("express");
const auth_1 = require("../../middlewares/auth");
const permission_1 = require("../../middlewares/permission");
const requireActiveModule_1 = require("../../middlewares/requireActiveModule");
const asyncHandler_1 = require("../../utils/asyncHandler");
const finance_controller_1 = require("./finance.controller");
const salaryDeduction_controller_1 = require("./salaryDeduction.controller");
const router = (0, express_1.Router)();
const controller = new finance_controller_1.FinanceController();
const deductionController = new salaryDeduction_controller_1.SalaryDeductionController();
router.use((0, requireActiveModule_1.requireActiveModule)('finance'));
router.use(auth_1.authRequired);
router.post("/templates", (0, permission_1.requireAnyPermission)("finance.manage"), (0, asyncHandler_1.asyncHandler)(controller.seedForms));
// Full workforce dashboard (finance managers only)
router.get("/workforce", (0, permission_1.requireAnyPermission)("finance.read", "finance.manage", "payroll.read"), (0, asyncHandler_1.asyncHandler)(controller.workforce));
// Self-scoped workforce data (own payslip / salary) — finance.mine users
router.get("/workforce/me", (0, permission_1.requireAnyPermission)("finance.mine", "finance.read", "finance.manage"), (0, asyncHandler_1.asyncHandler)(controller.workforceMe));
router.get("/workforce/export/:tab", (0, permission_1.requireAnyPermission)("finance.read", "finance.manage"), (0, asyncHandler_1.asyncHandler)(controller.exportWorkforce));
// Invoices
router.post("/invoices", (0, permission_1.requireAnyPermission)("finance.manage"), (0, asyncHandler_1.asyncHandler)(controller.createInvoice));
router.get("/invoices", (0, permission_1.requireAnyPermission)("finance.read", "finance.manage"), (0, asyncHandler_1.asyncHandler)(controller.listInvoices));
router.post("/invoices/from-deal/:id", (0, permission_1.requireAnyPermission)("finance.manage"), (0, asyncHandler_1.asyncHandler)(controller.generateInvoiceFromDeal));
router.post("/invoices/from-milestone/:id", (0, permission_1.requireAnyPermission)("finance.manage"), (0, asyncHandler_1.asyncHandler)(controller.generateInvoiceFromMilestone));
router.post("/payments", (0, permission_1.requireAnyPermission)("finance.manage"), (0, asyncHandler_1.asyncHandler)(controller.recordPayment));
// Expenses — any authenticated user can submit; approve requires finance.manage
router.post("/expenses", (0, asyncHandler_1.asyncHandler)(controller.createExpense));
router.get("/expenses", (0, permission_1.requireAnyPermission)("finance.read", "finance.manage", "expense.submit", "finance.mine"), (0, asyncHandler_1.asyncHandler)(controller.listExpenses));
router.post("/expenses/:id/approve", (0, permission_1.requireAnyPermission)("finance.manage"), (0, asyncHandler_1.asyncHandler)(controller.approveExpense));
router.post("/expenses/:id/reject", (0, permission_1.requireAnyPermission)("finance.manage"), (0, asyncHandler_1.asyncHandler)(controller.rejectExpense));
router.post("/salary-adjustments/:id/:action(approve|reject)", (0, permission_1.requireAnyPermission)("finance.manage"), (0, asyncHandler_1.asyncHandler)(controller.decideSalaryRequest));
router.post("/budget-reallocations/:id/:action(approve|reject)", (0, permission_1.requireAnyPermission)("finance.manage"), (0, asyncHandler_1.asyncHandler)(controller.decideBudgetReallocation));
router.post("/budget-reallocations", (0, permission_1.requireAnyPermission)("finance.manage"), (0, asyncHandler_1.asyncHandler)(controller.createBudgetReallocation));
// Budgets
router.post("/budgets", (0, permission_1.requireAnyPermission)("finance.manage"), (0, asyncHandler_1.asyncHandler)(controller.createBudget));
router.get("/budgets", (0, permission_1.requireAnyPermission)("finance.read", "finance.manage", "budget.read"), (0, asyncHandler_1.asyncHandler)(controller.listBudgets));
// Payroll Templates
router.get("/payroll-templates", (0, permission_1.requireAnyPermission)("finance.read", "finance.manage", "payroll.read", "payroll.run"), (0, asyncHandler_1.asyncHandler)(controller.listPayrollTemplates));
router.post("/payroll-templates", (0, permission_1.requireAnyPermission)("finance.manage", "payroll.run"), (0, asyncHandler_1.asyncHandler)(controller.createPayrollTemplate));
router.put("/payroll-templates/:id", (0, permission_1.requireAnyPermission)("finance.manage", "payroll.run"), (0, asyncHandler_1.asyncHandler)(controller.updatePayrollTemplate));
router.delete("/payroll-templates/:id", (0, permission_1.requireAnyPermission)("finance.manage"), (0, asyncHandler_1.asyncHandler)(controller.deletePayrollTemplate));
router.post("/payroll-templates/preview", (0, permission_1.requireAnyPermission)("finance.read", "finance.manage", "payroll.read", "payroll.run"), (0, asyncHandler_1.asyncHandler)(controller.previewPayrollCalculation));
// Employee Payroll Links
router.get("/payroll-dashboard", (0, permission_1.requireAnyPermission)("finance.read", "finance.manage", "payroll.read", "payroll.run"), (0, asyncHandler_1.asyncHandler)(controller.getPayrollDashboard));
router.get("/employee-salaries", (0, permission_1.requireAnyPermission)("salary_employee_read", "finance.manage"), (0, asyncHandler_1.asyncHandler)(controller.listEmployeeSalaries));
router.get("/employee-salaries/export", (0, permission_1.requireAnyPermission)("salary_employee_read", "finance.manage"), (0, asyncHandler_1.asyncHandler)(controller.exportEmployeeSalaries));
router.post("/employee-salaries/sync-ethiopian-tax", (0, permission_1.requireAnyPermission)("salary_employee_read", "finance.manage"), (0, asyncHandler_1.asyncHandler)(controller.syncEthiopianTax));
router.patch("/employee-salaries/:userId/base-salary", (0, permission_1.requireAnyPermission)("salary_employee_read", "finance.manage"), (0, asyncHandler_1.asyncHandler)(controller.updateEmployeeBaseSalary));
router.get("/employee-salaries/:payrollLinkId/deductions", (0, permission_1.requireAnyPermission)("salary_employee_read", "finance.manage"), (0, asyncHandler_1.asyncHandler)(deductionController.listForSalary));
router.delete("/employee-salaries/deductions/:deductionId", (0, permission_1.requireAnyPermission)("finance.manage", "salary_employee_read"), (0, asyncHandler_1.asyncHandler)(deductionController.removeDeduction));
router.post("/payroll-links", (0, permission_1.requireAnyPermission)("finance.manage", "payroll.run", "salary_employee_read"), (0, asyncHandler_1.asyncHandler)(controller.linkEmployeeToTemplate));
router.post("/payroll-links/bulk", (0, permission_1.requireAnyPermission)("finance.manage", "payroll.run", "salary_employee_read"), (0, asyncHandler_1.asyncHandler)(controller.bulkLinkEmployeesToTemplate));
router.delete("/payroll-links/:userId", (0, permission_1.requireAnyPermission)("finance.manage"), (0, asyncHandler_1.asyncHandler)(controller.unlinkEmployee));
exports.financeRoutes = router;
