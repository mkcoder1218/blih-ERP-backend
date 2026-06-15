function partsInTz(date: Date, timeZone: string) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });
  const parts = dtf.formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second")
  };
}

export function getTimeZoneOffsetMinutes(date: Date, timeZone: string): number {
  const p = partsInTz(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return (asUtc - date.getTime()) / 60000;
}

export function startOfBusinessDayUtc(now: Date, timeZone: string): Date {
  const p = partsInTz(now, timeZone);
  const approxUtc = new Date(Date.UTC(p.year, p.month - 1, p.day, 0, 0, 0));
  const offsetMins = getTimeZoneOffsetMinutes(approxUtc, timeZone);
  return new Date(approxUtc.getTime() - offsetMins * 60000);
}

export function endOfBusinessDayUtc(now: Date, timeZone: string): Date {
  const start = startOfBusinessDayUtc(now, timeZone);
  return new Date(start.getTime() + 24 * 60 * 60 * 1000);
}

export function businessDateStartUtc(dateYmd: string, timeZone: string): Date {
  const [y, m, d] = dateYmd.split("-").map((v) => Number(v));
  const approxUtc = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
  const offsetMins = getTimeZoneOffsetMinutes(approxUtc, timeZone);
  return new Date(approxUtc.getTime() - offsetMins * 60000);
}

export function businessDateEndUtc(dateYmd: string, timeZone: string): Date {
  const start = businessDateStartUtc(dateYmd, timeZone);
  return new Date(start.getTime() + 24 * 60 * 60 * 1000);
}

export function localWallTimeToUtc(dateYmd: string, hhmm: string, timeZone: string): Date {
  const [y, m, d] = dateYmd.split("-").map((v) => Number(v));
  const [hh, mm] = hhmm.split(":").map((v) => Number(v));
  const approxUtc = new Date(Date.UTC(y, m - 1, d, hh || 0, mm || 0, 0));
  const offsetMins = getTimeZoneOffsetMinutes(approxUtc, timeZone);
  return new Date(approxUtc.getTime() - offsetMins * 60000);
}

export function dateWallTimeToUtc(date: Date, timeZone: string): Date {
  const ymd = date.toISOString().slice(0, 10);
  const hhmm = date.toISOString().slice(11, 16);
  return localWallTimeToUtc(ymd, hhmm, timeZone);
}
