import { Op } from "sequelize";
import { db } from "../../models";

export type BrainClientListQuery = {
  page?: number | string;
  size?: number | string;
  search?: string;
  status?: "active" | "inactive";
};

export class BrainClientsService {
  private requireBusinessId(businessId?: string | null): string {
    if (!businessId) {
      const error: any = new Error("A company context is required to manage clients");
      error.statusCode = 403;
      throw error;
    }

    return businessId;
  }

  async listClients(
    businessId: string | null | undefined,
    query: BrainClientListQuery = {},
  ) {
    const scopedBusinessId = this.requireBusinessId(businessId);
    const page = Math.max(Number.parseInt(String(query.page || 1), 10) || 1, 1);
    const size = Math.min(
      Math.max(Number.parseInt(String(query.size || 20), 10) || 20, 1),
      100,
    );
    const offset = (page - 1) * size;

    const where: any = { businessId: scopedBusinessId };

    if (query.status) {
      where.status = query.status;
    }

    const search = String(query.search || "").trim();
    if (search) {
      where[Op.or] = [
        { companyName: { [Op.iLike]: `%${search}%` } },
        { contactName: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } },
        { phone: { [Op.iLike]: `%${search}%` } },
        { industry: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const { count, rows } = await db.Client.findAndCountAll({
      where,
      offset,
      limit: size,
      order: [["companyName", "ASC"], ["createdAt", "DESC"]],
      include: [
        {
          model: db.User,
          as: "accountManager",
          attributes: ["id", "fullName", "email"],
          required: false,
        },
      ],
    });

    return {
      rows,
      count,
      page,
      size,
      pages: Math.max(Math.ceil(count / size), 1),
    };
  }

  async createClient(
    businessId: string | null | undefined,
    actorUserId: string,
    payload: {
      companyName: string;
      contactName?: string | null;
      email?: string | null;
      phone?: string | null;
      industry?: string | null;
      status?: "active" | "inactive";
    },
  ) {
    const scopedBusinessId = this.requireBusinessId(businessId);
    const companyName = String(payload.companyName || "").trim();

    const duplicate = await db.Client.findOne({
      where: {
        businessId: scopedBusinessId,
        companyName: { [Op.iLike]: companyName },
      },
    });

    if (duplicate) {
      const error: any = new Error(`Client "${companyName}" already exists`);
      error.statusCode = 409;
      throw error;
    }

    const client = await db.Client.create({
      businessId: scopedBusinessId,
      accountManagerUserId: actorUserId,
      companyName,
      contactName: payload.contactName?.trim() || null,
      email: payload.email?.trim().toLowerCase() || null,
      phone: payload.phone?.trim() || null,
      industry: payload.industry?.trim() || null,
      status: payload.status || "active",
      metadata: {
        createdFrom: "brain_clients",
        createdByUserId: actorUserId,
      },
    });

    return db.Client.findOne({
      where: { id: client.id, businessId: scopedBusinessId },
      include: [
        {
          model: db.User,
          as: "accountManager",
          attributes: ["id", "fullName", "email"],
          required: false,
        },
      ],
    });
  }
}
