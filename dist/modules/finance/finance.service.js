"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FinanceService = void 0;
const models_1 = require("../../models");
const notification_service_1 = require("../notification/notification.service");
const sequelize_1 = require("sequelize");
const employee_constants_1 = require("../../constants/employee.constants");
class FinanceService {
    money(value) {
        return Number(value || 0);
    }
    salaryFromRecord(record) {
        return this.money(record?.salaryInfo?.baseSalary ?? record?.salaryInfo?.monthlySalary ?? record?.salaryInfo?.salary ?? 0);
    }
    monthKey(date) {
        return date.toLocaleString('en-US', { month: 'short' });
    }
    startOfMonth(date = new Date()) {
        return new Date(date.getFullYear(), date.getMonth(), 1);
    }
    async employees(businessId) {
        return models_1.db.EmployeeRecord.findAll({
            where: { businessId, employmentStatus: { [sequelize_1.Op.ne]: employee_constants_1.TERMINATED_EMPLOYMENT_STATUS } },
            include: [
                { model: models_1.db.User, as: 'user', attributes: ['id', 'fullName', 'email'] },
                { model: models_1.db.Department, as: 'department', attributes: ['id', 'name'] },
                { model: models_1.db.Position, as: 'position', attributes: ['id', 'title'] }
            ],
            order: [['createdAt', 'DESC']]
        });
    }
    async performanceMap(businessId) {
        const reviews = await models_1.db.PerformanceReview.findAll({
            where: { businessId, score: { [sequelize_1.Op.ne]: null } },
            order: [['periodEnd', 'DESC']]
        });
        const map = new Map();
        for (const review of reviews) {
            if (!map.has(review.employeeUserId))
                map.set(review.employeeUserId, this.money(review.score));
        }
        return map;
    }
    async getWorkforceDashboard(businessId, query = {}) {
        const [employees, perf, budgets, expenses, payrollRecords, payrollLinks, salaryRequests, reallocations, benefits, enrollments, notifications, auditLogs] = await Promise.all([
            this.employees(businessId),
            this.performanceMap(businessId),
            models_1.db.Budget.findAll({ where: { businessId }, include: [{ model: models_1.db.Department, attributes: ['id', 'name'] }] }),
            models_1.db.Expense.findAll({
                where: { businessId },
                include: [
                    { model: models_1.db.User, as: 'requester', attributes: ['id', 'fullName', 'email'] },
                    { model: models_1.db.Department, attributes: ['id', 'name'] }
                ],
                order: [['expenseDate', 'DESC']]
            }),
            models_1.db.PayrollRecord.findAll({
                where: { businessId },
                include: [
                    { model: models_1.db.User, as: 'employee', attributes: ['id', 'fullName', 'email'] },
                    { model: models_1.db.Department, as: 'department', attributes: ['id', 'name'] }
                ],
                order: [['periodEnd', 'DESC']]
            }),
            models_1.db.EmployeePayrollLink.findAll({
                where: { businessId },
                include: [
                    { model: models_1.db.PayrollTemplate, as: 'template', attributes: ['id', 'name', 'currency'] }
                ]
            }),
            models_1.db.SalaryAdjustmentRequest.findAll({
                where: { businessId },
                include: [
                    { model: models_1.db.User, as: 'employee', attributes: ['id', 'fullName', 'email'] },
                    { model: models_1.db.User, as: 'requester', attributes: ['id', 'fullName', 'email'] },
                    { model: models_1.db.Department, as: 'department', attributes: ['id', 'name'] }
                ],
                order: [['createdAt', 'DESC']]
            }),
            models_1.db.BudgetReallocationRequest.findAll({ where: { businessId }, order: [['createdAt', 'DESC']] }),
            models_1.db.FinanceBenefit.findAll({ where: { businessId }, include: [{ model: models_1.db.Department, as: 'department', attributes: ['id', 'name'] }] }),
            models_1.db.FinanceBenefitEnrollment.findAll({ where: { businessId }, include: [{ model: models_1.db.Department, as: 'department', attributes: ['id', 'name'] }] }),
            models_1.db.Notification.findAll({ where: { businessId, moduleKey: 'finance' }, order: [['createdAt', 'DESC']], limit: 8 }),
            models_1.db.AuditLog.findAll({ where: { businessId, entityType: { [sequelize_1.Op.in]: ['finance_salary', 'finance_payroll', 'finance_expense', 'finance_budget', 'finance_benefit'] } }, order: [['createdAt', 'DESC']], limit: 20 })
        ]);
        const payrollLinkByUserId = new Map(payrollLinks.map((link) => [link.employeeUserId, link]));
        const employeeRows = employees.map((employee) => {
            const annualSalary = this.salaryFromRecord(employee);
            const payrollLink = payrollLinkByUserId.get(employee.userId);
            const taxMeta = payrollLink?.metadata?.tax || {};
            return {
                id: employee.id,
                userId: employee.userId,
                name: employee.user?.fullName || 'Unassigned employee',
                email: employee.user?.email,
                departmentId: employee.departmentId,
                department: employee.department?.name || 'Unassigned',
                role: employee.position?.title || employee.employmentType || 'Employee',
                salary: annualSalary,
                performance: perf.get(employee.userId) ?? null,
                hireDate: employee.hireDate,
                employmentType: employee.employmentType,
                salaryInfo: employee.salaryInfo || {},
                payroll: payrollLink ? {
                    templateName: payrollLink.template?.name || 'Payroll Template',
                    grossPay: this.money(payrollLink.grossPay),
                    totalDeductions: this.money(payrollLink.totalDeductions),
                    netPay: this.money(payrollLink.netPay),
                    employeePensionContribution: this.money(payrollLink.pensionDeduction),
                    employerPensionContribution: this.money(taxMeta.employerPensionContribution),
                    totalCostToCompany: this.money(taxMeta.totalCostToCompany || (this.money(payrollLink.grossPay) + this.money(taxMeta.employerPensionContribution))),
                    currency: payrollLink.currency,
                } : null
            };
        });
        const salaryTotal = employeeRows.reduce((sum, row) => sum + row.salary, 0);
        const avgSalary = employeeRows.length ? salaryTotal / employeeRows.length : 0;
        const payrollCostAnalytics = payrollLinks.reduce((acc, link) => {
            const taxMeta = link.metadata?.tax || {};
            const employerPension = this.money(taxMeta.employerPensionContribution);
            const totalCostToCompany = this.money(taxMeta.totalCostToCompany || (this.money(link.grossPay) + employerPension));
            acc.grossPayroll += this.money(link.grossPay);
            acc.employeeDeductions += this.money(link.totalDeductions);
            acc.employeePension += this.money(link.pensionDeduction);
            acc.employerPension += employerPension;
            acc.totalCostToCompany += totalCostToCompany;
            return acc;
        }, { grossPayroll: 0, employeeDeductions: 0, employeePension: 0, employerPension: 0, totalCostToCompany: 0 });
        const activePayroll = payrollRecords.length ? payrollRecords : employeeRows.map((row) => {
            const monthlyGross = row.salary / 12;
            const pension = monthlyGross * 0.06;
            const tax = monthlyGross * 0.25;
            return {
                id: `employee-${row.id}`,
                employeeUserId: row.userId,
                departmentId: row.departmentId,
                employee: { fullName: row.name, email: row.email },
                department: { name: row.department },
                periodStart: null,
                periodEnd: null,
                payDate: null,
                baseSalary: row.salary,
                pension,
                grossPay: monthlyGross,
                tax,
                netPay: monthlyGross - pension - tax,
                overtime: 0,
                bonus: 0,
                commission: 0,
                currency: 'USD',
                status: 'derived'
            };
        });
        const currentMonth = this.startOfMonth();
        const currentMonthExpenses = expenses.filter((expense) => new Date(expense.expenseDate) >= currentMonth);
        const pendingExpenses = expenses.filter((expense) => expense.status === 'pending_approval');
        const pendingSalary = salaryRequests.filter((request) => request.status === 'pending');
        const pendingReallocations = reallocations.filter((request) => request.status === 'pending');
        const totalBudget = budgets.reduce((sum, b) => sum + this.money(b.allocatedAmount), 0);
        const totalBudgetUsed = budgets.reduce((sum, b) => sum + this.money(b.usedAmount), 0);
        const deptBudgetUtilization = budgets.map((budget) => ({
            id: budget.id,
            name: budget.Department?.name || budget.name,
            allocated: this.money(budget.allocatedAmount),
            spent: this.money(budget.usedAmount),
            remaining: Math.max(this.money(budget.allocatedAmount) - this.money(budget.usedAmount), 0),
            utilization: this.money(budget.allocatedAmount) ? (this.money(budget.usedAmount) / this.money(budget.allocatedAmount)) * 100 : 0
        }));
        const deptSalaryMap = new Map();
        for (const employee of employeeRows) {
            const key = employee.department || 'Unassigned';
            const current = deptSalaryMap.get(key) || { name: key, count: 0, total: 0, amount: 0 };
            current.count += 1;
            current.total += employee.salary;
            current.amount = current.count ? current.total / current.count : 0;
            deptSalaryMap.set(key, current);
        }
        const payrollTrend = this.lastMonths(7).map(({ label, start, end }) => {
            const amount = payrollRecords
                .filter((record) => record.periodEnd && new Date(record.periodEnd) >= start && new Date(record.periodEnd) < end)
                .reduce((sum, record) => sum + this.money(record.grossPay), 0);
            return { name: label, amount: amount || (label === this.monthKey(new Date()) ? activePayroll.reduce((sum, record) => sum + this.money(record.grossPay), 0) : 0) };
        });
        const expenseTrend = this.lastMonths(6).map(({ label, start, end }) => ({
            month: label,
            amount: expenses
                .filter((expense) => new Date(expense.expenseDate) >= start && new Date(expense.expenseDate) < end)
                .reduce((sum, expense) => sum + this.money(expense.amount), 0)
        }));
        const expenseCategoryTotals = new Map();
        for (const expense of expenses) {
            expenseCategoryTotals.set(expense.category, (expenseCategoryTotals.get(expense.category) || 0) + this.money(expense.amount));
        }
        const expenseCategorySum = Array.from(expenseCategoryTotals.values()).reduce((a, b) => a + b, 0);
        const benefitValue = enrollments.reduce((sum, enrollment) => sum + this.money(enrollment.value), 0);
        const activeEnrollments = enrollments.filter((enrollment) => enrollment.status === 'active');
        const benefitsByDepartment = new Map();
        for (const enrollment of enrollments) {
            const name = enrollment.department?.name || 'Unassigned';
            const current = benefitsByDepartment.get(name) || { name, value: 0, employees: 0 };
            current.value += this.money(enrollment.value);
            current.employees += 1;
            benefitsByDepartment.set(name, current);
        }
        return {
            overview: {
                totals: {
                    pendingApprovalAmount: [...pendingSalary, ...pendingExpenses, ...pendingReallocations].reduce((sum, item) => sum + this.money(item.amount ?? (this.money(item.requestedSalary) - this.money(item.currentSalary))), 0),
                    pendingApprovals: pendingSalary.length + pendingExpenses.length + pendingReallocations.length,
                    monthlyExpenses: currentMonthExpenses.reduce((sum, expense) => sum + this.money(expense.amount), 0),
                    monthlyExpenseItems: currentMonthExpenses.length,
                    totalBudget,
                    totalBudgetDeltaPercent: totalBudget ? ((totalBudget - totalBudgetUsed) / totalBudget) * 100 : 0
                },
                notifications: notifications.map((n) => ({ id: n.id, title: n.title, message: n.message, date: n.createdAt, priority: n.priority, type: n.type })),
                pendingApprovals: [
                    ...pendingSalary.map((request) => this.formatSalaryRequest(request)),
                    ...pendingExpenses.map((expense) => this.formatExpenseRequest(expense)),
                    ...pendingReallocations.map((request) => this.formatReallocationRequest(request))
                ],
                payrollTrend,
                departmentBudgetUtilization: deptBudgetUtilization
            },
            salary: {
                totals: {
                    avgSalary,
                    totalPayroll: salaryTotal,
                    grossPayroll: payrollCostAnalytics.grossPayroll,
                    employeeDeductions: payrollCostAnalytics.employeeDeductions,
                    employeePension: payrollCostAnalytics.employeePension,
                    employerPension: payrollCostAnalytics.employerPension,
                    totalCostToCompany: payrollCostAnalytics.totalCostToCompany,
                    currentMonthOtherExpenses: currentMonthExpenses.reduce((sum, expense) => sum + this.money(expense.amount), 0),
                    totalCompanyOutflow: payrollCostAnalytics.totalCostToCompany + currentMonthExpenses.reduce((sum, expense) => sum + this.money(expense.amount), 0),
                    payrollCostLoadPercent: payrollCostAnalytics.grossPayroll ? ((payrollCostAnalytics.totalCostToCompany - payrollCostAnalytics.grossPayroll) / payrollCostAnalytics.grossPayroll) * 100 : 0,
                    pendingRequests: pendingSalary.length,
                    avgIncreasePercent: pendingSalary.length ? pendingSalary.reduce((sum, r) => sum + ((this.money(r.requestedSalary) - this.money(r.currentSalary)) / Math.max(this.money(r.currentSalary), 1)) * 100, 0) / pendingSalary.length : 0
                },
                requests: salaryRequests.map((request) => this.formatSalaryRequest(request)),
                performanceComparison: employeeRows.filter((row) => row.performance !== null && row.salary > 0).map((row) => ({ x: Math.round(row.salary / 1000), y: row.performance, name: row.role })),
                departmentSalary: Array.from(deptSalaryMap.values()),
                employees: employeeRows,
                auditLogs: auditLogs.map((log) => ({ id: log.id, action: log.action, entityType: log.entityType, entityId: log.entityId, beforeData: log.beforeData, afterData: log.afterData, date: log.createdAt }))
            },
            payroll: {
                records: activePayroll.map((record) => this.formatPayrollRecord(record)),
                schedule: this.buildPayrollSchedule(activePayroll),
                monthlySummaries: this.buildPayrollSummaries(activePayroll),
                history: payrollRecords.map((record) => this.formatPayrollRecord(record))
            },
            budget: {
                totals: { allocated: totalBudget, spent: totalBudgetUsed, remaining: Math.max(totalBudget - totalBudgetUsed, 0), utilization: totalBudget ? (totalBudgetUsed / totalBudget) * 100 : 0 },
                departmentBudgetUtilization: deptBudgetUtilization,
                allocations: budgets.map((budget) => ({
                    id: budget.id,
                    name: budget.name,
                    department: budget.Department?.name,
                    periodType: budget.periodType,
                    periodStart: budget.periodStart,
                    periodEnd: budget.periodEnd,
                    allocated: this.money(budget.allocatedAmount),
                    spent: this.money(budget.usedAmount),
                    remaining: Math.max(this.money(budget.allocatedAmount) - this.money(budget.usedAmount), 0),
                    utilization: this.money(budget.allocatedAmount) ? (this.money(budget.usedAmount) / this.money(budget.allocatedAmount)) * 100 : 0,
                    status: budget.status,
                    metadata: budget.metadata || {}
                })),
                reallocationRequests: reallocations.map((request) => this.formatReallocationRequest(request)),
                annualSummaries: this.buildAnnualBudgetSummaries(budgets)
            },
            expense: {
                totals: {
                    totalExpense: expenses.reduce((sum, expense) => sum + this.money(expense.amount), 0),
                    pendingApprovals: pendingExpenses.length,
                    unexpected: expenses.filter((expense) => expense.metadata?.unexpected === true).length,
                    thisMonth: currentMonthExpenses.reduce((sum, expense) => sum + this.money(expense.amount), 0)
                },
                breakdown: Array.from(expenseCategoryTotals.entries()).map(([name, amount], index) => ({ name, amount, value: expenseCategorySum ? (amount / expenseCategorySum) * 100 : 0, color: ['#1d4ed8', '#3b82f6', '#93c5fd', '#60a5fa', '#bfdbfe'][index % 5] })),
                trend: expenseTrend,
                requests: pendingExpenses.map((expense) => this.formatExpenseRequest(expense)),
                recent: expenses.slice(0, 12).map((expense) => this.formatExpenseRequest(expense)),
                unexpected: expenses.filter((expense) => expense.metadata?.unexpected === true).map((expense) => this.formatExpenseRequest(expense)),
                history: this.buildExpenseHistory(expenses)
            },
            benefits: {
                totals: { totalValue: benefitValue, avgPerEmployee: activeEnrollments.length ? benefitValue / activeEnrollments.length : 0, activeEnrollments: activeEnrollments.length },
                benefits: benefits.map((benefit) => ({ id: benefit.id, name: benefit.name, category: benefit.category, monthlyBudget: this.money(benefit.monthlyBudget), annualBudget: this.money(benefit.annualBudget), employerSharePercent: benefit.employerSharePercent, employeeSharePercent: benefit.employeeSharePercent, perEmployeeMax: benefit.perEmployeeMax, department: benefit.department?.name, status: benefit.status, metadata: benefit.metadata || {} })),
                enrollments: enrollments.map((enrollment) => ({ id: enrollment.id, benefitId: enrollment.benefitId, employeeUserId: enrollment.employeeUserId, department: enrollment.department?.name, value: this.money(enrollment.value), status: enrollment.status, enrolledAt: enrollment.enrolledAt })),
                departmentValues: Array.from(benefitsByDepartment.values()).map((d) => ({ ...d, avg: d.employees ? d.value / d.employees : 0 }))
            },
            meta: { generatedAt: new Date().toISOString(), query }
        };
    }
    lastMonths(count) {
        const now = new Date();
        return Array.from({ length: count }, (_, index) => {
            const month = new Date(now.getFullYear(), now.getMonth() - (count - index - 1), 1);
            const next = new Date(month.getFullYear(), month.getMonth() + 1, 1);
            return { label: this.monthKey(month), start: month, end: next };
        });
    }
    formatSalaryRequest(request) {
        const increase = this.money(request.requestedSalary) - this.money(request.currentSalary);
        return {
            id: request.id,
            kind: 'salary',
            type: 'Salary Adjustment',
            priority: request.priority,
            employee: request.employee?.fullName || 'Unknown employee',
            employeeUserId: request.employeeUserId,
            requester: request.requester?.fullName || 'Unknown requester',
            department: request.department?.name,
            descr: request.reason || '',
            reason: request.reason || '',
            currentSalary: this.money(request.currentSalary),
            requestedSalary: this.money(request.requestedSalary),
            amount: increase,
            increase,
            pct: this.money(request.currentSalary) ? (increase / this.money(request.currentSalary)) * 100 : 0,
            date: request.createdAt,
            status: request.status,
            metadata: request.metadata || {}
        };
    }
    formatExpenseRequest(expense) {
        return {
            id: expense.id,
            kind: 'expense',
            type: 'Expense Approval',
            title: expense.description || expense.category,
            category: expense.category,
            priority: expense.metadata?.priority || 'medium',
            dept: expense.Department?.name || 'Unassigned',
            department: expense.Department?.name || 'Unassigned',
            reason: expense.description || '',
            descr: expense.description || '',
            budget: expense.metadata?.budgetName || expense.category,
            requestedBy: expense.requester?.fullName || 'Unknown requester',
            requester: expense.requester?.fullName || 'Unknown requester',
            date: expense.expenseDate,
            amount: this.money(expense.amount),
            currency: expense.currency,
            status: expense.status,
            metadata: expense.metadata || {}
        };
    }
    formatReallocationRequest(request) {
        return {
            id: request.id,
            kind: 'budget',
            type: 'Budget Reallocation',
            priority: request.metadata?.priority || 'medium',
            employee: request.metadata?.requesterName || 'Finance team',
            requester: request.metadata?.requesterName || 'Finance team',
            descr: request.reason || '',
            reason: request.reason || '',
            amount: this.money(request.amount),
            date: request.createdAt,
            status: request.status,
            metadata: request.metadata || {}
        };
    }
    formatPayrollRecord(record) {
        return {
            id: record.id,
            employeeUserId: record.employeeUserId,
            name: record.employee?.fullName || 'Unknown employee',
            email: record.employee?.email,
            department: record.department?.name || 'Unassigned',
            role: record.metadata?.role || 'Employee',
            periodStart: record.periodStart,
            periodEnd: record.periodEnd,
            payDate: record.payDate,
            baseSalary: this.money(record.baseSalary),
            pension: this.money(record.pension),
            grossPay: this.money(record.grossPay),
            tax: this.money(record.tax),
            netPay: this.money(record.netPay),
            overtime: this.money(record.overtime),
            bonus: this.money(record.bonus),
            commission: this.money(record.commission),
            currency: record.currency,
            status: record.status
        };
    }
    buildPayrollSchedule(records) {
        const byType = [
            ['scheduled', 'grossPay'],
            ['commission', 'commission'],
            ['bonus', 'bonus'],
            ['overtime', 'overtime']
        ];
        const now = new Date();
        return byType.map(([type, field], index) => {
            const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 5 + index);
            return {
                date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                title: type,
                amount: records.reduce((sum, record) => sum + this.money(record[field]), 0),
                daysLeft: Math.max(Math.ceil((date.getTime() - now.getTime()) / 86400000), 0)
            };
        });
    }
    buildPayrollSummaries(records) {
        const groups = new Map();
        for (const record of records) {
            const key = record.periodEnd ? new Date(record.periodEnd).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 'Current Payroll';
            const current = groups.get(key) || { name: key, count: 0, gross: 0, pension: 0, tax: 0, net: 0 };
            current.count += 1;
            current.gross += this.money(record.grossPay);
            current.pension += this.money(record.pension);
            current.tax += this.money(record.tax);
            current.net += this.money(record.netPay);
            groups.set(key, current);
        }
        return Array.from(groups.values());
    }
    buildAnnualBudgetSummaries(budgets) {
        const groups = new Map();
        for (const budget of budgets) {
            const year = budget.periodStart ? new Date(budget.periodStart).getFullYear() : new Date().getFullYear();
            const current = groups.get(String(year)) || { year: `Year ${year}`, allocated: 0, spent: 0, departments: [] };
            current.allocated += this.money(budget.allocatedAmount);
            current.spent += this.money(budget.usedAmount);
            current.departments.push({ name: budget.Department?.name || budget.name, allocated: this.money(budget.allocatedAmount), spent: this.money(budget.usedAmount) });
            groups.set(String(year), current);
        }
        return Array.from(groups.values()).map((item) => ({ ...item, variance: item.allocated - item.spent }));
    }
    buildExpenseHistory(expenses) {
        const groups = new Map();
        for (const expense of expenses) {
            const key = new Date(expense.expenseDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
            const current = groups.get(key) || { period: key, total: 0, categories: {} };
            current.total += this.money(expense.amount);
            current.categories[expense.category] = (current.categories[expense.category] || 0) + this.money(expense.amount);
            groups.set(key, current);
        }
        return Array.from(groups.values());
    }
    async decideSalaryRequest(businessId, id, action, actorUserId) {
        const request = await models_1.db.SalaryAdjustmentRequest.findOne({ where: { id, businessId } });
        if (!request)
            throw new Error('Salary adjustment request not found');
        await request.update({ status: action === 'approve' ? 'approved' : 'rejected', reviewedByUserId: actorUserId, reviewedAt: new Date() });
        if (action === 'approve') {
            const employee = await models_1.db.EmployeeRecord.findOne({ where: { businessId, userId: request.employeeUserId } });
            if (employee)
                await employee.update({ salaryInfo: { ...(employee.salaryInfo || {}), baseSalary: request.requestedSalary } });
        }
        return request;
    }
    async rejectExpense(businessId, expenseId, actorUserId) {
        const exp = await models_1.db.Expense.findOne({ where: { id: expenseId, businessId } });
        if (!exp)
            throw new Error("Expense not found");
        await exp.update({ status: 'rejected', metadata: { ...(exp.metadata || {}), reviewedByUserId: actorUserId, reviewedAt: new Date().toISOString() } });
        return exp;
    }
    async decideBudgetReallocation(businessId, id, action, actorUserId) {
        const request = await models_1.db.BudgetReallocationRequest.findOne({ where: { id, businessId } });
        if (!request)
            throw new Error('Budget reallocation request not found');
        await request.update({ status: action === 'approve' ? 'approved' : 'rejected', reviewedByUserId: actorUserId, reviewedAt: new Date() });
        if (action === 'approve' && request.sourceBudgetId && request.targetBudgetId) {
            const [source, target] = await Promise.all([
                models_1.db.Budget.findOne({ where: { id: request.sourceBudgetId, businessId } }),
                models_1.db.Budget.findOne({ where: { id: request.targetBudgetId, businessId } })
            ]);
            if (source && target) {
                await source.update({ allocatedAmount: Math.max(this.money(source.allocatedAmount) - this.money(request.amount), 0) });
                await target.update({ allocatedAmount: this.money(target.allocatedAmount) + this.money(request.amount) });
            }
        }
        return request;
    }
    async createBudgetReallocation(businessId, actorUserId, data) {
        return models_1.db.BudgetReallocationRequest.create({
            businessId,
            requestedByUserId: actorUserId,
            sourceBudgetId: data.sourceBudgetId || null,
            targetBudgetId: data.targetBudgetId || null,
            amount: this.money(data.amount),
            reason: data.reason || 'Budget reallocation requested from Workforce Finance',
            status: 'pending',
            metadata: data.metadata || {}
        });
    }
    async provisionForms(businessId) {
        const templates = [
            { key: 'invoice_creation', title: 'Invoice Creation Form' },
            { key: 'milestone_billing', title: 'Milestone Billing Form' },
            { key: 'payment_tracking', title: 'Payment Collection Tracking Form' },
            { key: 'credit_note', title: 'Credit Note / Invoice Adjustment Form' },
            { key: 'annual_budget_submission', title: 'Annual Budget Submission Form' },
            { key: 'department_budget_request', title: 'Department Budget Request Form' },
            { key: 'expense_reimbursement', title: 'Expense Reimbursement Form' },
            { key: 'operational_expense_entry', title: 'Operational Expense Entry Form' },
            { key: 'purchase_request', title: 'Purchase Request Form' },
            { key: 'vendor_registration', title: 'Vendor Registration Form' },
            { key: 'payroll_preview', title: 'Payroll Preview & Verification Form' },
            { key: 'monthly_summary', title: 'Monthly Finance Summary Form' }
        ];
        for (const t of templates) {
            const existing = await models_1.db.FormDefinition.findOne({ where: { businessId, key: t.key } });
            if (!existing) {
                await models_1.db.FormDefinition.create({
                    businessId, name: t.title, key: t.key, visibility: 'internal',
                    version: 1, schema: { type: 'object', properties: {} }
                });
            }
        }
    }
    // --- Invoicing --- //
    async createInvoice(businessId, data, items) {
        // 1. Calculate totals explicitly
        let subtotal = 0;
        let taxTotal = 0;
        const parsedItems = items || [];
        for (const i of parsedItems) {
            const lineSub = (i.quantity || 1) * (i.unitPrice || 0);
            const lineTax = lineSub * ((i.taxRate || 0) / 100);
            subtotal += lineSub;
            taxTotal += lineTax;
        }
        const discountTotal = data.discountTotal || 0;
        const grandTotal = subtotal + taxTotal - discountTotal;
        // 2. Create invoice
        const inv = await models_1.db.Invoice.create({ ...data, businessId, subtotal, taxTotal, discountTotal, grandTotal });
        // 3. Create items explicitly mapping to Invoice ID
        for (const i of parsedItems) {
            const lineSub = (i.quantity || 1) * (i.unitPrice || 0);
            await models_1.db.InvoiceItem.create({ ...i, businessId, invoiceId: inv.id, lineTotal: lineSub });
        }
        return inv;
    }
    async generateFromDeal(businessId, dealId) {
        const deal = await models_1.db.Deal.findOne({ where: { id: dealId, businessId } });
        if (!deal)
            throw new Error("Deal not found");
        // Generate stub invoice mapping directly from value bounds
        return this.createInvoice(businessId, {
            dealId, clientId: deal.clientId, currency: deal.currency,
            invoiceNumber: `INV-D-${Date.now()}`, issueDate: new Date(), status: 'draft'
        }, [{ description: deal.title, quantity: 1, unitPrice: deal.value, taxRate: 0 }]);
    }
    async generateFromMilestone(businessId, milestoneId) {
        const ms = await models_1.db.ProjectMilestone.findOne({ where: { id: milestoneId, businessId }, include: [{ model: models_1.db.Project }] });
        if (!ms)
            throw new Error("Milestone not found");
        const project = ms.Project;
        const amt = project.budget * (ms.billingPercent / 100);
        return this.createInvoice(businessId, {
            projectId: project.id, clientId: project.clientId, currency: project.currency,
            invoiceNumber: `INV-M-${Date.now()}`, issueDate: new Date(), status: 'draft'
        }, [{ description: ms.name, quantity: 1, unitPrice: amt, taxRate: 0 }]);
    }
    // --- Payments --- //
    async recordPayment(businessId, data) {
        const p = await models_1.db.Payment.create({ ...data, businessId });
        // Dynamically lock Invoice status
        if (p.invoiceId) {
            const inv = await models_1.db.Invoice.findOne({ where: { id: p.invoiceId, businessId } });
            if (inv) {
                const allPayments = await models_1.db.Payment.findAll({ where: { invoiceId: inv.id, status: 'completed' } });
                const totalPaid = allPayments.reduce((acc, curr) => acc + curr.amount, 0);
                if (totalPaid >= inv.grandTotal) {
                    await inv.update({ status: 'paid' });
                }
                else {
                    await inv.update({ status: 'partial' });
                }
            }
        }
        await this.notifyFinance(businessId, 'Payment Recorded', `Payment of ${p.amount} ${p.currency} logged.`);
        return p;
    }
    // --- Expenses --- //
    async createExpense(businessId, data) {
        const exp = await models_1.db.Expense.create({ ...data, businessId });
        await this.notifyFinance(businessId, 'New Expense Submitted', `Expense of ${exp.amount} ${exp.currency} requires approval.`);
        return exp;
    }
    async approveExpense(businessId, expenseId) {
        const exp = await models_1.db.Expense.findOne({ where: { id: expenseId, businessId } });
        if (!exp)
            throw new Error("Expense not found");
        await exp.update({ status: 'approved' });
        // Explicit Budget modification mapping
        if (exp.departmentId) {
            const budgets = await models_1.db.Budget.findAll({ where: { departmentId: exp.departmentId, status: 'active' } });
            for (const b of budgets) {
                await b.update({ usedAmount: b.usedAmount + exp.amount });
            }
        }
        return exp;
    }
    // --- Helpers --- //
    async notifyFinance(businessId, title, message) {
        try {
            // Typically we'd lookup standard finance roles users and map InternalNotifier natively to each.
            // Here we stub out the logic since actual users array mapping would require a lookup.
            const financeUsers = await models_1.db.UserRole.findAll({ include: [{ model: models_1.db.Role, where: { name: 'Finance Manager' } }] });
            for (const u of financeUsers) {
                await notification_service_1.InternalNotifier.send({ businessId, recipientUserId: u.userId, moduleKey: 'finance', type: 'system', title, message, entityType: 'finance', entityId: '' });
            }
        }
        catch (e) { }
    }
}
exports.FinanceService = FinanceService;
