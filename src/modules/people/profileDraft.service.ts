import { db } from "../../models";
import { ProfileDraftDAL } from "./profileDraft.dal";

function buildValidationDetails(templateFields: any[], data: any) {
  const requiredFromTemplate = new Set<string>(
    (templateFields || []).filter((f: any) => Boolean(f?.required)).map((f: any) => String(f.name))
  );

  // Hard rule: if these fields exist in the template, they must be required.
  const mustBeRequiredIfPresent = ["fullName", "phone", "password"];
  for (const key of mustBeRequiredIfPresent) {
    const present = (templateFields || []).some((f: any) => String(f?.name) === key);
    if (present) requiredFromTemplate.add(key);
  }

  const details: any[] = [];
  for (const name of requiredFromTemplate) {
    const v = data ? (data as any)[name] : undefined;
    const empty =
      v === undefined || v === null || (typeof v === "string" && v.trim() === "") || (Array.isArray(v) && v.length === 0);
    if (empty) details.push({ message: `"${name}" is required`, path: [name] });
  }
  return details;
}

export class ProfileDraftService {
  private dal = new ProfileDraftDAL();

  list(businessId: string) {
    return this.dal.findAll({ businessId }, { order: [["updatedAt", "DESC"]] });
  }

  getById(id: string, businessId: string) {
    return db.ProfileDraft.findOne({ where: { id, businessId } });
  }

  async create(businessId: string, createdById: string, data: any) {
    const template = await db.ProfileTemplate.findOne({ where: { id: data.templateId, businessId } });
    if (!template) return { error: { statusCode: 404, message: "Profile template not found" } };

    const isDraft = (data.status || "draft") === "draft";
    if (!isDraft) {
      const details = buildValidationDetails(template.fields || [], data.data || {});
      if (details.length) return { error: { statusCode: 400, message: "Validation error", details } };
    }

    const draft = await this.dal.create({
      businessId,
      templateId: data.templateId,
      status: data.status || "draft",
      data: data.data || {},
      createdById
    });
    return { draft };
  }

  async update(id: string, businessId: string, patch: any) {
    const draft = await db.ProfileDraft.findOne({ where: { id, businessId } });
    if (!draft) return { error: { statusCode: 404, message: "Profile draft not found" } };

    const isDraft = (patch.status || draft.status) === "draft";
    if (patch.data && !isDraft) {
      const template = await db.ProfileTemplate.findOne({ where: { id: draft.templateId, businessId } });
      if (!template) return { error: { statusCode: 404, message: "Profile template not found" } };
      const details = buildValidationDetails(template.fields || [], patch.data || {});
      if (details.length) return { error: { statusCode: 400, message: "Validation error", details } };
    }

    await draft.update(patch);
    return { draft };
  }

  async remove(id: string, businessId: string) {
    const draft = await db.ProfileDraft.findOne({ where: { id, businessId } });
    if (!draft) return { error: { statusCode: 404, message: "Profile draft not found" } };
    await draft.destroy();
    return { ok: true };
  }
}

