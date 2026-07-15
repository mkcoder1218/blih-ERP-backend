"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HRController = void 0;
const hr_service_1 = require("./hr.service");
const response_1 = require("../../utils/response");
const models_1 = require("../../models");
const offerLetterRenderer_1 = require("../../utils/offerLetterRenderer");
const offerLetterPdfGenerator_1 = require("../../utils/offerLetterPdfGenerator");
const offerLetterMailer_1 = require("../../utils/offerLetterMailer");
const sequelize_1 = require("sequelize");
const payrollTemplate_service_1 = require("../finance/payrollTemplate.service");
const employee_constants_1 = require("../../constants/employee.constants");
const bulkEmployeeValidation_service_1 = require("./bulkEmployeeValidation.service");
class HRController {
    constructor() {
        this.service = new hr_service_1.HRService();
        this.bulkValidationService = new bulkEmployeeValidation_service_1.BulkEmployeeValidationService();
        this.payrollTemplateService = new payrollTemplate_service_1.PayrollTemplateService();
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
                const employmentType = req.query.employmentType;
                const employmentStatus = req.query.employmentStatus;
                const q = { businessId: req.user.businessId };
                if (departmentId)
                    q.departmentId = departmentId;
                if (employmentType)
                    q.employmentType = employmentType;
                if (employmentStatus)
                    q.employmentStatus = employmentStatus;
                else
                    q.employmentStatus = { [sequelize_1.Op.ne]: 'terminated' };
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
        this.validateBulkEmployeeRecords = async (req, res) => {
            try {
                const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
                if (!Array.isArray(req.body?.rows))
                    return (0, response_1.errorResponse)(res, "rows must be an array", 400);
                const result = await this.bulkValidationService.validate(req.user.businessId, rows);
                (0, response_1.successResponse)(res, result, "Bulk employee validation complete");
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        this.bulkWriteEmployeeRecords = async (req, res) => {
            try {
                if (!Array.isArray(req.body?.rows))
                    return (0, response_1.errorResponse)(res, "rows must be an array", 400);
                const result = await this.bulkValidationService.apply(req.user.businessId, req.body.rows);
                (0, response_1.successResponse)(res, result, "Bulk employee write complete");
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
                            recordUpdates.employmentType = profile.employmentType ? this.normalizeEmploymentType(profile.employmentType, rec.employmentType || employee_constants_1.DEFAULT_EMPLOYMENT_TYPE) : null;
                        if (profile.employmentCategory !== undefined)
                            recordUpdates.employmentCategory = this.normalizeEmploymentCategory(profile.employmentCategory);
                        if (profile.assignedStartTime !== undefined)
                            recordUpdates.assignedStartTime = this.normalizeAssignedStartTime(profile.assignedStartTime, rec.assignedStartTime || "09:00");
                        if (profile.scheduledWorkDays !== undefined)
                            recordUpdates.scheduledWorkDays = this.normalizeScheduledWorkDays(profile.scheduledWorkDays, rec.scheduledWorkDays || [1, 2, 3, 4, 5]);
                        if (profile.employmentStatus !== undefined)
                            recordUpdates.employmentStatus = this.normalizeEmploymentStatus(profile.employmentStatus, rec.employmentStatus || employee_constants_1.DEFAULT_EMPLOYMENT_STATUS);
                        if (profile.startDate !== undefined)
                            recordUpdates.hireDate = profile.startDate || rec.hireDate;
                        if (profile.contractStartDate !== undefined)
                            recordUpdates.contractStartDate = profile.contractStartDate || null;
                        if (profile.contractEndDate !== undefined)
                            recordUpdates.contractEndDate = profile.contractEndDate || null;
                        if (profile.probationPeriod !== undefined) {
                            const months = Number(profile.probationPeriod || 0);
                            recordUpdates.probationEndDate = months
                                ? new Date(Date.now() + 1000 * 60 * 60 * 24 * 30 * months)
                                : null;
                        }
                        if (profile.monthlySalary !== undefined || profile.salaryCurrency !== undefined) {
                            recordUpdates.salaryInfo = this.buildSalaryInfo(rec.salaryInfo || {}, {
                                monthlySalary: profile.monthlySalary !== undefined ? profile.monthlySalary : rec.salaryInfo?.baseSalary,
                                salaryCurrency: profile.salaryCurrency !== undefined ? profile.salaryCurrency : rec.salaryInfo?.currency,
                            });
                        }
                        const emergencyProvided = profile.emergencyFirstName !== undefined ||
                            profile.emergencyLastName !== undefined ||
                            profile.emergencyPhone !== undefined ||
                            profile.emergencyEmail !== undefined ||
                            profile.emergencyCity !== undefined ||
                            profile.emergencyCountry !== undefined;
                        if (emergencyProvided) {
                            recordUpdates.emergencyContact = this.buildEmergencyContact(rec.emergencyContact || {}, {
                                emergencyFirstName: profile.emergencyFirstName !== undefined ? profile.emergencyFirstName : rec.emergencyContact?.firstName,
                                emergencyLastName: profile.emergencyLastName !== undefined ? profile.emergencyLastName : rec.emergencyContact?.lastName,
                                emergencyPhone: profile.emergencyPhone !== undefined ? profile.emergencyPhone : rec.emergencyContact?.phone,
                                emergencyEmail: profile.emergencyEmail !== undefined ? profile.emergencyEmail : rec.emergencyContact?.email,
                                emergencyCity: profile.emergencyCity !== undefined ? profile.emergencyCity : rec.emergencyContact?.city,
                                emergencyCountry: profile.emergencyCountry !== undefined ? profile.emergencyCountry : rec.emergencyContact?.country,
                            });
                        }
                        recordUpdates.metadata = this.buildEmployeeMetadata(rec.metadata || {}, {
                            dateOfBirth: profile.dateOfBirth !== undefined ? profile.dateOfBirth : rec.metadata?.dateOfBirth,
                            city: profile.city !== undefined ? profile.city : rec.metadata?.city,
                            countryOfBirth: profile.countryOfBirth !== undefined ? profile.countryOfBirth : rec.metadata?.countryOfBirth,
                            additionalPhone: profile.additionalPhone !== undefined ? profile.additionalPhone : rec.metadata?.additionalPhone,
                            branch: profile.branch !== undefined ? profile.branch : rec.metadata?.branch,
                            internshipProgram: profile.internshipProgram !== undefined ? profile.internshipProgram : rec.metadata?.internship?.program,
                            internshipInstitution: profile.internshipInstitution !== undefined ? profile.internshipInstitution : rec.metadata?.internship?.institution,
                            internshipMentorUserId: profile.internshipMentorUserId !== undefined ? profile.internshipMentorUserId : rec.metadata?.internship?.mentorUserId,
                            internshipExpectedEndDate: profile.internshipExpectedEndDate !== undefined ? profile.internshipExpectedEndDate : rec.metadata?.internship?.expectedEndDate,
                            internshipStatus: profile.internshipStatus !== undefined ? profile.internshipStatus : rec.metadata?.internship?.status,
                            internshipStipendType: profile.internshipStipendType !== undefined ? profile.internshipStipendType : rec.metadata?.internship?.stipendType,
                            bankDetails: profile.bankDetails !== undefined ? profile.bankDetails : rec.metadata?.bankDetails,
                            assetsAndCredentials: profile.assetsAndCredentials !== undefined ? profile.assetsAndCredentials : rec.metadata?.assetsAndCredentials,
                            additionalNotes: profile.additionalNotes !== undefined ? profile.additionalNotes : rec.metadata?.additionalNotes,
                        }, uploads);
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
                            bpUpdates.employmentType = profile.employmentType ? this.normalizeEmploymentType(profile.employmentType, businessProfile.employmentType || employee_constants_1.DEFAULT_EMPLOYMENT_TYPE) : null;
                        if (profile?.startDate !== undefined)
                            bpUpdates.joinedAt = profile.startDate || businessProfile.joinedAt;
                        if (profile?.systemRole !== undefined) {
                            const settings = { ...(businessProfile.settings || {}) };
                            settings.systemRole = this.normalizeSystemRoleKey(profile.systemRole);
                            bpUpdates.settings = settings;
                        }
                        if (Object.keys(bpUpdates).length > 0)
                            await businessProfile.update(bpUpdates, { transaction });
                        await this.attachUploadsToProfile({ businessId, profileId: businessProfile.id, uploads, transaction });
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
        this.terminateEmployeeContract = async (req, res) => {
            const transaction = await models_1.db.sequelize.transaction();
            try {
                const businessId = req.user.businessId;
                const targetUserId = req.params.userId;
                const effectiveAt = req.body?.effectiveAt ? new Date(req.body.effectiveAt) : new Date();
                const effectiveDate = req.body?.effectiveDate || effectiveAt.toISOString().slice(0, 10);
                const reason = String(req.body?.reason || "Contract terminated by HR").trim();
                const rec = await models_1.db.EmployeeRecord.findOne({
                    where: { businessId, userId: targetUserId },
                    transaction,
                    lock: transaction.LOCK.UPDATE,
                });
                const user = await models_1.db.User.findOne({
                    where: { businessId, id: targetUserId },
                    transaction,
                    lock: transaction.LOCK.UPDATE,
                });
                if (!rec || !user) {
                    await transaction.rollback();
                    return (0, response_1.errorResponse)(res, "Employee contract record not found", 404);
                }
                await rec.update({
                    employmentStatus: employee_constants_1.TERMINATED_EMPLOYMENT_STATUS,
                    contractEndDate: effectiveDate,
                    metadata: {
                        ...(rec.metadata || {}),
                        contractTermination: {
                            terminatedAt: effectiveAt.toISOString(),
                            effectiveDate,
                            reason,
                            terminatedByUserId: req.user.id,
                        },
                    },
                }, { transaction });
                await user.update({ status: "inactive" }, { transaction });
                await transaction.commit();
                (0, response_1.successResponse)(res, { employeeRecord: rec, user }, "Contract terminated");
            }
            catch (e) {
                await transaction.rollback();
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        this.onboardEmployee = async (req, res) => {
            const transaction = await models_1.db.sequelize.transaction();
            try {
                const { account, profile: rawProfile, uploads, offerLetterTemplateId } = req.body;
                const profile = rawProfile || {};
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
                    employmentType: this.normalizeEmploymentType(profile?.employmentType, employee_constants_1.DEFAULT_EMPLOYMENT_TYPE),
                    employmentCategory: this.normalizeEmploymentCategory(profile?.employmentCategory),
                    assignedStartTime: this.normalizeAssignedStartTime(profile?.assignedStartTime),
                    scheduledWorkDays: this.normalizeScheduledWorkDays(profile?.scheduledWorkDays),
                    employmentStatus: this.normalizeEmploymentStatus(profile?.employmentStatus, employee_constants_1.DEFAULT_EMPLOYMENT_STATUS),
                    hireDate: profile.startDate || new Date(),
                    contractStartDate: profile.contractStartDate || profile.startDate || null,
                    contractEndDate: profile.contractEndDate || null,
                    probationEndDate: profile.probationPeriod ? new Date(Date.now() + 1000 * 60 * 60 * 24 * 30 * parseInt(profile.probationPeriod)) : null,
                    salaryInfo: this.buildSalaryInfo({}, profile),
                    emergencyContact: this.buildEmergencyContact({}, profile),
                    metadata: this.buildEmployeeMetadata({}, profile, uploads)
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
                let businessProfile;
                if (deletedProfile) {
                    if (deletedProfile.deletedAt)
                        await deletedProfile.restore({ transaction });
                    businessProfile = await deletedProfile.update({
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
                    businessProfile = await models_1.db.BusinessUserProfile.create({
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
                await this.attachUploadsToProfile({ businessId, profileId: businessProfile.id, uploads, transaction });
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
                            employmentType: this.normalizeEmploymentType(profile?.employmentType, employee_constants_1.DEFAULT_EMPLOYMENT_TYPE),
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
                            await (0, offerLetterMailer_1.sendOfferLetterEmail)(account.email, renderedSubject.renderedContent, finalHtml, renderedText.renderedContent, pdfPath, businessId);
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
        // ── Pending Registrations — HR Approval Workflow ──────────────────────────
        /**
         * GET /api/v1/hr/pending-registrations
         * List users with status 'pending' or 'rejected' for HR review.
         */
        this.listPendingRegistrations = async (req, res) => {
            try {
                const businessId = req.user.businessId;
                const status = req.query.status || 'pending';
                const page = Math.max(1, parseInt(req.query.page) || 1);
                const size = Math.min(100, parseInt(req.query.size) || 20);
                const offset = (page - 1) * size;
                const { Op } = require('sequelize');
                const allowedStatuses = ['pending', 'rejected'];
                const whereStatus = allowedStatuses.includes(status) ? status : 'pending';
                const { count, rows } = await models_1.db.User.findAndCountAll({
                    where: { businessId, status: whereStatus },
                    attributes: ['id', 'fullName', 'email', 'phone', 'status', 'createdAt', 'rejectionReason', 'rejectedAt'],
                    include: [{
                            model: models_1.db.BusinessUserProfile,
                            as: 'BusinessUserProfile',
                            attributes: ['settings', 'departmentId', 'positionId', 'employmentType', 'joinedAt'],
                            include: [
                                { model: models_1.db.Department, as: 'department', attributes: ['id', 'name'] },
                                { model: models_1.db.Position, as: 'position', attributes: ['id', 'title'] },
                            ],
                        }],
                    order: [['createdAt', 'DESC']],
                    limit: size,
                    offset,
                });
                const employeeRecords = await models_1.db.EmployeeRecord.findAll({
                    where: { businessId, userId: { [Op.in]: rows.map((u) => u.id) } },
                    attributes: ['userId', 'salaryInfo', 'metadata'],
                });
                const employeeRecordByUserId = new Map(employeeRecords.map((record) => [record.userId, record]));
                const items = rows.map((u) => {
                    const profile = u.BusinessUserProfile;
                    const settings = profile?.settings ?? {};
                    const employeeRecord = employeeRecordByUserId.get(u.id);
                    return {
                        id: u.id,
                        fullName: u.fullName,
                        email: u.email,
                        phone: u.phone,
                        status: u.status,
                        createdAt: u.createdAt,
                        rejectionReason: u.rejectionReason,
                        rejectedAt: u.rejectedAt,
                        requestedRoleKey: settings.requestedRoleKey || null,
                        employmentType: profile?.employmentType || settings.employmentType || null,
                        hireDate: profile?.joinedAt || null,
                        department: profile?.department || null,
                        position: profile?.position || null,
                        financial: this.pendingRegistrationFinancialInfo(employeeRecord),
                        personal: {
                            dateOfBirth: settings.dateOfBirth || null,
                            gender: settings.gender || null,
                            maritalStatus: settings.maritalStatus || null,
                            nationality: settings.nationality || null,
                            address: settings.address || null,
                            city: settings.city || null,
                            country: settings.country || null,
                            zipCode: settings.zipCode || null,
                        },
                    };
                });
                (0, response_1.successResponse)(res, { items, total: count, page, size, pages: Math.ceil(count / size) });
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        /**
         * GET /api/v1/hr/pending-registrations/:userId
         * Full detail of one pending/rejected user for the HR review modal.
         */
        this.getPendingRegistration = async (req, res) => {
            try {
                const businessId = req.user.businessId;
                const { Op } = require('sequelize');
                const user = await models_1.db.User.findOne({
                    where: { id: req.params.userId, businessId, status: { [Op.in]: ['pending', 'rejected'] } },
                    attributes: { exclude: ['password'] },
                    include: [{
                            model: models_1.db.BusinessUserProfile,
                            as: 'BusinessUserProfile',
                            include: [
                                { model: models_1.db.Department, as: 'department', attributes: ['id', 'name'] },
                                { model: models_1.db.Position, as: 'position', attributes: ['id', 'title'] },
                            ],
                        }, {
                            model: models_1.db.EmployeeRecord,
                            // User hasMany EmployeeRecord — Sequelize uses the plural alias
                            attributes: ['id', 'metadata', 'salaryInfo', 'emergencyContact', 'departmentId', 'positionId', 'employmentType', 'hireDate'],
                            required: false,
                            limit: 1,
                            order: [['createdAt', 'DESC']],
                        }],
                });
                if (!user)
                    return (0, response_1.errorResponse)(res, 'Not found', 404);
                // Flatten so the frontend can access EmployeeRecord directly
                const plain = user.toJSON ? user.toJSON() : user;
                const empRecord = (plain.EmployeeRecords ?? [])[0] ?? null;
                (0, response_1.successResponse)(res, {
                    user: {
                        ...plain,
                        EmployeeRecord: empRecord,
                        EmployeeRecords: undefined,
                        financial: this.pendingRegistrationFinancialInfo(empRecord),
                    },
                });
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        /**
         * POST /api/v1/hr/pending-registrations/:userId/approve
         * Approve a pending registration. Activates account and assigns role.
         */
        this.approveRegistration = async (req, res) => {
            try {
                const businessId = req.user.businessId;
                const { Op } = require('sequelize');
                const { sendApprovalEmail } = require('../../services/registrationEmails');
                const user = await models_1.db.User.findOne({
                    where: { id: req.params.userId, businessId, status: { [Op.in]: ['pending', 'rejected'] } },
                });
                if (!user)
                    return (0, response_1.errorResponse)(res, 'Not found', 404);
                if (req.body?.financialConfirmation !== true) {
                    return (0, response_1.errorResponse)(res, 'Confirm the financial information before approval', 400);
                }
                let financialInfo;
                try {
                    financialInfo = this.normalizeApprovalFinancialInfo(req.body?.financialInfo);
                }
                catch (validationError) {
                    return (0, response_1.errorResponse)(res, validationError.message, 400);
                }
                const employeeRecord = await models_1.db.EmployeeRecord.findOne({ where: { businessId, userId: user.id } });
                if (!employeeRecord)
                    return (0, response_1.errorResponse)(res, 'Employee record is required before approval', 400);
                await user.update({
                    status: 'active',
                    rejectionReason: null,
                    rejectedAt: null,
                    approvedAt: new Date(),
                    approvedByUserId: req.user.id,
                });
                await models_1.db.BusinessUserProfile.update({ status: 'active' }, { where: { userId: user.id } });
                // Assign requested role
                const profile = await models_1.db.BusinessUserProfile.findOne({ where: { userId: user.id } });
                const settings = profile?.settings ?? {};
                const roleKey = settings.requestedRoleKey || 'EMPLOYEE';
                const role = await models_1.db.Role.findOne({ where: { key: roleKey.toUpperCase(), businessId: null } });
                if (role)
                    await user.setRoles([role]).catch(() => null);
                if (settings.onboardingId) {
                    const onboarding = await models_1.db.CandidateOnboarding.findOne({ where: { onboardingId: settings.onboardingId, businessId } });
                    if (onboarding) {
                        await onboarding.update({ status: 'COMPLETED' });
                        await models_1.db.EmployeeRecord.update({ employmentStatus: 'active' }, { where: { userId: user.id, businessId } });
                        await models_1.db.InventoryItem.update({
                            status: 'ASSIGNED',
                            assignedToUserId: user.id,
                            reservedForOnboardingId: null,
                        }, { where: { businessId, reservedForOnboardingId: onboarding.id } });
                    }
                }
                const payroll = await this.payrollTemplateService.setupAutomaticEthiopianPayroll(businessId, req.user.id, user.id, financialInfo);
                // Send approval email (non-fatal)
                const business = await models_1.db.Business.findByPk(businessId, { attributes: ['name'] });
                sendApprovalEmail({ toEmail: user.email, toName: user.fullName, businessName: business?.name || '' }).catch(() => null);
                (0, response_1.successResponse)(res, { approved: true, userId: user.id, payroll });
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        /**
         * POST /api/v1/hr/pending-registrations/:userId/reject
         * Reject a pending registration with reason and optional template message.
         * Sends a resubmit email to the applicant.
         */
        this.rejectRegistration = async (req, res) => {
            try {
                const businessId = req.user.businessId;
                const { Op } = require('sequelize');
                const { sendRejectionEmail } = require('../../services/registrationEmails');
                const { reason, templateMessage } = req.body;
                if (!reason?.trim())
                    return (0, response_1.errorResponse)(res, 'Rejection reason is required', 400);
                const user = await models_1.db.User.findOne({
                    where: { id: req.params.userId, businessId, status: { [Op.in]: ['pending', 'rejected'] } },
                });
                if (!user)
                    return (0, response_1.errorResponse)(res, 'Not found', 404);
                await user.update({
                    status: 'rejected',
                    rejectionReason: reason.trim(),
                    rejectedAt: new Date(),
                });
                await models_1.db.BusinessUserProfile.update({ status: 'rejected' }, { where: { userId: user.id } });
                // Send rejection email with resubmit link
                const business = await models_1.db.Business.findByPk(businessId, { attributes: ['name', 'slug'] });
                if (user.registrationToken && business) {
                    sendRejectionEmail({
                        toEmail: user.email,
                        toName: user.fullName,
                        businessName: business.name,
                        businessSlug: business.slug,
                        registrationToken: user.registrationToken,
                        reason: reason.trim(),
                        templateMessage: templateMessage?.trim() || undefined,
                    }).catch(() => null);
                }
                (0, response_1.successResponse)(res, { rejected: true, userId: user.id });
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
    normalizeEmploymentStatus(input, fallback = employee_constants_1.DEFAULT_EMPLOYMENT_STATUS) {
        const value = (input ?? "").toString().trim();
        return employee_constants_1.EMPLOYMENT_STATUSES.includes(value) ? value : fallback;
    }
    normalizeEmploymentType(input, fallback = employee_constants_1.DEFAULT_EMPLOYMENT_TYPE) {
        const value = (input ?? "").toString().trim();
        return employee_constants_1.EMPLOYMENT_TYPES.includes(value) ? value : fallback;
    }
    normalizeEmploymentCategory(input) {
        const value = (input ?? "").toString().trim();
        return value === "Managerial" || value === "Non-Managerial" ? value : null;
    }
    normalizeAssignedStartTime(input, fallback = "09:00") {
        const value = (input ?? "").toString().trim();
        return value === "08:00" || value === "08:30" || value === "09:00" ? value : fallback;
    }
    normalizeScheduledWorkDays(input, fallback = [1, 2, 3, 4, 5]) {
        const raw = Array.isArray(input) ? input : fallback;
        const days = Array.from(new Set(raw.map((day) => Number(day)).filter((day) => Number.isInteger(day) && day >= 1 && day <= 7))).sort((a, b) => a - b);
        return days.length ? days : fallback;
    }
    buildSalaryInfo(current, profile) {
        return {
            ...(current || {}),
            baseSalary: profile?.monthlySalary ?? current?.baseSalary ?? null,
            currency: profile?.salaryCurrency || current?.currency || "ETB",
        };
    }
    normalizeApprovalFinancialInfo(input) {
        const data = input || {};
        const hasBaseSalary = data.baseSalary != null || data.monthlySalary != null || data.salary != null;
        const baseSalary = hasBaseSalary ? Number(data.baseSalary ?? data.monthlySalary ?? data.salary) : null;
        const netSalary = Number(data.netSalary ?? data.targetNetSalary ?? data.targetNetPay ?? data.netPay ?? 0);
        if ((baseSalary == null || !Number.isFinite(baseSalary) || baseSalary <= 0) && (!Number.isFinite(netSalary) || netSalary <= 0)) {
            throw new Error("Base salary or net salary is required before approval");
        }
        const pensionableSalary = Number(data.pensionableSalary ?? baseSalary ?? 0);
        if (data.pensionableSalary != null && (!Number.isFinite(pensionableSalary) || pensionableSalary < 0))
            throw new Error("Pensionable salary must be valid");
        return {
            ...(baseSalary != null ? { baseSalary } : {}),
            ...(Number.isFinite(netSalary) && netSalary > 0 ? { netSalary } : {}),
            ...(data.pensionableSalary != null ? { pensionableSalary } : {}),
            currency: data.currency || "ETB",
            transportAllowance: Number(data.transportAllowance ?? 0),
            perDiemAllowance: Number(data.perDiemAllowance ?? 0),
            perDiemDays: Number(data.perDiemDays ?? 0),
            medicalBenefit: Number(data.medicalBenefit ?? 0),
            telecomAllowance: Number(data.telecomAllowance ?? 0),
            housingAllowance: Number(data.housingAllowance ?? 0),
            mealAllowance: Number(data.mealAllowance ?? 0),
            otherAllowance: Number(data.otherAllowance ?? 0),
            employeePensionRate: Number(data.employeePensionRate ?? 7),
            employerPensionRate: Number(data.employerPensionRate ?? 11),
            bankAccount: data.bankAccount || null,
            tin: data.tin || null,
            paymentStatus: data.paymentStatus || "Pending",
            remarks: data.remarks || null,
        };
    }
    pendingRegistrationFinancialInfo(employeeRecord) {
        const salaryInfo = employeeRecord?.salaryInfo ?? {};
        const metadata = employeeRecord?.metadata ?? {};
        const primaryBank = Array.isArray(metadata.bankDetails) ? metadata.bankDetails[0] : null;
        return {
            bankName: primaryBank?.bankName ?? metadata.bankName ?? null,
            bankAccount: salaryInfo.bankAccount ?? primaryBank?.accountNumber ?? metadata.bankAccountNumber ?? null,
            tin: salaryInfo.tin ?? metadata.tin ?? metadata.taxIdentificationNumber ?? null,
            salaryInputMode: salaryInfo.salaryInputMode ?? null,
            baseSalary: salaryInfo.baseSalary ?? null,
            netSalary: salaryInfo.targetNetSalary ?? salaryInfo.netSalary ?? null,
            transportAllowance: salaryInfo.transportAllowance ?? null,
            perDiemAllowance: salaryInfo.perDiemAllowance ?? null,
            perDiemDays: salaryInfo.perDiemDays ?? null,
            medicalBenefit: salaryInfo.medicalBenefit ?? null,
            telecomAllowance: salaryInfo.telecomAllowance ?? null,
            housingAllowance: salaryInfo.housingAllowance ?? null,
            mealAllowance: salaryInfo.mealAllowance ?? null,
            otherAllowance: salaryInfo.otherAllowance ?? null,
            employeePensionRate: salaryInfo.employeePensionRate ?? null,
            employerPensionRate: salaryInfo.employerPensionRate ?? null,
            remarks: salaryInfo.remarks ?? null,
        };
    }
    buildEmergencyContact(current, profile) {
        return {
            ...(current || {}),
            firstName: profile?.emergencyFirstName ?? current?.firstName ?? null,
            lastName: profile?.emergencyLastName ?? current?.lastName ?? null,
            phone: profile?.emergencyPhone ?? current?.phone ?? null,
            email: profile?.emergencyEmail ?? current?.email ?? null,
            city: profile?.emergencyCity ?? current?.city ?? null,
            country: profile?.emergencyCountry ?? current?.country ?? null,
        };
    }
    buildEmployeeMetadata(current, profile, uploads) {
        return {
            ...(current || {}),
            dateOfBirth: profile?.dateOfBirth ?? current?.dateOfBirth ?? null,
            city: profile?.city ?? current?.city ?? null,
            countryOfBirth: profile?.countryOfBirth ?? current?.countryOfBirth ?? null,
            additionalPhone: profile?.additionalPhone ?? current?.additionalPhone ?? null,
            branch: profile?.branch ?? current?.branch ?? null,
            internship: {
                ...((current || {}).internship || {}),
                program: profile?.internshipProgram ?? current?.internship?.program ?? null,
                institution: profile?.internshipInstitution ?? current?.internship?.institution ?? null,
                mentorUserId: profile?.internshipMentorUserId ?? current?.internship?.mentorUserId ?? null,
                expectedEndDate: profile?.internshipExpectedEndDate ?? current?.internship?.expectedEndDate ?? null,
                status: profile?.internshipStatus ?? current?.internship?.status ?? null,
                stipendType: profile?.internshipStipendType ?? current?.internship?.stipendType ?? null,
            },
            bankDetails: profile?.bankDetails ?? current?.bankDetails ?? [],
            assetsAndCredentials: profile?.assetsAndCredentials ?? current?.assetsAndCredentials ?? [],
            additionalNotes: profile?.additionalNotes ?? current?.additionalNotes ?? null,
            uploads: { ...((current || {}).uploads || {}), ...(uploads || {}) },
        };
    }
    async attachUploadsToProfile(params) {
        const { businessId, profileId, uploads, transaction } = params;
        if (!uploads || typeof uploads !== "object")
            return;
        for (const [key, value] of Object.entries(uploads)) {
            const fileAssetId = value?.id || value?.fileAssetId;
            if (!fileAssetId)
                continue;
            const existing = await models_1.db.EntityAttachment.findOne({
                where: { businessId, entityType: "business_user_profile", entityId: profileId, fileAssetId },
                transaction
            });
            if (existing)
                continue;
            await models_1.db.EntityAttachment.create({
                businessId,
                fileAssetId,
                entityType: "business_user_profile",
                entityId: profileId,
                moduleKey: "profiles",
                attachmentType: key
            }, { transaction });
        }
    }
}
exports.HRController = HRController;
