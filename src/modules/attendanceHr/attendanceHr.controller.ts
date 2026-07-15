import type { Request, Response, NextFunction } from "express";
import { ok } from "../../utils/apiResponse";
import { AttendanceHrService } from "./attendanceHr.service";
import { AttendanceDailyReportService } from "../../services/attendanceDailyReport.service";
import { AttendanceWeeklyReportService } from "../../services/attendanceWeeklyReport.service";
import { AttendanceMonthlyReportService } from "../../services/attendanceMonthlyReport.service";
import { AttendanceDeductionService } from "../../services/attendanceDeduction.service";
import { LatenessReasonRulesService } from "../../services/latenessReasonRules.service";
import { toCsv } from "../../utils/csv";

const DAILY_HEADERS = ["EmployeeName", "TotalDaysExpectedToWork", "TotalDaysWorked", "TotalMissedDays", "PenaltyDeductedHours", "PenaltyDeductionDetails", "DaysAvailableOrWorked", "MissedDays", "Date", "Department", "AssignedStartTime", "MorningCheckIn", "LunchCheckOut", "LunchCheckIn", "EveningCheckOut", "LunchMinutesTaken", "NetHoursWorked", "LatenessStatus", "MinutesLate", "NoticeStatus", "DeductionApplied", "LatenessReason_HROnly"];
const DAILY_PUBLIC_HEADERS = DAILY_HEADERS.filter((header) => header !== "LatenessReason_HROnly");
const WEEKLY_HEADERS = ["EmployeeName", "Department", "ScheduledWorkDays", "DaysOnTime", "DaysLateWithNotice", "DaysLateNoNotice", "DaysAbsent", "DaysIncompletePunch", "LatenessNoticesUsed", "PunctualityRatePercent", "NetHoursWorked", "HalfDayDeductions", "FullDayDeductions"];
const MONTHLY_HEADERS = ["EmployeeName", "Department", "EmploymentCategory", "ScheduledWorkDays", "DaysOnTime", "DaysLateWithNotice", "DaysLateNoNotice", "DaysAbsent", "DaysIncompletePunch", "PunctualityRatePercent", "LatenessNoticesUsed", "TotalMinutesLate", "TotalHoursWorked", "ApprovedOvertimeHours", "HalfDayDeductions", "FullDayDeductions", "DeductedHours", "AnnualLeaveDaysUsed", "SickLeaveDaysUsed", "OtherLeaveDaysUsed", "AnnualLeaveBalanceRemaining", "AccountabilityFlag"];

type DailyAttendanceExportSummary = {
  expected: number;
  worked: number;
  missed: number;
  deductedHours: number;
  penaltyDetails: string[];
  workedDays: string[];
  missedDays: string[];
};

function escapeHtml(value: any) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function toExcelHtml(rows: Record<string, any>[], headers: string[]) {
  const head = headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("");
  const body = rows
    .map((row) => `<tr>${headers.map((header) => `<td>${escapeHtml(row[header])}</td>`).join("")}</tr>`)
    .join("");
  return `<!doctype html><html><head><meta charset="utf-8" /></head><body><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></body></html>`;
}

export class AttendanceHrController {
  private service = new AttendanceHrService();
  private dailyReport = new AttendanceDailyReportService();
  private weeklyReport = new AttendanceWeeklyReportService();
  private monthlyReport = new AttendanceMonthlyReportService();
  private deductionService = new AttendanceDeductionService();
  private latenessReasonRules = new LatenessReasonRulesService();

  private canViewHrOnly(req: Request) {
    const roles = new Set(req.user?.roles || []);
    return Boolean(req.user?.isPlatformSuperAdmin || roles.has("HR_MANAGER") || roles.has("BUSINESS_ADMIN"));
  }

  private assertCanManageReasonRules(req: Request) {
    const roles = new Set(req.user?.roles || []);
    const perms = new Set(req.user?.permissions || []);
    if (req.user?.isPlatformSuperAdmin || roles.has("HR_MANAGER") || roles.has("BUSINESS_ADMIN") || perms.has("attendance.manage")) return;
    throw Object.assign(new Error("Lateness reason configuration requires HR or Business Admin access."), { statusCode: 403 });
  }

