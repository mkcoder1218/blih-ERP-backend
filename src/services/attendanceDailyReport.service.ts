import { Op } from "sequelize";
import { db } from "../models";
import { businessDateEndUtc, businessDateStartUtc } from "../utils/timezone";
import { AttendanceRosterResolver, type AttendanceRosterEmployeeDay } from "./attendanceRosterResolver.service";
import { LatenessReasonRulesService } from "./latenessReasonRules.service";

export type AttendanceDailyReportPunches = {
  MorningCheckIn: string | null;
  LunchCheckOut: string | null;
  LunchCheckIn: string | null;
  EveningCheckOut: string | null;
};

export type AttendanceDailyReportRow = AttendanceDailyReportPunches & {
  Date: string;
  EmployeeId: string;
  EmployeeName: string;
  Department: string | null;
  AssignedStartTime: "08:00" | "08:30" | "09:00";
  EmploymentCategory: "Managerial" | "Non-Managerial" | null;
  LunchMinutesTaken: number | null;
  NetHoursWorked: number;
  TotalHoursWorked: number;
  RegularHoursWorked: number;
  ApprovedOvertimeHours: number;
  LatenessStatus: "OnTime" | "Late-WithNotice" | "Late-NoNotice" | "Absent" | "IncompletePunch" | "ApprovedLeave";
  MinutesLate: number;
  NoticeStatus: "Approved" | "Pending" | "None" | "Invalid" | "Rejected" | "Expired" | "NotApplicable";
  LatenessNoticesUsedWeek: number;
  LatenessNoticesUsedMonth: number;
  LatenessNoticesUsedByReason?: Record<string, number>;
  LatenessReasonCode?: string | null;
  DeductionApplied: boolean;
  LeaveCategory: "Annual" | "Sick" | "Other" | null;
  ApprovedLeaveDays: number;
  LatenessReason_HROnly?: string | null;
  LatenessNotice_HROnly?: {
    id: string;
    submittedAt: string | null;
    approvedAt: string | null;
    approvedBy: string | null;
    rejectedAt: string | null;
    rejectedBy: string | null;
    reasonCategory: string | null;
    reasonText: string | null;
    validityStatus: string | null;
    deadlineAt: string | null;
  } | null;
};

export type AttendanceDailyReportOptions = {
  startDate: string;
  endDate: string;
  departmentId?: string | null;
  employeeId?: string | null;
  audience?: "hr" | "public";
};

type AttendanceEventType = "CHECK_IN" | "LUNCH_OUT" | "LUNCH_IN" | "CHECK_OUT";
type PunchMap = Partial<Record<AttendanceEventType, any>>;

const ADDIS_ABABA_TZ = "Africa/Addis_Ababa";
const REQUIRED_PUNCHES: AttendanceEventType[] = ["CHECK_IN", "LUNCH_OUT", "LUNCH_IN", "CHECK_OUT"];
const MINIMUM_LUNCH_MINUTES = 60;
const STANDARD_WORK_MINUTES = 8 * 60;

function localTime(date: Date | null): string | null {
  if (!date) return null;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: ADDIS_ABABA_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(date).toUpperCase();
}

function localMinutes(date: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ADDIS_ABABA_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === "hour")?.value);
  const minute = Number(parts.find((part) => part.type === "minute")?.value);
  return hour * 60 + minute;
}

function hhmmToMinutes(hhmm: string): number {
  const [hour, minute] = hhmm.split(":").map((part) => Number(part));
  return hour * 60 + minute;
}

function minutesBetween(start: Date, end: Date): number {
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 60_000));
}

function roundHours(minutes: number): number {
  return Math.round((minutes / 60) * 100) / 100;
}

function dateRangeWhere(startDate: string, endDate: string) {
  return {
    [Op.or]: [
      { startDate: { [Op.between]: [startDate, endDate] } },
      { endDate: { [Op.between]: [startDate, endDate] } },
      { startDate: { [Op.lte]: startDate }, endDate: { [Op.gte]: endDate } },
    ],
  };
}

