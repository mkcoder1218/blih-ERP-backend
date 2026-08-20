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

function unique(values: string[]) {
  return Array.from(new Set(values.map(String).filter(Boolean)));
}

function generatePassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const random = crypto.randomBytes(18);
  const chars = Array.from(random, (byte) => alphabet[byte % alphabet.length]);
  return `Blih!${chars.slice(0, 6).join("")}-${chars.slice(6, 12).join("")}-${chars.slice(12, 18).join("")}`;
}

export class TesterService {
  private async testerRow(userId: string) {
    return TesterAccount.findOne({ where: { userId } });
  }

  private async requireTester(userId: string) {
    const tester = await this.testerRow(userId);
    if (!tester) fail("Tester access only.", 403);
    return tester;
  }

  private async requireMaster(userId: string) {
    const tester = await this.requireTester(userId);
    if (String(tester.testerLevel) !== "MASTER") {
      fail("Master Tester access required.", 403);
    }
    return tester;
  }

  private async availableRolesForBusiness(businessId: string) {
    return db.Role.findAll({
      where: {
        [Op.or]: [{ businessId }, { businessId: null }],
      },
      attributes: ["id", "businessId", "name", "key", "description", "domain", "isSystemRole"],
      order: [["name", "ASC"]],
    });
  }

  private async resolveRoles(businessId: string, roleKeys: string[]) {
    const keys = unique(roleKeys);
    if (!keys.length) return [];

    const roles = await db.Role.findAll({
      where: {
        key: { [Op.in]: keys },
        [Op.or]: [{ businessId }, { businessId: null }],
      },
    });

    const found = new Set(roles.map((role: any) => String(role.key)));
    const missing = keys.filter((key) => !found.has(key));
    if (missing.length) {
      fail(`Unknown role(s) for the selected business: ${missing.join(", ")}.`, 400);
    }

    return roles;
  }

