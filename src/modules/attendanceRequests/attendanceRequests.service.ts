import { Op } from "sequelize";
import { db } from "../../models";
import { businessDateEndUtc, businessDateStartUtc, localWallTimeToUtc } from "../../utils/timezone";
import { LatenessReasonRulesService } from "../../services/latenessReasonRules.service";

const VALID_TYPES = new Set(["work_from_home", "memo_log", "check_in_correction", "not_available", "lateness_notice"]);
const VALID_STATUSES = new Set(["pending", "approved", "rejected", "invalid", "expired", "cancelled"]);
const CORRECTION_EVENT_TYPES = new Set(["CHECK_IN", "LUNCH_OUT", "LUNCH_IN", "CHECK_OUT"]);
const LATE_NOTICE_DEADLINE_HOUR = 8;
const LATE_NOTICE_DEADLINE_MINUTES = 30;
const VAGUE_REASON_PATTERN = /^(late|traffic|personal|emergency|issue|n\/a|na|none|other|misc|because)$/i;

function assertType(type: string) {
  if (!VALID_TYPES.has(type)) throw new Error("Invalid attendance request type.");
}

function parseCorrectionWallTime(value: unknown, timeZone: string) {
  const raw = String(value || "").trim();
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::\d{2})?$/);
  if (match) return localWallTimeToUtc(match[1], match[2], timeZone);

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function businessDateYmd(dateUtc: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(dateUtc);
}

function localDayStartUtc(dateUtc: Date, timeZone: string) {
  return businessDateStartUtc(businessDateYmd(dateUtc, timeZone), timeZone);
}

function buildNoticeDeadline(dateUtc: Date, timeZone: string) {
  const dayStart = localDayStartUtc(dateUtc, timeZone);
  return new Date(dayStart.getTime() + (LATE_NOTICE_DEADLINE_HOUR * 60 + LATE_NOTICE_DEADLINE_MINUTES) * 60_000);
}

function validateNoticeText(reasonText: string) {
  const normalized = reasonText.trim().replace(/\s+/g, " ");
  if (normalized.length < 12) return "invalid";
  if (VAGUE_REASON_PATTERN.test(normalized)) return "invalid";
  return "valid";
}

function employeeInclude() {
  return [
    {
      model: db.User,
      as: "employee",
      attributes: ["id", "fullName", "email", "phone"],
      include: [{
        model: db.BusinessUserProfile,
        required: false,
        include: [
          { model: db.Department, as: "department", attributes: ["id", "name"] },
          { model: db.Position, as: "position", attributes: ["id", "title"] },
        ],
      }],
    },
    { model: db.User, as: "actionedBy", attributes: ["id", "fullName", "email"] },
    { model: db.User, as: "approvedBy", attributes: ["id", "fullName", "email"] },
    { model: db.User, as: "rejectedBy", attributes: ["id", "fullName", "email"] },
  ];
}

export class AttendanceRequestsService {
  private latenessRules = new LatenessReasonRulesService();

  async findBasic(businessId: string, requestId: string) {
    return db.AttendanceRequest.findOne({ where: { id: requestId, businessId }, attributes: ["id", "requestType"] });
  }

  async list(businessId: string, query: any, employeeUserId?: string) {
    const page = Math.max(1, Number(query.page || 1));
    const size = Math.min(100, Math.max(1, Number(query.size || 20)));
    const where: any = { businessId };
    if (query.requestType) {
      assertType(String(query.requestType));
      where.requestType = query.requestType;
    }
    if (query.status && query.status !== "all") where.status = query.status;
    if (employeeUserId) where.employeeUserId = employeeUserId;
    if (query.search) {
      where[Op.or] = [
        { title: { [Op.iLike]: `%${query.search}%` } },
        { reason: { [Op.iLike]: `%${query.search}%` } },
        { category: { [Op.iLike]: `%${query.search}%` } },
      ];
    }

    return db.AttendanceRequest.findAndCountAll({
      where,
      include: employeeInclude(),
      order: [["createdAt", "DESC"]],
      limit: size,
      offset: (page - 1) * size,
      distinct: true,
    });
  }