function leaveCategory(leaveType: unknown): "Annual" | "Sick" | "Other" {
  const normalized = String(leaveType || "").toLowerCase();
  if (normalized.includes("annual")) return "Annual";
  if (normalized.includes("sick")) return "Sick";
  return "Other";
}

function requestOverlapsDate(request: any, dateYmd: string) {
  const from = request.fromAt ? new Date(request.fromAt) : null;
  const to = request.toAt ? new Date(request.toAt) : null;
  if (!from && !to) return false;
  const start = from ? new Intl.DateTimeFormat("en-CA", { timeZone: ADDIS_ABABA_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(from) : dateYmd;
  const end = to ? new Intl.DateTimeFormat("en-CA", { timeZone: ADDIS_ABABA_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(to) : start;
  return start <= dateYmd && dateYmd <= end;
}

function noticeDate(request: any) {
  const raw = request.fromAt || request.submittedAt || request.createdAt;
  if (!raw) return null;
  return new Intl.DateTimeFormat("en-CA", { timeZone: ADDIS_ABABA_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(raw));
}

function isVagueReason(reason: unknown) {
  const normalized = String(reason || "").trim().replace(/\s+/g, " ");
  if (normalized.length < 12) return true;
  return /^(late|traffic|personal|emergency|issue|n\/a|na|none|other|misc|because)$/i.test(normalized);
}

function isBeforeDeadline(request: any) {
  if (!request.deadlineAt) return true;
  const submitted = new Date(request.submittedAt || request.createdAt || request.fromAt || 0).getTime();
  const deadline = new Date(request.deadlineAt).getTime();
  return submitted <= deadline;
}

function baseApprovedNotice(request: any) {
  return request?.status === "approved" && request.validityStatus === "valid" && !isVagueReason(request.reasonText || request.reason);
}

function isoWeekStart(dateYmd: string) {
  const date = new Date(`${dateYmd}T00:00:00.000Z`);
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - day + 1);
  return date.toISOString().slice(0, 10);
}

function isoWeekEndExclusive(dateYmd: string) {
  const date = new Date(`${isoWeekStart(dateYmd)}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 7);
  return date.toISOString().slice(0, 10);
}

function monthStart(dateYmd: string) {
  return `${dateYmd.slice(0, 7)}-01`;
}

function monthEndExclusive(dateYmd: string) {
  const date = new Date(`${monthStart(dateYmd)}T00:00:00.000Z`);
  date.setUTCMonth(date.getUTCMonth() + 1);
  return date.toISOString().slice(0, 10);
}

async function countApprovedUsableNotices(notices: any[], startYmd: string, endExclusiveYmd: string, rules: LatenessReasonRulesService) {
  const usedByReason: Record<string, number> = {};
  for (const notice of notices) {
    if (!baseApprovedNotice(notice)) continue;
    const date = noticeDate(notice);
    if (!date || date < startYmd || date >= endExclusiveYmd) continue;
    const evaluation = await rules.evaluateNotice(notice, Number(notice.durationMinutes || 0));
    if (!evaluation.usable) continue;
    usedByReason[evaluation.reasonCode] = (usedByReason[evaluation.reasonCode] || 0) + 1;
  }
  return { total: Object.values(usedByReason).reduce((sum, value) => sum + value, 0), usedByReason };
}

function approvedOvertimeMinutesForDay(requests: any[]) {
  return requests.reduce((sum, request) => sum + Number(request.approvedOvertimeMinutes || 0), 0);
}

function groupByEmployeeDate(events: any[]) {
  const grouped = new Map<string, any[]>();
  for (const event of events) {
    const date = new Intl.DateTimeFormat("en-CA", { timeZone: ADDIS_ABABA_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(event.timestampUtc));
    const key = `${event.employeeId}__${date}`;
    const rows = grouped.get(key) || [];
    rows.push(event);
    grouped.set(key, rows);
  }
  for (const rows of grouped.values()) rows.sort((a, b) => new Date(a.timestampUtc).getTime() - new Date(b.timestampUtc).getTime());
  return grouped;
}

function buildPunchMap(events: any[], corrections: any[]) {
  const punchMap: PunchMap = {};
  for (const type of REQUIRED_PUNCHES) {
    const event = events.find((row) => row.type === type);
    if (event) punchMap[type] = event;
  }
  for (const correction of corrections) {
    const type = String(correction.category || "") as AttendanceEventType;
    if (REQUIRED_PUNCHES.includes(type) && !punchMap[type] && correction.fromAt) {
      punchMap[type] = {
        id: correction.id,
        type,
        employeeId: correction.employeeUserId,
        timestampUtc: correction.fromAt,
        isManualCorrection: true,
      };
    }
  }
  return punchMap;
}

export class AttendanceDailyReportService {
  private rosterResolver = new AttendanceRosterResolver();
  private latenessRules = new LatenessReasonRulesService();

  async generate(businessId: string, opts: AttendanceDailyReportOptions): Promise<AttendanceDailyReportRow[]> {
    const audience = opts.audience || "hr";
    const rosterRows = await this.rosterResolver.resolveExpectedEmployees(businessId, {
      startDate: opts.startDate,
      endDate: opts.endDate,
      departmentId: opts.departmentId,
      employeeId: opts.employeeId,
    });
    const employeeIds = Array.from(new Set(rosterRows.map((row) => row.employeeId)));
    if (!rosterRows.length) return [];

    const rangeStartUtc = businessDateStartUtc(opts.startDate, ADDIS_ABABA_TZ);
    const rangeEndUtc = businessDateEndUtc(opts.endDate, ADDIS_ABABA_TZ);
    const employeeWhere = employeeIds.length ? { [Op.in]: employeeIds } : { [Op.in]: ["00000000-0000-0000-0000-000000000000"] };

    const [events, leaves, notices, corrections, overtimeRequests, lateExplanations, dailyReasons] = await Promise.all([
      db.AttendanceEvent.findAll({
        where: { businessId, employeeId: employeeWhere, timestampUtc: { [Op.gte]: rangeStartUtc, [Op.lt]: rangeEndUtc } },
        order: [["timestampUtc", "ASC"]],
      }),
      db.LeaveRequest.findAll({
        where: {
          businessId,
          employeeUserId: employeeWhere,
          status: "approved",
          ...dateRangeWhere(opts.startDate, opts.endDate),
        },
      }),
      db.AttendanceRequest.findAll({
        where: {
          businessId,
          employeeUserId: employeeWhere,
          requestType: "lateness_notice",
        },
      }),
      db.AttendanceRequest.findAll({
        where: {
          businessId,
          employeeUserId: employeeWhere,
          status: "approved",
          requestType: "check_in_correction",
          category: { [Op.in]: REQUIRED_PUNCHES },
        },
      }),
      db.OvertimeRequest.findAll({
        where: {
          businessId,
          employeeUserId: employeeWhere,
          status: "closed",
          [Op.or]: [
            { requestedDate: { [Op.between]: [opts.startDate, opts.endDate] } },
            { overtimeDate: { [Op.between]: [opts.startDate, opts.endDate] } },
          ],
        },
      }),
      db.AttendanceLateExplanation.findAll({ where: { businessId, employeeId: employeeWhere } }),
      db.AttendanceDailyReason.findAll({
        where: {
          businessId,
          employeeId: employeeWhere,
          dateYmd: { [Op.between]: [opts.startDate, opts.endDate] },
          reasonType: "late",
        },
        include: [{ model: db.AttendanceLateReason, as: "lateReason", attributes: ["id", "name"] }],
      }),
    ]);

    const eventsByEmployeeDate = groupByEmployeeDate(events);
    const leavesByEmployee = new Map<string, any[]>();
    for (const leave of leaves) {
      const rows = leavesByEmployee.get(leave.employeeUserId) || [];
      rows.push(leave);
      leavesByEmployee.set(leave.employeeUserId, rows);
    }
    const noticesByEmployee = new Map<string, any[]>();
    for (const notice of notices) {
      const rows = noticesByEmployee.get(notice.employeeUserId) || [];
      rows.push(notice);
      noticesByEmployee.set(notice.employeeUserId, rows);
    }
    const correctionsByEmployeeDate = groupByEmployeeDate(
      corrections
        .filter((correction: any) => correction.fromAt)
        .map((correction: any) => ({
          ...correction,
          employeeId: correction.employeeUserId,
          timestampUtc: correction.fromAt,
          type: correction.category,
        }))
    );
    const overtimeByEmployeeDate = new Map<string, any[]>();
    for (const request of overtimeRequests) {
      const requestDate = request.requestedDate || request.overtimeDate;
      const key = `${request.employeeUserId}__${requestDate}`;
      const rows = overtimeByEmployeeDate.get(key) || [];
      rows.push(request);
      overtimeByEmployeeDate.set(key, rows);
    }
    const lateByEventId = new Map<string, any>();
    for (const explanation of lateExplanations) lateByEventId.set(explanation.attendanceEventId, explanation);
    const dailyReasonsByEmployeeDate = new Map<string, any[]>();
    for (const reason of dailyReasons) {
      const key = `${reason.employeeId}__${reason.dateYmd}`;
      const rows = dailyReasonsByEmployeeDate.get(key) || [];
      rows.push(reason);
      dailyReasonsByEmployeeDate.set(key, rows);
    }

    return Promise.all(rosterRows.map(async (roster) => {
      const row = this.buildRow({
        roster,
        events: eventsByEmployeeDate.get(`${roster.employeeId}__${roster.dateYmd}`) || [],
        corrections: correctionsByEmployeeDate.get(`${roster.employeeId}__${roster.dateYmd}`) || [],
        leaves: leavesByEmployee.get(roster.employeeId) || [],
        notices: noticesByEmployee.get(roster.employeeId) || [],
        approvedOvertimeRequests: overtimeByEmployeeDate.get(`${roster.employeeId}__${roster.dateYmd}`) || [],
        lateByEventId,
        dailyReasons: dailyReasonsByEmployeeDate.get(`${roster.employeeId}__${roster.dateYmd}`) || [],
        audience,
      });
      const resolved = await row;
      if (audience !== "hr") {
        delete resolved.LatenessReason_HROnly;
        delete resolved.LatenessNotice_HROnly;
      }
      return resolved;
    }));
  }

  private async buildRow(params: {
    roster: AttendanceRosterEmployeeDay;
    events: any[];
    corrections: any[];
    leaves: any[];
    notices: any[];
    approvedOvertimeRequests: any[];
    lateByEventId: Map<string, any>;
    dailyReasons: any[];
    audience: "hr" | "public";
  }): Promise<AttendanceDailyReportRow> {
    const { roster, events, corrections, leaves, notices, approvedOvertimeRequests, lateByEventId, dailyReasons } = params;
    const punchMap = buildPunchMap(events, corrections);
    const checkIn = punchMap.CHECK_IN ? new Date(punchMap.CHECK_IN.timestampUtc) : null;
    const lunchOut = punchMap.LUNCH_OUT ? new Date(punchMap.LUNCH_OUT.timestampUtc) : null;
    const lunchIn = punchMap.LUNCH_IN ? new Date(punchMap.LUNCH_IN.timestampUtc) : null;
    const checkOut = punchMap.CHECK_OUT ? new Date(punchMap.CHECK_OUT.timestampUtc) : null;
    const hasAnyPunch = REQUIRED_PUNCHES.some((type) => Boolean(punchMap[type]));
    const hasAllPunches = REQUIRED_PUNCHES.every((type) => Boolean(punchMap[type]));
    const hasApprovedLeave = leaves.some((leave) => leave.startDate <= roster.dateYmd && roster.dateYmd <= leave.endDate);
    const approvedLeave = leaves.find((leave) => leave.startDate <= roster.dateYmd && roster.dateYmd <= leave.endDate);
    const dayNotices = notices.filter((notice) => noticeDate(notice) === roster.dateYmd || requestOverlapsDate(notice, roster.dateYmd));
    const checkInLateMinutes = checkIn ? Math.max(0, localMinutes(checkIn) - hhmmToMinutes(roster.assignedStartTime)) : 0;
    const evaluatedNotices = await Promise.all(dayNotices.map(async (notice) => ({
      notice,
      evaluation: notice.status === "approved" ? await this.latenessRules.evaluateNotice(notice, checkInLateMinutes || Number(notice.durationMinutes || 0)) : null,
    })));
    const approvedNoticeEvaluation = evaluatedNotices.find((item) => item.notice.status === "approved" && item.evaluation?.usable) || null;
    const approvedNotice = approvedNoticeEvaluation?.notice || null;
    const pendingNotice = dayNotices.find((notice) => notice.status === "pending" && notice.validityStatus !== "invalid" && !isVagueReason(notice.reasonText || notice.reason));
    const rejectedNotice = dayNotices.find((notice) => notice.status === "rejected");
    const expiredNotice = dayNotices.find((notice) => notice.status === "expired" || notice.validityStatus === "expired" || (!notice.allowAfterDeadline && !isBeforeDeadline(notice)));
    const invalidNotice = dayNotices.find((notice) => notice.status === "invalid" || notice.validityStatus === "invalid" || isVagueReason(notice.reasonText || notice.reason)) ||
      evaluatedNotices.find((item) => item.notice.status === "approved" && item.evaluation && !item.evaluation.usable && item.evaluation.noticeStatus === "Invalid")?.notice;
    const selectedNotice = approvedNotice || pendingNotice || invalidNotice || expiredNotice || rejectedNotice || dayNotices[0] || null;
    const weekNoticeUsage = await countApprovedUsableNotices(notices, isoWeekStart(roster.dateYmd), isoWeekEndExclusive(roster.dateYmd), this.latenessRules);
    const monthNoticeUsage = await countApprovedUsableNotices(notices, monthStart(roster.dateYmd), monthEndExclusive(roster.dateYmd), this.latenessRules);

    let latenessStatus: AttendanceDailyReportRow["LatenessStatus"] = "OnTime";
    let noticeStatus: AttendanceDailyReportRow["NoticeStatus"] = "NotApplicable";
    let minutesLate = 0;

    if (!hasAnyPunch && hasApprovedLeave) {
      latenessStatus = "ApprovedLeave";
      noticeStatus = "NotApplicable";
    } else if (!hasAnyPunch && !hasApprovedLeave) {
      latenessStatus = "Absent";
      noticeStatus = selectedNotice ? (approvedNotice ? "Approved" : pendingNotice ? "Pending" : expiredNotice ? "Expired" : rejectedNotice ? "Rejected" : "Invalid") : "None";
    } else if (!hasAllPunches) {
      latenessStatus = "IncompletePunch";
      noticeStatus = selectedNotice ? (approvedNotice ? "Approved" : pendingNotice ? "Pending" : expiredNotice ? "Expired" : rejectedNotice ? "Rejected" : "Invalid") : "None";
    } else if (checkIn) {
      minutesLate = Math.max(0, localMinutes(checkIn) - hhmmToMinutes(roster.assignedStartTime));
      if (minutesLate === 0) {
        latenessStatus = "OnTime";
        noticeStatus = "NotApplicable";
      } else if (approvedNotice) {
        latenessStatus = "Late-WithNotice";
        noticeStatus = "Approved";
      } else if (pendingNotice) {
        latenessStatus = "Late-NoNotice";
        noticeStatus = "Pending";
      } else if (expiredNotice) {
        latenessStatus = "Late-NoNotice";
        noticeStatus = "Expired";
      } else if (rejectedNotice) {
        latenessStatus = "Late-NoNotice";
        noticeStatus = "Rejected";
      } else if (invalidNotice) {
        latenessStatus = "Late-NoNotice";
        noticeStatus = "Invalid";
      } else {
        latenessStatus = "Late-NoNotice";
        noticeStatus = "None";
      }
    }

    const lunchMinutesTaken = lunchOut && lunchIn ? minutesBetween(lunchOut, lunchIn) : null;
    let totalMinutes = 0;
    let approvedOvertimeMinutes = 0;
    if (checkIn && lunchOut && lunchIn && checkOut) {
      const morning = minutesBetween(checkIn, lunchOut);
      const afternoon = minutesBetween(lunchIn, checkOut);
      const rawWorkedMinutes = Math.max(0, morning + afternoon - Math.max(0, MINIMUM_LUNCH_MINUTES - (lunchMinutesTaken || 0)));
      const rawExcessMinutes = Math.max(0, rawWorkedMinutes - STANDARD_WORK_MINUTES);
      approvedOvertimeMinutes = Math.min(rawExcessMinutes, approvedOvertimeMinutesForDay(approvedOvertimeRequests));
      totalMinutes = Math.min(rawWorkedMinutes, STANDARD_WORK_MINUTES + approvedOvertimeMinutes);
    }
    const regularMinutes = Math.min(totalMinutes, STANDARD_WORK_MINUTES);

    const checkInExplanation = punchMap.CHECK_IN?.id ? lateByEventId.get(punchMap.CHECK_IN.id) : null;
    const dailyReasonText = dailyReasons
      .map((reason) => reason.lateReason?.name || reason.comment)
      .filter(Boolean)
      .join("; ");
    const latenessReason = checkInExplanation?.customReason || checkInExplanation?.reason?.name || dailyReasonText || null;
    const noticeDetail = selectedNotice
      ? {
          id: selectedNotice.id,
          submittedAt: selectedNotice.submittedAt ? new Date(selectedNotice.submittedAt).toISOString() : selectedNotice.createdAt ? new Date(selectedNotice.createdAt).toISOString() : null,
          approvedAt: selectedNotice.approvedAt ? new Date(selectedNotice.approvedAt).toISOString() : null,
          approvedBy: selectedNotice.approvedByUserId || null,
          rejectedAt: selectedNotice.rejectedAt ? new Date(selectedNotice.rejectedAt).toISOString() : null,
          rejectedBy: selectedNotice.rejectedByUserId || null,
          reasonCategory: selectedNotice.reasonCategory || selectedNotice.category || null,
          reasonText: selectedNotice.reasonText || selectedNotice.reason || null,
          validityStatus: invalidNotice && selectedNotice.id === invalidNotice.id ? "invalid" : selectedNotice.validityStatus || null,
          deadlineAt: selectedNotice.deadlineAt ? new Date(selectedNotice.deadlineAt).toISOString() : null,
        }
      : null;

    return {
      Date: roster.dateYmd,
      EmployeeId: roster.employeeId,
      EmployeeName: roster.employeeName,
      Department: roster.department?.name || null,
      AssignedStartTime: roster.assignedStartTime,
      EmploymentCategory: roster.employmentCategory,
      MorningCheckIn: localTime(checkIn),
      LunchCheckOut: localTime(lunchOut),
      LunchCheckIn: localTime(lunchIn),
      EveningCheckOut: localTime(checkOut),
      LunchMinutesTaken: lunchMinutesTaken,
      NetHoursWorked: roundHours(totalMinutes),
      TotalHoursWorked: roundHours(totalMinutes),
      RegularHoursWorked: roundHours(regularMinutes),
      ApprovedOvertimeHours: roundHours(approvedOvertimeMinutes),
      LatenessStatus: latenessStatus,
      MinutesLate: minutesLate,
      NoticeStatus: noticeStatus,
      LatenessNoticesUsedWeek: weekNoticeUsage.total,
      LatenessNoticesUsedMonth: monthNoticeUsage.total,
      LatenessNoticesUsedByReason: monthNoticeUsage.usedByReason,
      LatenessReasonCode: latenessStatus === "Late-WithNotice" ? approvedNoticeEvaluation?.evaluation?.reasonCode || null : null,
      DeductionApplied: latenessStatus === "Absent" || latenessStatus === "IncompletePunch" || latenessStatus === "Late-NoNotice",
      LeaveCategory: approvedLeave ? leaveCategory(approvedLeave.leaveType) : null,
      ApprovedLeaveDays: approvedLeave ? 1 : 0,
      LatenessReason_HROnly: latenessReason,
      LatenessNotice_HROnly: noticeDetail,
    };
  }
}
