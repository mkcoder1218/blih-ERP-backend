export const EXIT_INITIATORS = [
  "employee",
  "employer",
] as const;

export const EXIT_MODES = [
  "immediate",
  "urgent",
  "standard_notice",
] as const;

export const EXIT_TYPES = [
  "resignation",
  "termination",
  "redundancy",
] as const;

export type ExitInitiator =
  (typeof EXIT_INITIATORS)[number];

export type ExitMode =
  (typeof EXIT_MODES)[number];

export type ExitType =
  (typeof EXIT_TYPES)[number];

export interface CreateExitInput {
  employeeUserId: string;
  initiatedByUserId: string;
  initiatedByType: ExitInitiator;

  exitType: ExitType;
  exitMode: ExitMode;

  noticePeriodDays: number;
  effectiveDate: Date;

  exitReasonId: string;
  exitReasonNameSnapshot: string;

  reason: string | null;
  letterHtml: string;

  templateId?: string | null;
  templateSnapshot?: unknown;
  formValues?: Record<string, unknown>;
}

export interface ReviewExitInput {
  reviewedByUserId: string;
  effectiveDate?: Date;
  approvalNote?: string | null;
  rejectionReason?: string | null;
}
