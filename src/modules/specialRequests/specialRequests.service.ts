import { Op } from "sequelize";
import { db } from "../../models";

const FULL_LUNCH_REQUEST_MINUTES = 60;
const VALID_STATUSES = new Set(["pending", "approved", "rejected"]);

function requesterInclude() {
  return [
    {
      model: db.User,
      as: "requester",
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
    { model: db.User, as: "approver", attributes: ["id", "fullName", "email"] },
    { model: db.User, as: "rejecter", attributes: ["id", "fullName", "email"] },
  ];
}

export class SpecialRequestsService {
  async list(businessId: string, query: any, requestedBy?: string) {
    const page = Math.max(1, Number(query.page || 1));
    const size = Math.min(100, Math.max(1, Number(query.size || 20)));
    const where: any = { businessId };
    if (requestedBy) where.requestedBy = requestedBy;
    if (query.status && query.status !== "all") {
      if (!VALID_STATUSES.has(String(query.status))) throw new Error("Invalid status.");
      where.status = query.status;
    }
    if (query.requestedDate) where.requestedDate = query.requestedDate;
    if (query.search) where.reason = { [Op.iLike]: `%${query.search}%` };

    return db.SpecialRequest.findAndCountAll({
      where,
      include: requesterInclude(),
      order: [["createdAt", "DESC"]],
      limit: size,
      offset: (page - 1) * size,
      distinct: true,
    });
  }

  async create(businessId: string, requestedBy: string, data: any, options: { autoApprove?: boolean } = {}) {
    const lunchUsageType = String(data.lunchUsageType || "").toUpperCase();
    if (!["FULL", "PARTIAL"].includes(lunchUsageType)) throw new Error("Valid lunch usage type is required.");
    const requestedMinutes = lunchUsageType === "FULL" ? FULL_LUNCH_REQUEST_MINUTES : Number(data.requestedMinutes || 0);
    if (!Number.isFinite(requestedMinutes) || requestedMinutes <= 0 || requestedMinutes > 240) {
      throw new Error("Requested minutes must be between 1 and 240.");
    }
    if (!data.requestedDate) throw new Error("Requested date is required.");
    if (!data.reason || !String(data.reason).trim()) throw new Error("Reason is required.");

    const now = new Date();
    return db.SpecialRequest.create({
      businessId,
      requestedBy,
      requestedDate: data.requestedDate,
      requestType: "Special Request",
      lunchUsageType,
      requestedMinutes,
      reason: String(data.reason).trim(),
      status: options.autoApprove ? "approved" : "pending",
      submittedAt: now,
      approvedBy: options.autoApprove ? requestedBy : null,
      approvedAt: options.autoApprove ? now : null,
    });
  }

  async approve(businessId: string, requestId: string, approvedBy: string) {
    const record = await db.SpecialRequest.findOne({ where: { id: requestId, businessId } });
    if (!record) throw new Error("Special Request not found.");
    if (record.status !== "pending") throw new Error("Only pending Special Requests can be approved.");
    await record.update({ status: "approved", approvedBy, approvedAt: new Date(), rejectedBy: null, rejectedAt: null, rejectedReason: null });
    return db.SpecialRequest.findOne({ where: { id: requestId, businessId }, include: requesterInclude() });
  }

  async reject(businessId: string, requestId: string, rejectedBy: string, rejectedReason: string) {
    const record = await db.SpecialRequest.findOne({ where: { id: requestId, businessId } });
    if (!record) throw new Error("Special Request not found.");
    if (record.status !== "pending") throw new Error("Only pending Special Requests can be rejected.");
    await record.update({ status: "rejected", rejectedBy, rejectedAt: new Date(), rejectedReason: rejectedReason || "No reason provided" });
    return db.SpecialRequest.findOne({ where: { id: requestId, businessId }, include: requesterInclude() });
  }

  async approvedMinutesByEmployeeDate(businessId: string, employeeIds: string[], startDate: string, endDate: string) {
    if (!employeeIds.length) return new Map<string, number>();
    const rows = await db.SpecialRequest.findAll({
      where: {
        businessId,
        requestedBy: { [Op.in]: employeeIds },
        requestedDate: { [Op.between]: [startDate, endDate] },
        status: "approved",
      },
      attributes: ["requestedBy", "requestedDate", "requestedMinutes"],
    });
    const map = new Map<string, number>();
    for (const row of rows) {
      const key = `${row.requestedBy}__${row.requestedDate}`;
      map.set(key, (map.get(key) || 0) + Number(row.requestedMinutes || 0));
    }
    return map;
  }
}
