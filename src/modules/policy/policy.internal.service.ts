import { Op } from "sequelize";
import { db } from "../../models";

export interface InternalPolicyLibraryQuery {
  page?: number | string;
  size?: number | string;
  search?: string;
  categoryId?: string;
  policyType?: string;
  sortBy?: "title" | "publishedAt" | "effectiveFrom" | "updatedAt";
  sortDirection?: "ASC" | "DESC" | "asc" | "desc";
}

export class PolicyInternalService {
  private requireBusinessId(businessId?: string | null): string {
    if (!businessId) {
      const err: any = new Error("A company context is required to view the policy library");
      err.statusCode = 403;
      throw err;
    }

    return businessId;
  }

  async listPublishedCompanyPolicies(
    businessId: string | null | undefined,
    query: InternalPolicyLibraryQuery,
  ) {
    const scopedBusinessId = this.requireBusinessId(businessId);
    const page = Math.max(Number.parseInt(String(query.page || 1), 10) || 1, 1);
    const size = Math.min(Math.max(Number.parseInt(String(query.size || 20), 10) || 20, 1), 100);
    const offset = (page - 1) * size;

    const where: any = {
      businessId: scopedBusinessId,
      status: "published",
      visibility: "company",
    };

    if (query.categoryId) {
      where.categoryId = query.categoryId;
    }

    if (query.policyType) {
      where.policyType = String(query.policyType).trim().toUpperCase();
    }

    const search = String(query.search || "").trim();
    if (search) {
      where[Op.or] = [
        { title: { [Op.iLike]: `%${search}%` } },
        { summary: { [Op.iLike]: `%${search}%` } },
        { policyType: { [Op.iLike]: `%${search}%` } },
        { contentText: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const sortBy = query.sortBy || "publishedAt";
    const sortDirection = String(query.sortDirection || "DESC").toUpperCase() === "ASC" ? "ASC" : "DESC";

    const { count, rows } = await db.Policy.findAndCountAll({
      where,
      attributes: [
        "id",
        "categoryId",
        "policyType",
        "title",
        "slug",
        "summary",
        "version",
        "versionLabel",
        "status",
        "visibility",
        "confidentialityLevel",
        "isRequired",
        "requiresAcceptance",
        "requiresSignature",
        "appliesToAllEmployees",
        "effectiveFrom",
        "effectiveUntil",
        "publishedAt",
        "updatedAt",
      ],
      include: [
        {
          model: db.PolicyCategory,
          as: "category",
          attributes: ["id", "name", "key"],
          required: false,
        },
      ],
      order: [[sortBy, sortDirection], ["title", "ASC"]],
      limit: size,
      offset,
    });

    return {
      rows,
      count,
      page,
      size,
      pages: Math.max(Math.ceil(count / size), 1),
    };
  }

  async getPublishedCompanyPolicy(
    businessId: string | null | undefined,
    policyId: string,
  ) {
    const scopedBusinessId = this.requireBusinessId(businessId);

    const policy = await db.Policy.findOne({
      where: {
        id: policyId,
        businessId: scopedBusinessId,
        status: "published",
        visibility: "company",
      },
      include: [
        {
          model: db.PolicyCategory,
          as: "category",
          attributes: ["id", "name", "key"],
          required: false,
        },
        {
          model: db.User,
          as: "owner",
          attributes: ["id", "fullName"],
          required: false,
        },
      ],
    });

    if (!policy) {
      const err: any = new Error("Published company policy not found");
      err.statusCode = 404;
      throw err;
    }

    return policy;
  }
}
