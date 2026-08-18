import { randomUUID } from "crypto";
import { Op } from "sequelize";
import { sequelize } from "../../../database/sequelize";
import {
  BRAIN_CONTACT_FIELD_TYPES,
  BrainContactCategory,
  BrainContactColumnPreference,
  BrainContactField,
  BrainCustomContact,
} from "./contactCategory.model";
import type {
  BrainContactCategoryInput,
  BrainContactFieldInput,
  BrainContactFieldOption,
  BrainContactFieldType,
  BrainCustomContactInput,
} from "./contactCategory.types";

const cleanText = (value: unknown): string | null => String(value ?? "").trim() || null;
const isEmpty = (value: unknown) => value === null || value === undefined || value === "" || (Array.isArray(value) && value.length === 0);
const makeKey = (label: string) => label.trim().toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 80) || "field";

function cleanOptions(raw: unknown): BrainContactFieldOption[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const rows: BrainContactFieldOption[] = [];
  for (const item of raw) {
    const label = cleanText(typeof item === "string" ? item : (item as any)?.label);
    if (!label || seen.has(label.toLowerCase())) continue;
    seen.add(label.toLowerCase());
    rows.push({ id: cleanText(typeof item === "object" ? (item as any)?.id : null) || randomUUID(), label });
  }
  return rows.slice(0, 100);
}

export class BrainContactCategoryService {
  private businessId(value?: string | null) {
    if (!value) {
      const error: any = new Error("A company context is required to manage contact categories");
      error.statusCode = 403;
      throw error;
    }
    return value;
  }

  private async category(businessId: string, id: string, activeOnly = false) {
    const row = await BrainContactCategory.findOne({ where: { id, businessId, ...(activeOnly ? { isActive: true } : {}) } });
    if (!row) {
      const error: any = new Error("Contact category not found");
      error.statusCode = 404;
      throw error;
    }
    return row as any;
  }

  private async field(businessId: string, categoryId: string, id: string) {
    const row = await BrainContactField.findOne({ where: { id, categoryId, businessId } });
    if (!row) {
      const error: any = new Error("Contact field not found");
      error.statusCode = 404;
      throw error;
    }
    return row as any;
  }

  private normalizeField(input: BrainContactFieldInput) {
    const label = cleanText(input.label);
    if (!label) {
      const error: any = new Error("Field name is required");
      error.statusCode = 400;
      throw error;
    }
    if (!BRAIN_CONTACT_FIELD_TYPES.includes(input.type as any)) {
      const error: any = new Error("Unsupported contact field type");
      error.statusCode = 400;
      throw error;
    }
    return {
      label,
      type: input.type,
      isRequired: Boolean(input.isRequired),
      showInTable: Boolean(input.showInTable),
      options: input.type === "dropdown" || input.type === "multi_select" ? cleanOptions(input.options) : [],
    };
  }

  private async nextKey(categoryId: string, label: string) {
    const base = makeKey(label);
    let key = base;
    let suffix = 2;
    while (await BrainContactField.findOne({ where: { categoryId, key } })) key = `${base}_${suffix++}`.slice(0, 100);
    return key;
  }

  private async toCategory(row: any, includeArchivedFields = false) {
    const fields = await BrainContactField.findAll({
      where: { businessId: row.businessId, categoryId: row.id, ...(includeArchivedFields ? {} : { isArchived: false }) },
      order: [["sortOrder", "ASC"], ["createdAt", "ASC"]],
    });
    return {
      ...row.toJSON(),
      fields: fields.map((field: any) => field.toJSON()),
      contactCount: await BrainCustomContact.count({ where: { businessId: row.businessId, categoryId: row.id } }),
    };
  }

  async listCategories(businessId?: string | null, includeArchived = false) {
    const scoped = this.businessId(businessId);
    const rows = await BrainContactCategory.findAll({
      where: { businessId: scoped, ...(includeArchived ? {} : { isActive: true }) },
      order: [["sortOrder", "ASC"], ["name", "ASC"]],
    });
    return Promise.all(rows.map((row: any) => this.toCategory(row, includeArchived)));
  }

