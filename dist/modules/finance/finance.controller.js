"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FinanceController = void 0;
const finance_service_1 = require("./finance.service");
const payrollTemplate_service_1 = require("./payrollTemplate.service");
const auditLog_service_1 = require("../../services/auditLog.service");
const response_1 = require("../../utils/response");
const models_1 = require("../../models");
class FinanceController {
    constructor() {
        this.service = new finance_service_1.FinanceService();
        this.payrollTplSvc = new payrollTemplate_service_1.PayrollTemplateService();
        this.workforce = async (req, res) => {
            try {
                const data = await this.service.getWorkforceDashboard(req.user.businessId, req.query);
                (0, response_1.successResponse)(res, data, "Workforce finance dashboard loaded");
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        // Self-scoped: returns only the requesting user's own expenses, payroll records, and benefit enrollments
        this.workforceMe = async (req, res) => {
            try {
                const { businessId, id: userId } = req.user;
                const [expenses, payrollRecords, enrollments] = await Promise.all([
                    models_1.db.Expense.findAll({
                        where: { businessId, requestedByUserId: userId },
                        include: [{ model: models_1.db.Department, attributes: ['id', 'name'] }],
                        order: [['expenseDate', 'DESC']],
                    }),
                    models_1.db.PayrollRecord.findAll({
                        where: { businessId, employeeUserId: userId },
                        include: [{ model: models_1.db.Department, as: 'department', attributes: ['id', 'name'] }],
                        order: [['periodEnd', 'DESC']],
                    }),
                    models_1.db.FinanceBenefitEnrollment.findAll({
                        where: { businessId, employeeUserId: userId },
                        include: [
                            { model: models_1.db.FinanceBenefit, as: 'benefit', attributes: ['id', 'name', 'category', 'employerSharePercent', 'employeeSharePercent'] },
                            { model: models_1.db.Department, as: 'department', attributes: ['id', 'name'] },
                        ],
                    }),
                ]);
                (0, response_1.successResponse)(res, { expenses, payrollRecords, enrollments }, "My finance data loaded");
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        this.exportWorkforce = async (req, res) => {
            try {
                const tab = String(req.params.tab || 'overview');
                const data = await this.service.getWorkforceDashboard(req.user.businessId, req.query);
                const rows = this.rowsForExport(data, tab);
                const csv = this.toCsv(rows);
                res.setHeader('Content-Type', 'text/csv; charset=utf-8');
                res.setHeader('Content-Disposition', `attachment; filename="workforce-finance-${tab}.csv"`);
                res.status(200).send(csv);
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        this.seedForms = async (req, res) => {
            await this.service.provisionForms(req.user.businessId);
            (0, response_1.successResponse)(res, null, "Finance forms seeded successfully.");
        };
        this.createInvoice = async (req, res) => {
            try {
                const inv = await this.service.createInvoice(req.user.businessId, req.body, req.body.items);
                await auditLog_service_1.AuditLogService.log('CREATE_INVOICE', 'finance_invoice', String(inv.id), null, inv, req);
                (0, response_1.successResponse)(res, inv, "Invoice created", 201);
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        this.generateInvoiceFromDeal = async (req, res) => {
            try {
                const inv = await this.service.generateFromDeal(req.user.businessId, req.params.id);
                (0, response_1.successResponse)(res, inv, "Invoice generated", 201);
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        this.generateInvoiceFromMilestone = async (req, res) => {
            try {
                const inv = await this.service.generateFromMilestone(req.user.businessId, req.params.id);
                (0, response_1.successResponse)(res, inv, "Invoice generated", 201);
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        this.listInvoices = async (req, res) => {
            try {
                const data = await models_1.db.Invoice.findAndCountAll({ where: { businessId: req.user.businessId } });
                (0, response_1.paginationResponse)(res, data.rows, data.count, 1, 100);
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        this.recordPayment = async (req, res) => {
            try {
                const p = await this.service.recordPayment(req.user.businessId, req.body);
                await auditLog_service_1.AuditLogService.log('RECORD_PAYMENT', 'finance_payment', String(p.id), null, p, req);
                (0, response_1.successResponse)(res, p, "Payment recorded", 201);
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        this.createExpense = async (req, res) => {
            try {
                // Map self user id explicitly dropping external override bounds directly
                const payload = { ...req.body, requestedByUserId: req.user.id };
                const exp = await this.service.createExpense(req.user.businessId, payload);
                await auditLog_service_1.AuditLogService.log('CREATE_EXPENSE', 'finance_expense', String(exp.id), null, exp, req);
                (0, response_1.successResponse)(res, exp, "Expense submitted", 201);
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        this.approveExpense = async (req, res) => {
            try {
                const exp = await this.service.approveExpense(req.user.businessId, req.params.id);
                (0, response_1.successResponse)(res, exp, "Expense approved");
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        this.rejectExpense = async (req, res) => {
            try {
                const exp = await this.service.rejectExpense(req.user.businessId, req.params.id, req.user.id);
                (0, response_1.successResponse)(res, exp, "Expense rejected");
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        this.decideSalaryRequest = async (req, res) => {
            try {
                const action = req.params.action === 'approve' ? 'approve' : 'reject';
                const request = await this.service.decideSalaryRequest(req.user.businessId, req.params.id, action, req.user.id);
                await auditLog_service_1.AuditLogService.log(action === 'approve' ? 'APPROVE_SALARY_ADJUSTMENT' : 'REJECT_SALARY_ADJUSTMENT', 'finance_salary', String(request.id), null, request, req);
                (0, response_1.successResponse)(res, request, `Salary adjustment ${action}d`);
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        this.decideBudgetReallocation = async (req, res) => {
            try {
                const action = req.params.action === 'approve' ? 'approve' : 'reject';
                const request = await this.service.decideBudgetReallocation(req.user.businessId, req.params.id, action, req.user.id);
                await auditLog_service_1.AuditLogService.log(action === 'approve' ? 'APPROVE_BUDGET_REALLOCATION' : 'REJECT_BUDGET_REALLOCATION', 'finance_budget', String(request.id), null, request, req);
                (0, response_1.successResponse)(res, request, `Budget reallocation ${action}d`);
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        this.createBudgetReallocation = async (req, res) => {
            try {
                const request = await this.service.createBudgetReallocation(req.user.businessId, req.user.id, req.body);
                await auditLog_service_1.AuditLogService.log('CREATE_BUDGET_REALLOCATION', 'finance_budget', String(request.id), null, request, req);
                (0, response_1.successResponse)(res, request, 'Budget reallocation requested', 201);
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        this.listExpenses = async (req, res) => {
            try {
                let where = { businessId: req.user.businessId };
                if (!req.user.isPlatformSuperAdmin && !(res.locals.hasRole && res.locals.hasRole('BUSINESS_ADMIN'))) {
                    // Employee: only see their own explicitly
                    where.requestedByUserId = req.user.id;
                }
                const data = await models_1.db.Expense.findAndCountAll({ where });
                (0, response_1.paginationResponse)(res, data.rows, data.count, 1, 100);
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        this.createBudget = async (req, res) => {
            try {
                const b = await models_1.db.Budget.create({ ...req.body, businessId: req.user.businessId });
                (0, response_1.successResponse)(res, b, "Budget created");
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        this.listBudgets = async (req, res) => {
            try {
                const data = await models_1.db.Budget.findAndCountAll({ where: { businessId: req.user.businessId } });
                (0, response_1.paginationResponse)(res, data.rows, data.count, 1, 100);
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        // ── Payroll Templates ──────────────────────────────────────────────────────
        this.listPayrollTemplates = async (req, res) => {
            try {
                const templates = await this.payrollTplSvc.listTemplates(req.user.businessId);
                (0, response_1.successResponse)(res, templates.map((t) => this.payrollTplSvc.formatTemplate(t)));
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        this.createPayrollTemplate = async (req, res) => {
            try {
                const tpl = await this.payrollTplSvc.createTemplate(req.user.businessId, req.user.id, req.body);
                await auditLog_service_1.AuditLogService.log('CREATE_PAYROLL_TEMPLATE', 'finance_payroll', String(tpl.id), null, tpl, req);
                (0, response_1.successResponse)(res, this.payrollTplSvc.formatTemplate(tpl), 'Payroll template created', 201);
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        this.updatePayrollTemplate = async (req, res) => {
            try {
                const tpl = await this.payrollTplSvc.updateTemplate(req.user.businessId, req.params.id, req.body);
                await auditLog_service_1.AuditLogService.log('UPDATE_PAYROLL_TEMPLATE', 'finance_payroll', String(tpl.id), null, tpl, req);
                (0, response_1.successResponse)(res, this.payrollTplSvc.formatTemplate(tpl));
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        this.deletePayrollTemplate = async (req, res) => {
            try {
                await this.payrollTplSvc.deleteTemplate(req.user.businessId, req.params.id);
                (0, response_1.successResponse)(res, null, 'Payroll template deleted');
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        this.previewPayrollCalculation = async (req, res) => {
            try {
                const { baseSalary, ...templateData } = req.body;
                if (!baseSalary) {
                    (0, response_1.errorResponse)(res, 'baseSalary is required', 400);
                    return;
                }
                const result = this.payrollTplSvc.previewCalculation(Number(baseSalary), templateData);
                (0, response_1.successResponse)(res, result);
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        // ── Employee Payroll Links ─────────────────────────────────────────────────
        this.getPayrollDashboard = async (req, res) => {
            try {
                const data = await this.payrollTplSvc.getPayrollDashboardData(req.user.businessId);
                (0, response_1.successResponse)(res, data);
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        this.listEmployeeSalaries = async (req, res) => {
            try {
                const data = await this.payrollTplSvc.listEmployeeSalaries(req.user.businessId, req.query);
                res.status(200).json({
                    success: true,
                    message: "Employee salaries loaded",
                    data: data.rows,
                    meta: {
                        total: data.count,
                        page: data.page,
                        limit: data.limit,
                        totalPages: data.totalPages,
                        totals: data.totals,
                        requestId: res.locals.requestId,
                    },
                });
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        this.exportEmployeeSalaries = async (req, res) => {
            try {
                const defaultColumnIds = ["employee", "payPeriod", "salarySummary", "status", "actions"];
                const showMoreColumnIds = [
                    "employee",
                    "payPeriod",
                    "department",
                    "employmentType",
                    "salaryTemplate",
                    "salarySummary",
                    "basicSalary",
                    "grossSalary",
                    "taxableAmount",
                    "incomeTaxPaye",
                    "employeePension",
                    "totalDeductions",
                    "deductionReasonsCount",
                    "attendanceDeduction",
                    "overtime",
                    "netSalary",
                    "status",
                ];
                const columnMap = {
                    employee: { key: "employee", value: (row) => row.name },
                    payPeriod: { key: "payPeriod", value: (row) => row.payPeriod || "" },
                    salarySummary: {
                        key: "salarySummary",
                        value: (row) => `Gross: ${row.grossPay} | Deduct: ${row.deductionTotal ?? row.totalDeductions} | Net: ${row.netPay}`,
                    },
                    grossSalary: { key: "grossSalary", value: (row) => row.grossPay },
                    totalDeductions: { key: "totalDeductions", value: (row) => row.deductionTotal ?? row.totalDeductions },
                    netSalary: { key: "netSalary", value: (row) => row.netPay },
                    status: { key: "status", value: (row) => row.paymentStatus || "" },
                    actions: { key: "actions", value: () => "" },
                    employeeId: { key: "employeeId", value: (row) => row.employeeCode || row.userId },
                    tin: { key: "tin", value: (row) => row.tin || "" },
                    paymentDate: { key: "paymentDate", value: (row) => row.paymentDate || "" },
                    basicSalary: { key: "basicSalary", value: (row) => row.baseSalary },
                    taxableAmount: { key: "taxableAmount", value: (row) => row.taxableAmount },
                    incomeTaxPaye: { key: "incomeTaxPaye", value: (row) => row.taxDeduction },
                    employeePension: { key: "employeePension", value: (row) => row.employeePensionContribution },
                    employerPension: { key: "employerPension", value: (row) => row.employerPensionContribution },
                    deductionReasonsCount: { key: "deductionReasonsCount", value: (row) => row.deductionCount },
                    department: { key: "department", value: (row) => row.department?.name || "" },
                    employmentType: { key: "employmentType", value: (row) => row.employmentType || "" },
                    salaryTemplate: { key: "salaryTemplate", value: (row) => row.templateName || "" },
                    approvedLeave: {
                        key: "approvedLeave",
                        value: (row) => (row.deductionItems || []).filter((item) => item.status === "active" && item.reasonType === "leave").length,
                    },
                    attendanceDeduction: {
                        key: "attendanceDeduction",
                        value: (row) => (row.deductionItems || [])
                            .filter((item) => item.status === "active" && item.sourceModule === "attendance")
                            .reduce((sum, item) => sum + Number(item.amount || 0), 0),
                    },
                    overtime: { key: "overtime", value: (row) => row.overtimePay },
                    createdAt: { key: "createdAt", value: (row) => row.createdAt || "" },
                    updatedAt: { key: "updatedAt", value: (row) => row.lastUpdated || "" },
                };
                const requestedColumnIds = String(req.query.columns || "")
                    .split(",")
                    .map((value) => value.trim())
                    .filter(Boolean);
                const fallbackColumnIds = String(req.query.showMoreDetails || "").toLowerCase() === "true" ? showMoreColumnIds : defaultColumnIds;
                const selectedColumnIds = (requestedColumnIds.length ? requestedColumnIds : fallbackColumnIds)
                    .filter((id) => columnMap[id] && id !== "actions");
                const data = await this.payrollTplSvc.listEmployeeSalaries(req.user.businessId, {
                    ...req.query,
                    page: 1,
                    limit: 5000,
                    exportAll: "true",
                });
                const rows = data.rows
                    .filter((row) => !this.isUnpaidSalaryExportMarker(row))
                    .map((row) => selectedColumnIds.reduce((acc, id) => {
                    const column = columnMap[id];
                    acc[column.key] = column.value(row);
                    return acc;
                }, {}));
                const csv = this.toCsv(rows);
                res.setHeader("Content-Type", "text/csv; charset=utf-8");
                res.setHeader("Content-Disposition", 'attachment; filename="employee-salaries.csv"');
                res.status(200).send(csv);
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        this.updateEmployeeBaseSalary = async (req, res) => {
            try {
                const result = await this.payrollTplSvc.updateEmployeeBaseSalaryWithEthiopianTax(req.user.businessId, req.user.id, req.params.userId, req.body || {});
                await auditLog_service_1.AuditLogService.log('UPDATE_EMPLOYEE_BASE_SALARY', 'finance_salary', req.params.userId, null, result, req);
                (0, response_1.successResponse)(res, result, 'Employee base salary updated');
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        this.syncEthiopianTax = async (req, res) => {
            try {
                const result = await this.payrollTplSvc.syncEthiopianTax(req.user.businessId, req.user.id, req.body || {});
                await auditLog_service_1.AuditLogService.log('SYNC_ETHIOPIAN_SALARY_TAX', 'finance_salary', 'ethiopian_proclamation', null, result, req);
                (0, response_1.successResponse)(res, result, `${result.syncedCount} employee salary records synced`);
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        this.linkEmployeeToTemplate = async (req, res) => {
            try {
                const link = await this.payrollTplSvc.linkEmployee(req.user.businessId, req.user.id, req.body);
                await auditLog_service_1.AuditLogService.log('LINK_EMPLOYEE_PAYROLL', 'finance_payroll', String(link.id), null, link, req);
                (0, response_1.successResponse)(res, link, 'Employee linked to payroll template', 201);
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        this.bulkLinkEmployeesToTemplate = async (req, res) => {
            try {
                const result = await this.payrollTplSvc.bulkLinkEmployees(req.user.businessId, req.user.id, req.body);
                await auditLog_service_1.AuditLogService.log('BULK_LINK_EMPLOYEE_PAYROLL', 'finance_payroll', String(req.body.templateId), null, result, req);
                (0, response_1.successResponse)(res, result, `${result.linkedCount} employees linked to payroll template`, 201);
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        this.unlinkEmployee = async (req, res) => {
            try {
                await this.payrollTplSvc.unlinkEmployee(req.user.businessId, req.params.userId);
                (0, response_1.successResponse)(res, null, 'Employee unlinked from payroll template');
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
    }
    isUnpaidSalaryExportMarker(row) {
        const salaryInfo = row?.salaryInfo || {};
        const originalSalaryValues = [
            salaryInfo.baseSalary,
            salaryInfo.monthlySalary,
            salaryInfo.salary,
            salaryInfo.netSalary,
            salaryInfo.targetNetSalary,
            salaryInfo.targetNetPay,
            salaryInfo.netPay,
            row?.targetNetSalary,
        ].map((value) => Number(value ?? 0)).filter((value) => value > 0);
        const hasUnpaidOriginalSalary = originalSalaryValues.some((value) => value <= 1);
        const hasTokenPayroll = [
            row?.basicSalary,
            row?.baseSalary,
            row?.grossSalary,
            row?.grossPay,
            row?.taxableAmount,
            row?.netSalary,
            row?.netPay,
        ].some((value) => {
            const numeric = Number(value ?? 0);
            return numeric > 0 && numeric <= 2;
        });
        return hasUnpaidOriginalSalary || hasTokenPayroll;
    }
    rowsForExport(data, tab) {
        if (tab === 'salary')
            return data.salary?.employees ?? [];
        if (tab === 'payroll')
            return data.payroll?.records ?? [];
        if (tab === 'budget')
            return data.budget?.allocations ?? [];
        if (tab === 'expense')
            return data.expense?.recent ?? [];
        if (tab === 'benefits')
            return data.benefits?.benefits ?? [];
        return data.overview?.pendingApprovals ?? [];
    }
    toCsv(rows) {
        if (!rows.length)
            return 'empty\n';
        const headers = Array.from(rows.reduce((set, row) => {
            Object.keys(row).forEach((key) => {
                if (typeof row[key] !== 'object')
                    set.add(key);
            });
            return set;
        }, new Set()));
        const escape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
        return [headers.join(','), ...rows.map((row) => headers.map((header) => escape(row[header])).join(','))].join('\n');
    }
}
exports.FinanceController = FinanceController;
