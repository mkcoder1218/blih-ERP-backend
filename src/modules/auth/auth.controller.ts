import bcrypt from "bcrypt";
import { env } from "../../config/env";
import { db } from "../../models";
import { signAccessToken, signRefreshToken } from "../../utils/jwt";
import { ok } from "../../utils/apiResponse";
import jwt from "jsonwebtoken";
import { normalizeEmail } from "../../utils/normalizeEmail";
import { Op } from "sequelize";
import { profileImageUrl } from "../../middlewares/profileImageUpload";
import { FileService } from "../file/file.service";

export class AuthController {
  private fileService = new FileService();

  register = async (req: any, res: any, next: any) => {
    const { businessId, fullName, email, password, phone, departmentId, positionId, address } = req.body;
    const normalizedEmail = normalizeEmail(email);

    const business = await db.Business.findByPk(businessId);
    if (!business) return next({ statusCode: 404, message: "Business not found" });

    const existing = await db.User.findOne({ where: { businessId, email: normalizedEmail } });
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

    const profileImage = Array.isArray(req.files?.profileImage) ? req.files.profileImage[0] : req.file;
    const [profile] = await db.BusinessUserProfile.upsert({
      businessId,
      userId: user.id,
      departmentId: departmentId || null,
      positionId: positionId || null,
      workEmail: normalizedEmail,
      workPhone: phone || null,
      status: "active",
      settings: {
        fullName,
        email: normalizedEmail,
        phone: phone || null,
        address: address || null,
        profileImageUrl: profileImageUrl(profileImage)
      }
    });

    const documents = Array.isArray(req.files?.documents) ? req.files.documents : [];
    for (const doc of documents) {
      const asset = await this.fileService.saveAssetRecord(businessId, user.id, doc, { profileId: profile.id, documentType: "employee_document" });
      await db.EntityAttachment.create({
        businessId,
        fileAssetId: asset.id,
        entityType: "business_user_profile",
        entityId: profile.id,
        moduleKey: "profiles",
        attachmentType: "employee_document"
      });
    }

    const count = await db.User.count({ where: { businessId } });
    const businessAdminRole = await db.Role.findOne({ where: { businessId: null, key: "BUSINESS_ADMIN" } });
    if (businessAdminRole && count === 1) {
      await user.setRoles([businessAdminRole]);
    }

    const token = signAccessToken(user);
    const refreshToken = signRefreshToken(user);
    return ok(
      res,
      {
        user: { id: user.id, businessId: user.businessId, fullName: user.fullName, email: user.email },
        accessToken: token,
        refreshToken
      },
      "Registered",
      201
    );
  };

  login = async (req: any, res: any, next: any) => {
    const { email, password } = req.body;
    const normalizedEmail = normalizeEmail(email);

    const matches = await db.User.findAll({
      where: db.sequelize.where(db.sequelize.fn("lower", db.sequelize.col("User.email")), normalizedEmail),
      include: [{ model: db.Business, attributes: ["id", "name", "slug", "status"] }]
    });
    if (!matches.length) return next({ statusCode: 401, message: "Invalid credentials" });

    // If there's a platform super admin user for this email, allow login without workspace selection.
    const platformCandidate = matches.find((u: any) => Boolean(u.isPlatformSuperAdmin));
    if (platformCandidate) {
      return this.finishLoginForUser(platformCandidate, password, res, next);
    }

    if (matches.length > 1) {
      // Validate password against any one active user; if none match, reject.
      let anyValid = false;
      for (const u of matches) {
        if (u.deletedAt || u.status !== "active") continue;
        // eslint-disable-next-line no-await-in-loop
        if (await bcrypt.compare(password, u.password)) {
          anyValid = true;
          break;
        }
      }
      if (!anyValid) return next({ statusCode: 401, message: "Invalid credentials" });

      const businesses = matches
        .map((u: any) => u.Business)
        .filter(Boolean)
        .map((b: any) => ({ id: b.id, name: b.name, slug: b.slug, status: b.status }));

      return ok(res, { requiresWorkspaceSelection: true, businesses }, "Select workspace");
    }

    return this.finishLoginForUser(matches[0], password, res, next);
  };

  selectWorkspace = async (req: any, res: any, next: any) => {
    const { businessId, email, password } = req.body;
    const normalizedEmail = normalizeEmail(email);
    const user = await db.User.findOne({
      where: {
        businessId,
        [Op.and]: [db.sequelize.where(db.sequelize.fn("lower", db.sequelize.col("User.email")), normalizedEmail)]
      }
    });
    if (!user) return next({ statusCode: 401, message: "Invalid credentials" });
    return this.finishLoginForUser(user, password, res, next);
  };

