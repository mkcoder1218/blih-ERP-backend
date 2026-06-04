import { Op } from "sequelize";
import bcrypt from "bcrypt";
import { db } from "../../models";
import { env } from "../../config/env";
import {
  EMPLOYMENT_STATUSES,
  EMPLOYMENT_TYPES,
  type EmploymentStatus,
  type EmploymentType,
} from "../../constants/employee.constants";

export type BulkEmployeeValidationStatus =
  | "READY_TO_CREATE"
  | "READY_TO_UPDATE"
  | "UNCHANGED"
  | "INVALID"
  | "CONFLICT";

export type BulkEmployeeValidationChange = {
  field: string;
  currentValue: unknown;
  uploadedValue: unknown;
};

type UploadedEmployeeRow = {
  rowNumber: number;
  action?: "CREATE" | "UPDATE" | "SKIP";
  employeeId?: string;
  referenceActions?: {
    department?: "CREATE" | "SKIP";
    position?: "CREATE" | "SKIP";
  };
  account?: Record<string, any>;
  profile?: Record<string, any>;
};

type ValidationError = {
  field: string;
  code?: string;
  message: string;
  allowCreate?: boolean;
};

type NormalizedEmployeeRow = {
  rowNumber: number;
  account: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string | null;
  };
  profile: {
    employeeCode: string;
    roleKeys: string[];
    departmentName?: string | null;
    positionName?: string | null;
    managerEmail?: string | null;
    branch?: string | null;
    employmentType: EmploymentType;
    employmentStatus: EmploymentStatus;
    hireDate: string;
    probationEndDate?: string | null;
    contractStartDate?: string | null;
    contractEndDate?: string | null;
    monthlySalary?: number | null;
    salaryCurrency?: string | null;
    dateOfBirth?: string | null;
    city?: string | null;
    countryOfBirth?: string | null;
    additionalPhone?: string | null;
    additionalNotes?: string | null;
    emergencyFirstName?: string | null;
    emergencyLastName?: string | null;
    emergencyPhone?: string | null;
    emergencyEmail?: string | null;
    emergencyCity?: string | null;
    emergencyCountry?: string | null;
    bankDetails?: Array<{ bankName?: string | null; accountNumber?: string | null }>;
  };
};

export type BulkEmployeeValidationResult = {
  rowNumber: number;
  status: BulkEmployeeValidationStatus;
  normalizedRow?: NormalizedEmployeeRow;
  errors: ValidationError[];
  changes: BulkEmployeeValidationChange[];
  matchedBy?: "employeeCode" | "email" | "none" | "conflict";
  existingEmployeeRecordId?: string;
  existingUserId?: string;
};

export type BulkEmployeeValidationResponse = {
  summary: Record<BulkEmployeeValidationStatus, number> & { total: number };
  results: BulkEmployeeValidationResult[];
};

export type BulkEmployeeWriteResult = {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  unchanged: number;
  failed: number;
  conflicts: number;
  results: Array<{
    rowNumber: number;
    status: "CREATED" | "UPDATED" | "SKIPPED" | "UNCHANGED" | "FAILED" | "CONFLICT";
    employeeId?: string;
    employeeCode?: string;
    errors?: ValidationError[];
  }>;
};

const REQUIRED_ACCOUNT_FIELDS = ["firstName", "lastName", "email"] as const;
const REQUIRED_PROFILE_FIELDS = ["employeeCode", "roleKeys", "employmentType", "employmentStatus", "hireDate"] as const;
const ALLOWED_BULK_ROLE_KEYS = [
  "EMPLOYEE",
  "DEPARTMENT_HEAD",
  "PROJECT_MANAGER",
  "CRM_MANAGER",
  "FINANCE_MANAGER",
  "HR_MANAGER",
] as const;

function trimToNull(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  return trimmed === "" ? null : trimmed;
}

function trimRequired(value: unknown): string {
  return trimToNull(value) || "";
}

function normalizeOptionalString(value: unknown) {
  return trimToNull(value) ?? undefined;
}

function normalizeOptionalEmail(value: unknown) {
  const trimmed = trimToNull(value);
  return trimmed ? trimmed.toLowerCase() : undefined;
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value)) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime());
}

function dateTime(value?: string | null) {
  return value ? new Date(value).getTime() : null;
}

function sameValue(a: unknown, b: unknown) {
  if (a === null || a === undefined || a === "") return b === null || b === undefined || b === "";
  if (b === null || b === undefined || b === "") return false;
  return String(a) === String(b);
}

function sameDate(a: unknown, b: unknown) {
  const left = a ? new Date(a as any).toISOString().slice(0, 10) : "";
  const right = b ? new Date(b as any).toISOString().slice(0, 10) : "";
  return left === right;
}

function addChange(changes: BulkEmployeeValidationChange[], field: string, currentValue: unknown, uploadedValue: unknown, compare: "value" | "date" = "value") {
  const same = compare === "date" ? sameDate(currentValue, uploadedValue) : sameValue(currentValue, uploadedValue);
  if (!same) changes.push({ field, currentValue, uploadedValue });
}

