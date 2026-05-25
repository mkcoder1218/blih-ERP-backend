"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FinanceController = void 0;
const finance_service_1 = require("./finance.service");
const auditLog_service_1 = require("../../services/auditLog.service");
const response_1 = require("../../utils/response");
const models_1 = require("../../models");
class FinanceController {
    constructor() {
        this.service = new finance_service_1.FinanceService();
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
    }
}
exports.FinanceController = FinanceController;
