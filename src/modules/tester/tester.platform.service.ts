import bcrypt from "bcrypt";
import crypto from "crypto";
import { Op } from "sequelize";
import { env } from "../../config/env";
import { db } from "../../models";
import { normalizeEmail } from "../../utils/normalizeEmail";
import { TesterAccount } from "./tester.models";

function fail(message: string, statusCode = 400): never {
  throw Object.assign(new Error(message), { statusCode });
}

function generatePassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const random = crypto.randomBytes(18);
  const chars = Array.from(random, (byte) => alphabet[byte % alphabet.length]);
  return `Blih!${chars.slice(0, 6).join("")}-${chars.slice(6, 12).join("")}-${chars.slice(12, 18).join("")}`;
}

export class PlatformMasterTesterService {
  private async requirePlatformAdmin(actorUserId: string) {
    const actor = await db.User.findByPk(actorUserId, {
      attributes: ["id", "status", "isPlatformSuperAdmin"],
      include: [
        {
          model: db.Role,
          through: { attributes: [] },
          attributes: ["key"],
        },
      ],
    });

    if (!actor || actor.status !== "active") {
      fail("Platform Admin account not found or inactive.", 403);
    }

    const roleKeys = new Set(
      (((actor as any).Roles || []) as any[]).map((role) => String(role.key)),
    );
    const isPlatformAdmin =
      Boolean(actor.isPlatformSuperAdmin) || roleKeys.has("PLATFORM_SUPER_ADMIN");

    if (!isPlatformAdmin) {
      fail("Platform Super Admin access required.", 403);
    }

    return actor;
  }

  private async hydrateMaster(tester: any) {
    const user = await db.User.findByPk(tester.userId, {
      attributes: [
        "id",
        "businessId",
        "fullName",
        "email",
        "phone",
        "status",
        "isTestAccount",
        "lastLoginAt",
        "createdAt",
        "updatedAt",
      ],
      include: [
        { model: db.Business, attributes: ["id", "name", "slug", "status"] },
        {
          model: db.Role,
          through: { attributes: [] },
          attributes: ["id", "businessId", "name", "key", "domain", "isSystemRole"],
        },
      ],
    });

    if (!user) return null;

    return {
      id: tester.id,
      userId: user.id,
      testerLevel: tester.testerLevel,
      safetyMode: tester.safetyMode,
      notes: tester.notes || null,
      createdByTesterUserId: tester.createdByTesterUserId || null,
      metadata: tester.metadata || {},
      createdAt: tester.createdAt,
      updatedAt: tester.updatedAt,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone || null,
        status: user.status,
        businessId: user.businessId,
        business: (user as any).Business || null,
        roles: ((user as any).Roles || []).map((role: any) => ({
          id: role.id,
          key: role.key,
          name: role.name,
          domain: role.domain || null,
          businessId: role.businessId || null,
        })),
        lastLoginAt: user.lastLoginAt || null,
        createdAt: user.createdAt,
      },
      employee: null,
    };
  }

  async options(actorUserId: string) {
    await this.requirePlatformAdmin(actorUserId);

    const businesses = await db.Business.findAll({
      where: { status: "active" },
      attributes: ["id", "name", "slug", "status"],
      order: [["name", "ASC"]],
    });

    return {
      businesses: businesses.map((business: any) => business.toJSON()),
    };
  }

  async list(actorUserId: string) {
    await this.requirePlatformAdmin(actorUserId);

    const rows = await TesterAccount.findAll({
      where: { testerLevel: "MASTER" },
      order: [["createdAt", "ASC"]],
    });

    const hydrated = await Promise.all(rows.map((row: any) => this.hydrateMaster(row)));
    return hydrated.filter(Boolean);
  }

  async create(actorUserId: string, data: any) {
    await this.requirePlatformAdmin(actorUserId);

    const fullName = String(data.fullName || "").trim();
    const email = normalizeEmail(String(data.email || ""));
    const businessId = String(data.businessId || "");
    const phone = String(data.phone || "").trim() || null;
    const notes = String(data.notes || "").trim() || null;
    const requestedPassword = String(data.password || "").trim();
    const temporaryPassword = requestedPassword || generatePassword();

    if (fullName.length < 2) fail("Master Tester name is required.");
    if (!email || !email.includes("@")) fail("A valid Master Tester email is required.");
    if (!businessId) fail("Select a business for the Master Tester.");
    if (temporaryPassword.length < 10) {
      fail("Master Tester password must be at least 10 characters.");
    }

    const business = await db.Business.findOne({
      where: { id: businessId, status: "active" },
    });
    if (!business) fail("Selected business was not found or is inactive.", 404);

    const existingEmail = await db.User.findOne({
      where: db.sequelize.where(
        db.sequelize.fn("lower", db.sequelize.col("email")),
        email,
      ),
    });
    if (existingEmail) fail("That email is already used by another account.", 409);

    const businessAdminRole =
      (await db.Role.findOne({ where: { businessId, key: "BUSINESS_ADMIN" } })) ||
      (await db.Role.findOne({ where: { businessId: null, key: "BUSINESS_ADMIN" } }));

    if (!businessAdminRole) {
      fail(
        "BUSINESS_ADMIN role is not configured. Seed system roles before creating a Master Tester.",
        409,
      );
    }

    const passwordHash = await bcrypt.hash(temporaryPassword, env.bcryptSaltRounds);
    const transaction = await db.sequelize.transaction();

    try {
      const user = await db.User.create(
        {
          businessId,
          fullName,
          email,
          password: passwordHash,
          phone,
          status: "active",
          isPlatformSuperAdmin: false,
          isTestAccount: true,
        },
        { transaction },
      );

      await db.UserRole.create(
        { userId: user.id, roleId: businessAdminRole.id },
        { transaction },
      );

      const employeeCode = `TST-M-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;

      await db.BusinessUserProfile.create(
        {
          businessId,
          userId: user.id,
          employeeCode,
          workEmail: email,
          workPhone: phone,
          employmentType: "tester",
          joinedAt: new Date(),
          status: "active",
          settings: {
            isTestAccount: true,
            testAccountLabel: "MASTER TEST ACCOUNT",
          },
        },
        { transaction },
      );

      await db.EmployeeRecord.create(
        {
          businessId,
          userId: user.id,
          employeeCode,
          employmentType: "tester",
          employmentCategory: "test",
          employmentStatus: "TEST",
          hireDate: new Date(),
          salaryInfo: {},
          emergencyContact: {},
          metadata: {
            isTestAccount: true,
            excludeFromReporting: true,
            masterTester: true,
            createdByPlatformAdminUserId: actorUserId,
          },
        },
        { transaction },
      );

      const tester = await TesterAccount.create(
        {
          userId: user.id,
          testerLevel: "MASTER",
          createdByTesterUserId: null,
          safetyMode: "RESTRICTED",
          notes,
          metadata: {
            createdVia: "PLATFORM_ADMIN",
            createdByPlatformAdminUserId: actorUserId,
          },
        },
        { transaction },
      );

      await transaction.commit();

      return {
        tester: await this.hydrateMaster(tester),
        temporaryPassword,
        passwordWasGenerated: !requestedPassword,
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
}
