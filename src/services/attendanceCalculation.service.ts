import type { BusinessAttendanceSettings } from "../types/attendance";

export type AttendanceEventType = "CHECK_IN" | "LUNCH_OUT" | "LUNCH_IN" | "CHECK_OUT";

export type AttendanceStatus =
  | "NOT_STARTED"
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

export function calculateAttendanceDay(params: {
  events: EventRow[];
  settings: BusinessAttendanceSettings;
  dayStartUtc: Date;
  dayEndUtc: Date;
  nowUtc: Date;
}): { calculation: AttendanceCalculation; normalized: NormalizedAttendanceDay } {
  const { events, settings, dayStartUtc, dayEndUtc, nowUtc } = params;
  const tz = settings.timezone || "UTC";

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

  // Build intervals with support for multiple breaks:
  // Work intervals: CHECK_IN -> LUNCH_OUT, LUNCH_IN -> LUNCH_OUT, LUNCH_IN -> CHECK_OUT
  let totalWorkedMinutes = 0;
  let totalBreakMinutes = 0;

  if (checkInMinute !== null) {
    const hasValidLunch =
      lunchOutMinute !== null &&
      lunchInMinute !== null &&
      lunchOutMinute >= checkInMinute &&
      lunchInMinute >= lunchOutMinute &&
      lunchOutMinute <= calculationEndMinute;

    if (hasValidLunch) {
      totalWorkedMinutes += minutesBetweenLocal(checkInMinute, lunchOutMinute);
      totalBreakMinutes += minutesBetweenLocal(lunchOutMinute, Math.min(lunchInMinute, calculationEndMinute));
      if (lunchInMinute <= calculationEndMinute) {
        totalWorkedMinutes += minutesBetweenLocal(lunchInMinute, calculationEndMinute);
      }
    } else {
      totalWorkedMinutes += minutesBetweenLocal(checkInMinute, calculationEndMinute);
    }
  }

  const expectedMinutes = Number(settings.expectedDailyMinutes || 0);
  const rawWorkedMinutes = totalWorkedMinutes;
  let penaltyMinutes = 0;
  let penaltyReason: string | null = null;

  const lunchBreakEnabled = settings.lunchBreakEnabled !== false;
  const hasCompleteLunch =
    lunchOutMinute !== null &&
    lunchInMinute !== null &&
    checkInMinute !== null &&
    lunchOutMinute >= checkInMinute &&
    lunchInMinute >= lunchOutMinute;
  const hasFinalCheckout = Boolean(checkOutAtUtc);
  const defaultEndMinutes = parseHHmmToMinutes(settings.defaultEndTime || "17:00");
  const dayLocalDate = localDateKey(dayStartUtc, tz);
  const nowLocalDate = localDateKey(nowUtc, tz);
  const workdayEnded = nowLocalDate > dayLocalDate || (nowLocalDate === dayLocalDate && localMinutes(nowUtc, tz) >= defaultEndMinutes);

  if (checkInAtUtc && !hasFinalCheckout && workdayEnded) {
    const halfDayMinutes = Math.floor(expectedMinutes / 2);
    totalWorkedMinutes = halfDayMinutes;
    penaltyMinutes = Math.max(0, expectedMinutes - halfDayMinutes);
    penaltyReason = lunchBreakEnabled && !hasCompleteLunch ? "Missed lunch checkout and final checkout; half-day credit applied" : "Missed final checkout; half-day credit applied";
  } else if (checkInAtUtc && hasFinalCheckout && lunchBreakEnabled && !hasCompleteLunch) {
    const lunchPenaltyMinutes = 120;
    penaltyMinutes = Math.min(lunchPenaltyMinutes, totalWorkedMinutes);
    totalWorkedMinutes = Math.max(0, totalWorkedMinutes - penaltyMinutes);
    penaltyReason = "Missed lunch checkout; 2h deduction applied";
  }

  const remainingMinutes = Math.max(0, expectedMinutes - totalWorkedMinutes);
  const overtimeMinutes = Math.max(0, totalWorkedMinutes - expectedMinutes);
  const missingMinutes = Math.max(0, expectedMinutes - totalWorkedMinutes);

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
  if (!checkInAtUtc) currentStatus = "NOT_STARTED";
  else if (latestType === "LUNCH_OUT") currentStatus = "ON_BREAK";
  else if (latestType === "CHECK_OUT") currentStatus = "COMPLETED";
  else currentStatus = "IN_PROGRESS";

  // Late logic (only when check-in exists)
  const expectedStartMinutes = parseHHmmToMinutes(settings.defaultStartTime || "09:00");
  const grace = Number(settings.lateGracePeriodMinutes || 0);
  const checkInMinutes = checkInAtUtc ? localMinutes(checkInAtUtc, tz) : null;
  const isLate = checkInMinutes !== null ? checkInMinutes > expectedStartMinutes + grace : false;
  const lateByMinutes = checkInMinutes !== null ? Math.max(0, checkInMinutes - (expectedStartMinutes + grace)) : 0;

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
      currentStatus
    },
    normalized: { checkInAtUtc, lunchOutAtUtc, lunchInAtUtc, checkOutAtUtc }
  };
}
