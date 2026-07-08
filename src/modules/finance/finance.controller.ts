
import type { Request, Response } from 'express';
import { FinanceService } from './finance.service';
import { PayrollTemplateService } from './payrollTemplate.service';
import { AuditLogService } from '../../services/auditLog.service';
import { errorResponse, successResponse, paginationResponse } from '../../utils/response';
import { db } from '../../models';

export class FinanceController {
  private service = new FinanceService();
  private payrollTplSvc = new PayrollTemplateService();

  private isUnpaidSalaryExportMarker(row: any) {
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

  workforce = async (req: Request, res: Response) => {
    try {
      const data = await this.service.getWorkforceDashboard(req.user!.businessId, req.query);
      successResponse(res, data, "Workforce finance dashboard loaded");
    } catch(e: any) { errorResponse(res, e.message); }
  };

  // Self-scoped: returns only the requesting user's own expenses, payroll records, and benefit enrollments
  workforceMe = async (req: Request, res: Response) => {
    try {
      const { businessId, id: userId } = req.user!;
      const [expenses, payrollRecords, enrollments] = await Promise.all([
        db.Expense.findAll({
          where: { businessId, requestedByUserId: userId },
          include: [{ model: db.Department, attributes: ['id', 'name'] }],
          order: [['expenseDate', 'DESC']],
        }),
        db.PayrollRecord.findAll({
          where: { businessId, employeeUserId: userId },
          include: [{ model: db.Department, as: 'department', attributes: ['id', 'name'] }],
          order: [['periodEnd', 'DESC']],
        }),
        db.FinanceBenefitEnrollment.findAll({
          where: { businessId, employeeUserId: userId },
          include: [
            { model: db.FinanceBenefit, as: 'benefit', attributes: ['id', 'name', 'category', 'employerSharePercent', 'employeeSharePercent'] },
            { model: db.Department, as: 'department', attributes: ['id', 'name'] },
          ],
        }),
      ]);
      successResponse(res, { expenses, payrollRecords, enrollments }, "My finance data loaded");
    } catch(e: any) { errorResponse(res, e.message); }
  };

  exportWorkforce = async (req: Request, res: Response) => {
    try {
      const tab = String(req.params.tab || 'overview');
      const data: any = await this.service.getWorkforceDashboard(req.user!.businessId, req.query);
      const rows = this.rowsForExport(data, tab);
      const csv = this.toCsv(rows);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="workforce-finance-${tab}.csv"`);
      res.status(200).send(csv);
    } catch(e: any) { errorResponse(res, e.message); }
  };

  private rowsForExport(data: any, tab: string) {
    if (tab === 'salary') return data.salary?.employees ?? [];
    if (tab === 'payroll') return data.payroll?.records ?? [];
    if (tab === 'budget') return data.budget?.allocations ?? [];
    if (tab === 'expense') return data.expense?.recent ?? [];
    if (tab === 'benefits') return data.benefits?.benefits ?? [];
    return data.overview?.pendingApprovals ?? [];
  }

  private toCsv(rows: any[]) {
    if (!rows.length) return 'empty\n';
    const headers = Array.from(rows.reduce((set: Set<string>, row) => {
      Object.keys(row).forEach((key) => {
        if (typeof row[key] !== 'object') set.add(key);
      });
      return set;
    }, new Set<string>()));
    const escape = (value: any) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    return [headers.join(','), ...rows.map((row) => headers.map((header: string) => escape(row[header])).join(','))].join('\n');
  }

  seedForms = async (req: Request, res: Response) => {
    await this.service.provisionForms(req.user!.businessId);
    successResponse(res, null, "Finance forms seeded successfully.");
  };

  createInvoice = async (req: Request, res: Response) => {
    try {
      const inv = await this.service.createInvoice(req.user!.businessId, req.body, req.body.items);
      await AuditLogService.log('CREATE_INVOICE', 'finance_invoice', String(inv.id), null, inv, req);
      successResponse(res, inv, "Invoice created", 201);
    } catch(e: any) { errorResponse(res, e.message); }
  };

  generateInvoiceFromDeal = async (req: Request, res: Response) => {
    try {
      const inv = await this.service.generateFromDeal(req.user!.businessId, req.params.id);
      successResponse(res, inv, "Invoice generated", 201);
    } catch(e: any) { errorResponse(res, e.message); }
  }

  generateInvoiceFromMilestone = async (req: Request, res: Response) => {
    try {
      const inv = await this.service.generateFromMilestone(req.user!.businessId, req.params.id);
      successResponse(res, inv, "Invoice generated", 201);
    } catch(e: any) { errorResponse(res, e.message); }
  }

  listInvoices = async (req: Request, res: Response) => {
    try {
      const data = await db.Invoice.findAndCountAll({ where: { businessId: req.user!.businessId }});
      paginationResponse(res, data.rows, data.count, 1, 100);
    } catch(e: any) { errorResponse(res, e.message); }
  }

  recordPayment = async (req: Request, res: Response) => {
    try {
      const p = await this.service.recordPayment(req.user!.businessId, req.body);
      await AuditLogService.log('RECORD_PAYMENT', 'finance_payment', String(p.id), null, p, req);
      successResponse(res, p, "Payment recorded", 201);
    } catch(e: any) { errorResponse(res, e.message); }
  };

  createExpense = async (req: Request, res: Response) => {
    try {
      // Map self user id explicitly dropping external override bounds directly
      const payload = { ...req.body, requestedByUserId: req.user!.id };
      const exp = await this.service.createExpense(req.user!.businessId, payload);
      await AuditLogService.log('CREATE_EXPENSE', 'finance_expense', String(exp.id), null, exp, req);
      successResponse(res, exp, "Expense submitted", 201);
    } catch(e: any) { errorResponse(res, e.message); }
  };

  approveExpense = async (req: Request, res: Response) => {
    try {
      const exp = await this.service.approveExpense(req.user!.businessId, req.params.id);
      successResponse(res, exp, "Expense approved");
    } catch(e: any) { errorResponse(res, e.message); }
  };

  rejectExpense = async (req: Request, res: Response) => {
    try {
      const exp = await this.service.rejectExpense(req.user!.businessId, req.params.id, req.user!.id);
      successResponse(res, exp, "Expense rejected");
    } catch(e: any) { errorResponse(res, e.message); }
  };

  decideSalaryRequest = async (req: Request, res: Response) => {
    try {
      const action = req.params.action === 'approve' ? 'approve' : 'reject';
      const request = await this.service.decideSalaryRequest(req.user!.businessId, req.params.id, action, req.user!.id);
      await AuditLogService.log(action === 'approve' ? 'APPROVE_SALARY_ADJUSTMENT' : 'REJECT_SALARY_ADJUSTMENT', 'finance_salary', String(request.id), null, request, req);
      successResponse(res, request, `Salary adjustment ${action}d`);
    } catch(e: any) { errorResponse(res, e.message); }
  };

  decideBudgetReallocation = async (req: Request, res: Response) => {
    try {
      const action = req.params.action === 'approve' ? 'approve' : 'reject';
      const request = await this.service.decideBudgetReallocation(req.user!.businessId, req.params.id, action, req.user!.id);
      await AuditLogService.log(action === 'approve' ? 'APPROVE_BUDGET_REALLOCATION' : 'REJECT_BUDGET_REALLOCATION', 'finance_budget', String(request.id), null, request, req);
      successResponse(res, request, `Budget reallocation ${action}d`);
    } catch(e: any) { errorResponse(res, e.message); }
  };

  createBudgetReallocation = async (req: Request, res: Response) => {
    try {
      const request = await this.service.createBudgetReallocation(req.user!.businessId, req.user!.id, req.body);
      await AuditLogService.log('CREATE_BUDGET_REALLOCATION', 'finance_budget', String(request.id), null, request, req);
      successResponse(res, request, 'Budget reallocation requested', 201);
    } catch(e: any) { errorResponse(res, e.message); }
  };
  
  listExpenses = async (req: Request, res: Response) => {
    try {
      let where: any = { businessId: req.user!.businessId };
      if (!req.user!.isPlatformSuperAdmin && !(res.locals.hasRole && res.locals.hasRole('BUSINESS_ADMIN'))) {
          // Employee: only see their own explicitly
          where.requestedByUserId = req.user!.id;
      }
      const data = await db.Expense.findAndCountAll({ where });
      paginationResponse(res, data.rows, data.count, 1, 100);
    } catch(e: any) { errorResponse(res, e.message); }
  }

  createBudget = async (req: Request, res: Response) => {
    try {
       const b = await db.Budget.create({ ...req.body, businessId: req.user!.businessId });
       successResponse(res, b, "Budget created");
    } catch(e: any) { errorResponse(res, e.message); }
  }

  listBudgets = async (req: Request, res: Response) => {
    try {
       const data = await db.Budget.findAndCountAll({ where: { businessId: req.user!.businessId }});
       paginationResponse(res, data.rows, data.count, 1, 100);
    } catch(e: any) { errorResponse(res, e.message); }
  }

  // ── Payroll Templates ──────────────────────────────────────────────────────
  listPayrollTemplates = async (req: Request, res: Response) => {
    try {
      const templates = await this.payrollTplSvc.listTemplates(req.user!.businessId);
      successResponse(res, templates.map((t: any) => this.payrollTplSvc.formatTemplate(t)));
    } catch (e: any) { errorResponse(res, e.message); }
  };

  createPayrollTemplate = async (req: Request, res: Response) => {
    try {
      const tpl = await this.payrollTplSvc.createTemplate(req.user!.businessId, req.user!.id, req.body);
      await AuditLogService.log('CREATE_PAYROLL_TEMPLATE', 'finance_payroll', String(tpl.id), null, tpl, req);
      successResponse(res, this.payrollTplSvc.formatTemplate(tpl), 'Payroll template created', 201);
    } catch (e: any) { errorResponse(res, e.message); }
  };

  updatePayrollTemplate = async (req: Request, res: Response) => {
    try {
      const tpl = await this.payrollTplSvc.updateTemplate(req.user!.businessId, req.params.id, req.body);
      await AuditLogService.log('UPDATE_PAYROLL_TEMPLATE', 'finance_payroll', String(tpl.id), null, tpl, req);
      successResponse(res, this.payrollTplSvc.formatTemplate(tpl));
    } catch (e: any) { errorResponse(res, e.message); }
  };

  deletePayrollTemplate = async (req: Request, res: Response) => {
    try {
      await this.payrollTplSvc.deleteTemplate(req.user!.businessId, req.params.id);
      successResponse(res, null, 'Payroll template deleted');
    } catch (e: any) { errorResponse(res, e.message); }
  };

  previewPayrollCalculation = async (req: Request, res: Response) => {
    try {
      const { baseSalary, ...templateData } = req.body;
      if (!baseSalary) { errorResponse(res, 'baseSalary is required', 400); return; }
      const result = this.payrollTplSvc.previewCalculation(Number(baseSalary), templateData);
      successResponse(res, result);
    } catch (e: any) { errorResponse(res, e.message); }
  };

  // ── Employee Payroll Links ─────────────────────────────────────────────────
  getPayrollDashboard = async (req: Request, res: Response) => {
    try {
      const data = await this.payrollTplSvc.getPayrollDashboardData(req.user!.businessId);
      successResponse(res, data);
    } catch (e: any) { errorResponse(res, e.message); }
  };

  listEmployeeSalaries = async (req: Request, res: Response) => {
    try {
      const data = await this.payrollTplSvc.listEmployeeSalaries(req.user!.businessId, req.query);
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
          requestId: (res as any).locals.requestId,
        },
      });
    } catch (e: any) { errorResponse(res, e.message); }
  };

  exportEmployeeSalaries = async (req: Request, res: Response) => {
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
      const columnMap: Record<string, { key: string; value: (row: any) => any }> = {
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
          value: (row) => (row.deductionItems || []).filter((item: any) => item.status === "active" && item.reasonType === "leave").length,
        },
        attendanceDeduction: {
          key: "attendanceDeduction",
          value: (row) => (row.deductionItems || [])
            .filter((item: any) => item.status === "active" && item.sourceModule === "attendance")
            .reduce((sum: number, item: any) => sum + Number(item.amount || 0), 0),
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
      const data = await this.payrollTplSvc.listEmployeeSalaries(req.user!.businessId, {
        ...req.query,
        page: 1,
        limit: 5000,
        exportAll: "true",
      });
      const rows = data.rows
        .filter((row: any) => !this.isUnpaidSalaryExportMarker(row))
        .map((row: any) => selectedColumnIds.reduce((acc: Record<string, any>, id) => {
          const column = columnMap[id];
          acc[column.key] = column.value(row);
          return acc;
        }, {}));
      const csv = this.toCsv(rows);
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", 'attachment; filename="employee-salaries.csv"');
      res.status(200).send(csv);
    } catch (e: any) { errorResponse(res, e.message); }
  };

  updateEmployeeBaseSalary = async (req: Request, res: Response) => {
    try {
      const result = await this.payrollTplSvc.updateEmployeeBaseSalaryWithEthiopianTax(
        req.user!.businessId,
        req.user!.id,
        req.params.userId,
        req.body || {}
      );
      await AuditLogService.log('UPDATE_EMPLOYEE_BASE_SALARY', 'finance_salary', req.params.userId, null, result, req);
      successResponse(res, result, 'Employee base salary updated');
    } catch (e: any) { errorResponse(res, e.message); }
  };

  syncEthiopianTax = async (req: Request, res: Response) => {
    try {
      const result = await this.payrollTplSvc.syncEthiopianTax(req.user!.businessId, req.user!.id, req.body || {});
      await AuditLogService.log('SYNC_ETHIOPIAN_SALARY_TAX', 'finance_salary', 'ethiopian_proclamation', null, result, req);
      successResponse(res, result, `${result.syncedCount} employee salary records synced`);
    } catch (e: any) { errorResponse(res, e.message); }
  };

  linkEmployeeToTemplate = async (req: Request, res: Response) => {
    try {
      const link = await this.payrollTplSvc.linkEmployee(req.user!.businessId, req.user!.id, req.body);
      await AuditLogService.log('LINK_EMPLOYEE_PAYROLL', 'finance_payroll', String(link.id), null, link, req);
      successResponse(res, link, 'Employee linked to payroll template', 201);
    } catch (e: any) { errorResponse(res, e.message); }
  };

  bulkLinkEmployeesToTemplate = async (req: Request, res: Response) => {
    try {
      const result = await this.payrollTplSvc.bulkLinkEmployees(req.user!.businessId, req.user!.id, req.body);
      await AuditLogService.log('BULK_LINK_EMPLOYEE_PAYROLL', 'finance_payroll', String(req.body.templateId), null, result, req);
      successResponse(res, result, `${result.linkedCount} employees linked to payroll template`, 201);
    } catch (e: any) { errorResponse(res, e.message); }
  };

  unlinkEmployee = async (req: Request, res: Response) => {
    try {
      await this.payrollTplSvc.unlinkEmployee(req.user!.businessId, req.params.userId);
      successResponse(res, null, 'Employee unlinked from payroll template');
    } catch (e: any) { errorResponse(res, e.message); }
  };
}
