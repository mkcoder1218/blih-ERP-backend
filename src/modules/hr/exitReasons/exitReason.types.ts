export const EXIT_REASON_INITIATORS = [
  "employee",
  "employer",
  "both",
] as const;

export type ExitReasonInitiator =
  (typeof EXIT_REASON_INITIATORS)[number];

export interface CreateExitReasonInput {
  name: string;
  description?: string | null;

  allowedInitiator:
    | "employee"
    | "employer"
    | "both";

  requiresExplanation: boolean;
  isActive: boolean;
  sortOrder?: number;
}

export interface UpdateExitReasonInput {
  name?: string;
  description?: string | null;

  allowedInitiator?:
    | "employee"
    | "employer"
    | "both";

  requiresExplanation?: boolean;
  isActive?: boolean;
  sortOrder?: number;
}

export interface ReorderExitReasonInput {
  id: string;
  sortOrder: number;
}