  async createCategory(businessId: string | null | undefined, userId: string, input: BrainContactCategoryInput) {
    const scoped = this.businessId(businessId);
    const name = cleanText(input.name);
    if (!name) {
      const error: any = new Error("Category name is required");
      error.statusCode = 400;
      throw error;
    }
    if (await BrainContactCategory.findOne({ where: { businessId: scoped, name: { [Op.iLike]: name } } })) {
      const error: any = new Error("A contact category with this name already exists");
      error.statusCode = 409;
      throw error;
    }

    const category: any = await sequelize.transaction(async (transaction) => {
      const max = await BrainContactCategory.max("sortOrder", { where: { businessId: scoped }, transaction }) as number | null;
      const row: any = await BrainContactCategory.create({
        businessId: scoped,
        name,
        iconName: cleanText(input.iconName) || "Users",
        description: cleanText(input.description),
        isActive: true,
        sortOrder: Number(max ?? -1) + 1,
        createdByUserId: userId,
        updatedByUserId: userId,
      }, { transaction });
      await BrainContactField.create({
        businessId: scoped, categoryId: row.id, key: "name", label: "Name", type: "text",
        isRequired: true, showInTable: true, sortOrder: 0, options: [], isSystem: true, isArchived: false,
        createdByUserId: userId, updatedByUserId: userId,
      }, { transaction });
      const keys = new Set(["name"]);
      let sortOrder = 1;
      for (const raw of input.fields || []) {
        const field = this.normalizeField(raw);
        const base = makeKey(field.label);
        let key = base;
        let suffix = 2;
        while (keys.has(key)) key = `${base}_${suffix++}`.slice(0, 100);
        keys.add(key);
        await BrainContactField.create({
          businessId: scoped, categoryId: row.id, key, ...field, sortOrder: sortOrder++, isSystem: false,
          isArchived: false, createdByUserId: userId, updatedByUserId: userId,
        }, { transaction });
      }
      return row;
    });
    return this.toCategory(category);
  }

  async updateCategory(businessId: string | null | undefined, userId: string, id: string, input: any) {
    const scoped = this.businessId(businessId);
    const row: any = await this.category(scoped, id);
    if (input.name !== undefined) {
      const name = cleanText(input.name);
      if (!name) {
        const error: any = new Error("Category name is required");
        error.statusCode = 400;
        throw error;
      }
      if (await BrainContactCategory.findOne({ where: { businessId: scoped, id: { [Op.ne]: id }, name: { [Op.iLike]: name } } })) {
        const error: any = new Error("A contact category with this name already exists");
        error.statusCode = 409;
        throw error;
      }
      row.name = name;
    }
    if (input.iconName !== undefined) row.iconName = cleanText(input.iconName) || "Users";
    if (input.description !== undefined) row.description = cleanText(input.description);
    if (input.isActive !== undefined) row.isActive = Boolean(input.isActive);
    row.updatedByUserId = userId;
    await row.save();
    return this.toCategory(row, true);
  }

  async archiveCategory(businessId: string | null | undefined, userId: string, id: string) {
    return this.updateCategory(businessId, userId, id, { isActive: false });
  }

  async createField(businessId: string | null | undefined, userId: string, categoryId: string, input: BrainContactFieldInput) {
    const scoped = this.businessId(businessId);
    await this.category(scoped, categoryId);
    const field = this.normalizeField(input);
    const max = await BrainContactField.max("sortOrder", { where: { categoryId } }) as number | null;
    const row: any = await BrainContactField.create({
      businessId: scoped, categoryId, key: await this.nextKey(categoryId, field.label), ...field,
      sortOrder: Number(max ?? -1) + 1, isSystem: false, isArchived: false,
      createdByUserId: userId, updatedByUserId: userId,
    });
    return row.toJSON();
  }

  async updateField(businessId: string | null | undefined, userId: string, categoryId: string, id: string, input: any) {
    const scoped = this.businessId(businessId);
    const row: any = await this.field(scoped, categoryId, id);
    if (row.isSystem) {
      if (input.label !== undefined || input.type !== undefined || input.isRequired === false || input.isArchived === true) {
        const error: any = new Error("The Name field is protected and cannot be renamed, retyped, made optional, or archived");
        error.statusCode = 400;
        throw error;
      }
      row.showInTable = true;
    } else {
      if (input.label !== undefined) {
        const label = cleanText(input.label);
        if (!label) {
          const error: any = new Error("Field name is required");
          error.statusCode = 400;
          throw error;
        }
        row.label = label;
      }
      if (input.type !== undefined) {
        if (!BRAIN_CONTACT_FIELD_TYPES.includes(input.type)) {
          const error: any = new Error("Unsupported contact field type");
          error.statusCode = 400;
          throw error;
        }
        row.type = input.type;
      }
      if (input.isRequired !== undefined) row.isRequired = Boolean(input.isRequired);
      if (input.showInTable !== undefined) row.showInTable = Boolean(input.showInTable);
      if (input.isArchived !== undefined) row.isArchived = Boolean(input.isArchived);
      if (input.options !== undefined || input.type !== undefined) {
        row.options = row.type === "dropdown" || row.type === "multi_select" ? cleanOptions(input.options ?? row.options) : [];
      }
    }
    row.updatedByUserId = userId;
    await row.save();
    return row.toJSON();
  }