  private async hydrate(tester: any) {
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

    const employee = await db.EmployeeRecord.findOne({
      where: { userId: user.id },
      attributes: ["id", "employeeCode", "departmentId", "positionId", "employmentType", "employmentStatus"],
      include: [
        { model: db.Department, as: "department", attributes: ["id", "name"], required: false },
        { model: db.Position, as: "position", attributes: ["id", "title"], required: false },
      ],
    });

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
        phone: user.phone,
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
      employee: employee
        ? {
            id: employee.id,
            employeeCode: employee.employeeCode,
            employmentType: employee.employmentType,
            employmentStatus: employee.employmentStatus,
            department: (employee as any).department || null,
            position: (employee as any).position || null,
          }
        : null,
    };
  }

  async session(userId: string) {
    const tester = await this.testerRow(userId);
    if (!tester) {
      return {
        isTestAccount: false,
        testerLevel: null,
        isMasterTester: false,
        safetyMode: null,
      };
    }

    const user = await db.User.findByPk(userId, {
      attributes: ["id", "fullName", "email", "businessId", "status", "lastLoginAt"],
      include: [{ model: db.Business, attributes: ["id", "name", "slug", "status"] }],
    });

    return {
      isTestAccount: true,
      testerLevel: tester.testerLevel,
      isMasterTester: String(tester.testerLevel) === "MASTER",
      safetyMode: tester.safetyMode,
      user: user
        ? {
            id: user.id,
            fullName: user.fullName,
            email: user.email,
            businessId: user.businessId,
            status: user.status,
            lastLoginAt: user.lastLoginAt || null,
            business: (user as any).Business || null,
          }
        : null,
    };
  }

  async list(actorUserId: string) {
    const actor = await this.requireTester(actorUserId);
    const where = String(actor.testerLevel) === "MASTER" ? {} : { userId: actorUserId };
    const rows = await TesterAccount.findAll({
      where,
      order: [
        ["testerLevel", "ASC"],
        ["createdAt", "ASC"],
      ],
    });

    const hydrated = await Promise.all(rows.map((row: any) => this.hydrate(row)));
    return hydrated.filter(Boolean);
  }

  async options(actorUserId: string) {
    const actor = await this.requireTester(actorUserId);
    const isMaster = String(actor.testerLevel) === "MASTER";

    if (!isMaster) {
      const own = await this.hydrate(actor);
      return {
        canManage: false,
        businesses: own?.user?.business ? [own.user.business] : [],
        roles: own?.user?.roles || [],
      };
    }

    const businesses = await db.Business.findAll({
      where: { status: "active" },
      attributes: ["id", "name", "slug", "status"],
      order: [["name", "ASC"]],
    });

    const roleRows = await db.Role.findAll({
      where: {
        [Op.or]: [
          { businessId: null },
          { businessId: { [Op.in]: businesses.map((business: any) => business.id) } },
        ],
      },
      attributes: ["id", "businessId", "name", "key", "description", "domain", "isSystemRole"],
      order: [["name", "ASC"]],
    });

    return {
      canManage: true,
      businesses: businesses.map((business: any) => business.toJSON()),
      roles: roleRows.map((role: any) => role.toJSON()),
    };
  }

  async create(actorUserId: string, data: any) {
    await this.requireMaster(actorUserId);

    const fullName = String(data.fullName || "").trim();
    const email = normalizeEmail(String(data.email || ""));
    const businessId = String(data.businessId || "");
    const roleKeys = Array.isArray(data.roleKeys) ? data.roleKeys.map(String) : [];
    const requestedPassword = String(data.password || "").trim();
    const temporaryPassword = requestedPassword || generatePassword();

    if (fullName.length < 2) fail("Tester name is required.");
    if (!email || !email.includes("@")) fail("A valid tester email is required.");
    if (!businessId) fail("Select a business for the tester.");
    if (!roleKeys.length) fail("Assign at least one role to the tester.");
    if (temporaryPassword.length < 10) fail("Tester password must be at least 10 characters.");

    const business = await db.Business.findOne({ where: { id: businessId, status: "active" } });
    if (!business) fail("Selected business was not found or is inactive.", 404);

    const existingEmail = await db.User.findOne({
      where: db.sequelize.where(db.sequelize.fn("lower", db.sequelize.col("email")), email),
    });
    if (existingEmail) fail("That email is already used by another account.", 409);

    const roles = await this.resolveRoles(businessId, roleKeys);
    const passwordHash = await bcrypt.hash(temporaryPassword, env.bcryptSaltRounds);
    const transaction = await db.sequelize.transaction();

    try {
      const user = await db.User.create(
        {
          businessId,
          fullName,
          email,
          password: passwordHash,
          phone: data.phone || null,
          status: "active",
          isPlatformSuperAdmin: false,
          isTestAccount: true,
        },
        { transaction },
      );

      await db.UserRole.destroy({ where: { userId: user.id }, transaction });
      for (const role of roles) {
        await db.UserRole.create({ userId: user.id, roleId: role.id }, { transaction });
      }

      const employeeCode = `TST-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;

      await db.BusinessUserProfile.create(
        {
          businessId,
          userId: user.id,
          departmentId: data.departmentId || null,
          positionId: data.positionId || null,
          employeeCode,
          workEmail: email,
          workPhone: data.phone || null,
          employmentType: "tester",
          joinedAt: new Date(),
          status: "active",
          settings: {
            isTestAccount: true,
            testAccountLabel: "TEST ACCOUNT",
          },
        },
        { transaction },
      );

      await db.EmployeeRecord.create(
        {
          businessId,
          userId: user.id,
          employeeCode,
          departmentId: data.departmentId || null,
          positionId: data.positionId || null,
          managerUserId: data.managerUserId || null,
          employmentType: "tester",
          employmentCategory: "test",
          employmentStatus: "TEST",
          hireDate: new Date(),
          salaryInfo: {},
          emergencyContact: {},
          metadata: {
            isTestAccount: true,
            excludeFromReporting: true,
            createdByMasterTesterUserId: actorUserId,
          },
        },
        { transaction },
      );

      const tester = await TesterAccount.create(
        {
          userId: user.id,
          testerLevel: "STANDARD",
          createdByTesterUserId: actorUserId,
          safetyMode: "RESTRICTED",
          notes: data.notes || null,
          metadata: {
            createdVia: "TESTER_CONTROL_CENTER",
          },
        },
        { transaction },
      );

      await transaction.commit();
      return {
        tester: await this.hydrate(tester),
        temporaryPassword,
        passwordWasGenerated: !requestedPassword,
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async update(actorUserId: string, testerUserId: string, data: any) {
    const actor = await this.requireMaster(actorUserId);
    const target = await this.requireTester(testerUserId);

    if (String(target.testerLevel) === "MASTER") {
      fail("The Master Tester account cannot be reassigned or downgraded.", 403);
    }
    if (testerUserId === actorUserId) {
      fail("The Master Tester cannot modify itself from the tester control center.", 403);
    }

    const user = await db.User.findByPk(testerUserId);
    if (!user || !user.isTestAccount) fail("Tester account not found.", 404);

    const nextBusinessId = String(data.businessId || user.businessId);
    const businessChanged = nextBusinessId !== String(user.businessId);
    const business = await db.Business.findOne({ where: { id: nextBusinessId, status: "active" } });
    if (!business) fail("Selected business was not found or is inactive.", 404);

    let roleKeys: string[] | null = null;
    if (Array.isArray(data.roleKeys)) {
      roleKeys = unique(data.roleKeys.map(String));
      if (!roleKeys.length) fail("A tester must keep at least one role.");
    } else if (businessChanged) {
      fail("Select the tester roles when changing businesses.");
    }

    const roles = roleKeys ? await this.resolveRoles(nextBusinessId, roleKeys) : null;
    const transaction = await db.sequelize.transaction();

    try {
      if (data.email !== undefined) {
        const nextEmail = normalizeEmail(String(data.email || ""));
        if (!nextEmail || !nextEmail.includes("@")) fail("A valid email is required.");
        const duplicate = await db.User.findOne({
          where: {
            id: { [Op.ne]: user.id },
            [Op.and]: [db.sequelize.where(db.sequelize.fn("lower", db.sequelize.col("email")), nextEmail)],
          },
          transaction,
        });
        if (duplicate) fail("That email is already used by another account.", 409);
        user.email = nextEmail;
      }

      if (data.fullName !== undefined) {
        const fullName = String(data.fullName || "").trim();
        if (fullName.length < 2) fail("Tester name is required.");
        user.fullName = fullName;
      }

      if (data.phone !== undefined) user.phone = data.phone || null;
      if (data.status !== undefined) {
        const status = String(data.status).toLowerCase();
        if (!["active", "disabled"].includes(status)) fail("Tester status must be active or disabled.");
        user.status = status;
      }
      user.businessId = nextBusinessId;
      user.isTestAccount = true;
      await user.save({ transaction });

      if (roles) {
        await db.UserRole.destroy({ where: { userId: user.id }, transaction });
        for (const role of roles) {
          await db.UserRole.create({ userId: user.id, roleId: role.id }, { transaction });
        }
      }

      const profile = await db.BusinessUserProfile.findOne({ where: { userId: user.id }, transaction });
      if (profile) {
        await profile.update(
          {
            businessId: nextBusinessId,
            workEmail: user.email,
            workPhone: user.phone || null,
            departmentId: businessChanged ? null : profile.departmentId,
            positionId: businessChanged ? null : profile.positionId,
            employmentType: "tester",
            status: "active",
            settings: {
              ...(profile.settings || {}),
              isTestAccount: true,
              testAccountLabel: "TEST ACCOUNT",
            },
          },
          { transaction },
        );
      }

      const employee = await db.EmployeeRecord.findOne({ where: { userId: user.id }, transaction });
      if (employee) {
        await employee.update(
          {
            businessId: nextBusinessId,
            departmentId: businessChanged ? null : employee.departmentId,
            positionId: businessChanged ? null : employee.positionId,
            managerUserId: businessChanged ? null : employee.managerUserId,
            employmentType: "tester",
            employmentCategory: "test",
            employmentStatus: "TEST",
            metadata: {
              ...(employee.metadata || {}),
              isTestAccount: true,
              excludeFromReporting: true,
            },
          },
          { transaction },
        );
      }

      if (data.notes !== undefined) target.notes = data.notes || null;
      target.safetyMode = "RESTRICTED";
      await target.save({ transaction });

      await transaction.commit();
      return this.hydrate(target);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async resetPassword(actorUserId: string, testerUserId: string, requestedPassword?: string) {
    await this.requireMaster(actorUserId);
    const target = await this.requireTester(testerUserId);
    if (String(target.testerLevel) === "MASTER") {
      fail("Use the normal account security flow to change the Master Tester password.", 403);
    }

    const password = String(requestedPassword || "").trim() || generatePassword();
    if (password.length < 10) fail("Tester password must be at least 10 characters.");

    const user = await db.User.findByPk(testerUserId);
    if (!user || !user.isTestAccount) fail("Tester account not found.", 404);

    user.password = await bcrypt.hash(password, env.bcryptSaltRounds);
    await user.save();

    return {
      tester: await this.hydrate(target),
      temporaryPassword: password,
      passwordWasGenerated: !String(requestedPassword || "").trim(),
    };
  }

  async bootstrapMaster(input: {
    fullName: string;
    email: string;
    password: string;
    businessId: string;
  }) {
    const existingMaster = await TesterAccount.findOne({ where: { testerLevel: "MASTER" } });
    if (existingMaster) return this.hydrate(existingMaster);

    const business = await db.Business.findOne({ where: { id: input.businessId, status: "active" } });
    if (!business) fail("Bootstrap business not found or inactive.", 404);

    const email = normalizeEmail(input.email);
    let user = await db.User.findOne({
      where: {
        businessId: input.businessId,
        [Op.and]: [db.sequelize.where(db.sequelize.fn("lower", db.sequelize.col("email")), email)],
      },
    });

    if (!user) {
      user = await db.User.create({
        businessId: input.businessId,
        fullName: input.fullName,
        email,
        password: await bcrypt.hash(input.password, env.bcryptSaltRounds),
        status: "active",
        isPlatformSuperAdmin: false,
        isTestAccount: true,
      });
    } else {
      await user.update({
        fullName: input.fullName,
        password: await bcrypt.hash(input.password, env.bcryptSaltRounds),
        status: "active",
        isTestAccount: true,
      });
    }

    const [tester] = await TesterAccount.findOrCreate({
      where: { userId: user.id },
      defaults: {
        userId: user.id,
        testerLevel: "MASTER",
        createdByTesterUserId: null,
        safetyMode: "RESTRICTED",
        notes: "Permanent Blih Master Tester bootstrap account.",
        metadata: { bootstrap: true },
      },
    });

    if (String(tester.testerLevel) !== "MASTER") {
      await tester.update({ testerLevel: "MASTER", safetyMode: "RESTRICTED" });
    }

    const employeeCode = `TST-MASTER-${String(user.id).slice(0, 6).toUpperCase()}`;
    await db.BusinessUserProfile.findOrCreate({
      where: { userId: user.id },
      defaults: {
        businessId: input.businessId,
        userId: user.id,
        employeeCode,
        workEmail: email,
        employmentType: "tester",
        joinedAt: new Date(),
        status: "active",
        settings: { isTestAccount: true, testAccountLabel: "MASTER TEST ACCOUNT" },
      },
    });

    await db.EmployeeRecord.findOrCreate({
      where: { userId: user.id },
      defaults: {
        businessId: input.businessId,
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
        },
      },
    });

    return this.hydrate(tester);
  }
}
