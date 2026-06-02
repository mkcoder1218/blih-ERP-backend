import type { NextFunction, Request, Response } from "express";
import { AttendanceSettingsService } from "./attendanceSettings.service";
import { ok } from "../../utils/apiResponse";
import { db } from "../../models";

export class AttendanceSettingsController {
  private service = new AttendanceSettingsService();

  get = async (req: Request, res: Response, next: NextFunction) => {
    const businessId = req.params.businessId;
    const business = await db.Business.findByPk(businessId);
    if (!business) return next({ statusCode: 404, message: "Business not found" });

    const settings = await this.service.getOrCreateForBusiness(businessId);
    return ok(res, { attendanceSettings: settings }, "Attendance settings");
  };

  upsert = async (req: Request, res: Response, next: NextFunction) => {
    const businessId = req.params.businessId;
    const business = await db.Business.findByPk(businessId);
    if (!business) return next({ statusCode: 404, message: "Business not found" });

    const settings = await this.service.upsertForBusiness(businessId, req.body);
    return ok(res, { attendanceSettings: settings }, "Attendance settings updated");
  };
}

