import { Op } from "sequelize";
import { db } from "../../models";

export class UserExemptionsService {
  private include() {
    return [
      { model: db.User, as: "user", attributes: ["id", "fullName", "email"] },
      { model: db.User, as: "requester", attributes: ["id", "fullName", "email"] },
      { model: db.User, as: "approver", attributes: ["id", "fullName", "email"] },
      { model: db.User, as: "rejecter", attributes: ["id", "fullName", "email"] },
    ];
  }

  async list(businessId: string, query: any = {}) {
    const page = Math.max(1, Number(query.page || 1));
    const size = Math.min(100, Math.max(1, Number(query.size || 20)));
    const where: any = { businessId };
    if (query.status && query.status !== "all") where.status = String(query.status).toUpperCase();
    if (query.userId) where.userId = query.userId;
    if (query.search) {
      where[Op.or] = [{ reason: { [Op.iLike]: `%${query.search}%` } }];
    }
    return db.UserExemption.findAndCountAll({
      where,
      include: this.include(),
      order: [["createdAt", "DESC"]],
      limit: size,
      offset: (page - 1) * size,
      distinct: true,
    });
  }

  async create(businessId: string, requestedBy: string, data: { userId: string; reason: string; excludeFromPayroll?: boolean }) {
    const user = await db.User.findOne({ where: { id: data.userId, businessId, status: "active" } });
    if (!user) throw Object.assign(new Error("User not found."), { statusCode: 404 });
    const existingPending = await db.UserExemption.findOne({
      where: { businessId, userId: data.userId, status: "PENDING" },
    });
    if (existingPending) throw Object.assign(new Error("This user already has a pending exemption request."), { statusCode: 409 });
    const existingApproved = await this.findApprovedForUser(businessId, data.userId);
    if (existingApproved) throw Object.assign(new Error("This user is already exempted."), { statusCode: 409 });
    return db.UserExemption.create({
      businessId,
      userId: data.userId,
      reason: data.reason.trim(),
      excludeFromPayroll: Boolean(data.excludeFromPayroll),
      status: "PENDING",
      requestedBy,
    });
  }

  async approve(businessId: string, id: string, approvedBy: string) {
    const record = await this.pendingRecord(businessId, id);
    const now = new Date();
    await record.update({ status: "APPROVED", approvedBy, approvedAt: now, rejectedBy: null, rejectedAt: null });
    return db.UserExemption.findOne({ where: { id, businessId }, include: this.include() });
  }

  async reject(businessId: string, id: string, rejectedBy: string) {
    const record = await this.pendingRecord(businessId, id);
    await record.update({ status: "REJECTED", rejectedBy, rejectedAt: new Date() });
    return db.UserExemption.findOne({ where: { id, businessId }, include: this.include() });
  }

  async pendingRecord(businessId: string, id: string) {
    const record = await db.UserExemption.findOne({ where: { id, businessId } });
    if (!record) throw Object.assign(new Error("Exemption request not found."), { statusCode: 404 });
    if (record.status !== "PENDING") throw Object.assign(new Error("Only pending exemption requests can be updated."), { statusCode: 400 });
    return record;
  }

  async findApprovedForUser(businessId: string, userId: string) {
    return db.UserExemption.findOne({ where: { businessId, userId, status: "APPROVED" } });
  }

  async approvedUserIds(businessId: string, options: { excludeFromPayroll?: boolean } = {}) {
    const where: any = { businessId, status: "APPROVED" };
    if (typeof options.excludeFromPayroll === "boolean") where.excludeFromPayroll = options.excludeFromPayroll;
    const rows = await db.UserExemption.findAll({ where, attributes: ["userId"] });
    return rows.map((row: any) => row.userId);
  }
}
