"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FinanceService = void 0;
const models_1 = require("../../models");
const notification_service_1 = require("../notification/notification.service");
class FinanceService {
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
