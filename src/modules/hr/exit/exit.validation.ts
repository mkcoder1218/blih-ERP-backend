import {
  EXIT_MODES,
  EXIT_TYPES,
  type ExitInitiator,
  type ExitMode,
  type ExitType,
} from "./exit.types";

function requiredString(
  value: unknown,
  field: string,
): string {
  const result = String(value || "").trim();

  if (!result) {
    throw new Error(`${field} is required.`);
  }

  return result;
}

function optionalString(
  value: unknown,
): string | null {
  const result = String(value || "").trim();
  return result || null;
}

function parseDate(
  value: unknown,
  field: string,
): Date {
  const date = new Date(
    requiredString(value, field),
  );

  if (Number.isNaN(date.getTime())) {
    throw new Error(
      `${field} must be a valid date.`,
    );
  }

  return date;
}

export function validateExitMode(
  value: unknown,
): ExitMode {
  const mode = String(value || "");

  if (
    !EXIT_MODES.includes(
      mode as ExitMode,
    )
  ) {
    throw new Error(
      "exitMode must be immediate, urgent, or standard_notice.",
    );
  }

  return mode as ExitMode;
}

export function validateExitType(
  value: unknown,
): ExitType {
  const type = String(value || "");

  if (
    !EXIT_TYPES.includes(
      type as ExitType,
    )
  ) {
    throw new Error(
      "exitType must be resignation, termination, or redundancy.",
    );
  }

  return type as ExitType;
}

export function resolveNoticePeriodDays(
  exitMode: ExitMode,
  value: unknown,
): number {
  if (exitMode === "immediate") {
    return 0;
  }

  if (exitMode === "standard_notice") {
    return 30;
  }

  const days = Number(value);

  if (
    !Number.isInteger(days) ||
    days < 1 ||
    days > 29
  ) {
    throw new Error(
      "Urgent exit notice days must be between 1 and 29.",
    );
  }

  return days;
}

export function validateLetter(
  value: unknown,
): string {
  const letter = requiredString(
    value,
    "letterHtml",
  );

  const textOnly = letter
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim();

  if (textOnly.length < 10) {
    throw new Error(
      "The exit letter must contain at least 10 characters.",
    );
  }

  return letter;
}

export function validateReasonExplanation(
  reason: unknown,
  requiresExplanation: boolean,
): string | null {
  const explanation =
    optionalString(reason);

  if (
    requiresExplanation &&
    (!explanation ||
      explanation.length < 3)
  ) {
    throw new Error(
      "An explanation is required for the selected exit reason.",
    );
  }

  return explanation;
}

export function validateInitiatorAndType(
  initiatedByType: ExitInitiator,
  exitType: ExitType,
) {
  if (
    initiatedByType === "employee" &&
    exitType !== "resignation"
  ) {
    throw new Error(
      "Employee-initiated exits must use resignation.",
    );
  }

  if (
    initiatedByType === "employer" &&
    ![
      "termination",
      "redundancy",
    ].includes(exitType)
  ) {
    throw new Error(
      "Employer-initiated exits must use termination or redundancy.",
    );
  }
}

export function validateEffectiveDate(
  value: unknown,
  noticePeriodDays: number,
): Date {
  const effectiveDate = parseDate(
    value,
    "effectiveDate",
  );

  const today = new Date();

  today.setHours(0, 0, 0, 0);

  const minimumDate = new Date(today);

  minimumDate.setDate(
    minimumDate.getDate() +
      noticePeriodDays,
  );

  const normalizedEffectiveDate =
    new Date(effectiveDate);

  normalizedEffectiveDate.setHours(
    0,
    0,
    0,
    0,
  );

  if (
    normalizedEffectiveDate.getTime() <
    minimumDate.getTime()
  ) {
    throw new Error(
      `The final working date cannot be earlier than the ${noticePeriodDays}-day notice period.`,
    );
  }

  return effectiveDate;
}
