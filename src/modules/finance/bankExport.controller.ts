import type { Request, Response } from "express";
import { errorResponse, successResponse } from "../../utils/response";
import { BankExportService } from "./bankExport.service";

export class BankExportController {
  private service = new BankExportService();

  listTemplates = async (req: Request, res: Response) => {
    try {
      const templates = await this.service.listTemplates(req.user!.businessId);
      successResponse(res, templates, "Bank export templates loaded");
    } catch (error: any) {
      errorResponse(res, error.message, error.statusCode || 500);
    }
  };

  createTemplate = async (req: Request, res: Response) => {
    try {
      const template = await this.service.createTemplate(
        req.user!.businessId,
        req.user!.id,
        req.body || {},
      );
      successResponse(res, template, "Bank export template created", 201);
    } catch (error: any) {
      errorResponse(res, error.message, error.statusCode || 500);
    }
  };

  updateTemplate = async (req: Request, res: Response) => {
    try {
      const template = await this.service.updateTemplate(
        req.user!.businessId,
        req.params.templateId,
        req.user!.id,
        req.body || {},
      );
      successResponse(res, template, "Bank export template updated");
    } catch (error: any) {
      errorResponse(res, error.message, error.statusCode || 500);
    }
  };

  deleteTemplate = async (req: Request, res: Response) => {
    try {
      await this.service.deleteTemplate(
        req.user!.businessId,
        req.params.templateId,
      );
      successResponse(res, null, "Bank export template deleted");
    } catch (error: any) {
      errorResponse(res, error.message, error.statusCode || 500);
    }
  };

  exportBankDocument = async (req: Request, res: Response) => {
    try {
      const templateId = String(req.body?.templateId || "").trim();
      if (!templateId) {
        errorResponse(res, "templateId is required", 400);
        return;
      }

      const { templateId: _templateId, ...salaryQuery } = req.body || {};
      const result = await this.service.generateBankDocument(
        req.user!.businessId,
        templateId,
        salaryQuery,
      );

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${result.filename.replace(/"/g, "")}"`,
      );
      res.setHeader("X-Employee-Count", String(result.employeeCount));
      res.status(200).send(result.pdf);
    } catch (error: any) {
      errorResponse(res, error.message, error.statusCode || 500);
    }
  };
}
