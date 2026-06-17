import type { Request, Response, NextFunction } from "express";
import { ok } from "../../utils/apiResponse";
import { AttendanceHrService } from "./attendanceHr.service";

export class AttendanceHrController {
  private service = new AttendanceHrService();

  summary = async (req: Request, res: Response) => {
    const businessId = req.user!.businessId;
    const dateYmd = (req.query as any).date || new Date().toISOString().slice(0, 10);
    const departmentId = (req.query as any).departmentId || null;
    const data = await this.service.summary(businessId, dateYmd, departmentId);
    return ok(res, data, "Attendance summary");
  };

  daily = async (req: Request, res: Response) => {
    const businessId = req.user!.businessId;
    const q: any = req.query;
    const dateYmd = q.date || new Date().toISOString().slice(0, 10);
    const data = await this.service.buildDaily(businessId, {
      dateYmd,
      departmentId: q.departmentId || null,
      status: q.status || null,
      search: q.search || null,
      sortBy: q.sortBy,
      sortOrder: q.sortOrder
    });
    return ok(res, data, "Attendance (daily)");
  };

  employee = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const businessId = req.user!.businessId;
      const employeeId = req.params.employeeId;
      const dateYmd = (req.query as any).date || new Date().toISOString().slice(0, 10);
      const data = await this.service.employeeDetails(businessId, employeeId, dateYmd);
      return ok(res, data, "Attendance (employee)");
    } catch (e: any) {
      return next({ statusCode: e.statusCode || 500, message: e.message || "Failed" });
    }
  };

  report = async (req: Request, res: Response) => {
    const businessId = req.user!.businessId;
    const q: any = req.query;
    const data = await this.service.report(businessId, {
      startDate: q.startDate,
      endDate: q.endDate,
      departmentId: q.departmentId || null,
      employeeId: q.employeeId || null,
      status: q.status || null,
      search: q.search || null,
      sortBy: q.sortBy,
      sortOrder: q.sortOrder
    });
    return ok(res, data, "Attendance report");
  };

  export = async (req: Request, res: Response) => {
    const businessId = req.user!.businessId;
    const q: any = req.query;
    const data = await this.service.report(businessId, {
      startDate: q.startDate,
      endDate: q.endDate,
      departmentId: q.departmentId || null,
      employeeId: q.employeeId || null,
      status: q.status || null,
      search: q.search || null,
      sortBy: q.sortBy,
      sortOrder: q.sortOrder
    });

    const tz = data.timezone || "UTC";
    const fmt = (d: Date | null) =>
      d ? new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit" }).format(d) : "";

    const rows = data.rows.map((r: any) => ({
      "Employee ID": r.employeeId,
      "Employee Name": r.employeeName,
      Department: r.department?.name || "",
      Date: r.date,
      "Check-In": fmt(r.checkInAtUtc),
      "Lunch Out": fmt(r.lunchOutAtUtc),
      "Lunch In": fmt(r.lunchInAtUtc),
      "Check-Out": fmt(r.checkOutAtUtc),
      "Raw Worked Minutes": r.rawWorkedMinutes,
      "Total Worked Minutes": r.totalWorkedMinutes,
      "Total Worked Formatted": `${Math.floor(r.totalWorkedMinutes / 60)}h ${r.totalWorkedMinutes % 60}m`,
      "Total Break Minutes": r.totalBreakMinutes,
      "Penalty Minutes": r.penaltyMinutes || 0,
      "Penalty Reason": r.penaltyReason || "",
      "Expected Minutes": r.expectedMinutes,
      "Overtime Minutes": r.overtimeMinutes,
      "Missing Minutes": r.missingMinutes,
      "Late By Minutes": r.lateByMinutes,
      "Late Reason": r.lateReasonName || "",
      "Late Explanation": r.lateExplanation || "",
      "Attendance Status": r.currentStatus
    }));

    const headers = Object.keys(rows[0] || {
      "Employee ID": "",
      "Employee Name": "",
      Department: "",
      Date: "",
      "Check-In": "",
      "Lunch Out": "",
      "Lunch In": "",
      "Check-Out": "",
      "Total Worked Minutes": "",
      "Total Worked Formatted": "",
      "Total Break Minutes": "",
      "Expected Minutes": "",
      "Overtime Minutes": "",
      "Missing Minutes": "",
      "Late By Minutes": "",
      "Late Reason": "",
      "Late Explanation": "",
      "Attendance Status": ""
    });

    const { toCsv } = await import("../../utils/csv");
    const csv = toCsv(rows as any, headers);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename=\"attendance-${q.startDate}-to-${q.endDate}.csv\"`);
    return res.status(200).send(csv);
  };
}
