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

    const employeeRecord = await db.EmployeeRecord.findOne({
      where: { businessId: user.businessId, userId: user.id },
      attributes: ["employmentType", "employmentStatus"],
    });

    const roles = (fullUser.Roles || []).map((r: any) => r.key);
    const permissionsSet = new Set<string>();
    (fullUser.Roles || []).forEach((r: any) => (r.Permissions || []).forEach((p: any) => permissionsSet.add(p.key)));
    ["attendance.self", "profiles.self", "performance.self", "project.self", "project.task"].forEach((key) => permissionsSet.add(key));

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
        employmentType: employeeRecord?.employmentType || null,
        employmentStatus: employeeRecord?.employmentStatus || null,
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

    const [profile, employeeRecord] = await Promise.all([
      db.BusinessUserProfile.findOne({
        where: { businessId: user.businessId, userId: user.id },
        attributes: ["departmentId", "positionId"],
        include: [
          { model: db.Department, as: "department", attributes: ["id", "name"] },
          { model: db.Position, as: "position", attributes: ["id", "title"] },
        ],
      }),
      db.EmployeeRecord.findOne({
        where: { businessId: user.businessId, userId: user.id },
        attributes: ["departmentId", "positionId", "employmentType", "employmentStatus"],
        include: [
          { model: db.Department, as: "department", attributes: ["id", "name"] },
          { model: db.Position, as: "position", attributes: ["id", "title"] },
        ],
      }),
    ]);

    const roles = (user.Roles || []).map((r: any) => r.key);
    const permissionsSet = new Set<string>();
    (user.Roles || []).forEach((r: any) => (r.Permissions || []).forEach((p: any) => permissionsSet.add(p.key)));
    ["attendance.self", "profiles.self", "performance.self", "project.self", "project.task"].forEach((key) => permissionsSet.add(key));
    const department = (profile as any)?.department || (employeeRecord as any)?.department || null;
    const position = (profile as any)?.position || (employeeRecord as any)?.position || null;

    return ok(res, {
      user: {
        id: user.id,
        businessId: user.businessId,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        status: user.status,
        employmentType: employeeRecord?.employmentType || null,
        employmentStatus: employeeRecord?.employmentStatus || null,
        isPlatformSuperAdmin: Boolean(user.isPlatformSuperAdmin) || roles.includes("PLATFORM_SUPER_ADMIN"),
        lastLoginAt: user.lastLoginAt
      },
      profile: {
        department: department ? { id: department.id, name: department.name } : null,
        position: position ? { id: position.id, title: position.title } : null,
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

  /**
   * PUBLIC SELF-REGISTRATION
   * POST /api/v1/auth/public-register
   *
   * Gate conditions (all enforced server-side):
   *   1. Business found by slug
   *   2. BusinessSetting `public_registration_enabled` is true
   *   3. Current time is within the window defined by
   *      `public_registration_open_from` and `public_registration_open_until`
   *   4. Email not already taken for that business
   *
   * New user is created with status "pending" (unless `auto_approve_registration`
   * is true). HR can approve pending users in the admin panel.
   */
  publicRegister = async (req: any, res: any, next: any) => {
    try {
      const {
        businessSlug, fullName, email, password, phone,
        // Personal info
        dateOfBirth, nationalId, address, city, country,
        zipCode, gender, maritalStatus, nationality,
        // Work info
        departmentId, positionId, hireDate, employmentType, internPaymentType, requestedRoleKey,
        // Emergency contact
        emergencyName, emergencyPhone, emergencyRelationship,
        // Bank / optional
        bankName, bankAccount,
      } = req.body;
      const normalizedEmail = normalizeEmail(email);
      const isIntern = employmentType === 'intern';
      const askInternPaymentType = internPaymentType === 'paid' || internPaymentType === 'unpaid';
      const normalizedInternPaymentType = isIntern && internPaymentType === 'paid' ? 'paid' : 'unpaid';
      const bankDetails = (!isIntern || (askInternPaymentType && normalizedInternPaymentType === 'paid')) && (bankName || bankAccount)
        ? [{ bankName: bankName || 'Awash Bank', accountNumber: bankAccount || null }]
        : [];

      // 1. Resolve business by slug
      const business = await db.Business.findOne({ where: { slug: businessSlug } });
      if (!business) return next({ statusCode: 404, message: "Registration link not found" });
      const businessId = business.id;

      // 2. Load public-registration settings — order by updatedAt DESC so the most
      //    recently saved value wins (guards against any surviving duplicate rows)
      const latestSetting = async (key: string) =>
        db.BusinessSetting.findOne({
          where: { businessId, key },
          order: [['updatedAt', 'DESC']],
        });

      const [enabledSetting, fromSetting, untilSetting, autoSetting] = await Promise.all([
        latestSetting('public_registration_enabled'),
        latestSetting('public_registration_open_from'),
        latestSetting('public_registration_open_until'),
        latestSetting('auto_approve_registration'),
      ]);

      const enabled = enabledSetting?.value === true || enabledSetting?.value?.enabled === true;
      if (!enabled) return next({ statusCode: 403, message: "Self-registration is not currently enabled for this company" });

      // 3. Check time window
      const now = new Date();
      if (fromSetting?.value) {
        const from = new Date(fromSetting.value as string);
        if (now < from) return next({ statusCode: 403, message: "Registration window has not opened yet" });
      }
      if (untilSetting?.value) {
        const until = new Date(untilSetting.value as string);
        if (now > until) return next({ statusCode: 403, message: "Registration window has closed" });
      }

      // 4. Validate requested role — block admin-level roles
      const BLOCKED_ROLES = ['BUSINESS_ADMIN', 'PLATFORM_SUPER_ADMIN'];
      if (requestedRoleKey && BLOCKED_ROLES.includes(String(requestedRoleKey).toUpperCase())) {
        return next({ statusCode: 403, message: "Cannot self-register with this role" });
      }

      // 5. Check duplicate
      const existing = await db.User.findOne({ where: { businessId, email: normalizedEmail } });
      if (existing) return next({ statusCode: 409, message: "An account with this email already exists" });

      // 6. Create user
      const autoApprove = autoSetting?.value === true || autoSetting?.value?.enabled === true;
      const hashed = await bcrypt.hash(password, env.bcryptSaltRounds);
      // Generate a unique registration token for the resubmit link
      const crypto = require('crypto');
      const registrationToken = crypto.randomBytes(48).toString('hex');
      const user = await db.User.create({
        businessId,
        fullName,
        email: normalizedEmail,
        password: hashed,
        phone: phone || null,
        status: autoApprove ? 'active' : 'pending',
        isPlatformSuperAdmin: false,
        registrationToken: autoApprove ? null : registrationToken,
      });

      // 7. Save ID document files if uploaded (front + back)
      const saveIdFile = async (file: Express.Multer.File, side: 'front' | 'back'): Promise<string | null> => {
        try {
          const fs     = require('fs');
          const path   = require('path');
          const crypto = require('crypto');
          const ext      = path.extname(file.originalname) || '.bin';
          const safeName = crypto.randomBytes(16).toString('hex') + `_${side}` + ext;
          const uploadDir  = path.join(process.cwd(), 'uploads', businessId, 'identity_docs');
          if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
          const storagePath = path.join(uploadDir, safeName);
          fs.writeFileSync(storagePath, file.buffer);

          const asset = await db.FileAsset.create({
            businessId,
            uploadedByUserId: user.id,
            originalName:    file.originalname,
            storedName:      safeName,
            mimeType:        file.mimetype,
            sizeBytes:       file.size,
            storageProvider: 'local',
            storagePath,
            status:          'active',
            metadata:        { documentType: 'identity_document', side, selfRegistered: true },
          });

          await db.EntityAttachment.create({
            businessId,
            fileAssetId:    asset.id,
            entityType:     'business_user_profile',
            entityId:       user.id,
            moduleKey:      'profiles',
            attachmentType: `identity_document_${side}`,
          }).catch(() => null);

          return `/uploads/${businessId}/identity_docs/${safeName}`;
        } catch (fileErr) {
          console.error(`[PublicRegister] Failed to save ID document (${side}):`, fileErr);
          return null;
        }
      };

      const uploadedFiles = (req as any).files as Record<string, Express.Multer.File[]> | undefined;
      const frontFile = uploadedFiles?.['idDocumentFront']?.[0];
      const backFile  = uploadedFiles?.['idDocumentBack']?.[0];

      const idDocumentFrontUrl = frontFile ? await saveIdFile(frontFile, 'front') : null;
      const idDocumentBackUrl  = backFile  ? await saveIdFile(backFile,  'back')  : null;
      // Keep a single idDocumentUrl pointing to the front for backwards compatibility
      const idDocumentUrl = idDocumentFrontUrl;

      // 7b. Create BusinessUserProfile with full employee metadata
      const emergencyContact = (emergencyName || emergencyPhone) ? {
        firstName:    emergencyName?.split(' ')[0]  ?? null,
        lastName:     emergencyName?.split(' ').slice(1).join(' ') ?? null,
        phone:        emergencyPhone        ?? null,
        email:        null,
        relationship: emergencyRelationship ?? null,
        city:         null,
        country:      null,
      } : null;

      await db.BusinessUserProfile.upsert({
        businessId,
        userId:         user.id,
        departmentId:   departmentId   || null,
        positionId:     positionId     || null,
        workEmail:      normalizedEmail,
        workPhone:      phone          || null,
        employmentType: employmentType || null,
        joinedAt:       hireDate       ? new Date(hireDate) : null,
        status:         autoApprove ? 'active' : 'pending',
        settings: {
          fullName,
          email:            normalizedEmail,
          phone:            phone            || null,
          address:          address          || null,
          city:             city             || null,
          country:          country          || null,
          zipCode:          zipCode          || null,
          gender:           gender           || null,
          maritalStatus:    maritalStatus    || null,
          nationality:      nationality      || null,
          dateOfBirth:      dateOfBirth      || null,
          selfRegistered:   true,
          requestedRoleKey: requestedRoleKey || null,
          internPaymentType: isIntern ? normalizedInternPaymentType : null,
        },
      });

      // 8. Create EmployeeRecord with full info
      await db.EmployeeRecord.create({
        businessId,
        userId:           user.id,
        employeeCode:     `SR-${String(user.id).slice(0, 8).toUpperCase()}`,
        departmentId:     departmentId   || null,
        positionId:       positionId     || null,
        employmentType:   employmentType || 'full_time',
        employmentStatus: 'active',
        hireDate:         hireDate || new Date().toISOString().slice(0, 10),
        salaryInfo:       {},
        emergencyContact: emergencyContact ?? {},
        metadata: {
          dateOfBirth:        dateOfBirth    || null,
          nationalId:         nationalId     || null,
          idDocumentUrl:      idDocumentUrl  || null,
          idDocumentFrontUrl: idDocumentFrontUrl || null,
          idDocumentBackUrl:  idDocumentBackUrl  || null,
          address:            address        || null,
          city:               city           || null,
          country:            country        || null,
          zipCode:            zipCode        || null,
          gender:             gender         || null,
          maritalStatus:      maritalStatus  || null,
          nationality:        nationality    || null,
          bankDetails,
          internship:         isIntern ? { stipendType: normalizedInternPaymentType } : undefined,
          selfRegistered:     true,
          requestedRoleKey:   requestedRoleKey || null,
        },
      }).catch(() => null); // Non-fatal if EmployeeRecord creation fails (e.g. missing required fields)

      // 9. Assign requested role if specified and auto-approve is on
      if (requestedRoleKey && autoApprove) {
        const role = await db.Role.findOne({
          where: { key: String(requestedRoleKey).toUpperCase(), businessId: null }, // global roles
        });
        if (role) await user.setRoles([role]).catch(() => null);
      }

      if (autoApprove) {
        const token = signAccessToken(user);
        const refreshToken = signRefreshToken(user);
        return ok(res, {
          autoApproved: true,
          user: { id: user.id, businessId, fullName: user.fullName, email: user.email },
          accessToken: token,
          refreshToken,
        }, 'Account created and activated.', 201);
      }

      return ok(res, {
        autoApproved: false,
        userId: user.id,
        message: 'Your account has been created and is pending approval by HR. You will be notified once activated.',
      }, 'Registration submitted.', 201);
    } catch (e: any) { return next({ statusCode: 500, message: e.message }); }
  };

  /**
   * GET /api/v1/auth/public-register/:businessSlug/resubmit/:token
   * Returns pre-filled form data for a previously rejected registration.
   * Used when HR rejects and the user clicks the resubmit link from email.
   */
  publicGetResubmitData = async (req: any, res: any, next: any) => {
    try {
      const { businessSlug, token } = req.params;
      const business = await db.Business.findOne({ where: { slug: businessSlug }, attributes: ['id', 'name'] });
      if (!business) return next({ statusCode: 404, message: 'Business not found' });

      const user = await db.User.findOne({
        where: { businessId: business.id, registrationToken: token, status: 'rejected' },
        attributes: ['id', 'fullName', 'email', 'phone', 'rejectionReason'],
        include: [
          {
            model: db.BusinessUserProfile,
            as: 'BusinessUserProfile',
            attributes: ['settings', 'departmentId', 'positionId', 'employmentType', 'joinedAt'],
            include: [
              { model: db.Department, as: 'department', attributes: ['id', 'name'] },
              { model: db.Position,   as: 'position',   attributes: ['id', 'title'] },
            ],
          },
          {
            model: db.EmployeeRecord,
            attributes: ['metadata', 'emergencyContact', 'departmentId', 'positionId', 'employmentType', 'hireDate'],
            required: false,
            limit: 1,
            order: [['createdAt', 'DESC']],
          },
        ],
      });
      if (!user) return next({ statusCode: 404, message: 'Invalid or expired resubmit link' });

      const profile      = (user as any).BusinessUserProfile;
      const settings     = profile?.settings ?? {};
      const empRecord    = (user as any).EmployeeRecords?.[0] ?? (user as any).EmployeeRecord ?? null;
      const empMeta      = empRecord?.metadata      ?? {};
      const emergency    = empRecord?.emergencyContact ?? {};
      const bankDetails  = empMeta.bankDetails?.[0]    ?? {};

      // Reconstruct emergency name from first/last stored in EmployeeRecord.emergencyContact
      const emergencyName = [emergency.firstName, emergency.lastName].filter(Boolean).join(' ') || '';

      return ok(res, {
        userId: user.id,
        prefill: {
          // Step 1 — Account (email editable, no password)
          fullName:              user.fullName,
          email:                 user.email,
          phone:                 settings.phone         || user.phone || '',

          // Step 2 — Personal
          dateOfBirth:           settings.dateOfBirth   || empMeta.dateOfBirth   || '',
          gender:                settings.gender        || empMeta.gender        || '',
          maritalStatus:         settings.maritalStatus || empMeta.maritalStatus || '',
          nationality:           settings.nationality   || empMeta.nationality   || '',
          address:               settings.address       || empMeta.address       || '',
          city:                  settings.city          || empMeta.city          || '',
          country:               settings.country       || empMeta.country       || '',
          zipCode:               settings.zipCode       || empMeta.zipCode       || '',
          // ID docs
          idDocumentFrontUrl:    empMeta.idDocumentFrontUrl || empMeta.idDocumentUrl || null,
          idDocumentBackUrl:     empMeta.idDocumentBackUrl  || null,

          // Step 3 — Work
          requestedRoleKey:      settings.requestedRoleKey    || empMeta.requestedRoleKey || 'EMPLOYEE',
          employmentType:        profile?.employmentType       || empRecord?.employmentType || 'full_time',
          hireDate:              profile?.joinedAt
                                   ? new Date(profile.joinedAt).toISOString().slice(0, 10)
                                   : empRecord?.hireDate
                                   ? new Date(empRecord.hireDate).toISOString().slice(0, 10)
                                   : '',
          departmentId:          profile?.departmentId  || empRecord?.departmentId  || '',
          departmentName:        profile?.department?.name || '',
          positionId:            profile?.positionId    || empRecord?.positionId    || '',
          positionTitle:         profile?.position?.title   || '',

          // Step 4 — Emergency contact
          emergencyName:         emergencyName,
          emergencyPhone:        emergency.phone        || '',
          emergencyRelationship: emergency.relationship || '',

          // Step 4 — Bank
          bankName:              bankDetails.bankName     || '',
          bankAccount:           bankDetails.accountNumber || '',
        },
        rejectionReason: user.rejectionReason || '',
      });
    } catch (e: any) { return next({ statusCode: 500, message: e.message }); }
  };

  /**
   * POST /api/v1/auth/public-register/resubmit/:token
   * Re-submission after rejection. Updates the pending user record and sets status back to pending.
   */
  publicResubmit = async (req: any, res: any, next: any) => {
    try {
      const { token } = req.params;
      const {
        businessSlug, fullName, email, password, phone,
        dateOfBirth, gender, maritalStatus, nationality,
        address, city, country, zipCode, requestedRoleKey, employmentType, internPaymentType, hireDate,
        departmentId, positionId, emergencyName, emergencyPhone, emergencyRelationship,
        bankName, bankAccount,
      } = req.body;

      const business = await db.Business.findOne({ where: { slug: businessSlug }, attributes: ['id'] });
      if (!business) return next({ statusCode: 404, message: 'Business not found' });
      const isIntern = employmentType === 'intern';
      const askInternPaymentType = internPaymentType === 'paid' || internPaymentType === 'unpaid';
      const normalizedInternPaymentType = isIntern && internPaymentType === 'paid' ? 'paid' : 'unpaid';
      const bankDetails = (!isIntern || (askInternPaymentType && normalizedInternPaymentType === 'paid')) && (bankName || bankAccount)
        ? [{ bankName: bankName || 'Awash Bank', accountNumber: bankAccount || null }]
        : [];

      const user = await db.User.findOne({
        where: { businessId: business.id, registrationToken: token, status: 'rejected' },
      });
      if (!user) return next({ statusCode: 404, message: 'Invalid or expired resubmit token' });

      const BLOCKED_ROLES = ['BUSINESS_ADMIN', 'PLATFORM_SUPER_ADMIN'];
      if (requestedRoleKey && BLOCKED_ROLES.includes(String(requestedRoleKey).toUpperCase())) {
        return next({ statusCode: 403, message: 'Cannot self-register with this role' });
      }

      // Build user update — password only changed if provided and meets min length
      const userUpdate: any = {
        fullName: fullName || user.fullName,
        phone:    phone    || user.phone,
        status:   'pending',
        rejectionReason: null,
        rejectedAt:      null,
      };

      if (email && email.trim()) {
        userUpdate.email = normalizeEmail(email.trim());
      }

      if (password && password.length >= 8) {
        userUpdate.password = await bcrypt.hash(password, env.bcryptSaltRounds);
      }

      await user.update(userUpdate);

      // Save ID docs if new ones uploaded
      const saveIdFile = async (file: Express.Multer.File, side: 'front' | 'back'): Promise<string | null> => {
        try {
          const fs = require('fs');
          const path = require('path');
          const crypto = require('crypto');
          const businessId = business.id;
          const ext = path.extname(file.originalname) || '.bin';
          const safeName = crypto.randomBytes(16).toString('hex') + `_${side}` + ext;
          const uploadDir = path.join(process.cwd(), 'uploads', businessId, 'identity_docs');
          if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
          const storagePath = path.join(uploadDir, safeName);
          fs.writeFileSync(storagePath, file.buffer);
          await db.FileAsset.create({
            businessId,
            uploadedByUserId: user.id,
            originalName: file.originalname,
            storedName: safeName,
            mimeType: file.mimetype,
            sizeBytes: file.size,
            storageProvider: 'local',
            storagePath,
            status: 'active',
            metadata: { documentType: 'identity_document', side, resubmitted: true },
          });
          return `/uploads/${businessId}/identity_docs/${safeName}`;
        } catch { return null; }
      };

      const uploadedFiles = (req as any).files as Record<string, Express.Multer.File[]> | undefined;
      const frontFile = uploadedFiles?.['idDocumentFront']?.[0];
      const backFile  = uploadedFiles?.['idDocumentBack']?.[0];
      const idDocumentFrontUrl = frontFile ? await saveIdFile(frontFile, 'front') : null;
      const idDocumentBackUrl  = backFile  ? await saveIdFile(backFile,  'back')  : null;

      // Update profile settings
      const emergencyContact = (emergencyName || emergencyPhone) ? {
        firstName:    emergencyName?.split(' ')[0]  ?? null,
        lastName:     emergencyName?.split(' ').slice(1).join(' ') ?? null,
        phone:        emergencyPhone        ?? null,
        relationship: emergencyRelationship ?? null,
      } : null;

      const existingProfile = await db.BusinessUserProfile.findOne({ where: { userId: user.id } });
      const prevSettings = existingProfile?.settings ?? {};

      await db.BusinessUserProfile.upsert({
        businessId: business.id,
        userId: user.id,
        departmentId: departmentId || null,
        positionId: positionId || null,
        workPhone: phone || null,
        employmentType: employmentType || null,
        joinedAt: hireDate ? new Date(hireDate) : null,
        status: 'pending',
        settings: {
          ...prevSettings,
          fullName: fullName || prevSettings.fullName,
          phone:          phone            || null,
          address:        address          || null,
          city:           city             || null,
          country:        country          || null,
          zipCode:        zipCode          || null,
          gender:         gender           || null,
          maritalStatus:  maritalStatus    || null,
          nationality:    nationality      || null,
          dateOfBirth:    dateOfBirth      || null,
          requestedRoleKey: requestedRoleKey || null,
          internPaymentType: isIntern ? normalizedInternPaymentType : null,
          resubmitted: true,
        },
      });

      // Update employee record metadata
      await db.EmployeeRecord.update(
        {
          departmentId: departmentId || null,
          positionId: positionId || null,
          employmentType: employmentType || undefined,
          hireDate: hireDate ? new Date(hireDate) : undefined,
          emergencyContact: emergencyContact ?? {},
          metadata: db.sequelize.fn('jsonb_set_deep', {} as any), // updated below
        },
        { where: { userId: user.id } }
      ).catch(() => null);

      // Simpler direct find+update for metadata
      const empRecord = await db.EmployeeRecord.findOne({ where: { userId: user.id } });
      if (empRecord) {
        const prevMeta = empRecord.metadata ?? {};
        await empRecord.update({
          departmentId: departmentId || empRecord.departmentId,
          positionId: positionId || empRecord.positionId,
          employmentType: employmentType || empRecord.employmentType,
          hireDate: hireDate ? new Date(hireDate) : empRecord.hireDate,
          emergencyContact: emergencyContact ?? empRecord.emergencyContact,
          metadata: {
            ...prevMeta,
            dateOfBirth:        dateOfBirth    || prevMeta.dateOfBirth,
            idDocumentFrontUrl: idDocumentFrontUrl || prevMeta.idDocumentFrontUrl,
            idDocumentBackUrl:  idDocumentBackUrl  || prevMeta.idDocumentBackUrl,
            address:            address        || prevMeta.address,
            city:               city           || prevMeta.city,
            country:            country        || prevMeta.country,
            zipCode:            zipCode        || prevMeta.zipCode,
            gender:             gender         || prevMeta.gender,
            maritalStatus:      maritalStatus  || prevMeta.maritalStatus,
            nationality:        nationality    || prevMeta.nationality,
            bankDetails:        isIntern ? bankDetails : (bankDetails.length ? bankDetails : prevMeta.bankDetails || []),
            internship:         isIntern ? { ...(prevMeta.internship || {}), stipendType: normalizedInternPaymentType } : prevMeta.internship,
            requestedRoleKey:   requestedRoleKey || prevMeta.requestedRoleKey,
            resubmitted: true,
          },
        });
      }

      return ok(res, { resubmitted: true }, 'Application resubmitted for review.', 200);
    } catch (e: any) { return next({ statusCode: 500, message: e.message }); }
  };

  /**
   * GET /api/v1/auth/public-register/:businessSlug/config
   * Returns public-safe registration window info for the frontend to display.
   */

  /**
   * GET /api/v1/auth/public-register/:businessSlug/roles
   * Lists roles available for self-registration (excludes BUSINESS_ADMIN and PLATFORM_SUPER_ADMIN).
   * Returns global system roles plus any custom business roles.
   */
  publicListRoles = async (req: any, res: any, next: any) => {
    try {
      const business = await db.Business.findOne({ where: { slug: req.params.businessSlug }, attributes: ['id'] });
      if (!business) return next({ statusCode: 404, message: 'Business not found' });

      const BLOCKED_ROLE_KEYS = ['BUSINESS_ADMIN', 'PLATFORM_SUPER_ADMIN'];
      const { Op } = require('sequelize');

      // Fetch global system roles + business-specific roles, excluding admin roles
      const roles = await db.Role.findAll({
        where: {
          [Op.or]: [
            { businessId: null },        // global/system roles
            { businessId: business.id }, // business-specific roles
          ],
          key: { [Op.notIn]: BLOCKED_ROLE_KEYS },
          deletedAt: null,
        },
        attributes: ['key', 'name', 'description'],
        order: [['name', 'ASC']],
      });

      return ok(res, { roles: roles.map((r: any) => ({ key: r.key, label: r.name, description: r.description })) });
    } catch (e: any) { return next({ statusCode: 500, message: e.message }); }
  };

  /**
   * GET /api/v1/auth/public-register/:businessSlug/departments
   * List departments for a business (public, no auth required).
   */
  publicListDepartments = async (req: any, res: any, next: any) => {
    try {
      const business = await db.Business.findOne({ where: { slug: req.params.businessSlug }, attributes: ['id'] });
      if (!business) return next({ statusCode: 404, message: 'Business not found' });
      const q = req.query.q as string | undefined;
      const where: any = { businessId: business.id, status: 'active' };
      if (q) {
        const { Op } = require('sequelize');
        where.name = { [Op.iLike]: `%${q}%` };
      }
      const rows = await db.Department.findAll({ where, attributes: ['id', 'name'], order: [['name', 'ASC']], limit: 1000 });
      return ok(res, { departments: rows });
    } catch (e: any) { return next({ statusCode: 500, message: e.message }); }
  };

  /**
   * POST /api/v1/auth/public-register/:businessSlug/departments
   * Create a new department suggestion (public). Creates with status 'pending' for HR review.
   */
  publicCreateDepartment = async (req: any, res: any, next: any) => {
    try {
      const business = await db.Business.findOne({ where: { slug: req.params.businessSlug }, attributes: ['id'] });
      if (!business) return next({ statusCode: 404, message: 'Business not found' });
      const { name } = req.body;
      if (!name?.trim()) return next({ statusCode: 400, message: 'Department name is required' });
      const { Op } = require('sequelize');
      const existing = await db.Department.findOne({
        where: { businessId: business.id, name: { [Op.iLike]: name.trim() } },
        attributes: ['id', 'name'],
      });
      if (existing) return ok(res, { department: existing, existed: true });
      // Auto-generate key from name (slug-style)
      const key = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || `dept_${Date.now()}`;
      const dept = await db.Department.create({ businessId: business.id, name: name.trim(), key, status: 'active' });
      return ok(res, { department: { id: dept.id, name: dept.name }, existed: false }, 'Department created', 201);
    } catch (e: any) { return next({ statusCode: 500, message: e.message }); }
  };

  /**
   * GET /api/v1/auth/public-register/:businessSlug/positions
   * List positions for a business (public, no auth required).
   */
  publicListPositions = async (req: any, res: any, next: any) => {
    try {
      const business = await db.Business.findOne({ where: { slug: req.params.businessSlug }, attributes: ['id'] });
      if (!business) return next({ statusCode: 404, message: 'Business not found' });
      const q = req.query.q as string | undefined;
      const where: any = { businessId: business.id, status: 'active' };
      if (q) {
        const { Op } = require('sequelize');
        where.title = { [Op.iLike]: `%${q}%` };
      }
      const rows = await db.Position.findAll({ where, attributes: ['id', 'title', 'departmentId'], order: [['title', 'ASC']], limit: 1000 });
      return ok(res, { positions: rows });
    } catch (e: any) { return next({ statusCode: 500, message: e.message }); }
  };

  /**
   * POST /api/v1/auth/public-register/:businessSlug/positions
   * Create a new position suggestion (public).
   */
  publicCreatePosition = async (req: any, res: any, next: any) => {
    try {
      const business = await db.Business.findOne({ where: { slug: req.params.businessSlug }, attributes: ['id'] });
      if (!business) return next({ statusCode: 404, message: 'Business not found' });
      const { title, departmentId } = req.body;
      if (!title?.trim()) return next({ statusCode: 400, message: 'Position title is required' });
      const { Op } = require('sequelize');
      const existing = await db.Position.findOne({
        where: { businessId: business.id, title: { [Op.iLike]: title.trim() } },
        attributes: ['id', 'title'],
      });
      if (existing) return ok(res, { position: existing, existed: true });
      // Auto-generate key; departmentId required by schema — use provided or find/create a "General" dept
      const key = title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || `pos_${Date.now()}`;
      let resolvedDeptId = departmentId || null;
      if (!resolvedDeptId) {
        // Find or create a catch-all "General" department
        let genDept = await db.Department.findOne({ where: { businessId: business.id, key: 'general' } });
        if (!genDept) {
          genDept = await db.Department.create({ businessId: business.id, name: 'General', key: 'general', status: 'active' });
        }
        resolvedDeptId = genDept.id;
      }
      const pos = await db.Position.create({ businessId: business.id, departmentId: resolvedDeptId, title: title.trim(), key, status: 'active' });
      return ok(res, { position: { id: pos.id, title: pos.title }, existed: false }, 'Position created', 201);
    } catch (e: any) { return next({ statusCode: 500, message: e.message }); }
  };

  getPublicRegistrationConfig = async (req: any, res: any, next: any) => {
    try {
      const business = await db.Business.findOne({
        where: { slug: req.params.businessSlug },
        attributes: ['id', 'name', 'slug'],
      });
      if (!business) return next({ statusCode: 404, message: 'Not found' });
      const businessId = business.id;

      const [enabledS, fromS, untilS, autoS, askInternPaymentS] = await Promise.all([
        db.BusinessSetting.findOne({ where: { businessId, key: 'public_registration_enabled' } }),
        db.BusinessSetting.findOne({ where: { businessId, key: 'public_registration_open_from' } }),
        db.BusinessSetting.findOne({ where: { businessId, key: 'public_registration_open_until' } }),
        db.BusinessSetting.findOne({ where: { businessId, key: 'auto_approve_registration' } }),
        db.BusinessSetting.findOne({ where: { businessId, key: 'public_registration_ask_intern_payment_type' } }),
      ]);

      const enabled   = enabledS?.value === true || enabledS?.value?.enabled === true;
      const openFrom  = fromS?.value  as string | null ?? null;
      const openUntil = untilS?.value as string | null ?? null;
      const autoApprove = autoS?.value === true || autoS?.value?.enabled === true;
      const askInternPaymentType = askInternPaymentS?.value !== false;

      const now = new Date();
      let isOpen = enabled;
      if (enabled && openFrom  && now < new Date(openFrom))  isOpen = false;
      if (enabled && openUntil && now > new Date(openUntil)) isOpen = false;

      return ok(res, {
        businessName: business.name,
        businessSlug: business.slug,
        enabled,
        isOpen,
        openFrom,
        openUntil,
        autoApprove,
        askInternPaymentType,
      });
    } catch (e: any) { return next({ statusCode: 500, message: e.message }); }
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
