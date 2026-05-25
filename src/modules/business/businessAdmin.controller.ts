import bcrypt from "bcrypt";
import type { Request, Response, NextFunction } from "express";
import { env } from "../../config/env";
import { db } from "../../models";
import { ok } from "../../utils/apiResponse";
import { normalizeEmail } from "../../utils/normalizeEmail";
import { Op } from "sequelize";

export class BusinessAdminController {
  createBusinessAdmin = async (req: Request, res: Response, next: NextFunction) => {
    const { businessId } = req.params as any;
    const { fullName, email, phone, password } = req.body as any;
    const normalizedEmail = normalizeEmail(email);

    const business = await db.Business.findByPk(businessId);
    if (!business) return next({ statusCode: 404, message: "Business not found" });

    const existing = await db.User.findOne({
      where: {
        businessId,
        [Op.and]: [db.sequelize.where(db.sequelize.fn("lower", db.sequelize.col("User.email")), normalizedEmail)]
      }
    });
    if (existing) return next({ statusCode: 409, message: "Email already exists" });

    const hashed = await bcrypt.hash(password, env.bcryptSaltRounds);
    const user = await db.User.create({
      businessId,
      fullName,
      email: normalizedEmail,
      password: hashed,
      phone: phone || null,
      status: "active",
      isPlatformSuperAdmin: false
    });

    const businessAdminRole =
      (await db.Role.findOne({ where: { businessId, key: "BUSINESS_ADMIN" } })) ||
      (await db.Role.findOne({ where: { businessId: null, key: "BUSINESS_ADMIN" } }));

    if (businessAdminRole) {
      await user.setRoles([businessAdminRole]);
    }

    return ok(
      res,
      { user: { id: user.id, businessId: user.businessId, fullName: user.fullName, email: user.email, phone: user.phone, status: user.status } },
      "Business admin created",
      201
    );
  };
}
