const VALID_FREQUENCIES = new Set([
  "DAILY",
  "WEEKLY",
  "MONTHLY",
  "YEARLY",
]);

const VALID_WEEKDAYS = new Set([
  "MO",
  "TU",
  "WE",
  "TH",
  "FR",
  "SA",
  "SU",
]);

const ALLOWED_KEYS = new Set([
  "FREQ",
  "INTERVAL",
  "BYDAY",
  "BYMONTHDAY",
  "COUNT",
  "UNTIL",
]);

function badRequest(message: string) {
  return Object.assign(new Error(message), {
    statusCode: 400,
  });
}

function extractRule(value: string): string {
  const lines = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const rruleLine = lines.find((line) =>
    line.toUpperCase().startsWith("RRULE:"),
  );

  return (rruleLine || lines[0] || "")
    .replace(/^RRULE:/i, "")
    .toUpperCase();
}

export function normalizeRecurrenceRule(
  value: unknown,
): string | null {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null;
  }

  if (typeof value !== "string") {
    throw badRequest(
      "recurrenceRule must be a valid RRULE string.",
    );
  }

  const normalized = extractRule(value);

  if (!normalized) {
    return null;
  }

  if (normalized.length > 1000) {
    throw badRequest(
      "recurrenceRule is too long.",
    );
  }

  const parsed = new Map<string, string>();
  const parts = normalized.split(";");

  for (const part of parts) {
    const [rawKey, ...rawValueParts] = part.split("=");

    const key = rawKey?.trim();
    const partValue = rawValueParts.join("=").trim();

    if (!key || !partValue) {
      throw badRequest(
        "recurrenceRule contains an invalid option.",
      );
    }

    if (!ALLOWED_KEYS.has(key)) {
      throw badRequest(
        `Unsupported recurrence option: ${key}.`,
      );
    }

    if (parsed.has(key)) {
      throw badRequest(
        `Duplicate recurrence option: ${key}.`,
      );
    }

    parsed.set(key, partValue);
  }

  const frequency = parsed.get("FREQ");

  if (
    !frequency ||
    !VALID_FREQUENCIES.has(frequency)
  ) {
    throw badRequest(
      "Recurrence frequency must be DAILY, WEEKLY, MONTHLY, or YEARLY.",
    );
  }

  const interval = Number(
    parsed.get("INTERVAL") || 1,
  );

  if (
    !Number.isInteger(interval) ||
    interval < 1 ||
    interval > 365
  ) {
    throw badRequest(
      "Recurrence interval must be between 1 and 365.",
    );
  }

  const countValue = parsed.get("COUNT");

  if (countValue) {
    const count = Number(countValue);

    if (
      !Number.isInteger(count) ||
      count < 1 ||
      count > 999
    ) {
      throw badRequest(
        "Recurrence count must be between 1 and 999.",
      );
    }
  }

  const until = parsed.get("UNTIL");

  if (
    until &&
    !/^\d{8}(T\d{6}Z?)?$/.test(until)
  ) {
    throw badRequest(
      "Recurrence end date is invalid.",
    );
  }

  if (countValue && until) {
    throw badRequest(
      "Use either COUNT or UNTIL, not both.",
    );
  }

  const byDay = parsed.get("BYDAY");

  if (byDay) {
    const weekdays = byDay.split(",");

    if (
      weekdays.length === 0 ||
      weekdays.some(
        (weekday) =>
          !VALID_WEEKDAYS.has(weekday),
      )
    ) {
      throw badRequest(
        "Recurrence weekdays are invalid.",
      );
    }
  }

  const byMonthDay = parsed.get("BYMONTHDAY");

  if (byMonthDay) {
    const day = Number(byMonthDay);

    if (
      !Number.isInteger(day) ||
      day < 1 ||
      day > 31
    ) {
      throw badRequest(
        "Monthly recurrence day must be between 1 and 31.",
      );
    }
  }

  return `RRULE:${parts.join(";")}`;
}
