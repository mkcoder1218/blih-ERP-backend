function escapeCsv(value: any): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(rows: Record<string, any>[], headers: string[]): string {
  const lines = [headers.map(escapeCsv).join(",")];
  for (const r of rows) {
    lines.push(headers.map((h) => escapeCsv((r as any)[h])).join(","));
  }
  return lines.join("\n");
}

