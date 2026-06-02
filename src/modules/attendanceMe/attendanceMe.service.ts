import { Op, Transaction } from "sequelize";
import { db } from "../../models";
import { haversineDistanceMeters } from "../../utils/geo";
import { businessDateEndUtc, businessDateStartUtc, endOfBusinessDayUtc, startOfBusinessDayUtc } from "../../utils/timezone";
import { calculateAttendanceDay } from "../../services/attendanceCalculation.service";

type AttendanceEventType = "CHECK_IN" | "LUNCH_OUT" | "LUNCH_IN" | "CHECK_OUT";

const EVENT_LABEL: Record<AttendanceEventType, string> = {
  CHECK_IN: "Checked in",
  LUNCH_OUT: "Lunch out",
  LUNCH_IN: "Lunch in",
  CHECK_OUT: "Checked out"
};

function nextAllowedTypes(params: {
  latestType: AttendanceEventType | null;
  lunchBreakEnabled: boolean;
  allowMultipleLunchBreaks: boolean;
  hasTakenLunchAlready: boolean;
}): AttendanceEventType[] {
  const { latestType, lunchBreakEnabled, allowMultipleLunchBreaks, hasTakenLunchAlready } = params;
  if (!latestType) return ["CHECK_IN"];
  if (latestType === "CHECK_IN") return lunchBreakEnabled ? ["LUNCH_OUT", "CHECK_OUT"] : ["CHECK_OUT"];
  if (latestType === "LUNCH_OUT") return ["LUNCH_IN"];
  if (latestType === "LUNCH_IN") {
    if (!lunchBreakEnabled) return ["CHECK_OUT"];
    if (!allowMultipleLunchBreaks && hasTakenLunchAlready) return ["CHECK_OUT"];
    return ["LUNCH_OUT", "CHECK_OUT"];
  }
  return []; // CHECK_OUT -> none
}

export class AttendanceMeService {
  async getTodaySummary(userId: string, businessId: string) {
    const settings = await db.BusinessAttendanceSettings.findOne({ where: { businessId } });
    if (!settings) return { settings: null, disabledReason: "Attendance settings not found", timeline: [], nextAllowed: [] };

    const tz = settings.timezone || "UTC";
    const now = new Date();
    const startUtc = startOfBusinessDayUtc(now, tz);
    const endUtc = endOfBusinessDayUtc(now, tz);

    const events = await db.AttendanceEvent.findAll({
      where: { businessId, employeeId: userId, timestampUtc: { [Op.gte]: startUtc, [Op.lt]: endUtc } },
      order: [["timestampUtc", "ASC"]]
    });

    const latest: AttendanceEventType | null = events.length ? (events[events.length - 1].type as AttendanceEventType) : null;
    const lunchBreakEnabled = settings.lunchBreakEnabled !== false;
    const allowMultipleLunchBreaks = Boolean(settings.allowMultipleLunchBreaks);
    const lunchOutCount = events.filter((e: any) => e.type === "LUNCH_OUT").length;
    const hasTakenLunchAlready = lunchOutCount > 0;
    const nextAllowed = nextAllowedTypes({ latestType: latest, lunchBreakEnabled, allowMultipleLunchBreaks, hasTakenLunchAlready });

    const { calculation, normalized } = calculateAttendanceDay({
      events: events.map((e: any) => ({ type: e.type, timestampUtc: new Date(e.timestampUtc) })),
      settings,
      dayStartUtc: startUtc,
      dayEndUtc: endUtc,
      nowUtc: now
    });

    return {
      settings,
      disabledReason: settings.attendanceEnabled ? null : "Attendance is disabled",
      timeline: events.map((e: any) => ({
        id: e.id,
        type: e.type,
        label: EVENT_LABEL[e.type as AttendanceEventType] || e.type,
        timestampUtc: e.timestampUtc,
        withinAllowedRadius: e.withinAllowedRadius,
        distanceMeters: Number(e.distanceMeters)
      })),
      // Return empty nextAllowed when attendance is disabled so the UI shows no action buttons.
      nextAllowed: settings.attendanceEnabled ? nextAllowed : [],
      day: {
        checkInAtUtc: normalized.checkInAtUtc,
        lunchOutAtUtc: normalized.lunchOutAtUtc,
        lunchInAtUtc: normalized.lunchInAtUtc,
        checkOutAtUtc: normalized.checkOutAtUtc
      },
      calculation,
      lunch: {
        lunchBreakEnabled: settings.lunchBreakEnabled !== false,
        lunchMode: String(settings.lunchMode || "FLEXIBLE"),
        fixedLunchStartTime: settings.fixedLunchStartTime || null,
        fixedLunchEndTime: settings.fixedLunchEndTime || null,
        allowMultipleLunchBreaks: Boolean(settings.allowMultipleLunchBreaks)
      }
    };
  }

