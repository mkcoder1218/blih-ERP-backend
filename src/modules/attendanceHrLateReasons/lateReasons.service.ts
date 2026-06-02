import { db } from "../../models";

export class LateReasonsService {
  async list(businessId: string) {
    return db.AttendanceLateReason.findAll({
      where: { businessId },
      order: [["createdAt", "DESC"]]
    });
  }

  async create(businessId: string, createdBy: string, payload: any) {
    return db.AttendanceLateReason.create({ businessId, createdBy, ...payload });
  }

  async update(businessId: string, reasonId: string, payload: any) {
    const reason = await db.AttendanceLateReason.findOne({ where: { id: reasonId, businessId } });
    if (!reason) return null;
    await reason.update(payload);
    return reason;
  }

  async deactivate(businessId: string, reasonId: string) {
    const reason = await db.AttendanceLateReason.findOne({ where: { id: reasonId, businessId } });
    if (!reason) return null;
    await reason.update({ isActive: false });
    return reason;
  }
}

