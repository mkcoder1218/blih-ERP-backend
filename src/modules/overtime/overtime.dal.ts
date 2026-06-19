import { Op } from "sequelize";
import { db } from "../../models";

export interface OvertimeListFilters {
  businessId: string;
  employeeUserId?: string;
  approvalStage?: string;
  status?: string;
  statusIn?: string[];
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  size?: number;
}

const userAttrs = ["id", "fullName", "email"];

const includeUsers = [
  { model: db.User, as: "employee",       attributes: userAttrs, required: false },
  { model: db.User, as: "deptHeadApprover", attributes: userAttrs, required: false },
  { model: db.User, as: "adminApprover",  attributes: userAttrs, required: false },
  { model: db.User, as: "financeApprover", attributes: userAttrs, required: false },
  { model: db.User, as: "requester", attributes: userAttrs, required: false },
  { model: db.User, as: "approver", attributes: userAttrs, required: false },
  { model: db.User, as: "closer", attributes: userAttrs, required: false },
];

export class OvertimeDAL {
  findPaginated(filters: OvertimeListFilters) {
    const { businessId, employeeUserId, approvalStage, status, statusIn, dateFrom, dateTo, page = 1, size = 20 } = filters;
    const where: any = { businessId };
    if (employeeUserId) where.employeeUserId = employeeUserId;
    if (approvalStage) where.approvalStage = approvalStage;
    if (status) where.status = status;
    if (statusIn?.length) where.status = { [Op.in]: statusIn };
    if (dateFrom || dateTo) {
      where[Op.or] = [
        {
          requestedDate: {
            ...(dateFrom ? { [Op.gte]: dateFrom } : {}),
            ...(dateTo ? { [Op.lte]: dateTo } : {}),
          },
        },
        {
          overtimeDate: {
            ...(dateFrom ? { [Op.gte]: dateFrom } : {}),
            ...(dateTo ? { [Op.lte]: dateTo } : {}),
          },
        },
      ];
    }
    return db.OvertimeRequest.findAndCountAll({
      where,
      include: includeUsers,
      order: [["createdAt", "DESC"]],
      limit: size,
      offset: (page - 1) * size,
    });
  }

  findById(id: string, businessId: string) {
    return db.OvertimeRequest.findOne({
      where: { id, businessId },
      include: includeUsers,
    });
  }

  create(data: any) {
    return db.OvertimeRequest.create(data);
  }

  findActiveForEmployeeDate(businessId: string, employeeUserId: string, requestedDate: string) {
    return db.OvertimeRequest.findOne({
      where: {
        businessId,
        employeeUserId,
        [Op.or]: [{ requestedDate }, { overtimeDate: requestedDate }],
        status: { [Op.in]: ["pending", "approved"] },
      },
    });
  }

  async update(id: string, businessId: string, data: any) {
    const rec = await db.OvertimeRequest.findOne({ where: { id, businessId } });
    if (!rec) throw new Error("Not found");
    return rec.update(data);
  }
}