  async createEvent(userId: string, businessId: string, input: { type: AttendanceEventType; latitude: number; longitude: number }) {
    const settings = await db.BusinessAttendanceSettings.findOne({ where: { businessId } });
    if (!settings) throw Object.assign(new Error("Attendance settings not found"), { statusCode: 400 });
    if (!settings.attendanceEnabled) throw Object.assign(new Error("Attendance is disabled"), { statusCode: 400 });
    if (settings.latitude === null || settings.longitude === null) throw Object.assign(new Error("Attendance location is not configured"), { statusCode: 400 });

    // Lunch rules: allow disabling lunch events entirely.
    const lunchBreakEnabled = settings.lunchBreakEnabled !== false;
    if (!lunchBreakEnabled && (input.type === "LUNCH_OUT" || input.type === "LUNCH_IN")) {
      throw Object.assign(new Error("Lunch break is disabled for this business"), { statusCode: 400 });
    }

    const officeLat = Number(settings.latitude);
    const officeLon = Number(settings.longitude);
    const radius = Number(settings.allowedRadiusMeters);
    const dist = haversineDistanceMeters(input.latitude, input.longitude, officeLat, officeLon);
    if (!(dist <= radius)) throw Object.assign(new Error("Outside allowed workplace radius"), { statusCode: 403 });

    const tz = settings.timezone || "UTC";
    const now = new Date();
    const startUtc = startOfBusinessDayUtc(now, tz);
    const endUtc = endOfBusinessDayUtc(now, tz);

    return db.sequelize.transaction(async (t: Transaction) => {
      // Serialize attendance event writes per user to avoid race conditions (multi-tab / double click).
      // Locking the user row is stable even when there are zero existing events for the day.
      await db.User.findOne({
        where: { id: userId, businessId },
        transaction: t,
        lock: t.LOCK.UPDATE
      });

      const existing = await db.AttendanceEvent.findAll({
        where: { businessId, employeeId: userId, timestampUtc: { [Op.gte]: startUtc, [Op.lt]: endUtc } },
        order: [["timestampUtc", "ASC"]],
        transaction: t,
        lock: t.LOCK.UPDATE
      });

      const latest: AttendanceEventType | null = existing.length ? (existing[existing.length - 1].type as AttendanceEventType) : null;

      // Prevent final checkout while employee is on lunch.
      if (input.type === "CHECK_OUT" && latest === "LUNCH_OUT") {
        throw Object.assign(new Error("Return from lunch before checking out for the day"), { statusCode: 400 });
      }

      // Fixed lunch window enforcement (business-local time)
      if (input.type === "LUNCH_OUT" && lunchBreakEnabled && String(settings.lunchMode || "FLEXIBLE") === "FIXED") {
        const start = String(settings.fixedLunchStartTime || "");
        const end = String(settings.fixedLunchEndTime || "");
        if (!start || !end) throw Object.assign(new Error("Fixed lunch window is not configured"), { statusCode: 400 });
        const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(now);
        const get = (k: string) => Number(parts.find((p) => p.type === k)?.value);
        const nowMins = get("hour") * 60 + get("minute");
        const toMins = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
        const startM = toMins(start);
        const endM = toMins(end);
        if (nowMins < startM || nowMins > endM) {
          throw Object.assign(new Error("Lunch checkout is only allowed during the configured lunch window"), { statusCode: 403 });
        }
      }

      const allowMultipleLunchBreaks = Boolean(settings.allowMultipleLunchBreaks);
      const lunchOutCount = existing.filter((e: any) => e.type === "LUNCH_OUT").length;
      const hasTakenLunchAlready = lunchOutCount > 0;
      const allowed = nextAllowedTypes({ latestType: latest, lunchBreakEnabled, allowMultipleLunchBreaks, hasTakenLunchAlready });
      if (!allowed.includes(input.type)) {
        throw Object.assign(new Error(`Invalid attendance action. Next allowed: ${allowed.join(", ") || "none"}`), { statusCode: 400 });
      }

      const last = existing.length ? existing[existing.length - 1] : null;
      if (last) {
        const lastTs = new Date(last.timestampUtc).getTime();
        const nowTs = now.getTime();
        // Short duplicate window: protects double-clicks / retries without needing idempotency keys.
        if (nowTs - lastTs < 15_000) {
          // If same action within window -> conflict; otherwise it's likely an invalid sequence anyway.
          if (last.type === input.type) throw Object.assign(new Error("Duplicate submission detected"), { statusCode: 409 });
        }
      }

      const event = await db.AttendanceEvent.create(
        {
          businessId,
          employeeId: userId,
          type: input.type,
          timestampUtc: now,
          latitude: input.latitude,
          longitude: input.longitude,
          distanceMeters: dist,
          withinAllowedRadius: true
        },
        { transaction: t }
      );

      // Late check-in explanation (required when late)
      if (input.type === "CHECK_IN") {
        const expectedStart = String(settings.defaultStartTime || "09:00");
        const grace = Number(settings.lateGracePeriodMinutes || 0);
        const toMins = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
        const expectedM = toMins(expectedStart) + grace;
        const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(now);
        const get = (k: string) => Number(parts.find((p) => p.type === k)?.value);
        const nowM = get("hour") * 60 + get("minute");
        const lateByMinutes = Math.max(0, nowM - expectedM);

        if (lateByMinutes > 0) {
          const lateReasonId = (input as any).lateReasonId || null;
          const customReason = ((input as any).customReason || "").trim() || null;
          if (!lateReasonId && !customReason) {
            throw Object.assign(new Error("Late check-in requires a reason"), { statusCode: 400 });
          }

          let reasonRow: any = null;
          if (lateReasonId) {
            reasonRow = await db.AttendanceLateReason.findOne({ where: { id: lateReasonId, businessId, isActive: true }, transaction: t, lock: t.LOCK.UPDATE });
            if (!reasonRow) throw Object.assign(new Error("Invalid late reason"), { statusCode: 400 });
            if (reasonRow.requiresComment && !customReason) {
              throw Object.assign(new Error("Selected late reason requires a comment"), { statusCode: 400 });
            }
          }

          await db.AttendanceLateExplanation.create(
            {
              businessId,
              employeeId: userId,
              attendanceEventId: event.id,
              lateReasonId: reasonRow ? reasonRow.id : null,
              customReason,
              lateByMinutes
            },
            { transaction: t }
          );
        }
      }

      const summary = await this.getTodaySummary(userId, businessId);
      return summary;
    });
  }

