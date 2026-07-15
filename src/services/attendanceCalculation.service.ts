import type { BusinessAttendanceSettings, WeekendWorkMode } from "../types/attendance";

export type AttendanceEventType = "CHECK_IN" | "LUNCH_OUT" | "LUNCH_IN" | "CHECK_OUT";

export type AttendanceStatus =
  | "NOT_STARTED"
  | "PAID_DAY_OFF"
  | "IN_PROGRESS"
  | "ON_BREAK"
  | "COMPLETED"
  | "MISSED"
  | "LATE"
  | "INCOMPLETE"
  | "OUTSIDE_RADIUS_ATTEMPT";

export type AttendanceCalculation = {
  rawWorkedMinutes: number;
  totalWorkedMinutes: number;
  totalBreakMinutes: number;
  penaltyMinutes: number;
  penaltyReason: string | null;
  expectedMinutes: number;
  remainingMinutes: number;
  overtimeMinutes: number;
  missingMinutes: number;
  isLate: boolean;
  lateByMinutes: number;
  isComplete: boolean;
  isInProgress: boolean;
  currentStatus: AttendanceStatus;
  workDayMode: WeekendWorkMode | "WEEKDAY";
  scheduledDayUnits: number;
  paidDayOffUnits: number;
  fullWorkingDayUnits: number;
  halfWorkingDayUnits: number;
};

export type NormalizedAttendanceDay = {
  checkInAtUtc: Date | null;
  lunchOutAtUtc: Date | null;
  lunchInAtUtc: Date | null;
  checkOutAtUtc: Date | null;
};

type EventRow = { type: AttendanceEventType; timestampUtc: Date };

function minutesBetween(a: Date, b: Date) {
  return Math.max(0, Math.floor((b.getTime() - a.getTime()) / 60000));
}

function parseHHmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map((v) => Number(v));
  return h * 60 + m;
}

function localMinutes(dateUtc: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(dateUtc);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return get("hour") * 60 + get("minute");
}

function minutesBetweenLocal(a: number, b: number) {
  return Math.max(0, b - a);
}

function localDateKey(dateUtc: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(dateUtc);
}

function localWeekdayShort(dateUtc: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(dateUtc);
}

export function weekendWorkModeForDate(dateUtc: Date, settings: BusinessAttendanceSettings): WeekendWorkMode | "WEEKDAY" {
  const tz = settings.timezone || "UTC";
  const weekday = localWeekdayShort(dateUtc, tz);
  if (weekday === "Sat") return settings.saturdayWorkMode || "PAID_DAY_OFF";
  if (weekday === "Sun") return settings.sundayWorkMode || "PAID_DAY_OFF";
  return "WEEKDAY";
}

export function attendanceScheduleForDate(dateUtc: Date, settings: BusinessAttendanceSettings) {
  const mode = weekendWorkModeForDate(dateUtc, settings);
  const dailyMinutes = Number(settings.expectedDailyMinutes || 0);
  if (mode === "PAID_DAY_OFF") {
    return { mode, expectedMinutes: 0, scheduledDayUnits: 1, paidDayOffUnits: 1, fullWorkingDayUnits: 0, halfWorkingDayUnits: 0 };
  }
  if (mode === "HALF_WORKING_DAY") {
    return { mode, expectedMinutes: Math.round(dailyMinutes / 2), scheduledDayUnits: 0.5, paidDayOffUnits: 0, fullWorkingDayUnits: 0, halfWorkingDayUnits: 0.5 };
  }
  return { mode, expectedMinutes: dailyMinutes, scheduledDayUnits: 1, paidDayOffUnits: 0, fullWorkingDayUnits: 1, halfWorkingDayUnits: 0 };
}