export class BulkEmployeeValidationService {
  async validate(businessId: string, rows: UploadedEmployeeRow[]): Promise<BulkEmployeeValidationResponse> {
    const normalized = rows.map((row) => this.normalizeRow(row));
    this.applyPayloadDuplicateErrors(normalized);

    const validRows = normalized.filter((item) => item.normalizedRow && item.errors.length === 0).map((item) => item.normalizedRow!);
    const refs = await this.loadReferences(businessId, validRows);

    const results = normalized.map((item) => {
      if (!item.normalizedRow) return this.result(item.rowNumber, "INVALID", item.errors);
      const relationshipErrors = this.validateRelationships(item.normalizedRow, refs);
      const errors = [...item.errors, ...relationshipErrors];
      const blockingErrors = errors.filter((error) => !error.allowCreate);
      if (blockingErrors.length) return this.result(item.rowNumber, "INVALID", errors, item.normalizedRow);
      return this.classifyRow(item.normalizedRow, refs, errors);
    });

    return {
      summary: this.summarize(results),
      results,
    };
  }

  async apply(businessId: string, rows: UploadedEmployeeRow[]): Promise<BulkEmployeeWriteResult> {
    const validation = await this.validate(businessId, rows);
    const byRowNumber = new Map(rows.map((row) => [Number(row.rowNumber), row]));
    const output: BulkEmployeeWriteResult = {
      total: validation.results.length,
      created: 0,
      updated: 0,
      skipped: 0,
      unchanged: 0,
      failed: 0,
      conflicts: 0,
      results: [],
    };

    for (const validationResult of validation.results) {
      const requested = byRowNumber.get(validationResult.rowNumber);
      const action = requested?.action;

      if (action === "SKIP") {
        output.skipped += 1;
        output.results.push({ rowNumber: validationResult.rowNumber, status: "SKIPPED", employeeCode: validationResult.normalizedRow?.profile.employeeCode });
        continue;
      }

      if (validationResult.status === "CONFLICT") {
        output.conflicts += 1;
        output.results.push({ rowNumber: validationResult.rowNumber, status: "CONFLICT", employeeCode: validationResult.normalizedRow?.profile.employeeCode, errors: validationResult.errors });
        continue;
      }

      if (validationResult.status === "UNCHANGED") {
        output.unchanged += 1;
        output.results.push({ rowNumber: validationResult.rowNumber, status: "UNCHANGED", employeeId: validationResult.existingEmployeeRecordId, employeeCode: validationResult.normalizedRow?.profile.employeeCode });
        continue;
      }

      if (validationResult.status === "INVALID") {
        output.failed += 1;
        output.results.push({ rowNumber: validationResult.rowNumber, status: "FAILED", employeeCode: validationResult.normalizedRow?.profile.employeeCode, errors: validationResult.errors });
        continue;
      }

      if (!validationResult.normalizedRow) {
        output.failed += 1;
        output.results.push({ rowNumber: validationResult.rowNumber, status: "FAILED", errors: [{ field: "row", message: "Normalized row missing" }] });
        continue;
      }

      if (action === "CREATE" && validationResult.status !== "READY_TO_CREATE") {
        output.failed += 1;
        output.results.push({ rowNumber: validationResult.rowNumber, status: "FAILED", employeeCode: validationResult.normalizedRow.profile.employeeCode, errors: [{ field: "action", message: "CREATE is only allowed for READY_TO_CREATE rows" }] });
        continue;
      }

      if (action === "UPDATE" && validationResult.status !== "READY_TO_UPDATE") {
        output.failed += 1;
        output.results.push({ rowNumber: validationResult.rowNumber, status: "FAILED", employeeCode: validationResult.normalizedRow.profile.employeeCode, errors: [{ field: "action", message: "UPDATE is only allowed for READY_TO_UPDATE rows" }] });
        continue;
      }

      if (action !== "CREATE" && action !== "UPDATE") {
        output.failed += 1;
        output.results.push({ rowNumber: validationResult.rowNumber, status: "FAILED", employeeCode: validationResult.normalizedRow.profile.employeeCode, errors: [{ field: "action", message: "action must be CREATE, UPDATE, or SKIP" }] });
        continue;
      }

      const transaction = await db.sequelize.transaction();
      try {
        const refs = await this.resolveWriteReferences(businessId, validationResult.normalizedRow, requested, transaction);
        const written = action === "CREATE"
          ? await this.createEmployee(businessId, validationResult.normalizedRow, requested, refs, transaction)
          : await this.updateEmployee(businessId, validationResult.normalizedRow, requested?.employeeId || validationResult.existingEmployeeRecordId, refs, transaction);
        await transaction.commit();
        if (action === "CREATE") output.created += 1;
        else output.updated += 1;
        output.results.push({
          rowNumber: validationResult.rowNumber,
          status: action === "CREATE" ? "CREATED" : "UPDATED",
          employeeId: written.id,
          employeeCode: written.employeeCode,
        });
      } catch (error: any) {
        await transaction.rollback();
        output.failed += 1;
        output.results.push({
          rowNumber: validationResult.rowNumber,
          status: "FAILED",
          employeeCode: validationResult.normalizedRow.profile.employeeCode,
          errors: [{ field: "row", message: error.message || "Row failed" }],
        });
      }
    }

    return output;
  }

