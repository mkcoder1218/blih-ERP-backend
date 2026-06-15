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
  totalWorkedMinutes: number;
  totalBreakMinutes: number;
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
  const pickFirst = (t: AttendanceEventType) => ordered.find((e) => e.type === t && e.timestampUtc >= dayStartUtc && e.timestampUtc < dayEndUtc)?.timestampUtc ?? null;
  const displayedCheckInAtUtc = pickFirst("CHECK_IN");
  const displayedLunchOutAtUtc = pickFirst("LUNCH_OUT");
  const displayedLunchInAtUtc = pickFirst("LUNCH_IN");
  const displayedCheckOutAtUtc = pickFirst("CHECK_OUT");

  // Build intervals with support for multiple breaks:
  // Work intervals: CHECK_IN -> LUNCH_OUT, LUNCH_IN -> LUNCH_OUT, LUNCH_IN -> CHECK_OUT
  let totalWorkedMinutes = 0;
  let totalBreakMinutes = 0;

  let lastWorkStart: Date | null = null;
  let lastBreakStart: Date | null = null;
  let checkInAtUtc: Date | null = null;
  let lunchOutAtUtc: Date | null = null;
  let lunchInAtUtc: Date | null = null;
  let checkOutAtUtc: Date | null = null;
  let latestValidType: AttendanceEventType | null = null;

  for (const ev of ordered) {
    const ts = ev.timestampUtc;
    if (ts < dayStartUtc || ts >= dayEndUtc) continue;

    if (ev.type === "CHECK_IN") {
      if (!checkInAtUtc) checkInAtUtc = ts;
      lastWorkStart = ts;
      lastBreakStart = null;
      latestValidType = ev.type;
      continue;
    }

    if (ev.type === "LUNCH_OUT") {
      if (!lastWorkStart) continue;
      totalWorkedMinutes += minutesBetween(lastWorkStart, ts);
      if (!lunchOutAtUtc) lunchOutAtUtc = ts;
      lastWorkStart = null;
      lastBreakStart = ts;
      latestValidType = ev.type;
      continue;
    }

    if (ev.type === "LUNCH_IN") {
      if (!lastBreakStart) continue;
      totalBreakMinutes += minutesBetween(lastBreakStart, ts);
      if (!lunchInAtUtc) lunchInAtUtc = ts;
      lastBreakStart = null;
      lastWorkStart = ts;
      latestValidType = ev.type;
      continue;
    }

    if (ev.type === "CHECK_OUT") {
      if (lastWorkStart) totalWorkedMinutes += minutesBetween(lastWorkStart, ts);
      lastWorkStart = null;
      if (lastBreakStart) {
        totalBreakMinutes += minutesBetween(lastBreakStart, ts);
        lastBreakStart = null;
      }
      if (!checkOutAtUtc) checkOutAtUtc = ts;
      latestValidType = ev.type;
      continue;
    }
  }

  // Still working: count work time to now (clamped to day end).
  const clampNow = new Date(Math.min(nowUtc.getTime(), dayEndUtc.getTime()));
  if (lastWorkStart) totalWorkedMinutes += minutesBetween(lastWorkStart, clampNow);
  // If currently on break, do not count break time until it completes.

  const expectedMinutes = Number(settings.expectedDailyMinutes || 0);
  const remainingMinutes = Math.max(0, expectedMinutes - totalWorkedMinutes);
  const overtimeMinutes = Math.max(0, totalWorkedMinutes - expectedMinutes);
  const missingMinutes = Math.max(0, expectedMinutes - totalWorkedMinutes);

  const isComplete = Boolean(checkOutAtUtc);
  const isInProgress = !isComplete && Boolean(checkInAtUtc);

  let currentStatus: AttendanceStatus = "NOT_STARTED";
  if (!checkInAtUtc) currentStatus = "NOT_STARTED";
  else if (latestValidType === "LUNCH_OUT") currentStatus = "ON_BREAK";
  else if (latestValidType === "CHECK_OUT") currentStatus = "COMPLETED";
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
      totalWorkedMinutes,
      totalBreakMinutes,
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
    normalized: {
      checkInAtUtc: displayedCheckInAtUtc,
      lunchOutAtUtc: displayedLunchOutAtUtc,
      lunchInAtUtc: displayedLunchInAtUtc,
      checkOutAtUtc: displayedCheckOutAtUtc
    }
  };
}
