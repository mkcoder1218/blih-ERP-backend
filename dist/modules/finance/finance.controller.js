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