  private sendExport(res: Response, filenameBase: string, format: string, rows: Record<string, any>[], headers: string[]) {
    if (format === "excel") {
      res.setHeader("Content-Type", "application/vnd.ms-excel; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${filenameBase}.xls"`);
      return res.status(200).send(toExcelHtml(rows, headers));
    }
    const csv = toCsv(rows, headers);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filenameBase}.csv"`);
    return res.status(200).send(csv);
  }

  private filterEmploymentCategory<T extends { EmploymentCategory?: string | null }>(rows: T[], employmentCategory?: string | null) {
    return employmentCategory ? rows.filter((row) => row.EmploymentCategory === employmentCategory) : rows;
  }

  private filterReportRows<T extends Record<string, any>>(rows: T[], filters: { search?: string | null; status?: string | null }) {
    const search = String(filters.search || "").trim().toLowerCase();
    const status = String(filters.status || "").trim();
    return rows.filter((row) => {
      if (search) {
        const haystack = `${row.EmployeeName || ""} ${row.Department || ""}`.toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      if (!status) return true;
      if (status === "LATE") return Number(row.DaysLateWithNotice || 0) > 0 || Number(row.DaysLateNoNotice || 0) > 0 || String(row.LatenessStatus || "").startsWith("Late");
      if (status === "MISSED") return Number(row.DaysAbsent || 0) > 0 || Number(row.DaysIncompletePunch || 0) > 0 || ["Absent", "IncompletePunch"].includes(String(row.LatenessStatus || ""));
      if (status === "COMPLETED") return Boolean(row.EveningCheckOut) || Number(row.ScheduledWorkDays || 0) > 0;
      if (status === "NOT_STARTED") return String(row.LatenessStatus || "") === "Absent";
      return String(row.LatenessStatus || row.NoticeStatus || row.AccountabilityFlag || "").toLowerCase() === status.toLowerCase();
    });
  }

  private selectedEmployeeIds(queryValue?: string | string[] | null) {
    const values = Array.isArray(queryValue) ? queryValue : String(queryValue || "").split(",");
    const ids = values.map((value) => String(value || "").trim()).filter(Boolean);
    return ids.length ? new Set(ids) : null;
  }

  private filterSelectedEmployees<T extends Record<string, any>>(rows: T[], employeeIds?: Set<string> | null) {
    return employeeIds ? rows.filter((row) => row.EmployeeId && employeeIds.has(row.EmployeeId)) : rows;
  }

  private formatDeductedHours(hours: number) {
    if (!hours) return "0h";
    return Number.isInteger(hours) ? `${hours}h` : `${hours.toFixed(2)}h`;
  }

  private dailyPenaltyDetail(row: Record<string, any>, deduction: ReturnType<AttendanceDeductionService["calculate"]>) {
    if (!deduction.DeductedHours) return "";
    return `${row.Date}: ${this.formatDeductedHours(deduction.DeductedHours)} (${deduction.DeductionLabel} - ${deduction.Reason})`;
  }

  private emptyDailyAttendanceSummary(): DailyAttendanceExportSummary {
    return { expected: 0, worked: 0, missed: 0, deductedHours: 0, penaltyDetails: [], workedDays: [], missedDays: [] };
  }

  private dailyAttendanceSummaries(rows: Record<string, any>[]) {
    const byEmployee = new Map<string, DailyAttendanceExportSummary>();
    for (const row of rows) {
      const key = String(row.EmployeeId || row.EmployeeName || "");
      const summary = byEmployee.get(key) || this.emptyDailyAttendanceSummary();
      const status = String(row.LatenessStatus || "");
      const deduction = this.deductionService.calculate(row as any);
      const penaltyDetail = this.dailyPenaltyDetail(row, deduction);
      summary.expected += 1;
      if (status === "Absent") {
        summary.missed += 1;
        if (row.Date) summary.missedDays.push(String(row.Date));
      } else if (status !== "ApprovedLeave") {
        summary.worked += 1;
        if (row.Date) summary.workedDays.push(String(row.Date));
      }
      summary.deductedHours += Number(deduction.DeductedHours || 0);
      if (penaltyDetail) summary.penaltyDetails.push(penaltyDetail);
      byEmployee.set(key, summary);
    }
    return byEmployee;
  }

  private dailySelectedEmployeeSummaryRows(rows: Record<string, any>[], summaries: ReturnType<AttendanceHrController["dailyAttendanceSummaries"]>, dateLabel: string, canViewHrOnly: boolean) {
    const byEmployee = new Map<string, Record<string, any>>();
    for (const row of rows) {
      const key = String(row.EmployeeId || row.EmployeeName || "");
      if (byEmployee.has(key)) continue;
      const summary = summaries.get(key) || this.emptyDailyAttendanceSummary();
      byEmployee.set(key, {
        EmployeeName: row.EmployeeName,
        TotalDaysExpectedToWork: summary.expected,
        TotalDaysWorked: summary.worked,
        TotalMissedDays: summary.missed,
        PenaltyDeductedHours: this.formatDeductedHours(summary.deductedHours),
        PenaltyDeductionDetails: summary.penaltyDetails.length ? summary.penaltyDetails.join("; ") : "No penalty deductions",
        DaysAvailableOrWorked: summary.workedDays.length ? summary.workedDays.join(", ") : "None",
        MissedDays: summary.missedDays.length ? summary.missedDays.join(", ") : "None",
        Date: dateLabel,
        Department: row.Department || "",
        AssignedStartTime: row.AssignedStartTime || "",
        MorningCheckIn: "",
        LunchCheckOut: "",
        LunchCheckIn: "",
        EveningCheckOut: "",
        LunchMinutesTaken: "",
        NetHoursWorked: row.NetHoursWorked ?? "",
        LatenessStatus: "",
        MinutesLate: "",
        NoticeStatus: "",
        DeductionApplied: summary.deductedHours > 0 ? "Yes" : "No",
        ...(canViewHrOnly ? { LatenessReason_HROnly: row.LatenessReason_HROnly || "" } : {})
      });
    }
    return Array.from(byEmployee.values());
  }

  summary = async (req: Request, res: Response) => {
    const businessId = req.user!.businessId;
    const dateYmd = (req.query as any).date || new Date().toISOString().slice(0, 10);
    const departmentId = (req.query as any).departmentId || null;
    const data = await this.service.summary(businessId, dateYmd, departmentId);
    return ok(res, data, "Attendance summary");
  };

  listLatenessReasonRules = async (req: Request, res: Response) => {
    const rows = await this.latenessReasonRules.listRules(req.user!.businessId, { enabledOnly: req.query.enabledOnly === "true" });
    return ok(res, { rows }, "Lateness reason rules");
  };

  getLatenessCreditConfig = async (req: Request, res: Response) => {
    const config = await this.latenessReasonRules.getCreditConfig(req.user!.businessId);
    return ok(res, { config }, "Lateness credit configuration");
  };

  updateLatenessCreditConfig = async (req: Request, res: Response, next: NextFunction) => {
    try {
      this.assertCanManageReasonRules(req);
      const config = await this.latenessReasonRules.updateCreditConfig(req.user!.businessId, req.body || {});
      return ok(res, { config }, "Lateness credit configuration updated");
    } catch (err: any) {
      return next({ statusCode: err.statusCode || 400, message: err.message });
    }
  };

  createLatenessReasonRule = async (req: Request, res: Response, next: NextFunction) => {
    try {
      this.assertCanManageReasonRules(req);
      const row = await this.latenessReasonRules.upsertRule(req.user!.businessId, req.user!.id, req.body);
      return ok(res, { rule: row }, "Lateness reason rule saved", 201);
    } catch (err: any) {
      return next({ statusCode: err.statusCode || 400, message: err.message });
    }
  };

  updateLatenessReasonRule = async (req: Request, res: Response, next: NextFunction) => {
    try {
      this.assertCanManageReasonRules(req);
      const row = await this.latenessReasonRules.updateRule(req.user!.businessId, req.params.idOrCode, req.body);
      return ok(res, { rule: row }, "Lateness reason rule updated");
    } catch (err: any) {
      return next({ statusCode: err.statusCode || 400, message: err.message });
    }
  };

  enableLatenessReasonRule = async (req: Request, res: Response, next: NextFunction) => {
    try {
      this.assertCanManageReasonRules(req);
      const row = await this.latenessReasonRules.setEnabled(req.user!.businessId, req.params.idOrCode, true);
      return ok(res, { rule: row }, "Lateness reason rule enabled");
    } catch (err: any) {
      return next({ statusCode: err.statusCode || 400, message: err.message });
    }
  };

  disableLatenessReasonRule = async (req: Request, res: Response, next: NextFunction) => {
    try {
      this.assertCanManageReasonRules(req);
      const row = await this.latenessReasonRules.setEnabled(req.user!.businessId, req.params.idOrCode, false);
      return ok(res, { rule: row }, "Lateness reason rule disabled");
    } catch (err: any) {
      return next({ statusCode: err.statusCode || 400, message: err.message });
    }
  };

  reorderLatenessReasonRules = async (req: Request, res: Response, next: NextFunction) => {
    try {
      this.assertCanManageReasonRules(req);
      const rows = await this.latenessReasonRules.reorder(req.user!.businessId, req.body?.rules || req.body?.rows || []);
      return ok(res, { rows }, "Lateness reason rules reordered");
    } catch (err: any) {
      return next({ statusCode: err.statusCode || 400, message: err.message });
    }
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
      sortOrder: q.sortOrder,
      page: Number(q.page || 1),
      size: Number(q.size || 20)
    });
    return ok(res, data, "Attendance (daily)");
  };

