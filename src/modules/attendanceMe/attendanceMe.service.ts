import { Op, Transaction } from "sequelize";
import { db } from "../../models";
import { haversineDistanceMeters } from "../../utils/geo";
import { businessDateEndUtc, businessDateStartUtc, endOfBusinessDayUtc, startOfBusinessDayUtc } from "../../utils/timezone";
import { calculateAttendanceDay } from "../../services/attendanceCalculation.service";
import { AttendanceTelegramService } from "../attendanceTelegram/attendanceTelegram.service";
import { LatenessReasonRulesService } from "../../services/latenessReasonRules.service";

type AttendanceEventType = "CHECK_IN" | "LUNCH_OUT" | "LUNCH_IN" | "CHECK_OUT";
type AttendanceActionCooldown = {
  action: AttendanceEventType;
  active: boolean;
  startedAtUtc: string;
  untilUtc: string;
  remainingMinutes: number;
  requiredMinutes: number;
};
const POST_CHECKOUT_COOLDOWN_MS = 60 * 60 * 1000;

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

function buildCooldown(lastEvent: any | null, now: Date, action: AttendanceEventType, cooldownMs = POST_CHECKOUT_COOLDOWN_MS): AttendanceActionCooldown | null {
  if (!lastEvent) return null;
  if (cooldownMs <= 0) return null;
  const lastTs = new Date(lastEvent.timestampUtc).getTime();
  if (Number.isNaN(lastTs)) return null;
  const untilTs = lastTs + cooldownMs;
  if (now.getTime() >= untilTs) return null;
  return {
    action,
    active: true,
    startedAtUtc: new Date(lastTs).toISOString(),
    untilUtc: new Date(untilTs).toISOString(),
    remainingMinutes: Math.max(1, Math.ceil((untilTs - now.getTime()) / 60_000)),
    requiredMinutes: Math.ceil(cooldownMs / 60_000)
  };
}

