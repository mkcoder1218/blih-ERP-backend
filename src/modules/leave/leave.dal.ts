import { Op } from "sequelize";
import { db } from "../../models";

const userAttrs = ["id", "fullName", "email"];

const includeUsers = [
  { model: db.User, as: "employee",       attributes: userAttrs, required: false },
  { model: db.User, as: "deptHeadApprover", attributes: userAttrs, required: false },
  { model: db.User, as: "businessAdminApprover", attributes: userAttrs, required: false },
  { model: db.User, as: "adminApprover",  attributes: userAttrs, required: false },
  { model: db.User, as: "rejector",       attributes: userAttrs, required: false },
];

const includeTemplate = [
  { model: db.LeaveTemplate, as: "template", attributes: ["id", "name", "leaveType", "hasAmount", "totalDays", "isActive", "requiresEvidence", "evidenceInstructions"], required: false },
];

// ── Templates ────────────────────────────────────────────────────────────────

export class LeaveTemplateDAL {
  list(businessId: string, onlyActive?: boolean) {
    const where: any = { businessId };
    if (onlyActive) where.isActive = true;
    return db.LeaveTemplate.findAll({ where, order: [["createdAt", "DESC"]] });
  }

  findById(id: string, businessId: string) {
    return db.LeaveTemplate.findOne({ where: { id, businessId } });
  }

  create(data: any) {
    return db.LeaveTemplate.create(data);
  }

  async update(id: string, businessId: string, data: any) {
    const rec = await db.LeaveTemplate.findOne({ where: { id, businessId } });
    if (!rec) throw new Error("Template not found");
    return rec.update(data);
  }

  async delete(id: string, businessId: string) {
    const rec = await db.LeaveTemplate.findOne({ where: { id, businessId } });
    if (!rec) throw new Error("Template not found");
    return rec.destroy();
  }
}

// ── Leave Requests ────────────────────────────────────────────────────────────

export interface LeaveListFilters {
  businessId: string;
  employeeUserId?: string;
  approvalStage?: string;
  status?: string;
  leaveType?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  size?: number;
}

export class LeaveRequestDAL {
  findPaginated(filters: LeaveListFilters) {
    const { businessId, employeeUserId, approvalStage, status, leaveType, dateFrom, dateTo, page = 1, size = 20 } = filters;
    const where: any = { businessId };
    if (employeeUserId) where.employeeUserId = employeeUserId;
    if (approvalStage) where.approvalStage = approvalStage;
    if (status) where.status = status;
    if (leaveType) where.leaveType = leaveType;
    if (dateFrom || dateTo) {
      where.startDate = {};
      if (dateFrom) where.startDate[Op.gte] = dateFrom;
      if (dateTo) where.startDate[Op.lte] = dateTo;
    }
    return db.LeaveRequest.findAndCountAll({
      where,
      include: [...includeUsers, ...includeTemplate],
      order: [["createdAt", "DESC"]],
      limit: size,
      offset: (page - 1) * size,
    });
  }

  findById(id: string, businessId: string) {
    return db.LeaveRequest.findOne({
      where: { id, businessId },
      include: [...includeUsers, ...includeTemplate],
    });
  }

  create(data: any) {
    return db.LeaveRequest.create(data);
  }

  async update(id: string, businessId: string, data: any) {
    const rec = await db.LeaveRequest.findOne({ where: { id, businessId } });
    if (!rec) throw new Error("Leave request not found");
    return rec.update(data);
  }
}
