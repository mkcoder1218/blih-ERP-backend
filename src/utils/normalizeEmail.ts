export function normalizeEmail(input: unknown): string {
  return String(input || "")
    .trim()
    .toLowerCase();
}