  latenessReasonUsage = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.service.latenessReasonUsage(req.user!.businessId, {
        startDate: (req.query as any).startDate,
        endDate: (req.query as any).endDate,
        search: (req.query as any).search || null,
        size: Number((req.query as any).size || 100)
      });
      return ok(res, data, "Lateness reason usage");
    } catch (e: any) {
      return next({ statusCode: e.statusCode || 500, message: e.message || "Failed" });
    }
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

  sendLateNoReasonPenaltyMessage = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const businessId = req.user!.businessId;
      const employeeId = req.params.employeeId;
      const dateYmd = req.body?.date || new Date().toISOString().slice(0, 10);
      const data = await this.service.sendLateNoReasonPenaltyMessage(businessId, employeeId, dateYmd);
      return ok(res, data, "Penalty message sent");
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
      d ? new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: true }).format(d).toUpperCase() : "";

    const rows = data.rows.map((r: any) => ({
      "Employee ID": r.employeeId,
      "Employee Name": r.employeeName,
      Department: r.department?.name || "",
      "Assigned Start Time": r.assignedStartTime || "",
      "Employment Category": r.employmentCategory || "",
      "Scheduled Work Days": Array.isArray(r.scheduledWorkDays) ? r.scheduledWorkDays.join("|") : "",
      Date: r.date,
      "Scheduled Working Days": r.scheduledDayUnits ?? "",
      "Full Working Days": r.fullWorkingDayUnits ?? "",
      "Half Working Days": r.halfWorkingDayUnits ?? "",
      "Paid Days Off": r.paidDayOffUnits ?? "",
      "Days Attended": r.checkInAtUtc ? 1 : 0,
      "Days Absent": r.currentStatus === "MISSED" ? 1 : 0,
      "Approved Leave Days": r.approvedLeaveDays || 0,
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
      "Expected Time Formatted": `${Math.floor(Number(r.expectedMinutes || 0) / 60)}h ${Number(r.expectedMinutes || 0) % 60}m`,
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
      "Assigned Start Time": "",
      "Employment Category": "",
      "Scheduled Work Days": "",
      Date: "",
      "Scheduled Working Days": "",
      "Full Working Days": "",
      "Half Working Days": "",
      "Paid Days Off": "",
      "Days Attended": "",
      "Days Absent": "",
      "Approved Leave Days": "",
      "Check-In": "",
      "Lunch Out": "",
      "Lunch In": "",
      "Check-Out": "",
      "Total Worked Minutes": "",
      "Total Worked Formatted": "",
      "Total Break Minutes": "",
      "Expected Minutes": "",
      "Expected Time Formatted": "",
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

  exportDailyReport = async (req: Request, res: Response) => {
    const q: any = req.query;
    const canViewHrOnly = this.canViewHrOnly(req);
    const enableDateFilter = q.enableDateFilter === true || q.enableDateFilter === "true";
    const startDate = enableDateFilter ? q.startDate : q.date;
    const endDate = enableDateFilter ? q.endDate : q.date;
    const selectedEmployeeIds = this.selectedEmployeeIds(q.employeeIds);
    const reportRows = await this.dailyReport.generate(req.user!.businessId, {
      startDate,
      endDate,
      departmentId: q.departmentId || null,
      employeeId: q.employeeId || null,
      audience: canViewHrOnly ? "hr" : "public"
    });
    const filtered = this.filterReportRows(this.filterEmploymentCategory(reportRows, q.employmentCategory), {
      search: q.search,
      status: q.status
    });
    const selectedRows = this.filterSelectedEmployees(filtered, selectedEmployeeIds);
    const summaries = this.dailyAttendanceSummaries(selectedRows);
    const rows = selectedEmployeeIds
      ? this.dailySelectedEmployeeSummaryRows(selectedRows, summaries, enableDateFilter ? `${startDate} to ${endDate}` : q.date, canViewHrOnly)
      : selectedRows.map((row: any) => {
        const summary = summaries.get(String(row.EmployeeId || row.EmployeeName || "")) || this.emptyDailyAttendanceSummary();
        const deduction = this.deductionService.calculate(row);
        const penaltyDetail = this.dailyPenaltyDetail(row, deduction);
        const isWorkedDay = row.LatenessStatus !== "Absent" && row.LatenessStatus !== "ApprovedLeave";
        const isMissedDay = row.LatenessStatus === "Absent";
        return {
          EmployeeName: row.EmployeeName,
          TotalDaysExpectedToWork: summary.expected,
          TotalDaysWorked: summary.worked,
          TotalMissedDays: summary.missed,
          PenaltyDeductedHours: this.formatDeductedHours(deduction.DeductedHours),
          PenaltyDeductionDetails: penaltyDetail || "No penalty deductions",
          DaysAvailableOrWorked: isWorkedDay && row.Date ? row.Date : "None",
          MissedDays: isMissedDay && row.Date ? row.Date : "None",
          Date: row.Date,
          Department: row.Department || "",
          AssignedStartTime: row.AssignedStartTime,
          MorningCheckIn: row.MorningCheckIn || "",
          LunchCheckOut: row.LunchCheckOut || "",
          LunchCheckIn: row.LunchCheckIn || "",
          EveningCheckOut: row.EveningCheckOut || "",
          LunchMinutesTaken: row.LunchMinutesTaken ?? "",
          NetHoursWorked: row.NetHoursWorked,
          LatenessStatus: row.LatenessStatus,
          MinutesLate: row.MinutesLate,
          NoticeStatus: row.NoticeStatus,
          DeductionApplied: row.DeductionApplied ? "Yes" : "No",
          ...(canViewHrOnly ? { LatenessReason_HROnly: row.LatenessReason_HROnly || "" } : {})
        };
      });
    const headers = canViewHrOnly ? DAILY_HEADERS : DAILY_PUBLIC_HEADERS;
    const filenameDate = enableDateFilter ? `${startDate}-to-${endDate}` : q.date;
    return this.sendExport(res, `attendance-daily-${filenameDate}`, q.format, rows, headers);
  };

  exportWeeklyReport = async (req: Request, res: Response) => {
    const q: any = req.query;
    const selectedEmployeeIds = this.selectedEmployeeIds(q.employeeIds);
    const reportRows = await this.weeklyReport.generate(req.user!.businessId, {
      startDate: q.startDate,
      endDate: q.endDate,
      departmentId: q.departmentId || null,
      employeeId: q.employeeId || null,
      audience: this.canViewHrOnly(req) ? "hr" : "public"
    });
    const filtered = this.filterReportRows(this.filterEmploymentCategory(reportRows as any, q.employmentCategory), {
      search: q.search,
      status: q.status
    });
    const selectedRows = this.filterSelectedEmployees(filtered, selectedEmployeeIds);
    const rows = selectedRows.map((row: any) => ({
      EmployeeName: row.EmployeeName,
      Department: row.Department || "",
      ScheduledWorkDays: row.ScheduledWorkDays,
      DaysOnTime: row.DaysOnTime,
      DaysLateWithNotice: row.DaysLateWithNotice,
      DaysLateNoNotice: row.DaysLateNoNotice,
      DaysAbsent: row.DaysAbsent,
      DaysIncompletePunch: row.DaysIncompletePunch,
      LatenessNoticesUsed: row.LatenessNoticesUsed,
      PunctualityRatePercent: row.PunctualityRatePercent,
      NetHoursWorked: row.NetHoursWorked,
      HalfDayDeductions: row.HalfDayDeductions,
      FullDayDeductions: row.FullDayDeductions
    }));
    return this.sendExport(res, `attendance-weekly-${q.startDate}-to-${q.endDate}`, q.format, rows, WEEKLY_HEADERS);
  };

  exportMonthlyReport = async (req: Request, res: Response) => {
    const q: any = req.query;
    const selectedEmployeeIds = this.selectedEmployeeIds(q.employeeIds);
    const reportRows = await this.monthlyReport.generate(req.user!.businessId, {
      month: q.month,
      departmentId: q.departmentId || null,
      employeeId: q.employeeId || null,
      audience: this.canViewHrOnly(req) ? "hr" : "public"
    });
    const filtered = this.filterReportRows(this.filterEmploymentCategory(reportRows, q.employmentCategory), {
      search: q.search,
      status: q.status
    });
    const selectedRows = this.filterSelectedEmployees(filtered, selectedEmployeeIds);
    const rows = selectedRows.map((row: any) => ({
      EmployeeName: row.EmployeeName,
      Department: row.Department || "",
      EmploymentCategory: row.EmploymentCategory || "",
      ScheduledWorkDays: row.ScheduledWorkDays,
      DaysOnTime: row.DaysOnTime,
      DaysLateWithNotice: row.DaysLateWithNotice,
      DaysLateNoNotice: row.DaysLateNoNotice,
      DaysAbsent: row.DaysAbsent,
      DaysIncompletePunch: row.DaysIncompletePunch,
      PunctualityRatePercent: row.PunctualityRatePercent,
      LatenessNoticesUsed: row.LatenessNoticesUsed,
      TotalMinutesLate: row.TotalMinutesLate,
      TotalHoursWorked: row.TotalHoursWorked,
      ApprovedOvertimeHours: row.ApprovedOvertimeHours,
      HalfDayDeductions: row.HalfDayDeductions,
      FullDayDeductions: row.FullDayDeductions,
      DeductedHours: row.DeductedHours,
      AnnualLeaveDaysUsed: row.AnnualLeaveDaysUsed,
      SickLeaveDaysUsed: row.SickLeaveDaysUsed,
      OtherLeaveDaysUsed: row.OtherLeaveDaysUsed,
      AnnualLeaveBalanceRemaining: row.AnnualLeaveBalanceRemaining,
      AccountabilityFlag: row.AccountabilityFlag
    }));
    return this.sendExport(res, `attendance-monthly-${q.month}`, q.format, rows, MONTHLY_HEADERS);
  };
}