  private async resolveWriteReferences(businessId: string, row: NormalizedEmployeeRow, original: UploadedEmployeeRow | undefined, transaction: any) {
    const [allRoles, existingDepartment, existingPosition, manager] = await Promise.all([
      db.Role.findAll({ where: { [Op.or]: [{ businessId }, { businessId: null }], key: row.profile.roleKeys } }),
      row.profile.departmentName ? db.Department.findOne({ where: { businessId, name: row.profile.departmentName } }) : null,
      row.profile.positionName ? db.Position.findOne({ where: { businessId, title: row.profile.positionName } }) : null,
      row.profile.managerEmail ? db.User.findOne({ where: { businessId, email: row.profile.managerEmail } }) : null,
    ]);

    // Deduplicate roles: prefer business-scoped roles over system roles when both exist for the same key
    const rolesByKey = new Map<string, any>();
    for (const role of allRoles) {
      const existing = rolesByKey.get(role.key);
      // Prefer business-scoped (businessId is not null) over system roles (businessId is null)
      if (!existing || (role.businessId !== null && existing.businessId === null)) {
        rolesByKey.set(role.key, role);
      }
    }
    const roles = Array.from(rolesByKey.values());

    if (roles.length !== row.profile.roleKeys.length) throw new Error("One or more roles no longer exist");
    if (row.profile.managerEmail && !manager) throw new Error("Manager no longer exists");

    let department = existingDepartment;
    if (row.profile.departmentName && !department) {
      if (original?.referenceActions?.department === "CREATE") {
        department = await db.Department.create({
          businessId,
          name: row.profile.departmentName,
          key: this.keyFromName(row.profile.departmentName),
          status: "active",
        }, { transaction });
      } else if (original?.referenceActions?.department === "SKIP") {
        department = null;
      } else {
        throw new Error(`Department "${row.profile.departmentName}" does not exist`);
      }
    }

    let position = existingPosition;
    if (position && department && position.departmentId !== department.id) {
      position = null;
    }
    if (row.profile.positionName && !position) {
      if (original?.referenceActions?.position === "CREATE") {
        if (!department) throw new Error("Department is required before creating a position");
        position = await db.Position.create({
          businessId,
          departmentId: department.id,
          title: row.profile.positionName,
          key: this.keyFromName(row.profile.positionName),
          status: "active",
        }, { transaction });
      } else if (original?.referenceActions?.position === "SKIP") {
        position = null;
      } else {
        throw new Error(`Position "${row.profile.positionName}" does not exist in department "${row.profile.departmentName || "selected department"}"`);
      }
    }

    return { roles, department, position, manager };
  }

  private async createEmployee(businessId: string, row: NormalizedEmployeeRow, original: UploadedEmployeeRow | undefined, refs: any, transaction: any) {
    const rawPassword = trimToNull(original?.account?.password) || this.temporaryPassword();
    const user = await db.User.create({
      businessId,
      fullName: `${row.account.firstName} ${row.account.lastName}`.trim(),
      email: row.account.email,
      password: await bcrypt.hash(rawPassword, env.bcryptSaltRounds),
      phone: row.account.phone || null,
      status: "active",
    }, { transaction });

    await user.setRoles(refs.roles, { transaction });
    const record = await db.EmployeeRecord.create(this.recordData(businessId, user.id, row, refs), { transaction });
    return record;
  }

  private async updateEmployee(businessId: string, row: NormalizedEmployeeRow, employeeId: string | undefined, refs: any, transaction: any) {
    if (!employeeId) throw new Error("employeeId is required for UPDATE");
    const record = await db.EmployeeRecord.findOne({
      where: { id: employeeId, businessId },
      include: [{ model: db.User, as: "user", include: [{ model: db.Role, through: { attributes: [] } }] }],
      transaction,
    });
    if (!record) throw new Error("Employee does not belong to this business");
    const user = record.user || record.User;
    if (!user || user.businessId !== businessId) throw new Error("User does not belong to this business");

    await user.update({
      fullName: `${row.account.firstName} ${row.account.lastName}`.trim(),
      phone: row.account.phone || null,
    }, { transaction });

    await user.setRoles(refs.roles, { transaction });
    await record.update(this.recordData(businessId, record.userId, row, refs, record), { transaction });
    return record;
  }