  async getHistory(userId: string, businessId: string, query: any) {
    const settings = await db.BusinessAttendanceSettings.findOne({ where: { businessId } });
    if (!settings) throw Object.assign(new Error("Attendance settings not found"), { statusCode: 400 });
    const tz = settings.timezone || "UTC";

    const page = Number(query.page || 1);
    const size = Number(query.size || 30);
    const sortBy = String(query.sortBy || "date");
    const sortOrder = String(query.sortOrder || "desc");

    const startDate = (query.startDate as string | undefined) || null;
    const endDate = (query.endDate as string | undefined) || null;

    const startUtc = startDate ? businessDateStartUtc(startDate, tz) : new Date(0);
    const endUtc = endDate ? businessDateEndUtc(endDate, tz) : new Date(8640000000000000);

    const events = await db.AttendanceEvent.findAll({
      where: { businessId, employeeId: userId, timestampUtc: { [Op.gte]: startUtc, [Op.lt]: endUtc } },
      order: [["timestampUtc", "ASC"]]
    });

    // Group by business-local date
    const dateKey = (d: Date) =>
      new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d); // YYYY-MM-DD

    const groups = new Map<string, any[]>();
    for (const ev of events) {
      const key = dateKey(new Date((ev as any).timestampUtc));
      const arr = groups.get(key) || [];
      arr.push(ev);
      groups.set(key, arr);
    }

    const days = Array.from(groups.entries()).map(([date, evs]) => {
      const dayStart = businessDateStartUtc(date, tz);
      const dayEnd = businessDateEndUtc(date, tz);
      const { calculation, normalized } = calculateAttendanceDay({
        events: evs.map((e: any) => ({ type: e.type, timestampUtc: new Date(e.timestampUtc) })),
        settings,
        dayStartUtc: dayStart,
        dayEndUtc: dayEnd,
        nowUtc: new Date()
      });
      return {
        date,
        events: {
          checkInAtUtc: normalized.checkInAtUtc,
          lunchOutAtUtc: normalized.lunchOutAtUtc,
          lunchInAtUtc: normalized.lunchInAtUtc,
          checkOutAtUtc: normalized.checkOutAtUtc
        },
        calculation
      };
    });

    let filtered = days;
    if (query.status) {
      const s = String(query.status);
      filtered = filtered.filter((d: any) => d.calculation.currentStatus === s);
    }

    const dir = sortOrder === "asc" ? 1 : -1;
    filtered.sort((a: any, b: any) => {
      if (sortBy === "status") return a.calculation.currentStatus.localeCompare(b.calculation.currentStatus) * dir;
      if (sortBy === "workedMinutes") return (a.calculation.totalWorkedMinutes - b.calculation.totalWorkedMinutes) * dir;
      return a.date.localeCompare(b.date) * dir;
    });

    const count = filtered.length;
    const offset = (page - 1) * size;
    const rows = filtered.slice(offset, offset + size);
    return { rows, count, page, size };
  }
}
