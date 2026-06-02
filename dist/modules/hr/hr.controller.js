"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HRController = void 0;
const hr_service_1 = require("./hr.service");
const response_1 = require("../../utils/response");
const models_1 = require("../../models");
const offerLetterRenderer_1 = require("../../utils/offerLetterRenderer");
const offerLetterPdfGenerator_1 = require("../../utils/offerLetterPdfGenerator");
const offerLetterMailer_1 = require("../../utils/offerLetterMailer");
class HRController {
    constructor() {
        this.service = new hr_service_1.HRService();
        // Seed hook
        this.seedTemplates = async (req, res) => {
            await this.service.provisionTemplates(req.user.businessId);
            (0, response_1.successResponse)(res, null, "Templates seeded successfully");
        };
        // Record Endpoints
        this.getRecord = async (req, res) => {
            try {
                // Target requested
                const targetUserId = req.params.userId || req.user.id;
                const bId = req.user.businessId;
                const rec = await this.service.getRecord(bId, targetUserId);
                if (!rec)
                    return (0, response_1.errorResponse)(res, "Record not found", 404);
                // Security Validation (Salary filtering)
                const isSelf = req.user.id === rec.userId;
                const canSeeSalary = req.user.roles.some((r) => ['SUPER_ADMIN', 'BUSINESS_ADMIN', 'HR_MANAGER'].includes(r));
                const payload = rec.toJSON();
                if (!canSeeSalary) {
                    delete payload.salaryInfo;
                }
                // Must be self, HR manager, admin, or department head
                if (!isSelf && !canSeeSalary) {
                    // Lock
                }
                (0, response_1.successResponse)(res, { employeeRecord: payload });
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        this.listRecords = async (req, res) => {
            try {
                const limit = Number(req.query.limit || 20);
                const offset = Number(req.query.offset || 0);
                const departmentId = req.query.departmentId;
                const q = { businessId: req.user.businessId };
                if (departmentId)
                    q.departmentId = departmentId;
                const result = await this.service.listRecords(q, limit, offset);
                const rowsWithFilteredSalaries = result.rows.map((r) => {
                    const j = r.toJSON();
                    const canSeeSalary = req.user.roles.some((role) => ['SUPER_ADMIN', 'BUSINESS_ADMIN', 'HR_MANAGER'].includes(role));
                    if (!canSeeSalary)
                        delete j.salaryInfo;
                    return j;
                });
                (0, response_1.paginationResponse)(res, rowsWithFilteredSalaries, result.count, offset / limit + 1, limit);
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        this.updateSelfRecord = async (req, res) => {
            try {
                const updates = { ...req.body };
                delete updates.salaryInfo;
                delete updates.departmentId;
                delete updates.positionId;
                delete updates.managerUserId;
                delete updates.employmentStatus;
                delete updates.employmentType;
                const rec = await this.service.getRecord(req.user.businessId, req.user.id);
                if (!rec)
                    return (0, response_1.errorResponse)(res, "No record mapped");
                const u = await this.service.updateRecord(rec.id, req.user.businessId, updates);
                (0, response_1.successResponse)(res, { employeeRecord: u });
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        this.updateEmployeeRecord = async (req, res) => {
            const transaction = await models_1.db.sequelize.transaction();
            try {
                const businessId = req.user.businessId;
                const targetUserId = req.params.userId;
                const { account, profile, uploads } = req.body || {};
                const rec = await this.service.getRecord(businessId, targetUserId);
                if (!rec) {
                    await transaction.rollback();
                    return (0, response_1.errorResponse)(res, "Record not found", 404);
                }
                if (account) {
                    const user = await models_1.db.User.findOne({ where: { id: targetUserId, businessId }, transaction });
                    if (!user) {
                        await transaction.rollback();
                        return (0, response_1.errorResponse)(res, "User not found", 404);
                    }
                    if (account.email && account.email !== user.email) {
                        const existing = await models_1.db.User.findOne({ where: { email: account.email, businessId }, transaction });
                        if (existing && existing.id !== user.id) {
                            await transaction.rollback();
                            return (0, response_1.errorResponse)(res, "Email already in use", 400);
                        }
                    }
                    const updateUser = {};
                    if (account.firstName !== undefined || account.lastName !== undefined) {
                        const parts = (user.fullName || "").trim().split(/\s+/).filter(Boolean);
                        const currentFirst = parts.length > 1 ? parts.slice(0, -1).join(" ") : parts[0] || "";
                        const currentLast = parts.length > 1 ? parts.slice(-1).join(" ") : "";
                        const nextFirst = (account.firstName ?? currentFirst ?? "").toString().trim();
                        const nextLast = (account.lastName ?? currentLast ?? "").toString().trim();
                        const nextFull = `${nextFirst} ${nextLast}`.trim();
                        if (nextFull)
                            updateUser.fullName = nextFull;
                    }
                    if (account.email !== undefined && account.email !== "")
                        updateUser.email = account.email;
                    if (account.phone !== undefined)
                        updateUser.phone = account.phone || null;
                    if (account.password) {
                        const bcrypt = require("bcrypt");
                        updateUser.password = await bcrypt.hash(account.password, 10);
                    }
                    if (Object.keys(updateUser).length > 0) {
                        await user.update(updateUser, { transaction });
                    }
                }
                if (profile || uploads !== undefined) {
                    const recordUpdates = {};
                    if (profile) {
                        if (profile.employeeCode !== undefined)
                            recordUpdates.employeeCode = profile.employeeCode || rec.employeeCode;
                        if (profile.departmentId !== undefined)
                            recordUpdates.departmentId = profile.departmentId || null;
                        if (profile.positionId !== undefined)
                            recordUpdates.positionId = profile.positionId || null;
                        if (profile.reportingTo !== undefined)
                            recordUpdates.managerUserId = profile.reportingTo || null;
                        if (profile.employmentType !== undefined)
                            recordUpdates.employmentType = profile.employmentType || null;
                        if (profile.startDate !== undefined)
                            recordUpdates.hireDate = profile.startDate || rec.hireDate;
                        if (profile.probationPeriod !== undefined) {
                            const months = Number(profile.probationPeriod || 0);
                            recordUpdates.probationEndDate = months
                                ? new Date(Date.now() + 1000 * 60 * 60 * 24 * 30 * months)
                                : null;
                        }
                        if (profile.monthlySalary !== undefined || profile.salaryCurrency !== undefined) {
                            recordUpdates.salaryInfo = {
                                ...(rec.salaryInfo || {}),
                                ...(profile.monthlySalary !== undefined ? { baseSalary: profile.monthlySalary } : {}),
                                ...(profile.salaryCurrency !== undefined ? { currency: profile.salaryCurrency || "ETB" } : {}),
                            };
                        }
                        const emergencyProvided = profile.emergencyFirstName !== undefined ||
                            profile.emergencyLastName !== undefined ||
                            profile.emergencyPhone !== undefined ||
                            profile.emergencyEmail !== undefined ||
                            profile.emergencyCity !== undefined ||
                            profile.emergencyCountry !== undefined;
                        if (emergencyProvided) {
                            recordUpdates.emergencyContact = {
                                ...(rec.emergencyContact || {}),
                                ...(profile.emergencyFirstName !== undefined ? { firstName: profile.emergencyFirstName } : {}),
                                ...(profile.emergencyLastName !== undefined ? { lastName: profile.emergencyLastName } : {}),
                                ...(profile.emergencyPhone !== undefined ? { phone: profile.emergencyPhone } : {}),
                                ...(profile.emergencyEmail !== undefined ? { email: profile.emergencyEmail } : {}),
                                ...(profile.emergencyCity !== undefined ? { city: profile.emergencyCity } : {}),
                                ...(profile.emergencyCountry !== undefined ? { country: profile.emergencyCountry } : {}),
                            };
                        }
                        const metadataUpdates = { ...(rec.metadata || {}) };
                        if (profile.dateOfBirth !== undefined)
                            metadataUpdates.dateOfBirth = profile.dateOfBirth;
                        if (profile.city !== undefined)
                            metadataUpdates.city = profile.city;
                        if (profile.countryOfBirth !== undefined)
                            metadataUpdates.countryOfBirth = profile.countryOfBirth;
                        if (profile.additionalPhone !== undefined)
                            metadataUpdates.additionalPhone = profile.additionalPhone;
                        if (profile.branch !== undefined)
                            metadataUpdates.branch = profile.branch;
                        if (profile.bankDetails !== undefined)
                            metadataUpdates.bankDetails = profile.bankDetails || [];
                        if (profile.assetsAndCredentials !== undefined)
                            metadataUpdates.assetsAndCredentials = profile.assetsAndCredentials || [];
                        if (profile.additionalNotes !== undefined)
                            metadataUpdates.additionalNotes = profile.additionalNotes;
                        if (uploads !== undefined) {
                            const currentUploads = (rec.metadata || {}).uploads || {};
                            metadataUpdates.uploads = { ...(currentUploads || {}), ...(uploads || {}) };
                        }
                        recordUpdates.metadata = metadataUpdates;
                    }
                    else if (uploads !== undefined) {
                        const currentUploads = (rec.metadata || {}).uploads || {};
                        recordUpdates.metadata = { ...(rec.metadata || {}), uploads: { ...(currentUploads || {}), ...(uploads || {}) } };
                    }
                    if (Object.keys(recordUpdates).length > 0) {
                        await rec.update(recordUpdates, { transaction });
                    }
                    const businessProfile = await models_1.db.BusinessUserProfile.findOne({ where: { businessId, userId: targetUserId }, transaction });
                    if (businessProfile) {
                        const bpUpdates = {};
                        if (profile?.employeeCode !== undefined)
                            bpUpdates.employeeCode = profile.employeeCode || businessProfile.employeeCode;
                        if (profile?.departmentId !== undefined)
                            bpUpdates.departmentId = profile.departmentId || null;
                        if (profile?.positionId !== undefined)
                            bpUpdates.positionId = profile.positionId || null;
                        if (account?.email !== undefined && account.email !== "")
                            bpUpdates.workEmail = account.email;
                        if (account?.phone !== undefined)
                            bpUpdates.workPhone = account.phone || null;
                        if (profile?.employmentType !== undefined)
                            bpUpdates.employmentType = profile.employmentType || null;
                        if (profile?.startDate !== undefined)
                            bpUpdates.joinedAt = profile.startDate || businessProfile.joinedAt;
                        if (profile?.systemRole !== undefined) {
                            const settings = { ...(businessProfile.settings || {}) };
                            settings.systemRole = this.normalizeSystemRoleKey(profile.systemRole);
                            bpUpdates.settings = settings;
                        }
                        if (Object.keys(bpUpdates).length > 0)
                            await businessProfile.update(bpUpdates, { transaction });
                    }
                }
                if (profile?.systemRole !== undefined) {
                    const systemRoleKey = this.normalizeSystemRoleKey(profile.systemRole);
                    const targetUser = await models_1.db.User.findOne({
                        where: { id: targetUserId, businessId },
                        include: [{ model: models_1.db.Role, through: { attributes: [] } }],
                        transaction
                    });
                    if (targetUser) {
                        const nextRole = (await models_1.db.Role.findOne({ where: { businessId, key: systemRoleKey }, transaction })) ||
                            (await models_1.db.Role.findOne({ where: { businessId: null, key: systemRoleKey }, transaction }));
                        if (nextRole) {
                            const systemRoleKeys = [
                                "HR_MANAGER",
                                "FINANCE_MANAGER",
                                "CRM_MANAGER",
                                "PROJECT_MANAGER",
                                "DEPARTMENT_HEAD",
                                "EMPLOYEE",
                                "CLIENT"
                            ];
                            const existingRoles = (targetUser.Roles || []);
                            const preservedRoles = existingRoles.filter((r) => !systemRoleKeys.includes(r.key));
                            const merged = [...preservedRoles, nextRole];
                            const byId = new Map();
                            for (const r of merged)
                                byId.set(r.id, r);
                            await targetUser.setRoles(Array.from(byId.values()), { transaction });
                        }
                    }
                }
                await transaction.commit();
                (0, response_1.successResponse)(res, { employeeRecord: rec });
            }
            catch (e) {
                await transaction.rollback();
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        this.onboardEmployee = async (req, res) => {
            const transaction = await models_1.db.sequelize.transaction();
            try {
                const { account, profile, uploads, offerLetterTemplateId } = req.body;
                const businessId = req.user.businessId;
                if (!account || !account.email || !account.password || !account.firstName || !account.lastName) {
                    await transaction.rollback();
                    return (0, response_1.errorResponse)(res, "Account info missing (email, password, firstName, lastName)", 400);
                }
                // 1. Manage User Account (check soft-deleted users too)
                let targetUser = await models_1.db.User.findOne({ where: { email: account.email, businessId }, transaction });
                if (!targetUser) {
                    // Check if user was previously soft-deleted
                    const deletedUser = await models_1.db.User.findOne({ where: { email: account.email, businessId }, transaction, paranoid: false });
                    if (deletedUser) {
                        // Restore the soft-deleted user
                        await deletedUser.restore({ transaction });
                        const bcrypt = require('bcrypt');
                        const hash = await bcrypt.hash(account.password, 10);
                        await deletedUser.update({
                            fullName: `${account.firstName} ${account.lastName}`,
                            password: hash,
                            phone: account.phone || null,
                            status: 'inactive'
                        }, { transaction });
                        targetUser = deletedUser;
                    }
                    else {
                        const bcrypt = require('bcrypt');
                        const hash = await bcrypt.hash(account.password, 10);
                        targetUser = await models_1.db.User.create({
                            id: require('crypto').randomUUID(),
                            businessId,
                            fullName: `${account.firstName} ${account.lastName}`,
                            email: account.email,
                            password: hash,
                            phone: account.phone || null,
                            status: 'inactive'
                        }, { transaction });
                    }
                }
                // 2. Manage Employee Profile
                const empRec = await this.service.getRecord(businessId, targetUser.id);
                if (empRec) {
                    await transaction.rollback();
                    return (0, response_1.errorResponse)(res, "Employee record already exists for this user", 400);
                }
                // Ensure the user's system role is reflected in auth (/me) by syncing Roles.
                {
                    const systemRoleKey = this.normalizeSystemRoleKey(profile?.systemRole);
                    const role = (await models_1.db.Role.findOne({ where: { businessId, key: systemRoleKey }, transaction })) ||
                        (await models_1.db.Role.findOne({ where: { businessId: null, key: systemRoleKey }, transaction })) ||
                        (await models_1.db.Role.findOne({ where: { businessId, key: "EMPLOYEE" }, transaction })) ||
                        (await models_1.db.Role.findOne({ where: { businessId: null, key: "EMPLOYEE" }, transaction }));
                    if (role) {
                        await targetUser.setRoles([role], { transaction });
                    }
                }
                const recordData = {
                    businessId,
                    userId: targetUser.id,
                    employeeCode: profile.employeeCode || `EMP-${Date.now().toString().slice(-4)}`,
                    departmentId: profile.departmentId || null,
                    positionId: profile.positionId || null,
                    managerUserId: profile.reportingTo || null,
                    employmentType: profile.employmentType || 'full_time',
                    employmentStatus: 'onboarding',
                    hireDate: profile.startDate || new Date(),
                    probationEndDate: profile.probationPeriod ? new Date(Date.now() + 1000 * 60 * 60 * 24 * 30 * parseInt(profile.probationPeriod)) : null,
                    salaryInfo: {
                        baseSalary: profile.monthlySalary,
                        currency: profile.salaryCurrency || 'ETB'
                    },
                    emergencyContact: {
                        firstName: profile.emergencyFirstName, lastName: profile.emergencyLastName,
                        phone: profile.emergencyPhone, email: profile.emergencyEmail,
                        city: profile.emergencyCity, country: profile.emergencyCountry
                    },
                    metadata: {
                        dateOfBirth: profile.dateOfBirth, city: profile.city, countryOfBirth: profile.countryOfBirth,
                        additionalPhone: profile.additionalPhone, branch: profile.branch,
                        bankDetails: profile.bankDetails || [], assetsAndCredentials: profile.assetsAndCredentials || [],
                        additionalNotes: profile.additionalNotes, uploads: uploads || {}
                    }
                };
                // Check for soft-deleted employee record and restore it
                let newRecord;
                const deletedEmpRec = await models_1.db.EmployeeRecord.findOne({ where: { userId: targetUser.id, businessId }, transaction, paranoid: false });
                if (deletedEmpRec) {
                    await deletedEmpRec.restore({ transaction });
                    await deletedEmpRec.update(recordData, { transaction });
                    newRecord = deletedEmpRec;
                }
                else {
                    newRecord = await models_1.db.EmployeeRecord.create(recordData, { transaction });
                }
                // 3. Create or restore Business User Profile link
                const deletedProfile = await models_1.db.BusinessUserProfile.findOne({ where: { userId: targetUser.id, businessId }, transaction, paranoid: false });
                if (deletedProfile) {
                    if (deletedProfile.deletedAt)
                        await deletedProfile.restore({ transaction });
                    await deletedProfile.update({
                        employeeCode: recordData.employeeCode,
                        departmentId: recordData.departmentId,
                        positionId: recordData.positionId,
                        workEmail: account.email,
                        workPhone: account.phone,
                        employmentType: recordData.employmentType,
                        joinedAt: recordData.hireDate
                    }, { transaction });
                }
                else {
                    await models_1.db.BusinessUserProfile.create({
                        businessId,
                        userId: targetUser.id,
                        employeeCode: recordData.employeeCode,
                        departmentId: recordData.departmentId,
                        positionId: recordData.positionId,
                        workEmail: account.email,
                        workPhone: account.phone,
                        employmentType: recordData.employmentType,
                        joinedAt: recordData.hireDate
                    }, { transaction });
                }
                // 4. Offer Letter Automation
                if (offerLetterTemplateId) {
                    const template = await models_1.db.OfferLetterTemplate.findOne({ where: { id: offerLetterTemplateId, businessId }, transaction });
                    if (template) {
                        const pos = await models_1.db.Position.findByPk(profile.positionId, { transaction });
                        const dept = await models_1.db.Department.findByPk(profile.departmentId, { transaction });
                        const biz = await models_1.db.Business.findByPk(businessId, { transaction });
                        const systemRoleKey = this.normalizeSystemRoleKey(profile?.systemRole);
                        let role = await models_1.db.Role.findOne({ where: { businessId, key: systemRoleKey }, transaction });
                        if (!role) {
                            role = await models_1.db.Role.findOne({ where: { businessId, key: "EMPLOYEE" }, transaction });
                            if (!role) {
                                role = await models_1.db.Role.findOne({ where: { businessId }, transaction });
                            }
                        }
                        const renderData = {
                            ...profile,
                            firstName: account.firstName,
                            lastName: account.lastName,
                            fullName: `${account.firstName} ${account.lastName}`,
                            name: `${account.firstName} ${account.lastName}`,
                            email: account.email,
                            startDate: profile.startDate || 'TBD',
                            salary: profile.monthlySalary || 'TBD',
                            monthlySalary: profile.monthlySalary || 'TBD',
                            position: pos?.title || 'Staff',
                            positionTitle: pos?.title || 'Staff',
                            department: dept?.name || 'General',
                            businessName: biz?.name || 'Blih ERP'
                        };
                        const letter = await models_1.db.OfferLetter.create({
                            businessId,
                            templateId: template.id,
                            candidateName: renderData.fullName,
                            candidateEmail: account.email,
                            positionId: profile.positionId,
                            departmentId: profile.departmentId,
                            roleId: role?.id || null,
                            salary: profile.monthlySalary?.toString() || '0',
                            startDate: profile.startDate || new Date(),
                            employmentType: profile.employmentType || 'full_time',
                            renderedSubject: '',
                            renderedHtml: '',
                            renderedText: '',
                            createdById: req.user.id,
                            status: 'SENT',
                            sentAt: new Date()
                        }, { transaction });
                        const backendUrl = process.env.BACKEND_URL || `${req.protocol}://${req.get('host')}`;
                        const acceptUrl = `${backendUrl}/api/v1/hr/public/offers/${letter.id}/accept`;
                        const finalRenderData = { ...renderData, acceptUrl };
                        const renderedHtml = (0, offerLetterRenderer_1.renderOfferLetter)(template.bodyHtml, finalRenderData);
                        const renderedText = (0, offerLetterRenderer_1.renderOfferLetter)(template.bodyText, finalRenderData);
                        const renderedSubject = (0, offerLetterRenderer_1.renderOfferLetter)(template.subject, finalRenderData);
                        // Failsafe: Ensure candidate has an acceptance button even if template is missing {{acceptUrl}}
                        let finalHtml = renderedHtml.renderedContent;
                        if (!finalHtml.includes(acceptUrl)) {
                            finalHtml += `
                   <div style="margin-top:40px;padding-top:24px;border-top:1px solid #e2e8f0;text-align:center;font-family:Arial,sans-serif;">
                     <p style="color:#64748b;font-size:14px;margin-bottom:20px;">
                       To officially accept this job offer, please click the button below:
                     </p>
                     <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center">
                       <tr>
                         <td style="border-radius:8px;background:#2563eb;">
                           <a href="${acceptUrl}"
                              target="_blank"
                              style="display:inline-block;padding:14px 32px;font-family:Arial,sans-serif;font-size:16px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:8px;background:#2563eb;border:1px solid #2563eb;mso-padding-alt:0;text-align:center;">
                             ✓ Accept Job Offer
                           </a>
                         </td>
                       </tr>
                     </table>
                     <p style="color:#94a3b8;font-size:12px;margin-top:16px;">
                       Or copy this link: <a href="${acceptUrl}" style="color:#2563eb;">${acceptUrl}</a>
                     </p>
                   </div>
                 `;
                        }
                        await letter.update({
                            renderedSubject: renderedSubject.renderedContent,
                            renderedHtml: finalHtml,
                            renderedText: renderedText.renderedContent
                        }, { transaction });
                        try {
                            const pdfPath = await (0, offerLetterPdfGenerator_1.generateOfferLetterPdf)(finalHtml, businessId, letter.id);
                            await letter.update({ pdfPath }, { transaction });
                            await (0, offerLetterMailer_1.sendOfferLetterEmail)(account.email, renderedSubject.renderedContent, finalHtml, renderedText.renderedContent, pdfPath);
                        }
                        catch (emailErr) {
                            console.error("Failed to generate/send automated offer letter", emailErr);
                        }
                    }
                }
                await transaction.commit();
                (0, response_1.successResponse)(res, { employeeRecord: newRecord });
            }
            catch (e) {
                if (transaction)
                    await transaction.rollback();
                const message = e.name === 'SequelizeValidationError' || e.name === 'SequelizeUniqueConstraintError'
                    ? e.errors.map((err) => err.message).join(', ')
                    : e.message;
                (0, response_1.errorResponse)(res, message, 400, e.errors);
            }
        };
        this.deleteRecord = async (req, res) => {
            try {
                const userId = req.params.userId;
                await this.service.deleteRecord(req.user.businessId, userId);
                (0, response_1.successResponse)(res, null, "Employee record deleted successfully");
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        this.getOrganogram = async (req, res) => {
            try {
                const tree = await this.service.getOrganogram(req.user.businessId);
                (0, response_1.successResponse)(res, { tree });
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
    }
    normalizeSystemRoleKey(input) {
        const raw = (input ?? "EMPLOYEE").toString().trim().toUpperCase();
        const underscored = raw.replace(/[\s-]+/g, "_");
        if (underscored === "MANAGER")
            return "DEPARTMENT_HEAD";
        if (underscored === "HR_MANAGER" || underscored === "HRMANAGER")
            return "HR_MANAGER";
        return underscored || "EMPLOYEE";
    }
}
exports.HRController = HRController;
