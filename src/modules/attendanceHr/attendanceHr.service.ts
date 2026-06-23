import { Op } from "sequelize";
import { db } from "../../models";
import { businessDateEndUtc, businessDateStartUtc } from "../../utils/timezone";
import { calculateAttendanceDay } from "../../services/attendanceCalculation.service";
import { AttendanceRosterResolver } from "../../services/attendanceRosterResolver.service";
import { LatenessReasonRulesService } from "../../services/latenessReasonRules.service";
import { AttendanceDailyReportService } from "../../services/attendanceDailyReport.service";
import { AttendanceTelegramService } from "../attendanceTelegram/attendanceTelegram.service";

type Status = string;
type LatenessReasonCreditSummary = {
  mode: "PER_REASON" | "GLOBAL_POOL";
  remaining: number;
  limit: number;
  used: number;
  reasons: any[];
};

const REMOTE_WORKED_MINUTES = 8 * 60;
const REASON_REQUEST_TYPES = ["lateness_notice", "not_available"];

function isRemoteEmployee(employeeRecord: any) {
  return String(employeeRecord?.employmentType || "").toLowerCase().includes("remote");
}

function applyRemoteAttendanceOverride(calculation: any) {
  return {
    ...calculation,
    rawWorkedMinutes: REMOTE_WORKED_MINUTES,
    totalWorkedMinutes: REMOTE_WORKED_MINUTES,
    totalBreakMinutes: 0,
    penaltyMinutes: 0,
    penaltyReason: null,
    expectedMinutes: REMOTE_WORKED_MINUTES,
    remainingMinutes: 0,
    overtimeMinutes: 0,
    missingMinutes: 0,
    isLate: false,
    lateByMinutes: 0,
    isComplete: true,
    isInProgress: false,
    currentStatus: "REMOTE"
  };
}

export class AttendanceHrService {
  private rosterResolver = new AttendanceRosterResolver();
  private latenessReasonRules = new LatenessReasonRulesService();
  private dailyReport = new AttendanceDailyReportService();
  private telegram = new AttendanceTelegramService();

