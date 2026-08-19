import bcrypt from "bcrypt";
import { env } from "../../config/env";
import { Op } from "sequelize";
import { db } from "../../models";
import { UserDAL } from "./user.dal";
import { normalizeEmail } from "../../utils/normalizeEmail";

export class UserService {
  private dal: UserDAL;

  constructor() {
    this.dal = new UserDAL();
  }

  list(businessId: string, search: string = "", page: number = 1, size: number = 20, permission: string = "") {
    const offset = (page - 1) * size;
    const where: any = { businessId };
    const options: any = {
      attributes: { exclude: ["password"] },
      offset,
      limit: size,
      order: [["createdAt", "DESC"]]
    };

    if (search) {
      where[Op.or] = [
        { fullName: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } }
      ];
    }

    if (permission) {
      options.distinct = true;
      options.include = [
        {
          model: db.Role,
          required: true,
          through: { attributes: [] },
          include: [{
            model: db.Permission,
            required: true,
            where: { key: permission },
            through: { attributes: [] }
          }]
        }
      ];
    }

    return this.dal.findAndCount(where, options);
  }

  getById(id: string, businessId: string) {
    return db.User.findOne({
      where: { id, businessId },
      attributes: { exclude: ["password"] },
      include: [{ model: db.Role }]
    });
  }

  async create(requester: any, data: any) {
    const businessId = requester.isPlatformSuperAdmin ? (data.businessId || requester.businessId) : requester.businessId;
    const hashed = await bcrypt.hash(data.password, env.bcryptSaltRounds);

    const user = await db.User.create({
      businessId,
      fullName: data.fullName,
      email: normalizeEmail(data.email),
      password: hashed,
      phone: data.phone || null,
      status: data.status || "active",
      isPlatformSuperAdmin: requester.isPlatformSuperAdmin ? Boolean(data.isPlatformSuperAdmin) : false
    });

    if (data.roleKeys && data.roleKeys.length) {
      const roles = await db.Role.findAll({ where: { key: data.roleKeys, businessId } });
      await user.setRoles(roles);
    } else {
      const businessAdmin = await db.Role.findOne({ where: { businessId: null, key: "BUSINESS_ADMIN" } });
      if (businessAdmin) await user.setRoles([businessAdmin]);
    }

    const safe = user.toJSON();
    delete safe.password;
    return safe;
  }

  async update(id: string, requester: any, data: any) {
    const where = requester.isPlatformSuperAdmin ? { id } : { id, businessId: requester.businessId };
    const user = await db.User.findOne({ where });
    if (!user) return null;

    const update: any = { ...data };
    if (update.email) update.email = normalizeEmail(update.email);
    if (update.password) {
      update.password = await bcrypt.hash(update.password, env.bcryptSaltRounds);
    }
    if (!requester.isPlatformSuperAdmin) delete update.isPlatformSuperAdmin;

    await user.update(update);

    if (data.roleKeys) {
      const businessId = user.businessId;
      const roles = await db.Role.findAll({ where: { key: data.roleKeys, businessId } });
      await user.setRoles(roles);
    }

    const safe = user.toJSON();
    delete safe.password;
    return safe;
  }

  async getPreferences(id: string, businessId: string) {
    const user = await db.User.findOne({
      where: { id, businessId },
      attributes: ["id", "preferredLanguage"],
    });
    if (!user) return null;
    return { preferredLanguage: user.preferredLanguage || "en" };
  }

  async updatePreferences(id: string, businessId: string, data: { preferredLanguage?: string }) {
    const supportedLanguages = ["en", "am", "ti", "om"];
    const preferredLanguage = String(data.preferredLanguage || "").toLowerCase();
    if (!supportedLanguages.includes(preferredLanguage)) {
      throw new Error("Unsupported language");
    }

    const user = await db.User.findOne({ where: { id, businessId } });
    if (!user) return null;
    await user.update({ preferredLanguage });

    const safe = user.toJSON();
    delete safe.password;
    return safe;
  }

  async softDelete(id: string, requester: any) {
    const where = requester.isPlatformSuperAdmin ? { id } : { id, businessId: requester.businessId };
    const user = await db.User.findOne({ where });
    if (!user) return null;
    await user.destroy();
    return true;
  }
}
