import type { Request, Response } from "express";
import { smtpService } from "./smtp.service";

function businessIdFor(req: Request) {
  return req.user!.isPlatformSuperAdmin && req.query.businessId ? String(req.query.businessId) : req.user!.businessId;
}

export class SmtpController {
  listProviders = async (req: Request, res: Response) => {
    const includeInactive = Boolean(req.user?.isPlatformSuperAdmin && req.query.includeInactive === "true");
    res.json({ providers: await smtpService.listProviders(includeInactive) });
  };

  createProvider = async (req: Request, res: Response) => {
    const provider = await smtpService.createProvider(req.body, req.user!.id);
    res.status(201).json({ provider });
  };

  updateProvider = async (req: Request, res: Response) => {
    const provider = await smtpService.updateProvider(req.params.id, req.body, req.user!.id);
    res.json({ provider });
  };

  deleteProvider = async (req: Request, res: Response) => {
    await smtpService.deleteProvider(req.params.id);
    res.status(204).send();
  };

  getBusinessSetting = async (req: Request, res: Response) => {
    res.json({ smtpSettings: await smtpService.getBusinessSetting(businessIdFor(req)) });
  };

  saveBusinessSetting = async (req: Request, res: Response) => {
    const smtpSettings = await smtpService.upsertBusinessSetting(businessIdFor(req), req.body);
    res.json({ smtpSettings });
  };

  testBusinessSetting = async (req: Request, res: Response) => {
    const result = await smtpService.testBusinessSetting(businessIdFor(req), req.body);
    res.json({ ok: true, sent: result.sent, message: result.sent ? "SMTP test email sent" : "SMTP connection verified" });
  };

  sendPunctualityTestEmail = async (req: Request, res: Response) => {
    const result = await smtpService.sendPunctualityTestEmail(businessIdFor(req), req.body);
    res.json({ ok: true, sent: result.sent, message: "Punctuality test email sent" });
  };
}