  private recordData(businessId: string, userId: string, row: NormalizedEmployeeRow, refs: any, existing?: any) {
    return {
      businessId,
      userId,
      employeeCode: row.profile.employeeCode,
      departmentId: row.profile.departmentName !== undefined ? refs.department?.id || null : existing?.departmentId ?? null,
      positionId: row.profile.positionName !== undefined ? refs.position?.id || null : existing?.positionId ?? null,
      managerUserId: row.profile.managerEmail !== undefined ? refs.manager?.id || null : existing?.managerUserId ?? null,
      employmentType: row.profile.employmentType,
      employmentStatus: row.profile.employmentStatus,
      hireDate: row.profile.hireDate,
      probationEndDate: row.profile.probationEndDate !== undefined ? row.profile.probationEndDate || null : existing?.probationEndDate ?? null,
      contractStartDate: row.profile.contractStartDate !== undefined ? row.profile.contractStartDate || null : existing?.contractStartDate ?? null,
      contractEndDate: row.profile.contractEndDate !== undefined ? row.profile.contractEndDate || null : existing?.contractEndDate ?? null,
      salaryInfo: {
        ...(existing?.salaryInfo || {}),
        baseSalary: row.profile.monthlySalary !== undefined ? row.profile.monthlySalary : existing?.salaryInfo?.baseSalary ?? null,
        currency: row.profile.salaryCurrency || existing?.salaryInfo?.currency || "ETB",
      },
      emergencyContact: {
        ...(existing?.emergencyContact || {}),
        firstName: row.profile.emergencyFirstName !== undefined ? row.profile.emergencyFirstName || null : existing?.emergencyContact?.firstName ?? null,
        lastName: row.profile.emergencyLastName !== undefined ? row.profile.emergencyLastName || null : existing?.emergencyContact?.lastName ?? null,
        phone: row.profile.emergencyPhone !== undefined ? row.profile.emergencyPhone || null : existing?.emergencyContact?.phone ?? null,
        email: row.profile.emergencyEmail !== undefined ? row.profile.emergencyEmail || null : existing?.emergencyContact?.email ?? null,
        city: row.profile.emergencyCity !== undefined ? row.profile.emergencyCity || null : existing?.emergencyContact?.city ?? null,
        country: row.profile.emergencyCountry !== undefined ? row.profile.emergencyCountry || null : existing?.emergencyContact?.country ?? null,
      },
      metadata: {
        ...(existing?.metadata || {}),
        branch: row.profile.branch !== undefined ? row.profile.branch || null : existing?.metadata?.branch ?? null,
        dateOfBirth: row.profile.dateOfBirth !== undefined ? row.profile.dateOfBirth || null : existing?.metadata?.dateOfBirth ?? null,
        city: row.profile.city !== undefined ? row.profile.city || null : existing?.metadata?.city ?? null,
        countryOfBirth: row.profile.countryOfBirth !== undefined ? row.profile.countryOfBirth || null : existing?.metadata?.countryOfBirth ?? null,
        additionalPhone: row.profile.additionalPhone !== undefined ? row.profile.additionalPhone || null : existing?.metadata?.additionalPhone ?? null,
        additionalNotes: row.profile.additionalNotes !== undefined ? row.profile.additionalNotes || null : existing?.metadata?.additionalNotes ?? null,
        bankDetails: row.profile.bankDetails !== undefined ? row.profile.bankDetails || [] : existing?.metadata?.bankDetails ?? [],
      },
    };
  }

