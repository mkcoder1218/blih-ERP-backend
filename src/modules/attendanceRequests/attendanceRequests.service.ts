import { Op } from "sequelize";
import { db } from "../../models";

const VALID_TYPES = new Set(["work_from_home", "memo_log", "check_in_correction"]);
const VALID_STATUSES = new Set(["pending", "approved", "rejected"]);
const CORRECTION_EVENT_TYPES = new Set(["CHECK_IN", "LUNCH_OUT", "LUNCH_IN", "CHECK_OUT"]);

function assertType(type: string) {
  if (!VALID_TYPES.has(type)) throw new Error("Invalid attendance request type.");
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
    if (isCorrection) {
      if (!targetEmployeeUserId) throw new Error("Employee is required for check-in correction requests.");
      if (!CORRECTION_EVENT_TYPES.has(String(data.category || ""))) {
        throw new Error("Valid correction type is required.");
      }
      if (!data.fromAt || Number.isNaN(new Date(data.fromAt).getTime())) {
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
      fromAt: data.fromAt || null,
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
      await db.AttendanceEvent.create({
        businessId,
        employeeId: record.employeeUserId,
        type: record.category,
        timestampUtc: record.fromAt,
        latitude: 0,
        longitude: 0,
        distanceMeters: 0,
        withinAllowedRadius: true,
      });
    }
    return db.AttendanceRequest.findOne({ where: { id: requestId, businessId }, include: employeeInclude() });
  }
}
