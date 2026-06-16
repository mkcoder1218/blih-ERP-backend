import { Op } from "sequelize";
import { db } from "../../models";
import { businessDateEndUtc, businessDateStartUtc } from "../../utils/timezone";
import { calculateAttendanceDay } from "../../services/attendanceCalculation.service";

type Status = string;

const REMOTE_WORKED_MINUTES = 8 * 60;

function isRemoteEmployee(employeeRecord: any) {
  return String(employeeRecord?.employmentType || "").toLowerCase().includes("remote");
}

function applyRemoteAttendanceOverride(calculation: any) {
  return {
    ...calculation,
    totalWorkedMinutes: REMOTE_WORKED_MINUTES,
    totalBreakMinutes: 0,
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
  async buildDaily(businessId: string, opts: { dateYmd: string; departmentId?: string | null; status?: Status | null; search?: string | null; sortBy: string; sortOrder: string }) {
    const settings = await db.BusinessAttendanceSettings.findOne({ where: { businessId } });
    if (!settings) throw Object.assign(new Error("Attendance settings not found"), { statusCode: 400 });
    const tz = settings.timezone || "UTC";

    const startUtc = businessDateStartUtc(opts.dateYmd, tz);
    const endUtc = businessDateEndUtc(opts.dateYmd, tz);

    const employeeWhere: any = { businessId };
    if (opts.departmentId) employeeWhere.departmentId = opts.departmentId;

    const employees = await db.EmployeeRecord.findAll({
      where: employeeWhere,
      include: [
        { model: db.User, as: "user", attributes: ["id", "fullName", "email"] },
        { model: db.Department, as: "department", attributes: ["id", "name"] }
      ]
    });

    const employeeByUserId = new Map<string, any>();
    for (const employee of employees) employeeByUserId.set((employee as any).userId, employee);

    const userIds = employees.map((e: any) => e.userId);
    const eventWhere: any = { businessId, timestampUtc: { [Op.gte]: startUtc, [Op.lt]: endUtc } };
    if (opts.departmentId) eventWhere.employeeId = { [Op.in]: userIds };

    const events = await db.AttendanceEvent.findAll({
      where: eventWhere,
      order: [["timestampUtc", "ASC"]]
    });

    const eventUserIds: string[] = Array.from(new Set(events.map((e: any) => String(e.employeeId))));
    const missingUserIds = opts.departmentId ? [] : eventUserIds.filter((id) => !employeeByUserId.has(id));
    const missingUsers = missingUserIds.length
      ? await db.User.findAll({
          where: { id: { [Op.in]: missingUserIds }, businessId },
          attributes: ["id", "fullName", "email"]
        })
      : [];
    const userById = new Map<string, any>();
    for (const employee of employees) {
      if ((employee as any).user) userById.set((employee as any).userId, (employee as any).user);
    }
    for (const user of missingUsers) userById.set((user as any).id, user);

    const byEmployee = new Map<string, any[]>();
    for (const ev of events) {
      const id = (ev as any).employeeId;
      const arr = byEmployee.get(id) || [];
      arr.push(ev);
      byEmployee.set(id, arr);
    }

    const rowUserIds = Array.from(new Set([...userIds, ...missingUserIds]));
    const rows = rowUserIds.map((userId: string) => {
      const er = employeeByUserId.get(userId) || null;
      const user = userById.get(userId);
      const dept = er?.department || null;
      const evs = byEmployee.get(userId) || [];
      if (!user) return null;

      const { calculation, normalized } = calculateAttendanceDay({
        events: evs.map((e: any) => ({ type: e.type, timestampUtc: new Date(e.timestampUtc) })),
        settings,
        dayStartUtc: startUtc,
        dayEndUtc: endUtc,
        nowUtc: new Date()
      });

      const finalCalculation = isRemoteEmployee(er) ? applyRemoteAttendanceOverride(calculation) : calculation;
      const finalStatus: Status =
        finalCalculation.currentStatus === "NOT_STARTED" && settings.attendanceEnabled ? "MISSED" : finalCalculation.currentStatus;

      return {
        employeeId: user.id,
        employeeName: user.fullName,
        employeeEmail: user.email,
        department: dept ? { id: dept.id, name: dept.name } : null,
        events: {
          checkInAtUtc: normalized.checkInAtUtc,
          lunchOutAtUtc: normalized.lunchOutAtUtc,
          lunchInAtUtc: normalized.lunchInAtUtc,
          checkOutAtUtc: normalized.checkOutAtUtc
        },
        workedMinutes: finalCalculation.totalWorkedMinutes,
        breakMinutes: finalCalculation.totalBreakMinutes,
        expectedMinutes: finalCalculation.expectedMinutes,
        overtimeMinutes: finalCalculation.overtimeMinutes,
        missingMinutes: finalCalculation.missingMinutes,
        status: finalStatus,
        isLate: finalCalculation.isLate,
        lateByMinutes: finalCalculation.lateByMinutes
      };
    }).filter((row): row is NonNullable<typeof row> => Boolean(row));

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

    const employeeWhere: any = { businessId };
    if (opts.departmentId) employeeWhere.departmentId = opts.departmentId;
    if (opts.employeeId) employeeWhere.userId = opts.employeeId;

    const employees = await db.EmployeeRecord.findAll({
      where: employeeWhere,
      include: [
        { model: db.User, as: "user", attributes: ["id", "fullName", "email"] },
        { model: db.Department, as: "department", attributes: ["id", "name"] }
      ]
    });
    const employeeByUserId = new Map<string, any>();
    for (const employee of employees) employeeByUserId.set((employee as any).userId, employee);

    const userIds = employees.map((e: any) => e.userId);
    const eventWhere: any = { businessId, timestampUtc: { [Op.gte]: rangeStartUtc, [Op.lt]: rangeEndUtc } };
    if (opts.departmentId || opts.employeeId) eventWhere.employeeId = { [Op.in]: userIds };

    const events = await db.AttendanceEvent.findAll({
      where: eventWhere,
      order: [["timestampUtc", "ASC"]]
    });

    const eventUserIds: string[] = Array.from(new Set(events.map((e: any) => String(e.employeeId))));
    const missingUserIds = opts.departmentId || opts.employeeId ? [] : eventUserIds.filter((id) => !employeeByUserId.has(id));
    const missingUsers = missingUserIds.length
      ? await db.User.findAll({
          where: { id: { [Op.in]: missingUserIds }, businessId },
          attributes: ["id", "fullName", "email"]
        })
      : [];
    const userById = new Map<string, any>();
    for (const employee of employees) {
      if ((employee as any).user) userById.set((employee as any).userId, (employee as any).user);
    }
    for (const user of missingUsers) userById.set((user as any).id, user);

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

    // Build list of dates in range (inclusive)
    const dates: string[] = [];
    {
      const cur = new Date(opts.startDate + "T00:00:00Z");
      const end = new Date(opts.endDate + "T00:00:00Z");
      while (cur.getTime() <= end.getTime()) {
        dates.push(cur.toISOString().slice(0, 10));
        cur.setUTCDate(cur.getUTCDate() + 1);
      }
    }

    const rows: any[] = [];
    const rowUserIds = Array.from(new Set([...userIds, ...missingUserIds]));
    for (const userId of rowUserIds) {
      const er = employeeByUserId.get(userId) || null;
      const user = userById.get(userId);
      const dept = er?.department || null;
      if (!user) continue;
      if (opts.search) {
        const s = opts.search.toLowerCase();
        if (!user.fullName.toLowerCase().includes(s) && !String(user.email || "").toLowerCase().includes(s)) continue;
      }

      for (const dateYmd of dates) {
        const dayStartUtc = businessDateStartUtc(dateYmd, tz);
        const dayEndUtc = businessDateEndUtc(dateYmd, tz);
        const evs = byEmpDate.get(`${userId}__${dateYmd}`) || [];
        const { calculation, normalized } = calculateAttendanceDay({
          events: evs.map((e: any) => ({ type: e.type, timestampUtc: new Date(e.timestampUtc) })),
          settings,
          dayStartUtc,
          dayEndUtc,
          nowUtc: new Date()
        });

        const finalCalculation = isRemoteEmployee(er) ? applyRemoteAttendanceOverride(calculation) : calculation;
        const status = finalCalculation.currentStatus === "NOT_STARTED" && settings.attendanceEnabled ? "MISSED" : finalCalculation.currentStatus;
        if (opts.status && status !== opts.status) continue;

        rows.push({
          employeeId: user.id,
          employeeName: user.fullName,
          department: dept ? { id: dept.id, name: dept.name } : null,
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
