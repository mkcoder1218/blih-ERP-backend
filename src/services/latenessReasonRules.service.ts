import { Op } from "sequelize";
import { db } from "../models";
import { businessDateEndUtc, businessDateStartUtc } from "../utils/timezone";

export type LatenessReasonExceededBehavior = "BLOCK" | "MARK_INVALID" | "HR_REVIEW";

export type LatenessReasonRuleBalance = {
  reasonCode: string;
  label: string;
  monthlyLimit: number;
  usedThisMonth: number;
  remainingThisMonth: number;
  coversMinutes: number;
  enabled: boolean;
  canUse: boolean;
  blockedReason: string | null;
};

const ADDIS_ABABA_TZ = "Africa/Addis_Ababa";
const DEFAULT_REASON_CODE = "OTHER";
const VALID_BEHAVIORS = new Set(["BLOCK", "MARK_INVALID", "HR_REVIEW"]);

function normalizeCode(value: unknown) {
  return String(value || DEFAULT_REASON_CODE).trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_") || DEFAULT_REASON_CODE;
}

function localDateYmd(date: Date, timeZone = ADDIS_ABABA_TZ) {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function monthBoundsUtc(anchorDate: Date, timeZone = ADDIS_ABABA_TZ) {
  const ymd = localDateYmd(anchorDate, timeZone);
  const monthStart = `${ymd.slice(0, 7)}-01`;
  const end = new Date(`${monthStart}T00:00:00.000Z`);
  end.setUTCMonth(end.getUTCMonth() + 1);
  return {
    startUtc: businessDateStartUtc(monthStart, timeZone),
    endUtc: businessDateStartUtc(end.toISOString().slice(0, 10), timeZone),
  };
}

function ruleCode(rule: any) {
  return normalizeCode(rule?.reasonCode || rule?.code || rule?.name);
}

function ruleLabel(rule: any) {
  return String(rule?.label || rule?.name || ruleCode(rule));
}

function behavior(rule: any): LatenessReasonExceededBehavior {
  const value = String(rule?.behaviorWhenExceeded || "HR_REVIEW").toUpperCase();
  return (VALID_BEHAVIORS.has(value) ? value : "HR_REVIEW") as LatenessReasonExceededBehavior;
}

function enabled(rule: any) {
  return rule?.enabled !== false && rule?.isActive !== false;
}

export class LatenessReasonRulesService {
  normalizeReasonCode(value: unknown) {
    return normalizeCode(value);
  }

  async listRules(businessId: string, opts: { enabledOnly?: boolean } = {}) {
    const where: any = { businessId };
    if (opts.enabledOnly) {
      where.enabled = true;
      where.isActive = true;
    }
    return db.AttendanceLateReason.findAll({
      where,
      order: [["sortOrder", "ASC"], ["name", "ASC"]],
    });
  }

  async upsertRule(businessId: string, userId: string, data: any) {
    const reasonCode = normalizeCode(data.reasonCode || data.code || data.name || data.label);
    const payload = this.buildRulePayload(reasonCode, data, userId);
    const existing = await db.AttendanceLateReason.findOne({ where: { businessId, reasonCode } });
    if (existing) return existing.update(payload);
    return db.AttendanceLateReason.create({ businessId, ...payload, createdBy: userId });
  }

  async updateRule(businessId: string, idOrCode: string, data: any) {
    const rule = await this.findRule(businessId, idOrCode);
    if (!rule) throw Object.assign(new Error("Lateness reason category not found"), { statusCode: 404 });
    return rule.update(this.buildRulePayload(ruleCode(rule), data, rule.createdBy, true));
  }

  async setEnabled(businessId: string, idOrCode: string, isEnabled: boolean) {
    const rule = await this.findRule(businessId, idOrCode);
    if (!rule) throw Object.assign(new Error("Lateness reason category not found"), { statusCode: 404 });
    return rule.update({ enabled: isEnabled, isActive: isEnabled });
  }

  async reorder(businessId: string, ordered: Array<{ id?: string; reasonCode?: string; sortOrder?: number }>) {
    const updated: any[] = [];
    for (let index = 0; index < ordered.length; index += 1) {
      const item = ordered[index];
      const key = item.id || item.reasonCode;
      if (!key) continue;
      const rule = await this.findRule(businessId, key);
      if (!rule) continue;
      await rule.update({ sortOrder: item.sortOrder ?? index });
      updated.push(rule);
    }
    return updated;
  }

  async findRule(businessId: string, idOrCode: string) {
    return db.AttendanceLateReason.findOne({
      where: {
        businessId,
        [Op.or]: [{ id: idOrCode }, { reasonCode: normalizeCode(idOrCode) }],
      },
    });
  }

  async countApprovedUsableByReason(businessId: string, employeeUserId: string, reasonCode: string, anchorDate: Date, excludeRequestId?: string | null) {
    const { startUtc, endUtc } = monthBoundsUtc(anchorDate, ADDIS_ABABA_TZ);
    const where: any = {
      businessId,
      employeeUserId,
      requestType: "lateness_notice",
      status: "approved",
      validityStatus: "valid",
      reasonCategory: normalizeCode(reasonCode),
      approvedAt: { [Op.gte]: startUtc, [Op.lt]: endUtc },
    };
    if (excludeRequestId) where.id = { [Op.ne]: excludeRequestId };
    return db.AttendanceRequest.count({ where });
  }

  async balancesForEmployee(businessId: string, employeeUserId: string, anchorDate: Date = new Date()): Promise<LatenessReasonRuleBalance[]> {
    const rules = await this.listRules(businessId);
    const balances: LatenessReasonRuleBalance[] = [];
    for (const rule of rules) {
      const code = ruleCode(rule);
      const monthlyLimit = Number(rule.monthlyLimit || 0);
      const usedThisMonth = await this.countApprovedUsableByReason(businessId, employeeUserId, code, anchorDate);
      const remainingThisMonth = monthlyLimit > 0 ? Math.max(0, monthlyLimit - usedThisMonth) : 0;
      const isEnabled = enabled(rule);
      const canUse = isEnabled && monthlyLimit > 0 && usedThisMonth < monthlyLimit;
      balances.push({
        reasonCode: code,
        label: ruleLabel(rule),
        monthlyLimit,
        usedThisMonth,
        remainingThisMonth,
        coversMinutes: Number(rule.coversMinutes || 0),
        enabled: isEnabled,
        canUse,
        blockedReason: !isEnabled ? "disabled" : monthlyLimit <= 0 ? "no_monthly_allowance" : usedThisMonth >= monthlyLimit ? "monthly_limit_reached" : null,
      });
    }
    return balances;
  }

  async evaluateNotice(record: any, lateByMinutes = 0) {
    const reasonCode = normalizeCode(record.reasonCategory || record.category);
    const rule = await this.findRule(record.businessId, reasonCode);
    if (!rule) return { validityStatus: "invalid", noticeStatus: "Invalid", usable: false, reasonCode, message: "Lateness reason category is not configured." };
    if (!enabled(rule)) return { validityStatus: "invalid", noticeStatus: "Invalid", usable: false, reasonCode, message: "Lateness reason category is disabled." };
    if (rule.requiresAttachment && !record.attachmentUrl && !record.attachmentId) {
      return { validityStatus: "invalid", noticeStatus: "Invalid", usable: false, reasonCode, message: "Attachment is required for this lateness reason." };
    }
    if (!rule.allowAfterDeadline && record.deadlineAt && new Date(record.submittedAt || record.createdAt).getTime() > new Date(record.deadlineAt).getTime()) {
      return { validityStatus: "expired", noticeStatus: "Expired", usable: false, reasonCode, message: "Notice was submitted after the deadline." };
    }

    const monthlyLimit = Number(rule.monthlyLimit || 0);
    const used = await this.countApprovedUsableByReason(record.businessId, record.employeeUserId, reasonCode, new Date(record.fromAt || record.submittedAt || record.createdAt), record.id);
    if (monthlyLimit <= 0 || used >= monthlyLimit) {
      return this.exceededResult(rule, reasonCode, "Monthly limit reached for this lateness reason.");
    }

    const coversMinutes = Number(rule.coversMinutes || 0);
    if (lateByMinutes > coversMinutes) {
      return this.exceededResult(rule, reasonCode, `This reason covers only ${coversMinutes} late minutes.`);
    }

    return { validityStatus: "valid", noticeStatus: "Approved", usable: true, reasonCode, message: null };
  }

  private exceededResult(rule: any, reasonCode: string, message: string) {
    const mode = behavior(rule);
    if (mode === "BLOCK") return { validityStatus: "invalid", noticeStatus: "Invalid", usable: false, reasonCode, message, block: true };
    if (mode === "MARK_INVALID") return { validityStatus: "invalid", noticeStatus: "Invalid", usable: false, reasonCode, message };
    return { validityStatus: "hr_review", noticeStatus: "Pending", usable: false, reasonCode, message };
  }

  private buildRulePayload(reasonCode: string, data: any, userId?: string, partial = false) {
    const payload: any = {};
    const put = (key: string, value: any) => {
      if (!partial || value !== undefined) payload[key] = value;
    };
    put("reasonCode", reasonCode);
    put("label", data.label ?? data.name);
    put("name", data.label ?? data.name ?? reasonCode);
    put("description", data.description ?? null);
    put("enabled", data.enabled ?? data.isActive ?? true);
    put("isActive", data.enabled ?? data.isActive ?? true);
    put("requiresComment", data.requiresComment ?? false);
    put("monthlyLimit", Number(data.monthlyLimit ?? 0));
    put("coversMinutes", Number(data.coversMinutes ?? 0));
    put("requiresApproval", data.requiresApproval ?? true);
    put("requiresAttachment", data.requiresAttachment ?? false);
    put("allowAfterDeadline", data.allowAfterDeadline ?? false);
    put("behaviorWhenExceeded", behavior(data));
    put("sortOrder", Number(data.sortOrder ?? 0));
    if (!partial && userId) put("createdBy", userId);
    return payload;
  }
}
