import { Op } from "sequelize";
import { db } from "../models";
import { businessDateEndUtc, businessDateStartUtc } from "../utils/timezone";

export type LatenessReasonExceededBehavior = "BLOCK" | "MARK_INVALID" | "HR_REVIEW";
export type LatenessCreditMode = "PER_REASON" | "GLOBAL_POOL";

export type LatenessCreditConfig = {
  mode: LatenessCreditMode;
  globalMonthlyLimit: number;
  globalCoversMinutes: number;
  behaviorWhenExceeded: LatenessReasonExceededBehavior;
};

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
  creditMode?: LatenessCreditMode;
  globalMonthlyLimit?: number;
  globalUsedThisMonth?: number;
  globalRemainingThisMonth?: number;
};

export type LatenessNoticeEvaluation = {
  validityStatus: string;
  noticeStatus: string;
  usable: boolean;
  reasonCode: string | null;
  message: string | null;
  block?: boolean;
  penaltyLabel?: "HalfDay";
  penaltyReason?: string;
};

const ADDIS_ABABA_TZ = "Africa/Addis_Ababa";
const DEFAULT_REASON_CODE = "OTHER";
const VALID_BEHAVIORS = new Set(["BLOCK", "MARK_INVALID", "HR_REVIEW"]);
const LATENESS_CREDIT_CONFIG_KEY = "lateness_reason_credit_config";
const DEFAULT_CREDIT_CONFIG: LatenessCreditConfig = {
  mode: "PER_REASON",
  globalMonthlyLimit: 3,
  globalCoversMinutes: 60,
  behaviorWhenExceeded: "HR_REVIEW",
};
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