export function calculateAttendanceDay(params: {
  events: EventRow[];
  settings: BusinessAttendanceSettings;
  dayStartUtc: Date;
  dayEndUtc: Date;
  nowUtc: Date;
  approvedLunchUseMinutes?: number;
}): { calculation: AttendanceCalculation; normalized: NormalizedAttendanceDay } {
  const { events, settings, dayStartUtc, dayEndUtc, nowUtc } = params;
  const tz = settings.timezone || "UTC";
  const approvedLunchUseMinutes = Math.max(0, Number(params.approvedLunchUseMinutes || 0));

  const ordered = [...events].sort((a, b) => a.timestampUtc.getTime() - b.timestampUtc.getTime());
  const localOrdered = ordered
    .filter((e) => e.timestampUtc >= dayStartUtc && e.timestampUtc < dayEndUtc)
    .map((e) => ({ ...e, localMinute: localMinutes(e.timestampUtc, tz) }))
    .sort((a, b) => a.localMinute - b.localMinute || a.timestampUtc.getTime() - b.timestampUtc.getTime());

  const pickFirst = (t: AttendanceEventType) => localOrdered.find((e) => e.type === t)?.timestampUtc ?? null;
  const checkInAtUtc = pickFirst("CHECK_IN");
  const lunchOutAtUtc = pickFirst("LUNCH_OUT");
  const lunchInAtUtc = pickFirst("LUNCH_IN");
  const checkOutAtUtc = pickFirst("CHECK_OUT");
  const clampNow = new Date(Math.min(nowUtc.getTime(), dayEndUtc.getTime()));
  const calculationEndMinute = checkOutAtUtc ? localMinutes(checkOutAtUtc, tz) : localMinutes(clampNow, tz);

  const checkInMinute = checkInAtUtc ? localMinutes(checkInAtUtc, tz) : null;
  const lunchOutMinute = lunchOutAtUtc ? localMinutes(lunchOutAtUtc, tz) : null;
  const lunchInMinute = lunchInAtUtc ? localMinutes(lunchInAtUtc, tz) : null;
  const lunchBreakEnabled = settings.lunchBreakEnabled === true;

  let totalWorkedMinutes = 0;
  let totalBreakMinutes = 0;
  let hasCompleteLunch = false;

  if (checkInMinute !== null) {
    let cursor = checkInMinute;
    let working = true;
    for (const event of localOrdered) {
      if (event.localMinute < checkInMinute || event.localMinute > calculationEndMinute) continue;
      if (event.type === "LUNCH_OUT" && working) {
        totalWorkedMinutes += minutesBetweenLocal(cursor, event.localMinute);
        cursor = event.localMinute;
        working = false;
      } else if (event.type === "LUNCH_IN" && !working) {
        totalBreakMinutes += minutesBetweenLocal(cursor, event.localMinute);
        cursor = event.localMinute;
        working = true;
        hasCompleteLunch = true;
      }
    }
    if (working) {
      totalWorkedMinutes += minutesBetweenLocal(cursor, calculationEndMinute);
    } else {
      totalBreakMinutes += minutesBetweenLocal(cursor, calculationEndMinute);
    }
  }

  const schedule = attendanceScheduleForDate(dayStartUtc, settings);
  const paidDayOff = schedule.mode === "PAID_DAY_OFF";
  const expectedMinutes = schedule.expectedMinutes;
  const rawWorkedMinutes = totalWorkedMinutes;
  let penaltyMinutes = 0;
  let penaltyReason: string | null = null;

  const hasFinalCheckout = Boolean(checkOutAtUtc);
  const defaultEndMinutes = parseHHmmToMinutes(settings.defaultEndTime || "17:00");
  const dayLocalDate = localDateKey(dayStartUtc, tz);
  const nowLocalDate = localDateKey(nowUtc, tz);
  const workdayEnded = nowLocalDate > dayLocalDate || (nowLocalDate === dayLocalDate && localMinutes(nowUtc, tz) >= defaultEndMinutes);

  if (!paidDayOff && checkInAtUtc && !hasFinalCheckout && workdayEnded) {
    const halfDayMinutes = Math.floor(expectedMinutes / 2);
    totalWorkedMinutes = halfDayMinutes;
    penaltyMinutes = Math.max(0, expectedMinutes - halfDayMinutes);
    penaltyReason = lunchBreakEnabled && !hasCompleteLunch ? "Missed lunch checkout and final checkout; half-day credit applied" : "Missed final checkout; half-day credit applied";
  } else if (!paidDayOff && checkInAtUtc && hasFinalCheckout && lunchBreakEnabled && !hasCompleteLunch) {
    const lunchPenaltyMinutes = approvedLunchUseMinutes >= 60 ? 0 : Math.max(0, 120 - approvedLunchUseMinutes);
    penaltyMinutes = Math.min(lunchPenaltyMinutes, totalWorkedMinutes);
    totalWorkedMinutes = Math.max(0, totalWorkedMinutes - penaltyMinutes);
    penaltyReason = penaltyMinutes > 0
      ? "Missed lunch checkout; lunch deduction adjusted by approved Special Request"
      : null;
  }

  const remainingMinutes = Math.max(0, expectedMinutes - totalWorkedMinutes);
  const overtimeMinutes = paidDayOff ? 0 : Math.max(0, totalWorkedMinutes - expectedMinutes);
  const missingMinutes = paidDayOff ? 0 : Math.max(0, expectedMinutes - totalWorkedMinutes);

  const isComplete = Boolean(checkOutAtUtc);
  const latestType = checkOutAtUtc
    ? "CHECK_OUT"
    : lunchOutAtUtc && (!lunchInAtUtc || localMinutes(lunchOutAtUtc, tz) > localMinutes(lunchInAtUtc, tz))
      ? "LUNCH_OUT"
      : checkInAtUtc
        ? "CHECK_IN"
        : null;
  const isInProgress = !isComplete && Boolean(checkInAtUtc);

  let currentStatus: AttendanceStatus = "NOT_STARTED";
  if (paidDayOff && !checkInAtUtc) currentStatus = "PAID_DAY_OFF";
  else if (!checkInAtUtc) currentStatus = "NOT_STARTED";
  else if (latestType === "LUNCH_OUT") currentStatus = "ON_BREAK";
  else if (latestType === "CHECK_OUT") currentStatus = "COMPLETED";
  else currentStatus = "IN_PROGRESS";

  // Late logic (only when check-in exists)
  const expectedStartMinutes = parseHHmmToMinutes(settings.defaultStartTime || "09:00");
  const grace = Number(settings.lateGracePeriodMinutes || 0);
  const checkInMinutes = checkInAtUtc ? localMinutes(checkInAtUtc, tz) : null;
  const isLate = !paidDayOff && checkInMinutes !== null ? checkInMinutes > expectedStartMinutes + grace : false;
  const lateByMinutes = !paidDayOff && checkInMinutes !== null ? Math.max(0, checkInMinutes - (expectedStartMinutes + grace)) : 0;

  if (isLate && (currentStatus === "IN_PROGRESS" || currentStatus === "COMPLETED" || currentStatus === "ON_BREAK")) currentStatus = "LATE";
  if (checkInAtUtc && !checkOutAtUtc && ordered.some((e) => e.type === "CHECK_IN") && ordered.some((e) => e.type === "LUNCH_OUT") && !ordered.some((e) => e.type === "LUNCH_IN")) {
    // On break with no return is still ON_BREAK/LATE depending on lateness, but mark incomplete if day is over in later phases.
  }

  return {
    calculation: {
      rawWorkedMinutes,
      totalWorkedMinutes,
      totalBreakMinutes,
      penaltyMinutes,
      penaltyReason,
      expectedMinutes,
      remainingMinutes,
      overtimeMinutes,
      missingMinutes,
      isLate,
      lateByMinutes,
      isComplete,
      isInProgress,
      currentStatus,
      workDayMode: schedule.mode,
      scheduledDayUnits: schedule.scheduledDayUnits,
      paidDayOffUnits: schedule.paidDayOffUnits,
      fullWorkingDayUnits: schedule.fullWorkingDayUnits,
      halfWorkingDayUnits: schedule.halfWorkingDayUnits
    },
    normalized: { checkInAtUtc, lunchOutAtUtc, lunchInAtUtc, checkOutAtUtc }
  };
}