  async archiveField(businessId: string | null | undefined, userId: string, categoryId: string, id: string) {
    const scoped = this.businessId(businessId);
    const row: any = await this.field(scoped, categoryId, id);
    if (row.isSystem) {
      const error: any = new Error("The Name field is protected and cannot be archived");
      error.statusCode = 400;
      throw error;
    }
    row.isArchived = true;
    row.updatedByUserId = userId;
    await row.save();
    return row.toJSON();
  }

  async reorderFields(businessId: string | null | undefined, userId: string, categoryId: string, ids: string[]) {
    const scoped = this.businessId(businessId);
    const category = await this.category(scoped, categoryId);
    const fields: any[] = await BrainContactField.findAll({ where: { businessId: scoped, categoryId, isArchived: false } }) as any;
    const existing = new Set(fields.map((field) => String(field.id)));
    if (ids.length !== existing.size || ids.some((id) => !existing.has(id))) {
      const error: any = new Error("Field order must contain every active field exactly once");
      error.statusCode = 400;
      throw error;
    }
    const nameField = fields.find((field) => field.isSystem);
    if (nameField && ids[0] !== String(nameField.id)) {
      const error: any = new Error("The protected Name field must stay first");
      error.statusCode = 400;
      throw error;
    }
    await sequelize.transaction(async (transaction) => {
      for (let i = 0; i < ids.length; i += 1) {
        await BrainContactField.update({ sortOrder: i, updatedByUserId: userId }, { where: { id: ids[i], businessId: scoped, categoryId }, transaction });
      }
    });
    return this.toCategory(category);
  }

