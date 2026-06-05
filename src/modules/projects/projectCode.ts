import { db } from "../../models";

function initials(input: string, fallback: string) {
  const cleaned = input
    .replace(/[^a-zA-Z0-9\s-]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return cleaned || fallback;
}

async function nextSequence(model: any, businessId: string, codePrefix: string) {
  const count = await model.count({ where: { businessId } });
  return `${codePrefix}-${String(count + 1).padStart(4, "0")}`;
}

export async function generateProjectCode(businessId: string, title: string) {
  const prefix = `PRJ-${initials(title, "GEN")}`;
  return nextSequence(db.Project, businessId, prefix);
}

export async function generateTaskCode(businessId: string, projectCode: string | null | undefined) {
  const prefix = `${projectCode || "TASK"}-T`;
  return nextSequence(db.ProjectTask, businessId, prefix);
}