  async create(businessId: string, employeeUserId: string, data: any, options: { canManage?: boolean } = {}) {
    assertType(String(data.requestType));
    if (!data.title || !data.reason) throw new Error("title and reason are required.");
    const isCorrection = data.requestType === "check_in_correction";
    const isLatenessNotice = data.requestType === "lateness_notice";
    const canTargetEmployee = isCorrection || (isLatenessNotice && options.canManage);
    const targetEmployeeUserId = canTargetEmployee && data.employeeUserId ? String(data.employeeUserId || "") : employeeUserId;
    let correctionFromAt: Date | null = null;
    let noticeFromAt: Date | null = null;
    let deadlineAt: Date | null = null;
    let validityStatus: string | null = null;
    let reasonText: string | null = null;
    if (canTargetEmployee && !targetEmployeeUserId) throw new Error("Employee is required.");
    if (isCorrection) {
      if (!targetEmployeeUserId) throw new Error("Employee is required for check-in correction requests.");
      if (!CORRECTION_EVENT_TYPES.has(String(data.category || ""))) {
        throw new Error("Valid correction type is required.");
      }
      const settings = await db.BusinessAttendanceSettings.findOne({ where: { businessId } });
      correctionFromAt = parseCorrectionWallTime(data.fromAt, settings?.timezone || "UTC");
      if (!correctionFromAt) {
        throw new Error("Valid correction date and time is required.");
      }
      const employee = await db.User.findOne({ where: { id: targetEmployeeUserId, businessId } });
      if (!employee) throw new Error("Employee not found.");
    }
    if (isLatenessNotice) {
      if (targetEmployeeUserId !== employeeUserId) {
        const employee = await db.User.findOne({ where: { id: targetEmployeeUserId, businessId } });
        if (!employee) throw new Error("Employee not found.");
      }
      const settings = await db.BusinessAttendanceSettings.findOne({ where: { businessId } });
      noticeFromAt = data.fromAt ? parseCorrectionWallTime(data.fromAt, settings?.timezone || "Africa/Addis_Ababa") : new Date();
      if (!noticeFromAt) throw new Error("Valid lateness notice date and time is required.");
      deadlineAt = buildNoticeDeadline(noticeFromAt, settings?.timezone || "Africa/Addis_Ababa");
      reasonText = String(data.reasonText || data.reason || "").trim();
      validityStatus = validateNoticeText(reasonText);
      const reasonCode = this.latenessRules.normalizeReasonCode(data.reasonCategory || data.category);
      const rule = await this.latenessRules.findRule(businessId, reasonCode);
      if (!rule || rule.enabled === false || rule.isActive === false) throw Object.assign(new Error("Selected lateness reason is not enabled."), { statusCode: 400 });
      if (rule.requiresAttachment && !data.attachmentUrl && !data.attachmentId) throw Object.assign(new Error("Selected lateness reason requires an attachment."), { statusCode: 400 });
      if (new Date() > deadlineAt && !rule.allowAfterDeadline) validityStatus = "expired";
      const creditConfig = await this.latenessRules.getCreditConfig(businessId);
      const used = creditConfig.mode === "GLOBAL_POOL"
        ? await this.latenessRules.countApprovedUsableGlobal(businessId, targetEmployeeUserId, noticeFromAt)
        : await this.latenessRules.countApprovedUsableByReason(businessId, targetEmployeeUserId, reasonCode, noticeFromAt);
      const limit = creditConfig.mode === "GLOBAL_POOL" ? creditConfig.globalMonthlyLimit : Number(rule.monthlyLimit || 0);
      if (limit <= 0 || used >= limit) {
        const behavior = String((creditConfig.mode === "GLOBAL_POOL" ? creditConfig.behaviorWhenExceeded : rule.behaviorWhenExceeded) || "HR_REVIEW").toUpperCase();
        if (behavior === "BLOCK") throw Object.assign(new Error("Monthly limit reached for this lateness reason."), { statusCode: 400 });
        if (behavior === "MARK_INVALID") validityStatus = "invalid";
      }
    }
    const autoApproveLateness = isLatenessNotice && validityStatus === "valid";
    const now = new Date();
    return db.AttendanceRequest.create({
      businessId,
      employeeUserId: targetEmployeeUserId,
      requestType: data.requestType,
      category: isLatenessNotice ? this.latenessRules.normalizeReasonCode(data.reasonCategory || data.category) : data.category || data.reasonCategory || null,
      title: data.title,
      reason: data.reason,
      fromAt: isCorrection ? correctionFromAt : isLatenessNotice ? noticeFromAt : data.fromAt || null,
      toAt: data.toAt || null,
      durationMinutes: data.durationMinutes ?? null,
      status: autoApproveLateness ? "approved" : "pending",
      submittedAt: now,
      approvedAt: autoApproveLateness ? now : null,
      approvedByUserId: autoApproveLateness ? employeeUserId : null,
      actionedAt: autoApproveLateness ? now : null,
      actionedByUserId: autoApproveLateness ? employeeUserId : null,
      reasonCategory: isLatenessNotice ? this.latenessRules.normalizeReasonCode(data.reasonCategory || data.category) : data.reasonCategory || data.category || null,
      reasonText,
      validityStatus,
      deadlineAt,
    });
  }