  async buildDaily(businessId: string, opts: { dateYmd: string; departmentId?: string | null; status?: Status | null; search?: string | null; sortBy: string; sortOrder: string }) {
    const settings = await db.BusinessAttendanceSettings.findOne({ where: { businessId } });
    if (!settings) throw Object.assign(new Error("Attendance settings not found"), { statusCode: 400 });
    const tz = settings.timezone || "UTC";

    const startUtc = businessDateStartUtc(opts.dateYmd, tz);
    const endUtc = businessDateEndUtc(opts.dateYmd, tz);

    const rosterRows = await this.rosterResolver.resolveExpectedEmployees(businessId, {
      startDate: opts.dateYmd,
      endDate: opts.dateYmd,
      departmentId: opts.departmentId
    });

    const userIds = Array.from(new Set(rosterRows.map((row) => row.employeeId)));
    const eventWhere: any = { businessId, timestampUtc: { [Op.gte]: startUtc, [Op.lt]: endUtc } };
    eventWhere.employeeId = { [Op.in]: userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"] };

    const events = await db.AttendanceEvent.findAll({
      where: eventWhere,
      order: [["timestampUtc", "ASC"]]
    });

    const byEmployee = new Map<string, any[]>();
    for (const ev of events) {
      const id = (ev as any).employeeId;
      const arr = byEmployee.get(id) || [];
      arr.push(ev);
      byEmployee.set(id, arr);
    }

    const settingsJson = typeof settings.toJSON === "function" ? settings.toJSON() : settings;
    const balancePairs = await Promise.all(userIds.map(async (employeeId) => {
      const balances = await this.latenessReasonRules.balancesForEmployee(businessId, employeeId, startUtc);
      const enabled = balances.filter((balance) => balance.enabled);
      const global = enabled.find((balance) => balance.creditMode === "GLOBAL_POOL");
      if (global) {
        const credit: LatenessReasonCreditSummary = {
          mode: "GLOBAL_POOL",
          remaining: Number(global.globalRemainingThisMonth ?? global.remainingThisMonth ?? 0),
          limit: Number(global.globalMonthlyLimit ?? global.monthlyLimit ?? 0),
          used: Number(global.globalUsedThisMonth ?? global.usedThisMonth ?? 0),
          reasons: enabled.map((balance) => ({
            ...balance,
            remainingThisMonth: Number(global.globalRemainingThisMonth ?? global.remainingThisMonth ?? 0),
            monthlyLimit: Number(global.globalMonthlyLimit ?? global.monthlyLimit ?? 0),
          }))
        };
        return [employeeId, credit] as const;
      }
      const remaining = enabled.reduce((sum, balance) => sum + Number(balance.remainingThisMonth || 0), 0);
      const limit = enabled.reduce((sum, balance) => sum + Number(balance.monthlyLimit || 0), 0);
      const used = enabled.reduce((sum, balance) => sum + Number(balance.usedThisMonth || 0), 0);
      const credit: LatenessReasonCreditSummary = { mode: "PER_REASON", remaining, limit, used, reasons: enabled };
      return [employeeId, credit] as const;
    }));
    const creditByEmployee = new Map(balancePairs);

    const submittedReasonRows = userIds.length
      ? await db.AttendanceRequest.findAll({
          where: {
            businessId,
            employeeUserId: { [Op.in]: userIds },
            requestType: { [Op.in]: REASON_REQUEST_TYPES },
            fromAt: { [Op.gte]: startUtc, [Op.lt]: endUtc }
          },
          attributes: ["employeeUserId"]
        })
      : [];
    const submittedReasonEmployeeIds = new Set(submittedReasonRows.map((row: any) => row.employeeUserId));
    const dailyReasonRows = userIds.length
      ? await db.AttendanceDailyReason.findAll({
          where: {
            businessId,
            employeeId: { [Op.in]: userIds },
            reasonType: "late",
            dateYmd: opts.dateYmd
          },
          attributes: ["employeeId"]
        })
      : [];
    for (const row of dailyReasonRows) submittedReasonEmployeeIds.add((row as any).employeeId);
    const leaveRows = userIds.length
      ? await db.LeaveRequest.findAll({
          where: {
            businessId,
            employeeUserId: { [Op.in]: userIds },
            status: { [Op.in]: ["pending", "approved"] },
            startDate: { [Op.lte]: opts.dateYmd },
            endDate: { [Op.gte]: opts.dateYmd }
          },
          attributes: ["employeeUserId"]
        })
      : [];
    const leaveEmployeeIds = new Set(leaveRows.map((row: any) => row.employeeUserId));
    const noReasonPenaltyGraceMinutes = Number((settings as any).lateNoReasonPenaltyGraceMinutes || 0);

    const rows = rosterRows.map((roster) => {
      const er = roster.employeeRecord || null;
      const evs = byEmployee.get(roster.employeeId) || [];
      const calcSettings = { ...settingsJson, defaultStartTime: roster.assignedStartTime };

      const { calculation, normalized } = calculateAttendanceDay({
        events: evs.map((e: any) => ({ type: e.type, timestampUtc: new Date(e.timestampUtc) })),
        settings: calcSettings,
        dayStartUtc: startUtc,
        dayEndUtc: endUtc,
        nowUtc: new Date()
      });

      const finalCalculation = isRemoteEmployee(er) ? applyRemoteAttendanceOverride(calculation) : calculation;
      const finalStatus: Status =
        finalCalculation.currentStatus === "NOT_STARTED" && settings.attendanceEnabled ? "MISSED" : finalCalculation.currentStatus;
      const hasSubmittedReason = submittedReasonEmployeeIds.has(roster.employeeId);
      const hasLeaveRequest = leaveEmployeeIds.has(roster.employeeId);
      const isMissedWithoutLeave = ["MISSED", "NOT_STARTED"].includes(String(finalStatus)) && !hasLeaveRequest;
      const isLateWithoutReason =
        Boolean(finalCalculation.isLate) &&
        Number(finalCalculation.lateByMinutes || 0) > noReasonPenaltyGraceMinutes &&
        !hasSubmittedReason &&
        !hasLeaveRequest;

      return {
        employeeId: roster.employeeId,
        employeeName: roster.employeeName,
        employeeEmail: roster.employeeEmail,
        department: roster.department,
        assignedStartTime: roster.assignedStartTime,
        employmentCategory: roster.employmentCategory,
        scheduledWorkDays: roster.scheduledWorkDays,
        scheduledDate: roster.dateYmd,
        events: {
          checkInAtUtc: normalized.checkInAtUtc,
          lunchOutAtUtc: normalized.lunchOutAtUtc,
          lunchInAtUtc: normalized.lunchInAtUtc,
          checkOutAtUtc: normalized.checkOutAtUtc
        },
        workedMinutes: finalCalculation.totalWorkedMinutes,
        rawWorkedMinutes: finalCalculation.rawWorkedMinutes,
        breakMinutes: finalCalculation.totalBreakMinutes,
        penaltyMinutes: finalCalculation.penaltyMinutes,
        penaltyReason: finalCalculation.penaltyReason,
        latenessReasonCredit: creditByEmployee.get(roster.employeeId) || { remaining: 0, limit: 0, reasons: [] },
        expectedMinutes: finalCalculation.expectedMinutes,
        overtimeMinutes: finalCalculation.overtimeMinutes,
        missingMinutes: finalCalculation.missingMinutes,
        status: finalStatus,
        isLate: finalCalculation.isLate,
        lateByMinutes: finalCalculation.lateByMinutes,
        hasSubmittedLatenessReason: hasSubmittedReason,
        hasLeaveRequest,
        lateNoReasonPenaltyEligible: isLateWithoutReason,
        noReasonPenaltyMessageEligible: isLateWithoutReason || isMissedWithoutLeave,
        latenessReasonCreditApplies: !["MISSED", "NOT_STARTED"].includes(String(finalStatus)),
        latenessReasonCreditNote: ["MISSED", "NOT_STARTED"].includes(String(finalStatus)) ? "Absence requires leave; lateness credit is not used." : null
      };
    });

    const filtered = rows.filter((r: any) => {
      if (opts.search) {
        const s = opts.search.toLowerCase();
        if (!r.employeeName.toLowerCase().includes(s) && !r.employeeEmail.toLowerCase().includes(s)) return false;
      }
      if (opts.status) return r.status === opts.status;
      return true;
    });

    const sortDir = opts.sortOrder === "desc" ? -1 : 1;
    filtered.sort((a: any, b: any) => {
      if (opts.sortBy === "name") return a.employeeName.localeCompare(b.employeeName) * sortDir;
      if (opts.sortBy === "workedMinutes") return (a.workedMinutes - b.workedMinutes) * sortDir;
      if (opts.sortBy === "status") return a.status.localeCompare(b.status) * sortDir;
      // checkInTime
      const at = a.events.checkInAtUtc ? new Date(a.events.checkInAtUtc).getTime() : 0;
      const bt = b.events.checkInAtUtc ? new Date(b.events.checkInAtUtc).getTime() : 0;
      return (at - bt) * sortDir;
    });

    return { date: opts.dateYmd, timezone: tz, settings, rows: filtered };
  }

  async sendLateNoReasonPenaltyMessage(businessId: string, employeeId: string, dateYmd: string) {
    const rows = await this.dailyReport.generate(businessId, {
      startDate: dateYmd,
      endDate: dateYmd,
      employeeId,
      audience: "hr"
    });
    const row = rows[0];
    if (!row) throw Object.assign(new Error("Attendance row not found for the selected employee and date"), { statusCode: 404 });
    const canSend =
      (row.LatenessStatus === "Late-NoNotice" && row.NoticeStatus === "None" && Number(row.MinutesLate || 0) > 0) ||
      (row.LatenessStatus === "Absent" && row.NoticeStatus === "None" && Number(row.ApprovedLeaveDays || 0) <= 0);
    if (!canSend) {
      throw Object.assign(new Error("Penalty message can only be sent for late or absent employees without a reason or leave request"), { statusCode: 400 });
    }

    const employeeName = row.EmployeeName || "Unknown employee";
    const department = row.Department || "N/A";
    const minutesLate = Number(row.MinutesLate || 0);
    const messageText = row.LatenessStatus === "Absent"
      ? `${employeeName} who works in ${department} didnot come to work and didnot send a reason to the group and due to that he will get a 4hr penality if you have any complain contact your HR manager`
      : `${employeeName} who works in ${department} late this ${minutesLate} min and didnot send a reason to the group and due to that he will get a 4hr penality if you have any complain contact your HR manager`;
    const message = [
      `name:${employeeName}`,
      `message : ${messageText}`
    ].join("\n");

    await this.telegram.sendAttendanceGroupMessage(businessId, message, "late_no_reason_penalty_notice");
    return { sent: true, message };
  }

  async summary(businessId: string, dateYmd: string, departmentId?: string | null) {
    const daily = await this.buildDaily(businessId, { dateYmd, departmentId, sortBy: "name", sortOrder: "asc" });
    const counts = {
      inProgress: 0,
      totalCheckIns: 0,
      completed: 0,
      missed: 0,
      lateArrivals: 0
    };
    for (const r of daily.rows) {
      if (r.events.checkInAtUtc) counts.totalCheckIns += 1;
      if (r.status === "IN_PROGRESS" || r.status === "ON_BREAK") counts.inProgress += 1;
      if (r.status === "COMPLETED") counts.completed += 1;
      if (r.status === "MISSED" || r.status === "NOT_STARTED") counts.missed += 1;
      if (r.isLate) counts.lateArrivals += 1;
    }
    return { date: dateYmd, timezone: daily.timezone, cards: counts };
  }

  async employeeDetails(businessId: string, employeeId: string, dateYmd: string) {
    const settings = await db.BusinessAttendanceSettings.findOne({ where: { businessId } });
    const tz = settings?.timezone || "UTC";
    const startUtc = businessDateStartUtc(dateYmd, tz);
    const endUtc = businessDateEndUtc(dateYmd, tz);

    const user = await db.User.findOne({ where: { id: employeeId, businessId } });
    if (!user) throw Object.assign(new Error("Employee not found"), { statusCode: 404 });

    const employeeRecord = await db.EmployeeRecord.findOne({
      where: { userId: employeeId, businessId },
      include: [{ model: db.Department, as: "department", attributes: ["id", "name"] }]
    });

    const events = await db.AttendanceEvent.findAll({
      where: { businessId, employeeId, timestampUtc: { [Op.gte]: startUtc, [Op.lt]: endUtc } },
      order: [["timestampUtc", "ASC"]]
    });

    const eventIds = events.map((e: any) => e.id);
    const explanations = eventIds.length
      ? await db.AttendanceLateExplanation.findAll({
          where: { businessId, attendanceEventId: { [Op.in]: eventIds } },
          include: [{ model: db.AttendanceLateReason, as: "reason", attributes: ["id", "name", "requiresComment"] }]
        })
      : [];
    const expMap = new Map<string, any>();
    for (const ex of explanations) expMap.set((ex as any).attendanceEventId, ex);

    return {
      date: dateYmd,
      timezone: tz,
      lunch: settings
        ? {
            lunchBreakEnabled: settings.lunchBreakEnabled !== false,
            lunchMode: String(settings.lunchMode || "FLEXIBLE"),
            fixedLunchStartTime: settings.fixedLunchStartTime || null,
            fixedLunchEndTime: settings.fixedLunchEndTime || null,
            allowMultipleLunchBreaks: Boolean(settings.allowMultipleLunchBreaks),
          }
        : null,
      employee: { id: user.id, fullName: user.fullName, email: user.email, department: employeeRecord?.department || null },
      events: events.map((e: any) => ({
        ...e.toJSON(),
        lateExplanation: expMap.get(e.id)
          ? {
              id: (expMap.get(e.id) as any).id,
              lateByMinutes: (expMap.get(e.id) as any).lateByMinutes,
              customReason: (expMap.get(e.id) as any).customReason,
              reason: (expMap.get(e.id) as any).reason ? { id: (expMap.get(e.id) as any).reason.id, name: (expMap.get(e.id) as any).reason.name, requiresComment: (expMap.get(e.id) as any).reason.requiresComment } : null
            }
          : null
      }))
    };
  }

  async report(businessId: string, opts: {
    startDate: string;
    endDate: string;
    departmentId?: string | null;
    employeeId?: string | null;
    status?: string | null;
    search?: string | null;
    sortBy: string;
    sortOrder: string;
  }) {
    const settings = await db.BusinessAttendanceSettings.findOne({ where: { businessId } });
    if (!settings) throw Object.assign(new Error("Attendance settings not found"), { statusCode: 400 });
    const tz = settings.timezone || "UTC";

    const rangeStartUtc = businessDateStartUtc(opts.startDate, tz);
    const rangeEndUtc = businessDateEndUtc(opts.endDate, tz);

    const rosterRows = await this.rosterResolver.resolveExpectedEmployees(businessId, {
      startDate: opts.startDate,
      endDate: opts.endDate,
      departmentId: opts.departmentId,
      employeeId: opts.employeeId
    });

    const userIds = Array.from(new Set(rosterRows.map((row) => row.employeeId)));
    const eventWhere: any = { businessId, timestampUtc: { [Op.gte]: rangeStartUtc, [Op.lt]: rangeEndUtc } };
    eventWhere.employeeId = { [Op.in]: userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"] };

    const events = await db.AttendanceEvent.findAll({
      where: eventWhere,
      order: [["timestampUtc", "ASC"]]
    });

    const localDateKey = (d: Date) =>
      new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);

    const byEmpDate = new Map<string, any[]>();
    for (const ev of events) {
      const empId = (ev as any).employeeId;
      const date = localDateKey(new Date((ev as any).timestampUtc));
      const k = `${empId}__${date}`;
      const arr = byEmpDate.get(k) || [];
      arr.push(ev);
      byEmpDate.set(k, arr);
    }

    const rows: any[] = [];
    const settingsJson = typeof settings.toJSON === "function" ? settings.toJSON() : settings;
    for (const roster of rosterRows) {
      if (opts.search) {
        const s = opts.search.toLowerCase();
        if (!roster.employeeName.toLowerCase().includes(s) && !String(roster.employeeEmail || "").toLowerCase().includes(s)) continue;
      }

      {
        const dateYmd = roster.dateYmd;
        const dayStartUtc = businessDateStartUtc(dateYmd, tz);
        const dayEndUtc = businessDateEndUtc(dateYmd, tz);
        const evs = byEmpDate.get(`${roster.employeeId}__${dateYmd}`) || [];
        const calcSettings = { ...settingsJson, defaultStartTime: roster.assignedStartTime };
        const { calculation, normalized } = calculateAttendanceDay({
          events: evs.map((e: any) => ({ type: e.type, timestampUtc: new Date(e.timestampUtc) })),
          settings: calcSettings,
          dayStartUtc,
          dayEndUtc,
          nowUtc: new Date()
        });

        const finalCalculation = isRemoteEmployee(roster.employeeRecord) ? applyRemoteAttendanceOverride(calculation) : calculation;
        const status = finalCalculation.currentStatus === "NOT_STARTED" && settings.attendanceEnabled ? "MISSED" : finalCalculation.currentStatus;
        if (opts.status && status !== opts.status) continue;

        rows.push({
          employeeId: roster.employeeId,
          employeeName: roster.employeeName,
          department: roster.department,
          assignedStartTime: roster.assignedStartTime,
          employmentCategory: roster.employmentCategory,
          scheduledWorkDays: roster.scheduledWorkDays,
          date: dateYmd,
          checkInAtUtc: normalized.checkInAtUtc,
          lunchOutAtUtc: normalized.lunchOutAtUtc,
          lunchInAtUtc: normalized.lunchInAtUtc,
          checkOutAtUtc: normalized.checkOutAtUtc,
          ...finalCalculation,
          currentStatus: status
        });
      }
    }

    // Attach late reason details in one query for all check-ins in this report range.
    const checkInEventIds = events.filter((e: any) => e.type === "CHECK_IN").map((e: any) => e.id);
    if (checkInEventIds.length) {
      const exps = await db.AttendanceLateExplanation.findAll({
        where: { businessId, attendanceEventId: { [Op.in]: checkInEventIds } },
        include: [{ model: db.AttendanceLateReason, as: "reason", attributes: ["id", "name"] }]
      });
      const byEvent = new Map<string, any>();
      for (const ex of exps) byEvent.set((ex as any).attendanceEventId, ex);
      for (const r of rows) {
        // Find check-in event for this employee/date
        const checkIn = byEmpDate.get(`${r.employeeId}__${r.date}`)?.find((e: any) => e.type === "CHECK_IN");
        if (!checkIn) continue;
        const ex = byEvent.get(checkIn.id);
        r.lateReasonName = ex?.reason?.name || "";
        r.lateExplanation = ex?.customReason || "";
        r.lateByMinutes = ex?.lateByMinutes ?? r.lateByMinutes ?? 0;
      }
    }

    const dir = opts.sortOrder === "desc" ? -1 : 1;
    rows.sort((a, b) => {
      if (opts.sortBy === "name") return a.employeeName.localeCompare(b.employeeName) * dir;
      if (opts.sortBy === "workedMinutes") return (a.totalWorkedMinutes - b.totalWorkedMinutes) * dir;
      if (opts.sortBy === "status") return a.currentStatus.localeCompare(b.currentStatus) * dir;
      return a.date.localeCompare(b.date) * dir;
    });

    return { timezone: tz, rows };
  }
}
