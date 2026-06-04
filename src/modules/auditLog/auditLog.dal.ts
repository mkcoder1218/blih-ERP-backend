import { Op } from "sequelize";
import { db } from "../../models";

export interface AuditLogFilters {
  businessId?: string;
  userId?: string;
  action?: string;
  entityType?: string;
  category?: string;
  search?: string;    // fulltext search on entityType, action, entityId
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  size?: number;
}

export class AuditLogDAL {
  async findPaginated(filters: AuditLogFilters) {
    const {
      businessId,
      userId,
      action,
      entityType,
      category,
      search,
      dateFrom,
      dateTo,
      page = 1,
      size = 20,
    } = filters;

    const where: any = {};

    if (businessId) where.businessId = businessId;
    if (userId) where.userId = userId;
    if (action) where.action = action;
    if (entityType) where.entityType = entityType;
    if (category) where.category = category;

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt[Op.gte] = new Date(dateFrom);
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        where.createdAt[Op.lte] = end;
      }
    }

    if (search) {
      where[Op.or] = [
        { entityType: { [Op.iLike]: `%${search}%` } },
        { action: { [Op.iLike]: `%${search}%` } },
        { entityId: { [Op.iLike]: `%${search}%` } },
        { ipAddress: { [Op.iLike]: `%${search}%` } },
        { deviceInfo: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const offset = (page - 1) * size;

    return db.AuditLog.findAndCountAll({
      where,
      order: [["createdAt", "DESC"]],
      limit: size,
      offset,
      include: [
        {
          model: db.User,
          as: undefined,
          attributes: ["id", "fullName", "email"],
          required: false,
        },
        {
          model: db.Business,
          as: undefined,
          attributes: ["id", "name", "slug"],
          required: false,
        },
      ],
    });
  }

  findById(id: string) {
    return db.AuditLog.findByPk(id, {
      include: [
        {
          model: db.User,
          attributes: ["id", "fullName", "email"],
          required: false,
        },
        {
          model: db.Business,
          attributes: ["id", "name", "slug"],
          required: false,
        },
      ],
    });
  }
}