  async action(businessId: string, requestId: string, userId: string, status: "approved" | "rejected" | "invalid" | "expired" | "cancelled", note?: string) {
    if (!VALID_STATUSES.has(status)) throw new Error("Invalid status.");
    const record = await db.AttendanceRequest.findOne({ where: { id: requestId, businessId } });
    if (!record) throw new Error("Attendance request not found.");
    if (record.status !== "pending") throw new Error("Only pending attendance requests can be updated.");
    if (record.requestType === "lateness_notice" && status === "approved") {
      const validity = await this.evaluateLatenessNotice(record, Number(record.durationMinutes || 0));
      if (validity.validityStatus !== "valid" || !validity.usable) {
        if (validity.validityStatus === "invalid" || validity.validityStatus === "expired") {
          await record.update({ validityStatus: validity.validityStatus, actionNote: validity.message || note || null });
        }
        throw Object.assign(new Error(validity.message || "Lateness notice is invalid"), { statusCode: 400 });
      }
    }
    const now = new Date();
    await record.update({
      status,
      validityStatus: record.requestType === "lateness_notice" ? (status === "invalid" || status === "expired" ? status : status === "approved" ? "valid" : record.validityStatus) : record.validityStatus,
      approvedAt: status === "approved" ? now : record.approvedAt,
      approvedByUserId: status === "approved" ? userId : record.approvedByUserId,
      rejectedAt: status === "rejected" || status === "invalid" || status === "expired" ? now : record.rejectedAt,
      rejectedByUserId: status === "rejected" || status === "invalid" || status === "expired" ? userId : record.rejectedByUserId,
      actionedAt: now,
      actionedByUserId: userId,
      actionNote: note || null,
    });
    if (status === "approved" && record.requestType === "check_in_correction") {
      const settings = await db.BusinessAttendanceSettings.findOne({ where: { businessId } });
      const tz = settings?.timezone || "UTC";
      const correctedAtUtc = new Date(record.fromAt);
      const correctionDate = businessDateYmd(correctedAtUtc, tz);
      const dayStartUtc = businessDateStartUtc(correctionDate, tz);
      const dayEndUtc = businessDateEndUtc(correctionDate, tz);
      const existing = await db.AttendanceEvent.findOne({
        where: {
          businessId,
          employeeId: record.employeeUserId,
          type: record.category,
          timestampUtc: { [Op.gte]: dayStartUtc, [Op.lt]: dayEndUtc },
        },
        order: [["timestampUtc", "ASC"]],
      });
      const payload = {
        businessId,
        employeeId: record.employeeUserId,
        type: record.category,
        timestampUtc: correctedAtUtc,
        latitude: 0,
        longitude: 0,
        distanceMeters: 0,
        withinAllowedRadius: true,
      };
      if (existing) await existing.update(payload);
      else await db.AttendanceEvent.create(payload);
    }
    return db.AttendanceRequest.findOne({ where: { id: requestId, businessId }, include: employeeInclude() });
  }

