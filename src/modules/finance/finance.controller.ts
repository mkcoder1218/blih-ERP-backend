
import type { Request, Response } from 'express';
import { FinanceService } from './finance.service';
import { AuditLogService } from '../../services/auditLog.service';
import { errorResponse, successResponse, paginationResponse } from '../../utils/response';
import { db } from '../../models';

export class FinanceController {
  private service = new FinanceService();

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
}