  private temporaryPassword() {
    return `Temp-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
  }

  private keyFromName(name: string) {
    return name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  }

  private normalizeRow(row: UploadedEmployeeRow): { rowNumber: number; normalizedRow?: NormalizedEmployeeRow; errors: ValidationError[] } {
    const errors: ValidationError[] = [];
    const rowNumber = Number(row?.rowNumber);
    if (!Number.isInteger(rowNumber) || rowNumber <= 0) errors.push({ field: "rowNumber", message: "rowNumber must be a positive integer" });

    const account = row?.account || {};
    const profile = row?.profile || {};

    for (const field of REQUIRED_ACCOUNT_FIELDS) {
      if (!trimToNull(account[field])) errors.push({ field: `account.${field}`, message: `${field} is required` });
    }
    for (const field of REQUIRED_PROFILE_FIELDS) {
      if (field === "roleKeys") {
        if (!Array.isArray(profile.roleKeys) || profile.roleKeys.length === 0) errors.push({ field: "profile.roleKeys", message: "roleKeys is required" });
      } else if (!trimToNull(profile[field])) {
        errors.push({ field: `profile.${field}`, message: `${field} is required` });
      }
    }

    const email = trimRequired(account.email).toLowerCase();
    if (email && !isEmail(email)) errors.push({ field: "account.email", message: "email must be valid" });

    const emergencyEmail = normalizeOptionalEmail(profile.emergencyEmail);
    if (emergencyEmail && !isEmail(emergencyEmail)) errors.push({ field: "profile.emergencyEmail", message: "emergencyEmail must be valid" });

    const employmentType = trimRequired(profile.employmentType) as EmploymentType;
    if (employmentType && !EMPLOYMENT_TYPES.includes(employmentType)) errors.push({ field: "profile.employmentType", message: "employmentType is invalid" });

    const employmentStatus = trimRequired(profile.employmentStatus) as EmploymentStatus;
    if (employmentStatus && !EMPLOYMENT_STATUSES.includes(employmentStatus)) errors.push({ field: "profile.employmentStatus", message: "employmentStatus is invalid" });

    const dateFields = ["hireDate", "probationEndDate", "contractStartDate", "contractEndDate", "dateOfBirth"] as const;
    for (const field of dateFields) {
      const value = trimToNull(profile[field]);
      if (value && !isIsoDate(value)) errors.push({ field: `profile.${field}`, message: `${field} must be an ISO date` });
    }

    const contractStartDate = trimToNull(profile.contractStartDate);
    const contractEndDate = trimToNull(profile.contractEndDate);
    if (contractStartDate && contractEndDate && dateTime(contractEndDate)! < dateTime(contractStartDate)!) {
      errors.push({ field: "profile.contractEndDate", message: "contractEndDate must be greater than or equal to contractStartDate" });
    }

    const salary = profile.monthlySalary === null || profile.monthlySalary === undefined || profile.monthlySalary === ""
      ? undefined
      : Number(profile.monthlySalary);
    if (salary !== undefined && (Number.isNaN(salary) || salary < 0)) {
      errors.push({ field: "profile.monthlySalary", message: "monthlySalary must be greater than or equal to 0" });
    }

    const roleKeys = Array.isArray(profile.roleKeys)
      ? Array.from(new Set(profile.roleKeys.map((key: unknown) => trimRequired(key).toUpperCase()).filter(Boolean))).sort()
      : [];
    for (const roleKey of roleKeys) {
      if (!(ALLOWED_BULK_ROLE_KEYS as readonly string[]).includes(roleKey)) {
        errors.push({ field: "profile.roleKeys", message: `Role key "${roleKey}" is not allowed for bulk employee import` });
      }
    }

    const normalizedRow: NormalizedEmployeeRow = {
      rowNumber: rowNumber || 0,
      account: {
        firstName: trimRequired(account.firstName),
        lastName: trimRequired(account.lastName),
        email,
        ...(normalizeOptionalString(account.phone) ? { phone: normalizeOptionalString(account.phone)! } : {}),
      },
      profile: {
        employeeCode: trimRequired(profile.employeeCode),
        roleKeys,
        ...(normalizeOptionalString(profile.departmentName) ? { departmentName: normalizeOptionalString(profile.departmentName)! } : {}),
        ...(normalizeOptionalString(profile.positionName) ? { positionName: normalizeOptionalString(profile.positionName)! } : {}),
        ...(normalizeOptionalEmail(profile.managerEmail) ? { managerEmail: normalizeOptionalEmail(profile.managerEmail)! } : {}),
        ...(normalizeOptionalString(profile.branch) ? { branch: normalizeOptionalString(profile.branch)! } : {}),
        employmentType,
        employmentStatus,
        hireDate: trimRequired(profile.hireDate),
        ...(trimToNull(profile.probationEndDate) ? { probationEndDate: trimToNull(profile.probationEndDate)! } : {}),
        ...(contractStartDate ? { contractStartDate } : {}),
        ...(contractEndDate ? { contractEndDate } : {}),
        ...(salary !== undefined ? { monthlySalary: salary } : {}),
        ...(normalizeOptionalString(profile.salaryCurrency) ? { salaryCurrency: normalizeOptionalString(profile.salaryCurrency)! } : {}),
        ...(trimToNull(profile.dateOfBirth) ? { dateOfBirth: trimToNull(profile.dateOfBirth)! } : {}),
        ...(normalizeOptionalString(profile.city) ? { city: normalizeOptionalString(profile.city)! } : {}),
        ...(normalizeOptionalString(profile.countryOfBirth) ? { countryOfBirth: normalizeOptionalString(profile.countryOfBirth)! } : {}),
        ...(normalizeOptionalString(profile.additionalPhone) ? { additionalPhone: normalizeOptionalString(profile.additionalPhone)! } : {}),
        ...(normalizeOptionalString(profile.additionalNotes) ? { additionalNotes: normalizeOptionalString(profile.additionalNotes)! } : {}),
        ...(normalizeOptionalString(profile.emergencyFirstName) ? { emergencyFirstName: normalizeOptionalString(profile.emergencyFirstName)! } : {}),
        ...(normalizeOptionalString(profile.emergencyLastName) ? { emergencyLastName: normalizeOptionalString(profile.emergencyLastName)! } : {}),
        ...(normalizeOptionalString(profile.emergencyPhone) ? { emergencyPhone: normalizeOptionalString(profile.emergencyPhone)! } : {}),
        ...(emergencyEmail ? { emergencyEmail } : {}),
        ...(normalizeOptionalString(profile.emergencyCity) ? { emergencyCity: normalizeOptionalString(profile.emergencyCity)! } : {}),
        ...(normalizeOptionalString(profile.emergencyCountry) ? { emergencyCountry: normalizeOptionalString(profile.emergencyCountry)! } : {}),
        ...(Array.isArray(profile.bankDetails) ? { bankDetails: this.normalizeBankDetails(profile.bankDetails) } : {}),
      },
    };

    return { rowNumber: rowNumber || 0, normalizedRow, errors };
  }

  private normalizeBankDetails(bankDetails: any[]) {
    return bankDetails
      .map((bank) => ({
        ...(normalizeOptionalString(bank?.bankName) ? { bankName: normalizeOptionalString(bank.bankName)! } : {}),
        ...(normalizeOptionalString(bank?.accountNumber) ? { accountNumber: normalizeOptionalString(bank.accountNumber)! } : {}),
      }))
      .filter((bank) => Object.keys(bank).length > 0);
  }

  private applyPayloadDuplicateErrors(items: Array<{ normalizedRow?: NormalizedEmployeeRow; errors: ValidationError[] }>) {
    const track = (field: "rowNumber" | "employeeCode" | "email", valueFor: (row: NormalizedEmployeeRow) => string | number | undefined) => {
      const seen = new Map<string | number, number>();
      for (const item of items) {
        if (!item.normalizedRow) continue;
        const value = valueFor(item.normalizedRow);
        if (value === undefined || value === "") continue;
        seen.set(value, (seen.get(value) || 0) + 1);
      }
      for (const item of items) {
        if (!item.normalizedRow) continue;
        const value = valueFor(item.normalizedRow);
        if (value !== undefined && value !== "" && (seen.get(value) || 0) > 1) {
          item.errors.push({ field, message: `${field} is duplicated in payload` });
        }
      }
    };

    track("rowNumber", (row) => row.rowNumber);
    track("employeeCode", (row) => row.profile.employeeCode);
    track("email", (row) => row.account.email);
  }

  private async loadReferences(businessId: string, rows: NormalizedEmployeeRow[]) {
    const roleKeys = Array.from(new Set(rows.flatMap((row) => row.profile.roleKeys)));
    const departmentNames = Array.from(new Set(rows.map((row) => row.profile.departmentName).filter(Boolean))) as string[];
    const managerEmails = Array.from(new Set(rows.map((row) => row.profile.managerEmail).filter(Boolean))) as string[];
    const positionNames = Array.from(new Set(rows.map((row) => row.profile.positionName).filter(Boolean))) as string[];
    const employeeCodes = Array.from(new Set(rows.map((row) => row.profile.employeeCode)));
    const emails = Array.from(new Set(rows.map((row) => row.account.email)));

    const [roles, departments, managers, positions, recordsByCode, usersByEmail] = await Promise.all([
      roleKeys.length ? db.Role.findAll({ where: { [Op.or]: [{ businessId }, { businessId: null }], key: roleKeys } }) : [],
      departmentNames.length ? db.Department.findAll({ where: { businessId, name: departmentNames } }) : [],
      managerEmails.length ? db.User.findAll({ where: { businessId, email: managerEmails } }) : [],
      positionNames.length ? db.Position.findAll({ where: { businessId, title: positionNames } }) : [],
      employeeCodes.length ? db.EmployeeRecord.findAll({
        where: { businessId, employeeCode: employeeCodes },
        include: [
          { model: db.User, as: "user", attributes: ["id", "fullName", "email", "phone"], include: [{ model: db.Role, through: { attributes: [] } }] },
          { model: db.Department, as: "department", attributes: ["id", "key", "name"] },
          { model: db.Position, as: "position", attributes: ["id", "key", "title"] },
          { model: db.User, as: "manager", attributes: ["id", "email"] },
        ],
      }) : [],
      emails.length ? db.User.findAll({
        where: { businessId, email: emails },
        include: [
          {
            model: db.EmployeeRecord,
            where: { businessId },
            required: false,
            include: [
              { model: db.Department, as: "department", attributes: ["id", "key", "name"] },
              { model: db.Position, as: "position", attributes: ["id", "key", "title"] },
              { model: db.User, as: "manager", attributes: ["id", "email"] },
            ],
          },
          { model: db.Role, through: { attributes: [] } },
        ],
      }) : [],
    ]);

    const employeeByCode = new Map<string, any>();
    for (const record of recordsByCode as any[]) employeeByCode.set(record.employeeCode, record);

    const employeeByEmail = new Map<string, any>();
    for (const user of usersByEmail as any[]) {
      const record = user.EmployeeRecords?.[0] || user.EmployeeRecord || null;
      if (record) {
        record.user = user;
        employeeByEmail.set(String(user.email).toLowerCase(), record);
      }
    }

    // Deduplicate roles: prefer business-scoped roles over system roles when both exist for the same key
    const rolesByKey = new Map<string, any>();
    for (const role of roles as any[]) {
      const existing = rolesByKey.get(role.key);
      // Prefer business-scoped (businessId is not null) over system roles (businessId is null)
      if (!existing || (role.businessId !== null && existing.businessId === null)) {
        rolesByKey.set(role.key, role);
      }
    }

    return {
      rolesByKey,
      departmentsByName: new Map((departments as any[]).map((department) => [department.name, department])),
      managersByEmail: new Map((managers as any[]).map((manager) => [String(manager.email).toLowerCase(), manager])),
      positionsByName: new Map((positions as any[]).map((position) => [position.title, position])),
      employeeByCode,
      employeeByEmail,
    };
  }

  private validateRelationships(row: NormalizedEmployeeRow, refs: Awaited<ReturnType<BulkEmployeeValidationService["loadReferences"]>>) {
    const errors: ValidationError[] = [];
    for (const roleKey of row.profile.roleKeys) {
      if (!refs.rolesByKey.has(roleKey)) errors.push({ field: "profile.roleKeys", message: `Role key "${roleKey}" does not exist` });
    }
    const department = row.profile.departmentName ? refs.departmentsByName.get(row.profile.departmentName) : null;
    if (row.profile.departmentName && !department) {
      errors.push({
        field: "departmentName",
        code: "DEPARTMENT_NOT_FOUND",
        message: `Department "${row.profile.departmentName}" does not exist`,
        allowCreate: true,
      });
    }
    if (row.profile.managerEmail && !refs.managersByEmail.has(row.profile.managerEmail)) {
      errors.push({ field: "profile.managerEmail", message: `Manager email '${row.profile.managerEmail}' does not exist` });
    }
    const position = row.profile.positionName ? refs.positionsByName.get(row.profile.positionName) : null;
    if (row.profile.positionName && (!position || (department && position.departmentId !== department.id))) {
      errors.push({
        field: "positionName",
        code: "POSITION_NOT_FOUND",
        message: `Position "${row.profile.positionName}" does not exist in department "${row.profile.departmentName || "selected department"}"`,
        allowCreate: true,
      });
    }
    return errors;
  }

  private classifyRow(row: NormalizedEmployeeRow, refs: Awaited<ReturnType<BulkEmployeeValidationService["loadReferences"]>>, errors: ValidationError[] = []): BulkEmployeeValidationResult {
    const codeMatch = refs.employeeByCode.get(row.profile.employeeCode);
    const emailMatch = refs.employeeByEmail.get(row.account.email);

    // Code matches one person and email matches a different person
    if (codeMatch && emailMatch && codeMatch.userId !== emailMatch.userId) {
      return this.result(row.rowNumber, "CONFLICT", [{ field: "employeeCode,email", message: "employeeCode and email match different employees" }], row, [], "conflict");
    }

    // Code matches an existing record but the email belongs to a different person — different people, flag as conflict
    if (codeMatch) {
      const existingEmail = String(codeMatch.user?.email || codeMatch.User?.email || "").toLowerCase();
      if (existingEmail && existingEmail !== row.account.email) {
        return this.result(row.rowNumber, "CONFLICT", [{ field: "email", message: `Employee code ${row.profile.employeeCode} already belongs to ${existingEmail}` }], row, [], "conflict");
      }
    }

    const existing = codeMatch || emailMatch;
    if (!existing) return this.result(row.rowNumber, "READY_TO_CREATE", errors, row, [], "none");

    const changes = this.compare(row, existing, refs);
    return this.result(
      row.rowNumber,
      changes.length ? "READY_TO_UPDATE" : "UNCHANGED",
      errors,
      row,
      changes,
      codeMatch ? "employeeCode" : "email",
      existing,
    );
  }

  private compare(row: NormalizedEmployeeRow, existing: any, refs: Awaited<ReturnType<BulkEmployeeValidationService["loadReferences"]>>) {
    const changes: BulkEmployeeValidationChange[] = [];
    const user = existing.user || existing.User || {};
    const metadata = existing.metadata || {};
    const salaryInfo = existing.salaryInfo || {};
    const emergency = existing.emergencyContact || {};
    const manager = existing.manager || existing.Manager || null;
    const department = existing.department || existing.Department || null;
    const uploadedDepartment = row.profile.departmentName ? refs.departmentsByName.get(row.profile.departmentName) : null;
    const uploadedPosition = row.profile.positionName ? refs.positionsByName.get(row.profile.positionName) : null;
    const uploadedManager = row.profile.managerEmail ? refs.managersByEmail.get(row.profile.managerEmail) : null;

    addChange(changes, "account.firstName", this.firstName(user.fullName), row.account.firstName);
    addChange(changes, "account.lastName", this.lastName(user.fullName), row.account.lastName);
    addChange(changes, "account.email", user.email ? String(user.email).toLowerCase() : null, row.account.email);
    if (row.account.phone !== undefined) addChange(changes, "account.phone", user.phone, row.account.phone);
    addChange(changes, "profile.employeeCode", existing.employeeCode, row.profile.employeeCode);
    addChange(changes, "profile.roleKeys", this.roleKeys(user), row.profile.roleKeys);
    if (row.profile.departmentName !== undefined) addChange(changes, "profile.departmentName", department?.name ?? null, uploadedDepartment?.name ?? row.profile.departmentName ?? null);
    if (row.profile.positionName !== undefined) addChange(changes, "profile.positionName", existing.position?.title || existing.Position?.title || null, uploadedPosition?.title ?? row.profile.positionName ?? null);
    if (row.profile.managerEmail !== undefined) addChange(changes, "profile.managerEmail", manager?.email ? String(manager.email).toLowerCase() : null, uploadedManager?.email ? String(uploadedManager.email).toLowerCase() : null);
    if (row.profile.branch !== undefined) addChange(changes, "profile.branch", metadata.branch, row.profile.branch);
    addChange(changes, "profile.employmentType", existing.employmentType, row.profile.employmentType);
    addChange(changes, "profile.employmentStatus", existing.employmentStatus, row.profile.employmentStatus);
    addChange(changes, "profile.hireDate", existing.hireDate, row.profile.hireDate, "date");
    if (row.profile.probationEndDate !== undefined) addChange(changes, "profile.probationEndDate", existing.probationEndDate, row.profile.probationEndDate, "date");
    if (row.profile.contractStartDate !== undefined) addChange(changes, "profile.contractStartDate", existing.contractStartDate, row.profile.contractStartDate, "date");
    if (row.profile.contractEndDate !== undefined) addChange(changes, "profile.contractEndDate", existing.contractEndDate, row.profile.contractEndDate, "date");
    if (row.profile.monthlySalary !== undefined) addChange(changes, "profile.monthlySalary", salaryInfo.baseSalary, row.profile.monthlySalary);
    if (row.profile.salaryCurrency !== undefined) addChange(changes, "profile.salaryCurrency", salaryInfo.currency, row.profile.salaryCurrency);
    if (row.profile.dateOfBirth !== undefined) addChange(changes, "profile.dateOfBirth", metadata.dateOfBirth, row.profile.dateOfBirth, "date");
    for (const field of ["city", "countryOfBirth", "additionalPhone", "additionalNotes"] as const) {
      if (row.profile[field] !== undefined) addChange(changes, `profile.${field}`, metadata[field], row.profile[field]);
    }
    for (const field of ["emergencyFirstName", "emergencyLastName", "emergencyPhone", "emergencyEmail", "emergencyCity", "emergencyCountry"] as const) {
      const currentKey = field.replace("emergency", "");
      const normalizedKey = currentKey.charAt(0).toLowerCase() + currentKey.slice(1);
      if (row.profile[field] !== undefined) addChange(changes, `profile.${field}`, emergency[normalizedKey], row.profile[field]);
    }
    if (row.profile.bankDetails !== undefined) addChange(changes, "profile.bankDetails", JSON.stringify(metadata.bankDetails || []), JSON.stringify(row.profile.bankDetails || []));

    return changes;
  }

  private roleKeys(user: any) {
    const roles = user?.Roles || user?.roles || [];
    return roles.map((role: any) => role.key).filter(Boolean).sort();
  }

  private firstName(fullName: string | null | undefined) {
    const parts = String(fullName || "").trim().split(/\s+/).filter(Boolean);
    return parts.length > 1 ? parts.slice(0, -1).join(" ") : parts[0] || "";
  }

  private lastName(fullName: string | null | undefined) {
    const parts = String(fullName || "").trim().split(/\s+/).filter(Boolean);
    return parts.length > 1 ? parts.slice(-1)[0] : "";
  }

  private result(
    rowNumber: number,
    status: BulkEmployeeValidationStatus,
    errors: ValidationError[] = [],
    normalizedRow?: NormalizedEmployeeRow,
    changes: BulkEmployeeValidationChange[] = [],
    matchedBy?: BulkEmployeeValidationResult["matchedBy"],
    existing?: any,
  ): BulkEmployeeValidationResult {
    return {
      rowNumber,
      status,
      ...(normalizedRow ? { normalizedRow } : {}),
      errors,
      changes,
      ...(matchedBy ? { matchedBy } : {}),
      ...(existing ? { existingEmployeeRecordId: existing.id, existingUserId: existing.userId } : {}),
    };
  }

  private summarize(results: BulkEmployeeValidationResult[]) {
    const summary = {
      total: results.length,
      READY_TO_CREATE: 0,
      READY_TO_UPDATE: 0,
      UNCHANGED: 0,
      INVALID: 0,
      CONFLICT: 0,
    };
    for (const result of results) summary[result.status] += 1;
    return summary;
  }
}
