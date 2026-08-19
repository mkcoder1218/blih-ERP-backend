import { randomUUID } from "crypto";
import { Op } from "sequelize";
import { db } from "../../../models";
import {
  BEHAVIOR_COLORS,
  BrainContactOption,
  type BRAIN_CONTACT_OPTION_TYPES,
} from "./contactOption.model";
import type {
  BrainContactDirectoryMetadata,
  BrainContactInput,
  BrainContactKind,
  BrainContactListQuery,
  BrainContactOptionType,
  BrainContactPhone,
  BrainContactPlatformAccount,
} from "./contact.types";

type OptionRow = {
  id: string;
  businessId: string;
  type: BrainContactOptionType;
  label: string;
  color?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

const DEFAULT_OPTIONS: Record<BrainContactOptionType, Array<{ label: string; color?: string }>> = {
  field: [],
  behavior: [
    { label: "Friendly", color: BEHAVIOR_COLORS[6] },
    { label: "Professional", color: BEHAVIOR_COLORS[0] },
    { label: "Difficult", color: BEHAVIOR_COLORS[3] },
    { label: "Responsive", color: BEHAVIOR_COLORS[7] },
    { label: "Slow Responder", color: BEHAVIOR_COLORS[5] },
    { label: "Negotiable", color: BEHAVIOR_COLORS[1] },
    { label: "High Priority", color: BEHAVIOR_COLORS[4] },
  ],
  platform: [
    { label: "Instagram" },
    { label: "TikTok" },
    { label: "YouTube" },
    { label: "Facebook" },
    { label: "Telegram" },
  ],
  client_status: [
    { label: "Potential" },
    { label: "Active" },
    { label: "Inactive" },
    { label: "Past Client" },
  ],
  client_type: [],
  position: [],
  company: [],
};

function cleanText(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text || null;
}

function normalizePhone(value: unknown): string {
  let normalized = String(value ?? "").replace(/\D/g, "");
  if (normalized.startsWith("00")) normalized = normalized.slice(2);
  return normalized;
}

function cleanPhone(phone: BrainContactPhone): BrainContactPhone | null {
  const number = cleanText(phone?.number);
  if (!number) return null;
  return {
    id: phone.id || randomUUID(),
    number,
    label: cleanText(phone.label),
  };
}

function cleanPlatformAccount(
  account: BrainContactPlatformAccount,
): BrainContactPlatformAccount | null {
  const platformOptionId = cleanText(account?.platformOptionId);
  if (!platformOptionId) return null;

  const rawFollowerCount = account.followerCount;
  const followerCount =
    rawFollowerCount === null || rawFollowerCount === undefined || rawFollowerCount === ("" as any)
      ? null
      : Math.max(0, Number(rawFollowerCount) || 0);

  return {
    id: account.id || randomUUID(),
    platformOptionId,
    handle: cleanText(account.handle),
    profileUrl: cleanText(account.profileUrl),
    followerCount,
  };
}

export class BrainContactsService {
  private requireBusinessId(businessId?: string | null): string {
    if (!businessId) {
      const error: any = new Error("A company context is required to manage contacts");
      error.statusCode = 403;
      throw error;
    }
    return businessId;
  }

  private contactMetadata(client: any): BrainContactDirectoryMetadata {
    const rawMetadata = client?.metadata && typeof client.metadata === "object" ? client.metadata : {};
    const directory = rawMetadata.contactDirectory;

    if (directory && typeof directory === "object" && directory.version === 1) {
      return {
        ...directory,
        kind: directory.kind === "influencer" ? "influencer" : "client",
        name: cleanText(directory.name) || cleanText(client.contactName) || cleanText(client.companyName) || "Unnamed contact",
        phones: Array.isArray(directory.phones)
          ? directory.phones.map(cleanPhone).filter(Boolean)
          : [],
        platformAccounts: Array.isArray(directory.platformAccounts)
          ? directory.platformAccounts.map(cleanPlatformAccount).filter(Boolean)
          : [],
      } as BrainContactDirectoryMetadata;
    }

    return {
      version: 1,
      kind: "client",
      name: cleanText(client.contactName) || cleanText(client.companyName) || "Unnamed client",
      phones: client.phone
        ? [{ id: randomUUID(), number: String(client.phone), label: "Primary" }]
        : [],
      email: cleanText(client.email),
      fieldOptionId: null,
      behaviorOptionId: null,
      companyOptionId: null,
      positionOptionId: null,
      clientTypeOptionId: null,
      clientStatusOptionId: null,
      location: null,
      notes: null,
      profileImageUrl: null,
      platformAccounts: [],
      createdByUserId: client.accountManagerUserId || null,
      updatedByUserId: null,
    };
  }

  private async ensureDefaultOptions(businessId: string, actorUserId?: string | null) {
    const defaults = Object.entries(DEFAULT_OPTIONS) as Array<
      [BrainContactOptionType, Array<{ label: string; color?: string }>]
    >;

    for (const [type, values] of defaults) {
      for (const item of values) {
        const existing = await BrainContactOption.findOne({
          where: {
            businessId,
            type,
            label: { [Op.iLike]: item.label },
          },
        });

        if (!existing) {
          await BrainContactOption.create({
            businessId,
            type,
            label: item.label,
            color: item.color || null,
            createdByUserId: actorUserId || null,
          });
        }
      }
    }
  }

  private async optionRows(businessId: string): Promise<OptionRow[]> {
    const rows = await BrainContactOption.findAll({
      where: { businessId },
      order: [["type", "ASC"], ["label", "ASC"]],
    });
    return rows.map((row: any) => row.toJSON()) as OptionRow[];
  }

  private hydrateContact(client: any, optionMap: Map<string, OptionRow>) {
    const directory = this.contactMetadata(client);
    const option = (id?: string | null) => (id ? optionMap.get(id) || null : null);
    const legacyCompany = cleanText(client.companyName);
    const legacyField = cleanText(client.industry);

    return {
      id: client.id,
      businessId: client.businessId,
      kind: directory.kind,
      name: directory.name,
      email: cleanText(directory.email) || cleanText(client.email),
      phones: directory.phones,
      fieldOptionId: directory.fieldOptionId || null,
      behaviorOptionId: directory.behaviorOptionId || null,
      companyOptionId: directory.companyOptionId || null,
      positionOptionId: directory.positionOptionId || null,
      clientTypeOptionId: directory.clientTypeOptionId || null,
      clientStatusOptionId: directory.clientStatusOptionId || null,
      field: option(directory.fieldOptionId) || (legacyField ? { id: null, label: legacyField, color: null } : null),
      behavior: option(directory.behaviorOptionId),
      company: option(directory.companyOptionId) ||
        (directory.kind === "client" && legacyCompany ? { id: null, label: legacyCompany, color: null } : null),
      position: option(directory.positionOptionId),
      clientType: option(directory.clientTypeOptionId),
      clientStatus: option(directory.clientStatusOptionId),
      location: cleanText(directory.location),
      notes: cleanText(directory.notes),
      profileImageUrl: cleanText(directory.profileImageUrl),
      platformAccounts: directory.platformAccounts.map((account) => ({
        ...account,
        platform: option(account.platformOptionId),
      })),
      accountManager: client.accountManager || null,
      createdAt: client.createdAt,
      updatedAt: client.updatedAt,
    };
  }

  private async assertOptionIds(
    businessId: string,
    input: Partial<BrainContactInput>,
  ) {
    const expected: Array<[string | null | undefined, BrainContactOptionType]> = [
      [input.fieldOptionId, "field"],
      [input.behaviorOptionId, "behavior"],
      [input.companyOptionId, "company"],
      [input.positionOptionId, "position"],
      [input.clientTypeOptionId, "client_type"],
      [input.clientStatusOptionId, "client_status"],
    ];

    for (const account of input.platformAccounts || []) {
      expected.push([account.platformOptionId, "platform"]);
    }

    const ids = Array.from(new Set(expected.map(([id]) => cleanText(id)).filter(Boolean))) as string[];
    if (!ids.length) return;

    const rows = await BrainContactOption.findAll({
      where: { businessId, id: { [Op.in]: ids } },
    });
    const byId = new Map(rows.map((row: any) => [row.id, row.type]));

    for (const [rawId, expectedType] of expected) {
      const id = cleanText(rawId);
      if (!id) continue;
      if (byId.get(id) !== expectedType) {
        const error: any = new Error(`Invalid ${expectedType.replace(/_/g, " ")} option`);
        error.statusCode = 400;
        throw error;
      }
    }
  }

  private async assertPhonesAvailable(
    businessId: string,
    phones: BrainContactPhone[],
    excludeClientId?: string,
  ) {
    const requested = new Set(phones.map((phone) => normalizePhone(phone.number)).filter(Boolean));
    if (!requested.size) return;

    const existingClients = await db.Client.findAll({
      where: { businessId },
      attributes: ["id", "companyName", "contactName", "phone", "metadata"],
    });

    for (const existing of existingClients) {
      if (excludeClientId && existing.id === excludeClientId) continue;
      const directory = this.contactMetadata(existing);
      const existingNumbers = [
        ...directory.phones.map((phone) => phone.number),
        existing.phone,
      ]
        .map(normalizePhone)
        .filter(Boolean);

      if (existingNumbers.some((number) => requested.has(number))) {
        const existingName = directory.name || existing.contactName || existing.companyName || "another contact";
        const error: any = new Error(
          `This phone number already belongs to ${existingName}. Open the existing contact and add another phone number there if needed.`,
        );
        error.statusCode = 409;
        throw error;
      }
    }
  }

  private async buildMetadata(
    input: BrainContactInput,
    actorUserId: string,
    previous?: BrainContactDirectoryMetadata,
  ): Promise<BrainContactDirectoryMetadata> {
    const name = cleanText(input.name);
    if (!name) {
      const error: any = new Error("Contact name is required");
      error.statusCode = 400;
      throw error;
    }

    const phones = (input.phones || []).map(cleanPhone).filter(Boolean) as BrainContactPhone[];
    if (!phones.length) {
      const error: any = new Error("At least one phone number is required");
      error.statusCode = 400;
      throw error;
    }

    return {
      version: 1,
      kind: input.kind,
      name,
      phones,
      email: cleanText(input.email),
      fieldOptionId: cleanText(input.fieldOptionId),
      behaviorOptionId: cleanText(input.behaviorOptionId),
      companyOptionId: input.kind === "client" ? cleanText(input.companyOptionId) : null,
      positionOptionId: input.kind === "client" ? cleanText(input.positionOptionId) : null,
      clientTypeOptionId: input.kind === "client" ? cleanText(input.clientTypeOptionId) : null,
      clientStatusOptionId: input.kind === "client" ? cleanText(input.clientStatusOptionId) : null,
      location: cleanText(input.location),
      notes: cleanText(input.notes),
      profileImageUrl: cleanText(input.profileImageUrl),
      platformAccounts:
        input.kind === "influencer"
          ? (input.platformAccounts || []).map(cleanPlatformAccount).filter(Boolean) as BrainContactPlatformAccount[]
          : [],
      createdByUserId: previous?.createdByUserId || actorUserId,
      updatedByUserId: actorUserId,
    };
  }

  private async legacyValues(
    businessId: string,
    metadata: BrainContactDirectoryMetadata,
  ) {
    const options = await this.optionRows(businessId);
    const map = new Map(options.map((item) => [item.id, item]));
    const field = metadata.fieldOptionId ? map.get(metadata.fieldOptionId) : null;
    const company = metadata.companyOptionId ? map.get(metadata.companyOptionId) : null;
    const clientStatus = metadata.clientStatusOptionId ? map.get(metadata.clientStatusOptionId) : null;
    const statusLabel = String(clientStatus?.label || "").toLowerCase();

    return {
      companyName:
        metadata.kind === "client"
          ? company?.label || metadata.name
          : metadata.name,
      contactName: metadata.name,
      email: cleanText(metadata.email),
      phone: metadata.phones[0]?.number || null,
      industry: field?.label || null,
      status:
        metadata.kind === "client" && (statusLabel === "inactive" || statusLabel === "past client")
          ? "inactive"
          : "active",
    };
  }

  async listContacts(
    businessId: string | null | undefined,
    query: BrainContactListQuery = {},
    actorUserId?: string | null,
  ) {
    const scopedBusinessId = this.requireBusinessId(businessId);
    await this.ensureDefaultOptions(scopedBusinessId, actorUserId);

    const page = Math.max(Number.parseInt(String(query.page || 1), 10) || 1, 1);
    const size = Math.min(Math.max(Number.parseInt(String(query.size || 20), 10) || 20, 1), 100);
    const search = String(query.search || "").trim().toLowerCase();

    const clients = await db.Client.findAll({
      where: { businessId: scopedBusinessId },
      order: [["updatedAt", "DESC"]],
      include: [
        {
          model: db.User,
          as: "accountManager",
          attributes: ["id", "fullName", "email"],
          required: false,
        },
      ],
    });

    const optionRows = await this.optionRows(scopedBusinessId);
    const optionMap = new Map(optionRows.map((item) => [item.id, item]));
    let rows = clients.map((client: any) => this.hydrateContact(client, optionMap));

    if (query.kind) rows = rows.filter((row) => row.kind === query.kind);
    if (query.fieldOptionId) rows = rows.filter((row) => row.fieldOptionId === query.fieldOptionId);
    if (query.behaviorOptionId) rows = rows.filter((row) => row.behaviorOptionId === query.behaviorOptionId);
    if (query.clientStatusOptionId) rows = rows.filter((row) => row.clientStatusOptionId === query.clientStatusOptionId);

    if (search) {
      rows = rows.filter((row) => {
        const haystack = [
          row.name,
          row.email,
          row.location,
          row.field?.label,
          row.behavior?.label,
          row.company?.label,
          row.position?.label,
          row.clientType?.label,
          row.clientStatus?.label,
          ...row.phones.map((phone: BrainContactPhone) => phone.number),
          ...row.platformAccounts.flatMap((account: any) => [
            account.platform?.label,
            account.handle,
            account.profileUrl,
          ]),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(search);
      });
    }

    rows.sort((a, b) => a.name.localeCompare(b.name));
    const count = rows.length;
    const offset = (page - 1) * size;

    return {
      rows: rows.slice(offset, offset + size),
      count,
      page,
      size,
      pages: Math.max(Math.ceil(count / size), 1),
    };
  }

  async getContact(businessId: string | null | undefined, id: string) {
    const scopedBusinessId = this.requireBusinessId(businessId);
    const client = await db.Client.findOne({
      where: { id, businessId: scopedBusinessId },
      include: [
        {
          model: db.User,
          as: "accountManager",
          attributes: ["id", "fullName", "email"],
          required: false,
        },
      ],
    });
    if (!client) {
      const error: any = new Error("Contact not found");
      error.statusCode = 404;
      throw error;
    }
    const options = await this.optionRows(scopedBusinessId);
    return this.hydrateContact(client, new Map(options.map((item) => [item.id, item])));
  }

  async createContact(
    businessId: string | null | undefined,
    actorUserId: string,
    input: BrainContactInput,
  ) {
    const scopedBusinessId = this.requireBusinessId(businessId);
    await this.ensureDefaultOptions(scopedBusinessId, actorUserId);
    await this.assertOptionIds(scopedBusinessId, input);
    const metadata = await this.buildMetadata(input, actorUserId);
    await this.assertPhonesAvailable(scopedBusinessId, metadata.phones);
    const legacy = await this.legacyValues(scopedBusinessId, metadata);

    const client = await db.Client.create({
      businessId: scopedBusinessId,
      accountManagerUserId: actorUserId,
      ...legacy,
      metadata: {
        createdFrom: "brain_contact_directory",
        createdByUserId: actorUserId,
        contactDirectory: metadata,
      },
    });

    return this.getContact(scopedBusinessId, client.id);
  }

  async updateContact(
    businessId: string | null | undefined,
    actorUserId: string,
    id: string,
    patch: Partial<BrainContactInput>,
  ) {
    const scopedBusinessId = this.requireBusinessId(businessId);
    const client = await db.Client.findOne({ where: { id, businessId: scopedBusinessId } });
    if (!client) {
      const error: any = new Error("Contact not found");
      error.statusCode = 404;
      throw error;
    }

    const previous = this.contactMetadata(client);
    const merged: BrainContactInput = {
      kind: patch.kind || previous.kind,
      name: patch.name ?? previous.name,
      phones: patch.phones ?? previous.phones,
      email: patch.email !== undefined ? patch.email : previous.email,
      fieldOptionId: patch.fieldOptionId !== undefined ? patch.fieldOptionId : previous.fieldOptionId,
      behaviorOptionId: patch.behaviorOptionId !== undefined ? patch.behaviorOptionId : previous.behaviorOptionId,
      companyOptionId: patch.companyOptionId !== undefined ? patch.companyOptionId : previous.companyOptionId,
      positionOptionId: patch.positionOptionId !== undefined ? patch.positionOptionId : previous.positionOptionId,
      clientTypeOptionId: patch.clientTypeOptionId !== undefined ? patch.clientTypeOptionId : previous.clientTypeOptionId,
      clientStatusOptionId: patch.clientStatusOptionId !== undefined ? patch.clientStatusOptionId : previous.clientStatusOptionId,
      location: patch.location !== undefined ? patch.location : previous.location,
      notes: patch.notes !== undefined ? patch.notes : previous.notes,
      profileImageUrl: patch.profileImageUrl !== undefined ? patch.profileImageUrl : previous.profileImageUrl,
      platformAccounts: patch.platformAccounts !== undefined ? patch.platformAccounts : previous.platformAccounts,
    };

    await this.assertOptionIds(scopedBusinessId, merged);
    const metadata = await this.buildMetadata(merged, actorUserId, previous);
    await this.assertPhonesAvailable(scopedBusinessId, metadata.phones, id);
    const legacy = await this.legacyValues(scopedBusinessId, metadata);
    const currentMetadata = client.metadata && typeof client.metadata === "object" ? client.metadata : {};

    await client.update({
      ...legacy,
      metadata: {
        ...currentMetadata,
        contactDirectory: metadata,
        updatedByUserId: actorUserId,
      },
    });

    return this.getContact(scopedBusinessId, id);
  }

  async deleteContact(businessId: string | null | undefined, id: string) {
    const scopedBusinessId = this.requireBusinessId(businessId);
    const client = await db.Client.findOne({ where: { id, businessId: scopedBusinessId } });
    if (!client) {
      const error: any = new Error("Contact not found");
      error.statusCode = 404;
      throw error;
    }
    await client.destroy();
  }

  async listOptions(
    businessId: string | null | undefined,
    type?: BrainContactOptionType,
    actorUserId?: string | null,
  ) {
    const scopedBusinessId = this.requireBusinessId(businessId);
    await this.ensureDefaultOptions(scopedBusinessId, actorUserId);
    const where: any = { businessId: scopedBusinessId };
    if (type) where.type = type;
    const rows = await BrainContactOption.findAll({
      where,
      order: [["type", "ASC"], ["label", "ASC"]],
    });
    return rows.map((row: any) => row.toJSON());
  }

  async createOption(
    businessId: string | null | undefined,
    actorUserId: string,
    input: { type: BrainContactOptionType; label: string; color?: string | null },
  ) {
    const scopedBusinessId = this.requireBusinessId(businessId);
    const label = cleanText(input.label);
    if (!label) {
      const error: any = new Error("Option label is required");
      error.statusCode = 400;
      throw error;
    }

    const duplicate = await BrainContactOption.findOne({
      where: { businessId: scopedBusinessId, type: input.type, label: { [Op.iLike]: label } },
    });
    if (duplicate) {
      const error: any = new Error(`${label} already exists`);
      error.statusCode = 409;
      throw error;
    }

    const color = input.type === "behavior" ? cleanText(input.color) : null;
    if (color && !BEHAVIOR_COLORS.includes(color as any)) {
      const error: any = new Error("Behavior color must be one of the predefined colors");
      error.statusCode = 400;
      throw error;
    }

    const row = await BrainContactOption.create({
      businessId: scopedBusinessId,
      type: input.type,
      label,
      color: color || (input.type === "behavior" ? BEHAVIOR_COLORS[0] : null),
      createdByUserId: actorUserId,
    });
    return row.toJSON();
  }

  async updateOption(
    businessId: string | null | undefined,
    id: string,
    input: { label?: string; color?: string | null },
  ) {
    const scopedBusinessId = this.requireBusinessId(businessId);
    const row: any = await BrainContactOption.findOne({ where: { id, businessId: scopedBusinessId } });
    if (!row) {
      const error: any = new Error("Contact option not found");
      error.statusCode = 404;
      throw error;
    }

    const label = input.label !== undefined ? cleanText(input.label) : row.label;
    if (!label) {
      const error: any = new Error("Option label is required");
      error.statusCode = 400;
      throw error;
    }

    const color = row.type === "behavior" && input.color !== undefined ? cleanText(input.color) : row.color;
    if (color && row.type === "behavior" && !BEHAVIOR_COLORS.includes(color as any)) {
      const error: any = new Error("Behavior color must be one of the predefined colors");
      error.statusCode = 400;
      throw error;
    }

    await row.update({ label, color });
    return row.toJSON();
  }

  async deleteOption(businessId: string | null | undefined, id: string) {
    const scopedBusinessId = this.requireBusinessId(businessId);
    const row: any = await BrainContactOption.findOne({ where: { id, businessId: scopedBusinessId } });
    if (!row) {
      const error: any = new Error("Contact option not found");
      error.statusCode = 404;
      throw error;
    }
    await row.destroy();
  }
}