  async listPendingLatenessNotices(businessId: string, query: any = {}) {
    return this.list(businessId, {
      ...query,
      requestType: "lateness_notice",
      status: "pending",
    });
  }

  async evaluateLatenessNotice(record: any, lateByMinutes = 0) {
    const reasonText = String(record.reasonText || record.reason || "").trim();
    const validityStatus = validateNoticeText(reasonText);
    if (validityStatus === "invalid") return { validityStatus, noticeStatus: "Invalid", usable: false, reasonCode: null, message: "Reason is too vague or too short." };
    return this.latenessRules.evaluateNotice(record, lateByMinutes);
  }

  async countApprovedLatenessNotices(businessId: string, employeeUserId: string, anchorDate: Date, period: "week" | "month" = "month") {
    const start = new Date(anchorDate);
    start.setUTCHours(0, 0, 0, 0);
    if (period === "month") start.setUTCDate(1);
    else {
      const day = start.getUTCDay() || 7;
      start.setUTCDate(start.getUTCDate() - day + 1);
    }
    const end = new Date(start);
    if (period === "month") end.setUTCMonth(end.getUTCMonth() + 1);
    else end.setUTCDate(end.getUTCDate() + 7);
    return db.AttendanceRequest.count({
      where: {
        businessId,
        employeeUserId,
        requestType: "lateness_notice",
        status: "approved",
        validityStatus: "valid",
        approvedAt: { [Op.gte]: start, [Op.lt]: end },
      },
    });
  }

  async syncApprovedCorrections(businessId: string, query: any = {}) {
    const where: any = {
      businessId,
      requestType: "check_in_correction",
      status: "approved",
      fromAt: { [Op.ne]: null },
    };
    if (query.employeeUserId) where.employeeUserId = query.employeeUserId;

    const settings = await db.BusinessAttendanceSettings.findOne({ where: { businessId } });
    const tz = settings?.timezone || "UTC";
    const requests = await db.AttendanceRequest.findAll({ where, order: [["actionedAt", "ASC"], ["updatedAt", "ASC"]] });
    let created = 0;
    let updated = 0;

    for (const record of requests) {
      if (!CORRECTION_EVENT_TYPES.has(String(record.category || "")) || !record.fromAt) continue;
      const correctedAtUtc = new Date(record.fromAt);
      const correctionDate = businessDateYmd(correctedAtUtc, tz);
      if (query.date && query.date !== correctionDate) continue;

      const dayStartUtc = businessDateStartUtc(correctionDate, tz);
      const dayEndUtc = businessDateEndUtc(correctionDate, tz);
      const payload = {
        businessId,
        employeeId: record.employeeUserId,
        type: record.category,
        timestampUtc: correctedAtUtc,
        latitude: 0,
        longitude: 0,
        distanceMeters: 0,
        withinAllowedRadius: true,
      };
      const existing = await db.AttendanceEvent.findOne({
        where: {
          businessId,
          employeeId: record.employeeUserId,
          type: record.category,
          timestampUtc: { [Op.gte]: dayStartUtc, [Op.lt]: dayEndUtc },
        },
        order: [["timestampUtc", "ASC"]],
      });
      if (existing) {
        await existing.update(payload);
        updated += 1;
      } else {
        await db.AttendanceEvent.create(payload);
        created += 1;
      }
    }

    return { scanned: requests.length, created, updated };
  }
}