  private finishLoginForUser = async (user: any, password: string, res: any, next: any) => {
    if (user.deletedAt) return next({ statusCode: 403, message: "User is deleted" });
    if (user.status !== "active") return next({ statusCode: 403, message: "User is not active" });

    const okPass = await bcrypt.compare(password, user.password);
    if (!okPass) return next({ statusCode: 401, message: "Invalid credentials" });

    await user.update({ lastLoginAt: new Date() });

    const token = signAccessToken(user);
    const refreshToken = signRefreshToken(user);

    // Build same payload shape as /me
    const fullUser = await db.User.findByPk(user.id, {
      attributes: ["id", "businessId", "fullName", "email", "phone", "status", "isPlatformSuperAdmin", "lastLoginAt", "createdAt", "updatedAt"],
      include: [
        { model: db.Business, attributes: ["id", "name", "slug", "email", "phone", "status", "planId", "createdAt", "updatedAt"] },
        {
          model: db.Role,
          through: { attributes: [] },
          include: [{ model: db.Permission, through: { attributes: [] } }]
        }
      ]
    });

    const enabledModules = await db.BusinessModule.findAll({
      where: { businessId: user.businessId, status: "active" },
      attributes: ["moduleKey", "moduleName", "status", "enabledAt"]
    });

    const roles = (fullUser.Roles || []).map((r: any) => r.key);
    const permissionsSet = new Set<string>();
    (fullUser.Roles || []).forEach((r: any) => (r.Permissions || []).forEach((p: any) => permissionsSet.add(p.key)));

    return ok(res, {
      accessToken: token,
      refreshToken,
      user: {
        id: fullUser.id,
        businessId: fullUser.businessId,
        fullName: fullUser.fullName,
        email: fullUser.email,
        phone: fullUser.phone,
        status: fullUser.status,
        isPlatformSuperAdmin: Boolean(fullUser.isPlatformSuperAdmin) || roles.includes("PLATFORM_SUPER_ADMIN"),
        lastLoginAt: fullUser.lastLoginAt
      },
      business: (fullUser as any).Business || null,
      roles,
      permissions: Array.from(permissionsSet),
      enabledModules
    }, "Logged in");
  };

  me = async (req: any, res: any, next: any) => {
    if (!req.user?.id) return next({ statusCode: 401, message: "Unauthorized" });

    const user = await db.User.findByPk(req.user.id, {
      attributes: ["id", "businessId", "fullName", "email", "phone", "status", "isPlatformSuperAdmin", "lastLoginAt", "createdAt", "updatedAt"],
      include: [
        { model: db.Business, attributes: ["id", "name", "slug", "email", "phone", "status", "planId", "createdAt", "updatedAt"] },
        {
          model: db.Role,
          through: { attributes: [] },
          include: [{ model: db.Permission, through: { attributes: [] } }]
        }
      ]
    });

    if (!user) return next({ statusCode: 401, message: "Invalid user" });
    if (user.deletedAt) return next({ statusCode: 403, message: "User is deleted" });
    if (user.status !== "active") return next({ statusCode: 403, message: "User is not active" });

    const enabledModules = await db.BusinessModule.findAll({
      where: { businessId: user.businessId, status: "active" },
      attributes: ["moduleKey", "moduleName", "status", "enabledAt"]
    });

    const roles = (user.Roles || []).map((r: any) => r.key);
    const permissionsSet = new Set<string>();
    (user.Roles || []).forEach((r: any) => (r.Permissions || []).forEach((p: any) => permissionsSet.add(p.key)));

    return ok(res, {
      user: {
        id: user.id,
        businessId: user.businessId,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        status: user.status,
        isPlatformSuperAdmin: Boolean(user.isPlatformSuperAdmin) || roles.includes("PLATFORM_SUPER_ADMIN"),
        lastLoginAt: user.lastLoginAt
      },
      business: (user as any).Business || null,
      roles,
      permissions: Array.from(permissionsSet),
      enabledModules
    });
  };

  logout = async (_req: any, res: any) => {
    // Stateless JWT: frontend should drop token.
    return ok(res, { ok: true }, "Logged out");
  };

  refresh = async (req: any, res: any, next: any) => {
    const { refreshToken } = req.body || {};
    if (!refreshToken) return next({ statusCode: 400, message: "Missing refreshToken" });

    try {
      const decoded = jwt.verify(refreshToken, env.jwtRefreshSecret) as any;
      if (decoded?.type !== "refresh") return next({ statusCode: 401, message: "Invalid refresh token" });

      const userId = decoded.sub;
      const user = await db.User.findByPk(userId);
      if (!user) return next({ statusCode: 401, message: "Invalid refresh token" });
      if (user.deletedAt) return next({ statusCode: 403, message: "User is deleted" });
      if (user.status !== "active") return next({ statusCode: 403, message: "User is not active" });

      const accessToken = signAccessToken(user);
      const newRefreshToken = signRefreshToken(user);
      return ok(res, { accessToken, refreshToken: newRefreshToken }, "Refreshed");
    } catch {
      return next({ statusCode: 401, message: "Invalid refresh token" });
    }
  };
}
