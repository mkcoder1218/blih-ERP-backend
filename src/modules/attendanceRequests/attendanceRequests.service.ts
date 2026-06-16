import { Op } from "sequelize";
import { db } from "../../models";
import { businessDateEndUtc, businessDateStartUtc, localWallTimeToUtc } from "../../utils/timezone";

const VALID_TYPES = new Set(["work_from_home", "memo_log", "check_in_correction", "not_available"]);
const VALID_STATUSES = new Set(["pending", "approved", "rejected"]);
const CORRECTION_EVENT_TYPES = new Set(["CHECK_IN", "LUNCH_OUT", "LUNCH_IN", "CHECK_OUT"]);

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
  ];
}

export class AttendanceRequestsService {
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

  async create(businessId: string, employeeUserId: string, data: any) {
    assertType(String(data.requestType));
    if (!data.title || !data.reason) throw new Error("title and reason are required.");
    const isCorrection = data.requestType === "check_in_correction";
    const targetEmployeeUserId = isCorrection ? String(data.employeeUserId || "") : employeeUserId;
    let correctionFromAt: Date | null = null;
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
    return db.AttendanceRequest.create({
      businessId,
      employeeUserId: targetEmployeeUserId,
      requestType: data.requestType,
      category: data.category || null,
      title: data.title,
      reason: data.reason,
      fromAt: isCorrection ? correctionFromAt : data.fromAt || null,
      toAt: data.toAt || null,
      durationMinutes: data.durationMinutes ?? null,
      status: "pending",
    });
  }

  async action(businessId: string, requestId: string, userId: string, status: "approved" | "rejected", note?: string) {
    if (!VALID_STATUSES.has(status)) throw new Error("Invalid status.");
    const record = await db.AttendanceRequest.findOne({ where: { id: requestId, businessId } });
    if (!record) throw new Error("Attendance request not found.");
    if (record.status !== "pending") throw new Error("Only pending attendance requests can be updated.");
    await record.update({
      status,
      actionedAt: new Date(),
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