function localDateKey(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function isSaturday(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(date) === "Sat";
}

async function approvedLunchUseMinutesForDate(businessId: string, userId: string, dateYmd: string) {
  if (!db.SpecialRequest?.findAll) return 0;
  const rows = await db.SpecialRequest.findAll({
    where: {
      businessId,
      requestedBy: userId,
      status: { [Op.in]: ["approved", "APPROVED"] },
    },
    attributes: ["requestedDate", "requestedMinutes"],
  });
  const total = rows
    .filter((request: any) => String(request.requestedDate || "").slice(0, 10) === dateYmd)
    .reduce((sum: number, request: any) => sum + Number(request.requestedMinutes || 0), 0);
  return Math.min(60, Math.max(0, total));
}

export class AttendanceMeService {
  private telegram = new AttendanceTelegramService();
  private latenessReasonRules = new LatenessReasonRulesService();
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
    const dateYmd = localDateKey(now, tz);
    const dailyReasons = db.AttendanceDailyReason?.findAll
      ? await db.AttendanceDailyReason.findAll({
          where: { businessId, employeeId: userId, dateYmd },
          include: [{ model: db.AttendanceLateReason, as: "lateReason", attributes: ["id", "name", "reasonCode", "label", "requiresComment"] }],
          order: [["createdAt", "ASC"]]
        })
      : [];
    const reasonBalances = db.AttendanceLateReason?.findAll && db.AttendanceRequest?.count
      ? await this.latenessReasonRules.balancesForEmployee(businessId, userId, now)
      : [];
    const approvedSpecialRequests = db.SpecialRequest?.findAll
      ? await db.SpecialRequest.findAll({
          where: {
            businessId,
            requestedBy: userId,
            status: { [Op.in]: ["approved", "APPROVED"] },
          },
          order: [["approvedAt", "DESC"]],
        })
      : [];
    const approvedLunchUseMinutes = Math.min(60, approvedSpecialRequests
      .filter((request: any) => String(request.requestedDate || "").slice(0, 10) === dateYmd)
      .reduce((sum: number, request: any) => sum + Number(request.requestedMinutes || 0), 0));
    const requiredLunchBreakMinutes = Math.max(0, 60 - approvedLunchUseMinutes);

    const latest: AttendanceEventType | null = events.length ? (events[events.length - 1].type as AttendanceEventType) : null;
    const lunchBreakEnabled = settings.lunchBreakEnabled !== false;
    const allowMultipleLunchBreaks = Boolean(settings.allowMultipleLunchBreaks);
    const lunchOutCount = events.filter((e: any) => e.type === "LUNCH_OUT").length;
    const hasTakenLunchAlready = lunchOutCount > 0;
    let nextAllowed = nextAllowedTypes({ latestType: latest, lunchBreakEnabled, allowMultipleLunchBreaks, hasTakenLunchAlready });
    let cooldown: AttendanceActionCooldown | null = null;

    if (latest === "LUNCH_OUT") {
      cooldown = buildCooldown(events[events.length - 1], now, "LUNCH_IN", requiredLunchBreakMinutes * 60_000);
      if (cooldown) nextAllowed = nextAllowed.filter((type) => type !== "LUNCH_IN");
    }

    if (nextAllowed.includes("CHECK_IN")) {
      const lastCheckout = db.AttendanceEvent.findOne ? await db.AttendanceEvent.findOne({
        where: { businessId, employeeId: userId, type: "CHECK_OUT", timestampUtc: { [Op.lt]: now } },
        order: [["timestampUtc", "DESC"]]
      }) : null;
      const checkInCooldown = buildCooldown(lastCheckout, now, "CHECK_IN");
      if (checkInCooldown) {
        cooldown = checkInCooldown;
        nextAllowed = nextAllowed.filter((type) => type !== "CHECK_IN");
      }
    }

    const { calculation, normalized } = calculateAttendanceDay({
      events: events.map((e: any) => ({ type: e.type, timestampUtc: new Date(e.timestampUtc) })),
      settings,
      dayStartUtc: startUtc,
      dayEndUtc: endUtc,
      nowUtc: now,
      approvedLunchUseMinutes,
    });

    return {
      serverNowUtc: now.toISOString(),
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
      cooldown: settings.attendanceEnabled ? cooldown : null,
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
        allowMultipleLunchBreaks: Boolean(settings.allowMultipleLunchBreaks),
        approvedSpecialRequestMinutes: approvedLunchUseMinutes,
        approvedSpecialRequests,
      },
      dailyReasons: {
        late: dailyReasons.filter((item: any) => item.reasonType === "late").map((item: any) => ({
          id: item.id,
          reasonName: item.lateReason?.name || "Custom reason",
          comment: item.comment || null,
          source: item.source,
          createdAt: item.createdAt
        })),
        unavailable: dailyReasons.filter((item: any) => item.reasonType === "unavailable").map((item: any) => ({
          id: item.id,
          reasonName: item.lateReason?.name || "Unavailable",
          comment: item.comment || null,
          source: item.source,
          createdAt: item.createdAt
        }))
      },
      latenessReasonBalances: reasonBalances,
      latenessReasonOptions: reasonBalances.filter((reason) => reason.enabled)
    };
  }

  async createEvent(userId: string, businessId: string, input: { type: AttendanceEventType; latitude?: number | null; longitude?: number | null }) {
    const settings = await db.BusinessAttendanceSettings.findOne({ where: { businessId } });
    if (!settings) throw Object.assign(new Error("Attendance settings not found"), { statusCode: 400 });
    if (!settings.attendanceEnabled) throw Object.assign(new Error("Attendance is disabled"), { statusCode: 400 });
    const tz = settings.timezone || "UTC";
    const now = new Date();
    const saturdayTrackingOnly = isSaturday(now, tz);
    if (!saturdayTrackingOnly && (settings.latitude === null || settings.longitude === null)) throw Object.assign(new Error("Attendance location is not configured"), { statusCode: 400 });

    // Lunch rules: allow disabling lunch events entirely.
    const lunchBreakEnabled = settings.lunchBreakEnabled !== false;
    if (!lunchBreakEnabled && (input.type === "LUNCH_OUT" || input.type === "LUNCH_IN")) {
      throw Object.assign(new Error("Lunch break is disabled for this business"), { statusCode: 400 });
    }

    const hasInputLocation = input.latitude != null && input.longitude != null;
    const officeLat = Number(settings.latitude || 0);
    const officeLon = Number(settings.longitude || 0);
    const radius = Number(settings.allowedRadiusMeters || 0);
    const dist = saturdayTrackingOnly ? 0 : hasInputLocation ? haversineDistanceMeters(Number(input.latitude), Number(input.longitude), officeLat, officeLon) : Number.POSITIVE_INFINITY;
    if (!saturdayTrackingOnly && !hasInputLocation) throw Object.assign(new Error("Location permission required"), { statusCode: 400 });
    if (!saturdayTrackingOnly && !(dist <= radius)) throw Object.assign(new Error("Outside allowed workplace radius"), { statusCode: 403 });

    const startUtc = startOfBusinessDayUtc(now, tz);
    const endUtc = endOfBusinessDayUtc(now, tz);
    const dateYmd = localDateKey(now, tz);
    const approvedLunchUseMinutes = await approvedLunchUseMinutesForDate(businessId, userId, dateYmd);
    const requiredLunchBreakMinutes = Math.max(0, 60 - approvedLunchUseMinutes);

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

      if (input.type === "CHECK_IN") {
        const lastCheckout = db.AttendanceEvent.findOne ? await db.AttendanceEvent.findOne({
          where: { businessId, employeeId: userId, type: "CHECK_OUT", timestampUtc: { [Op.lt]: now } },
          order: [["timestampUtc", "DESC"]],
          transaction: t,
          lock: t.LOCK.UPDATE
        }) : null;
        const cooldown = buildCooldown(lastCheckout, now, "CHECK_IN");
        if (cooldown) {
          throw Object.assign(new Error(`Check-in is available after the mandatory 1 hour checkout break (${cooldown.remainingMinutes} min remaining)`), { statusCode: 400 });
        }
      }

      // Prevent final checkout while employee is on lunch.
      if (input.type === "CHECK_OUT" && latest === "LUNCH_OUT") {
        throw Object.assign(new Error("Return from lunch before checking out for the day"), { statusCode: 400 });
      }

      if (input.type === "LUNCH_IN" && latest === "LUNCH_OUT") {
        const cooldown = buildCooldown(existing[existing.length - 1], now, "LUNCH_IN", requiredLunchBreakMinutes * 60_000);
        if (cooldown) {
          throw Object.assign(new Error(`Lunch check-in is available after the mandatory ${requiredLunchBreakMinutes} minute lunch break (${cooldown.remainingMinutes} min remaining)`), { statusCode: 400 });
        }
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
          latitude: hasInputLocation ? input.latitude : 0,
          longitude: hasInputLocation ? input.longitude : 0,
          distanceMeters: dist,
          withinAllowedRadius: true
        },
        { transaction: t }
      );

      // Late check-in can proceed without a reason; submitted reasons are linked when available.
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
          const dateYmd = localDateKey(now, tz);
          const preSubmittedReasons = db.AttendanceDailyReason?.findAll ? await db.AttendanceDailyReason.findAll({
            where: { businessId, employeeId: userId, dateYmd, reasonType: "late" },
            order: [["createdAt", "ASC"]],
            transaction: t,
            lock: t.LOCK.UPDATE
          }) : [];
          const preSubmittedReasonIds = preSubmittedReasons.map((item: any) => item.lateReasonId).filter(Boolean);
          const approvedNotices = db.AttendanceRequest?.findAll ? await db.AttendanceRequest.findAll({
            where: {
              businessId,
              employeeUserId: userId,
              requestType: "lateness_notice",
              status: "approved",
              validityStatus: "valid",
              fromAt: { [Op.gte]: startUtc, [Op.lt]: endUtc },
            },
            order: [["approvedAt", "ASC"], ["createdAt", "ASC"]],
            transaction: t,
            lock: t.LOCK.UPDATE,
          }) : [];
          for (const notice of approvedNotices) {
            const evaluation = await this.latenessReasonRules.evaluateNotice(notice, lateByMinutes);
            if (evaluation.validityStatus === "invalid" && evaluation.penaltyLabel === "HalfDay") {
              await notice.update(
                { validityStatus: "invalid", actionNote: evaluation.message || "Lateness exceeded the approved reason coverage." },
                { transaction: t }
              );
            }
          }
          const preSubmittedReasonRows = preSubmittedReasonIds.length
            ? await db.AttendanceLateReason.findAll({
                where: { id: { [Op.in]: preSubmittedReasonIds }, businessId },
                attributes: ["id", "name", "requiresComment"],
                transaction: t
              })
            : [];
          const preSubmittedReasonById = new Map<string, any>(preSubmittedReasonRows.map((item: any) => [item.id, item]));
          let reasonRow: any = null;
          if (lateReasonId) {
            reasonRow = await db.AttendanceLateReason.findOne({ where: { id: lateReasonId, businessId, isActive: true, enabled: true }, transaction: t, lock: t.LOCK.UPDATE });
            if (!reasonRow) throw Object.assign(new Error("Invalid late reason"), { statusCode: 400 });
            if (reasonRow.requiresComment && !customReason) {
              throw Object.assign(new Error("Selected late reason requires a comment"), { statusCode: 400 });
            }
          }

          if (lateReasonId || customReason) {
            if (db.AttendanceDailyReason?.create) await db.AttendanceDailyReason.create(
              {
                businessId,
                employeeId: userId,
                dateYmd,
                reasonType: "late",
                lateReasonId: reasonRow ? reasonRow.id : null,
                comment: customReason,
                source: "erp",
                attendanceEventId: event.id
              },
              { transaction: t }
            );
          }

          if (lateReasonId || customReason || preSubmittedReasons.length) {
            const combinedReason = preSubmittedReasons.length
              ? preSubmittedReasons
                  .map((item: any, index: number) => {
                    const name = preSubmittedReasonById.get(item.lateReasonId)?.name || "Custom reason";
                    return `${index + 1}. ${name}${item.comment ? ` - ${item.comment}` : ""}`;
                  })
                  .join("\n")
              : customReason;

            const explanation = await db.AttendanceLateExplanation.create(
              {
                businessId,
                employeeId: userId,
                attendanceEventId: event.id,
                lateReasonId: reasonRow ? reasonRow.id : null,
                customReason: combinedReason,
                lateByMinutes
              },
              { transaction: t }
            );

            if (preSubmittedReasons.length) {
              if (db.AttendanceDailyReason?.update) await db.AttendanceDailyReason.update(
                { attendanceEventId: event.id },
                { where: { id: preSubmittedReasons.map((item: any) => item.id) }, transaction: t }
              );
            }

            t.afterCommit(() => {
              this.telegram.notifyLateReason(businessId, userId, event.id, explanation.id).catch((err) => {
                console.error(`Telegram late reason notification failed: ${err.message}`);
              });
            });
          }
        }
      }

      const summary = await this.getTodaySummary(userId, businessId);
      return summary;
    });
  }

  async revertLastEvent(userId: string, businessId: string) {
    const settings = await db.BusinessAttendanceSettings.findOne({ where: { businessId } });
    if (!settings) throw Object.assign(new Error("Attendance settings not found"), { statusCode: 400 });
    if (!settings.attendanceEnabled) throw Object.assign(new Error("Attendance is disabled"), { statusCode: 400 });

    const tz = settings.timezone || "UTC";
    const now = new Date();
    const startUtc = startOfBusinessDayUtc(now, tz);
    const endUtc = endOfBusinessDayUtc(now, tz);

    return db.sequelize.transaction(async (t: Transaction) => {
      await db.User.findOne({
        where: { id: userId, businessId },
        transaction: t,
        lock: t.LOCK.UPDATE
      });

      const events = await db.AttendanceEvent.findAll({
        where: { businessId, employeeId: userId, timestampUtc: { [Op.gte]: startUtc, [Op.lt]: endUtc } },
        order: [["timestampUtc", "ASC"]],
        transaction: t,
        lock: t.LOCK.UPDATE
      });

      if (!events.length) throw Object.assign(new Error("No attendance event to revert today"), { statusCode: 400 });
      const last = events[events.length - 1] as any;

      await db.AttendanceLateExplanation.destroy({
        where: { businessId, attendanceEventId: last.id },
        transaction: t
      });
      await last.destroy({ transaction: t });

      return this.getTodaySummary(userId, businessId);
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
