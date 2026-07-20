import {
  EXIT_REASON_INITIATORS,
  type CreateExitReasonInput,
  type ReorderExitReasonInput,
  type UpdateExitReasonInput,
} from "./exitReason.types";

function cleanName(value: unknown): string {
  return String(value || "").trim();
}

function cleanDescription(
  value: unknown,
): string | null {
  const text = String(value || "").trim();
  return text || null;
}

function validateInitiator(
  value: unknown,
): "employee" | "employer" | "both" {
  const initiator = String(value || "both");

  if (
    !EXIT_REASON_INITIATORS.includes(
      initiator as any,
    )
  ) {
    throw new Error(
      "allowedInitiator must be employee, employer, or both.",
    );
  }

  return initiator as
    | "employee"
    | "employer"
    | "both";
}

function validateSortOrder(
  value: unknown,
  fallback = 0,
): number {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return fallback;
  }

  const sortOrder = Number(value);

  if (
    !Number.isInteger(sortOrder) ||
    sortOrder < 0
  ) {
    throw new Error(
      "sortOrder must be a non-negative integer.",
    );
  }

  return sortOrder;
}

export function validateCreateExitReason(
  input: any,
): CreateExitReasonInput {
  const name = cleanName(input?.name);

  if (name.length < 2) {
    throw new Error(
      "Exit reason name must contain at least 2 characters.",
    );
  }

  if (name.length > 120) {
    throw new Error(
      "Exit reason name cannot exceed 120 characters.",
    );
  }

  return {
    name,
    description: cleanDescription(
      input?.description,
    ),

    allowedInitiator:
      validateInitiator(
        input?.allowedInitiator,
      ),

    requiresExplanation:
      input?.requiresExplanation !== false,

    isActive:
      input?.isActive !== false,

    sortOrder: validateSortOrder(
      input?.sortOrder,
    ),
  };
}

export function validateUpdateExitReason(
  input: any,
): UpdateExitReasonInput {
  const payload: UpdateExitReasonInput = {};

  if (input?.name !== undefined) {
    const name = cleanName(input.name);

    if (name.length < 2) {
      throw new Error(
        "Exit reason name must contain at least 2 characters.",
      );
    }

    if (name.length > 120) {
      throw new Error(
        "Exit reason name cannot exceed 120 characters.",
      );
    }

    payload.name = name;
  }

  if (input?.description !== undefined) {
    payload.description =
      cleanDescription(input.description);
  }

  if (
    input?.allowedInitiator !== undefined
  ) {
    payload.allowedInitiator =
      validateInitiator(
        input.allowedInitiator,
      );
  }

  if (
    input?.requiresExplanation !==
    undefined
  ) {
    payload.requiresExplanation =
      Boolean(
        input.requiresExplanation,
      );
  }

  if (input?.isActive !== undefined) {
    payload.isActive = Boolean(
      input.isActive,
    );
  }

  if (input?.sortOrder !== undefined) {
    payload.sortOrder =
      validateSortOrder(
        input.sortOrder,
      );
  }

  if (Object.keys(payload).length === 0) {
    throw new Error(
      "No exit reason changes were provided.",
    );
  }

  return payload;
}

export function validateReorderExitReasons(
  input: any,
): ReorderExitReasonInput[] {
  const rows = Array.isArray(input?.rows)
    ? input.rows
    : Array.isArray(input?.reasons)
      ? input.reasons
      : [];

  if (rows.length === 0) {
    throw new Error(
      "At least one exit reason is required.",
    );
  }

  const ids = new Set<string>();

  return rows.map(
    (row: any, index: number) => {
      const id = String(
        row?.id || "",
      ).trim();

      if (!id) {
        throw new Error(
          `Exit reason ID is required at position ${index + 1}.`,
        );
      }

      if (ids.has(id)) {
        throw new Error(
          "Duplicate exit reason IDs are not allowed.",
        );
      }

      ids.add(id);

      return {
        id,
        sortOrder:
          validateSortOrder(
            row?.sortOrder,
            index,
          ),
      };
    },
  );
}