function monthBoundsYmd(anchorDate: Date, timeZone = ADDIS_ABABA_TZ) {
  const ymd = localDateYmd(anchorDate, timeZone);
  const startYmd = `${ymd.slice(0, 7)}-01`;
  const end = new Date(`${startYmd}T00:00:00.000Z`);
  end.setUTCMonth(end.getUTCMonth() + 1);
  return { startYmd, endYmd: end.toISOString().slice(0, 10) };
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
    const key = String(idOrCode || "").trim();
    const code = normalizeCode(key);
    const identityFilters: any[] = [{ reasonCode: code }];
    if (UUID_PATTERN.test(key)) identityFilters.unshift({ id: key });

    return db.AttendanceLateReason.findOne({
      where: {
        businessId,
        [Op.or]: identityFilters,
      },
    });
  }

  async getCreditConfig(businessId: string): Promise<LatenessCreditConfig> {
    const row = await db.BusinessSetting.findOne({ where: { businessId, key: LATENESS_CREDIT_CONFIG_KEY } });
    return this.normalizeCreditConfig(row?.value);
  }

  async updateCreditConfig(businessId: string, data: any): Promise<LatenessCreditConfig> {
    const config = this.normalizeCreditConfig(data);
    const existing = await db.BusinessSetting.findOne({ where: { businessId, key: LATENESS_CREDIT_CONFIG_KEY } });
    if (existing) {
      await existing.update({ value: config, category: "attendance", isPublic: false });
    } else {
      await db.BusinessSetting.create({ businessId, key: LATENESS_CREDIT_CONFIG_KEY, value: config, category: "attendance", isPublic: false });
    }
    return config;
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
    const requestCount = await db.AttendanceRequest.count({ where });
    const dailyReasonCount = await this.countDailyReasonUsesByReason(businessId, employeeUserId, reasonCode, anchorDate);
    return requestCount + dailyReasonCount;
  }

  async countApprovedUsableGlobal(businessId: string, employeeUserId: string, anchorDate: Date, excludeRequestId?: string | null) {
    const { startUtc, endUtc } = monthBoundsUtc(anchorDate, ADDIS_ABABA_TZ);
    const where: any = {
      businessId,
      employeeUserId,
      requestType: "lateness_notice",
      status: "approved",
      validityStatus: "valid",
      approvedAt: { [Op.gte]: startUtc, [Op.lt]: endUtc },
    };
    if (excludeRequestId) where.id = { [Op.ne]: excludeRequestId };
    const requestCount = await db.AttendanceRequest.count({ where });
    const dailyReasonCount = await this.countDailyReasonUsesGlobal(businessId, employeeUserId, anchorDate);
    return requestCount + dailyReasonCount;
  }

  async countDailyReasonUsesByReason(businessId: string, employeeUserId: string, reasonCode: string, anchorDate: Date, excludeDailyReasonId?: string | null) {
    if (!db.AttendanceLateReason?.findAll || !db.AttendanceDailyReason?.count) return 0;
    const { startYmd, endYmd } = monthBoundsYmd(anchorDate, ADDIS_ABABA_TZ);
    const rules = await db.AttendanceLateReason.findAll({
      where: { businessId, reasonCode: normalizeCode(reasonCode) },
      attributes: ["id"],
    });
    const lateReasonIds = rules.map((rule: any) => rule.id);
    if (!lateReasonIds.length) return 0;
    const where: any = {
      businessId,
      employeeId: employeeUserId,
      reasonType: "late",
      lateReasonId: { [Op.in]: lateReasonIds },
      dateYmd: { [Op.gte]: startYmd, [Op.lt]: endYmd },
    };
    if (excludeDailyReasonId) where.id = { [Op.ne]: excludeDailyReasonId };
    return db.AttendanceDailyReason.count({ where });
  }

  async countDailyReasonUsesGlobal(businessId: string, employeeUserId: string, anchorDate: Date, excludeDailyReasonId?: string | null) {
    if (!db.AttendanceDailyReason?.count) return 0;
    const { startYmd, endYmd } = monthBoundsYmd(anchorDate, ADDIS_ABABA_TZ);
    const where: any = {
      businessId,
      employeeId: employeeUserId,
      reasonType: "late",
      dateYmd: { [Op.gte]: startYmd, [Op.lt]: endYmd },
    };
    if (excludeDailyReasonId) where.id = { [Op.ne]: excludeDailyReasonId };
    return db.AttendanceDailyReason.count({ where });
  }

  async balancesForEmployee(businessId: string, employeeUserId: string, anchorDate: Date = new Date()): Promise<LatenessReasonRuleBalance[]> {
    const rules = await this.listRules(businessId);
    const config = await this.getCreditConfig(businessId);
    const globalUsed = config.mode === "GLOBAL_POOL"
      ? await this.countApprovedUsableGlobal(businessId, employeeUserId, anchorDate)
      : 0;
    const globalRemaining = config.globalMonthlyLimit > 0 ? Math.max(0, config.globalMonthlyLimit - globalUsed) : 0;
    const balances: LatenessReasonRuleBalance[] = [];
    for (const rule of rules) {
      const code = ruleCode(rule);
      const monthlyLimit = config.mode === "GLOBAL_POOL" ? config.globalMonthlyLimit : Number(rule.monthlyLimit || 0);
      const usedThisMonth = config.mode === "GLOBAL_POOL"
        ? globalUsed
        : await this.countApprovedUsableByReason(businessId, employeeUserId, code, anchorDate);
      const remainingThisMonth = monthlyLimit > 0 ? Math.max(0, monthlyLimit - usedThisMonth) : 0;
      const isEnabled = enabled(rule);
      const canUse = isEnabled && monthlyLimit > 0 && usedThisMonth < monthlyLimit;
      balances.push({
        reasonCode: code,
        label: ruleLabel(rule),
        monthlyLimit,
        usedThisMonth,
        remainingThisMonth: config.mode === "GLOBAL_POOL" ? globalRemaining : remainingThisMonth,
        coversMinutes: config.mode === "GLOBAL_POOL" ? config.globalCoversMinutes : Number(rule.coversMinutes || 0),
        enabled: isEnabled,
        canUse,
        blockedReason: !isEnabled ? "disabled" : monthlyLimit <= 0 ? "no_monthly_allowance" : usedThisMonth >= monthlyLimit ? "monthly_limit_reached" : null,
        ...(config.mode === "GLOBAL_POOL" ? { creditMode: config.mode, globalMonthlyLimit: config.globalMonthlyLimit, globalUsedThisMonth: globalUsed, globalRemainingThisMonth: globalRemaining } : {}),
      });
    }
    return balances;
  }

  async evaluateNotice(record: any, lateByMinutes = 0): Promise<LatenessNoticeEvaluation> {
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

    const config = await this.getCreditConfig(record.businessId);
    const anchorDate = new Date(record.fromAt || record.submittedAt || record.createdAt);
    const monthlyLimit = config.mode === "GLOBAL_POOL" ? config.globalMonthlyLimit : Number(rule.monthlyLimit || 0);
    const used = config.mode === "GLOBAL_POOL"
      ? await this.countApprovedUsableGlobal(record.businessId, record.employeeUserId, anchorDate, record.id)
      : await this.countApprovedUsableByReason(record.businessId, record.employeeUserId, reasonCode, anchorDate, record.id);
    if (monthlyLimit <= 0 || used >= monthlyLimit) {
      return this.exceededResult(config.mode === "GLOBAL_POOL" ? config : rule, reasonCode, config.mode === "GLOBAL_POOL" ? "Monthly lateness credit limit reached." : "Monthly limit reached for this lateness reason.");
    }

    const coversMinutes = config.mode === "GLOBAL_POOL" ? config.globalCoversMinutes : Number(rule.coversMinutes || 0);
    if (lateByMinutes > coversMinutes) {
      return {
        validityStatus: "invalid",
        noticeStatus: "Invalid",
        usable: false,
        reasonCode,
        message: config.mode === "GLOBAL_POOL" ? `The global credit covers only ${coversMinutes} late minutes.` : `This reason covers only ${coversMinutes} late minutes.`,
        penaltyLabel: "HalfDay",
        penaltyReason: "Lateness exceeded the approved reason coverage.",
      };
    }

    return { validityStatus: "valid", noticeStatus: "Approved", usable: true, reasonCode, message: null };
  }

  async evaluateDailyReason(record: any, lateByMinutes = 0): Promise<LatenessNoticeEvaluation> {
    const rule = record.lateReason || (record.lateReasonId ? await db.AttendanceLateReason.findOne({ where: { id: record.lateReasonId, businessId: record.businessId } }) : null);
    const reasonCode = rule ? ruleCode(rule) : null;
    if (!rule || !reasonCode) return { validityStatus: "invalid", noticeStatus: "Invalid", usable: false, reasonCode, message: "Lateness reason category is not configured." };
    if (!enabled(rule)) return { validityStatus: "invalid", noticeStatus: "Invalid", usable: false, reasonCode, message: "Lateness reason category is disabled." };

    const config = await this.getCreditConfig(record.businessId);
    const anchorDate = new Date(`${record.dateYmd || localDateYmd(new Date())}T00:00:00.000Z`);
    const monthlyLimit = config.mode === "GLOBAL_POOL" ? config.globalMonthlyLimit : Number(rule.monthlyLimit || 0);
    const requestWhere: any = {
      businessId: record.businessId,
      employeeUserId: record.employeeId,
      requestType: "lateness_notice",
      status: "approved",
      validityStatus: "valid",
      approvedAt: { [Op.gte]: monthBoundsUtc(anchorDate, ADDIS_ABABA_TZ).startUtc, [Op.lt]: monthBoundsUtc(anchorDate, ADDIS_ABABA_TZ).endUtc },
    };
    if (config.mode !== "GLOBAL_POOL") requestWhere.reasonCategory = reasonCode;
    const requestUsed = await db.AttendanceRequest.count({ where: requestWhere });
    const dailyUsed = config.mode === "GLOBAL_POOL"
      ? await this.countDailyReasonUsesGlobal(record.businessId, record.employeeId, anchorDate, record.id)
      : await this.countDailyReasonUsesByReason(record.businessId, record.employeeId, reasonCode, anchorDate, record.id);
    const used = requestUsed + dailyUsed;
    if (monthlyLimit <= 0 || used >= monthlyLimit) {
      return this.exceededResult(config.mode === "GLOBAL_POOL" ? config : rule, reasonCode, config.mode === "GLOBAL_POOL" ? "Monthly lateness credit limit reached." : "Monthly limit reached for this lateness reason.");
    }

    const coversMinutes = config.mode === "GLOBAL_POOL" ? config.globalCoversMinutes : Number(rule.coversMinutes || 0);
    if (lateByMinutes > coversMinutes) {
      return {
        validityStatus: "invalid",
        noticeStatus: "Invalid",
        usable: false,
        reasonCode,
        message: config.mode === "GLOBAL_POOL" ? `The global credit covers only ${coversMinutes} late minutes.` : `This reason covers only ${coversMinutes} late minutes.`,
        penaltyLabel: "HalfDay",
        penaltyReason: "Lateness exceeded the approved reason coverage.",
      };
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

  private normalizeCreditConfig(value: any): LatenessCreditConfig {
    const mode = String(value?.mode || DEFAULT_CREDIT_CONFIG.mode).toUpperCase() === "GLOBAL_POOL" ? "GLOBAL_POOL" : "PER_REASON";
    return {
      mode,
      globalMonthlyLimit: Math.max(0, Number(value?.globalMonthlyLimit ?? DEFAULT_CREDIT_CONFIG.globalMonthlyLimit) || 0),
      globalCoversMinutes: Math.max(0, Number(value?.globalCoversMinutes ?? DEFAULT_CREDIT_CONFIG.globalCoversMinutes) || 0),
      behaviorWhenExceeded: behavior({ behaviorWhenExceeded: value?.behaviorWhenExceeded ?? DEFAULT_CREDIT_CONFIG.behaviorWhenExceeded }),
    };
  }
}