  private normalizeValue(field: any, value: unknown): unknown {
    if (isEmpty(value)) return null;
    const type = field.type as BrainContactFieldType;
    if (["text", "long_text", "phone"].includes(type)) return String(value).trim();
    if (type === "number") {
      const number = Number(value);
      if (!Number.isFinite(number)) throw new Error(`${field.label} must be a number`);
      return number;
    }
    if (type === "checkbox") return typeof value === "string" ? value.toLowerCase() === "true" : Boolean(value);
    if (type === "email") {
      const text = String(value).trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) throw new Error(`${field.label} must be a valid email`);
      return text;
    }
    if (type === "url") {
      const text = String(value).trim();
      try { new URL(text); } catch { throw new Error(`${field.label} must be a valid URL`); }
      return text;
    }
    if (type === "date") {
      const text = String(value).trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || Number.isNaN(Date.parse(`${text}T00:00:00Z`))) throw new Error(`${field.label} must be a valid date`);
      return text;
    }
    const options = cleanOptions(field.options);
    const allowed = new Set(options.map((option) => option.id));
    if (type === "dropdown") {
      const id = String(value);
      if (!allowed.has(id)) throw new Error(`${field.label} contains an invalid option`);
      return id;
    }
    if (type === "multi_select") {
      if (!Array.isArray(value) || value.some((item) => !allowed.has(String(item)))) throw new Error(`${field.label} contains an invalid option`);
      return Array.from(new Set(value.map(String)));
    }
    return value;
  }

  private async normalizeContact(category: any, input: BrainCustomContactInput, previous: Record<string, unknown> = {}) {
    const name = cleanText(input.name);
    if (!name) {
      const error: any = new Error("Contact name is required");
      error.statusCode = 400;
      throw error;
    }
    const fields: any[] = await BrainContactField.findAll({ where: { businessId: category.businessId, categoryId: category.id, isArchived: false }, order: [["sortOrder", "ASC"]] }) as any;
    const submitted = input.values && typeof input.values === "object" ? input.values : {};
    const values: Record<string, unknown> = { ...previous, name };
    try {
      for (const field of fields) {
        if (field.key === "name") continue;
        const raw = (submitted as any)[field.key];
        if (field.isRequired && isEmpty(raw)) throw new Error(`${field.label} is required`);
        values[field.key] = this.normalizeValue(field, raw);
      }
    } catch (cause) {
      const error: any = new Error((cause as Error).message || "Invalid contact field value");
      error.statusCode = 400;
      throw error;
    }
    return { name, values };
  }

  async listCustomContacts(businessId: string | null | undefined, categoryId: string, query: any = {}) {
    const scoped = this.businessId(businessId);
    const category: any = await this.category(scoped, categoryId, true);
    const page = Math.max(parseInt(String(query.page || 1), 10) || 1, 1);
    const size = Math.min(Math.max(parseInt(String(query.size || 20), 10) || 20, 1), 100);
    const search = String(query.search || "").trim().toLowerCase();
    let rows = (await BrainCustomContact.findAll({ where: { businessId: scoped, categoryId }, order: [["updatedAt", "DESC"]] })).map((row: any) => row.toJSON());
    if (search) rows = rows.filter((row: any) => Object.values({ name: row.name, ...(row.values || {}) }).flatMap((value) => Array.isArray(value) ? value : [value]).filter(Boolean).join(" ").toLowerCase().includes(search));
    const count = rows.length;
    const pages = Math.max(Math.ceil(count / size), 1);
    return { category: await this.toCategory(category), rows: rows.slice((page - 1) * size, page * size), count, page, size, pages };
  }

  async createCustomContact(businessId: string | null | undefined, userId: string, categoryId: string, input: BrainCustomContactInput) {
    const scoped = this.businessId(businessId);
    const category = await this.category(scoped, categoryId, true);
    const normalized = await this.normalizeContact(category, input);
    const row: any = await BrainCustomContact.create({ businessId: scoped, categoryId, ...normalized, createdByUserId: userId, updatedByUserId: userId });
    return row.toJSON();
  }

  async updateCustomContact(businessId: string | null | undefined, userId: string, categoryId: string, id: string, input: BrainCustomContactInput) {
    const scoped = this.businessId(businessId);
    const category = await this.category(scoped, categoryId, true);
    const row: any = await BrainCustomContact.findOne({ where: { id, categoryId, businessId: scoped } });
    if (!row) {
      const error: any = new Error("Contact not found"); error.statusCode = 404; throw error;
    }
    const normalized = await this.normalizeContact(category, input, row.values || {});
    row.name = normalized.name; row.values = normalized.values; row.updatedByUserId = userId; await row.save();
    return row.toJSON();
  }

  async deleteCustomContact(businessId: string | null | undefined, categoryId: string, id: string) {
    const scoped = this.businessId(businessId);
    const row: any = await BrainCustomContact.findOne({ where: { id, categoryId, businessId: scoped } });
    if (!row) { const error: any = new Error("Contact not found"); error.statusCode = 404; throw error; }
    await row.destroy();
  }

  async getColumnPreference(businessId: string | null | undefined, userId: string, categoryId: string) {
    const scoped = this.businessId(businessId);
    await this.category(scoped, categoryId);
    const fields: any[] = await BrainContactField.findAll({ where: { businessId: scoped, categoryId, isArchived: false }, order: [["sortOrder", "ASC"]] }) as any;
    const pref: any = await BrainContactColumnPreference.findOne({ where: { businessId: scoped, userId, categoryId } });
    const active = new Set(fields.map((field) => String(field.id)));
    const fallback = fields.filter((field) => field.showInTable || field.isSystem).map((field) => String(field.id));
    const visibleFieldIds = pref && Array.isArray(pref.visibleFieldIds) ? pref.visibleFieldIds.map(String).filter((id: string) => active.has(id)) : fallback;
    const name = fields.find((field) => field.isSystem);
    if (name && !visibleFieldIds.includes(String(name.id))) visibleFieldIds.unshift(String(name.id));
    return { categoryId, visibleFieldIds };
  }

  async updateColumnPreference(businessId: string | null | undefined, userId: string, categoryId: string, ids: string[]) {
    const scoped = this.businessId(businessId);
    await this.category(scoped, categoryId);
    const fields: any[] = await BrainContactField.findAll({ where: { businessId: scoped, categoryId, isArchived: false } }) as any;
    const valid = new Set(fields.map((field) => String(field.id)));
    const visibleFieldIds = Array.from(new Set(ids.map(String))).filter((id) => valid.has(id));
    const name = fields.find((field) => field.isSystem);
    if (name && !visibleFieldIds.includes(String(name.id))) visibleFieldIds.unshift(String(name.id));
    const [pref]: any = await BrainContactColumnPreference.findOrCreate({ where: { userId, categoryId }, defaults: { businessId: scoped, userId, categoryId, visibleFieldIds } });
    pref.businessId = scoped; pref.visibleFieldIds = visibleFieldIds; await pref.save();
    return { categoryId, visibleFieldIds };
  }
}
