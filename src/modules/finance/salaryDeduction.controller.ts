import type { Request, Response } from "express";
import { errorResponse, successResponse } from "../../utils/response";
import { AuditLogService } from "../../services/auditLog.service";
import { SalaryDeductionService } from "./salaryDeduction.service";

export class SalaryDeductionController {
  private service = new SalaryDeductionService();

  listForSalary = async (req: Request, res: Response) => {
    try {
      const data = await this.service.listForSalary(req.user!.businessId, req.params.payrollLinkId, req.query);
      successResponse(res, data, "Salary deductions loaded");
    } catch (e: any) { errorResponse(res, e.message); }
  };

  removeDeduction = async (req: Request, res: Response) => {
    try {
      const data = await this.service.removeDeduction(req.user!.businessId, req.params.deductionId, req.user!.id, req.query);
      await AuditLogService.log("REMOVE_SALARY_DEDUCTION", "finance_salary_deduction", req.params.deductionId, null, data, req);
      successResponse(res, data, "Salary deduction reason removed");
    } catch (e: any) { errorResponse(res, e.message); }
  };
}
