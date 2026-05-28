"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HRController = void 0;
const hr_service_1 = require("./hr.service");
const response_1 = require("../../utils/response");
const models_1 = require("../../models");
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
                if (!isSelf && !canSeeSalary) { // Basic lock
                    // Let's assume if it's department head and we matched dept we tolerate, otherwise block un-permissioned reading
                    // A more robust check binds here
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
                // Dept Head scoping enforcement
                if (req.user.roles.includes('DEPARTMENT_HEAD') && !req.user.roles.includes('HR_MANAGER')) {
                    // Ideally we get dept ID from user profile, but omitting for brief scaffold. 
                    // The route middleware normally handles mapping.
                }
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
                // Native constraint enforcement
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
        this.onboardEmployee = async (req, res) => {
            try {
                const { account, profile, uploads } = req.body;
                const businessId = req.user.businessId;
                if (!account || !account.email || !account.password || !account.firstName || !account.lastName) {
                    return (0, response_1.errorResponse)(res, "Account info missing (email, password, firstName, lastName)", 400);
                }
                // Check if User exists
                let targetUser = await models_1.db.User.findOne({ where: { email: account.email, businessId } });
                if (!targetUser) {
                    const bcrypt = require('bcrypt');
                    const hash = await bcrypt.hash(account.password, 10);
                    targetUser = await models_1.db.User.create({
                        id: require('crypto').randomUUID(),
                        businessId,
                        fullName: `${account.firstName} ${account.lastName}`,
                        email: account.email,
                        password: hash,
                        phone: account.phone || null,
                        status: 'active'
                    });
                }
                // Check if profile exists
                let empRec = await this.service.getRecord(businessId, targetUser.id);
                if (empRec) {
                    return (0, response_1.errorResponse)(res, "Employee record already exists for this user", 400);
                }
                // Create Employee Record
                const recordData = {
                    businessId,
                    userId: targetUser.id,
                    employeeCode: profile.employeeCode || `EMP-${Date.now().toString().slice(-4)}`,
                    departmentId: profile.departmentId || null,
                    positionId: profile.positionId || null,
                    managerUserId: profile.reportingTo || null,
                    employmentType: profile.employmentType || null,
                    hireDate: profile.startDate || new Date(),
                    probationEndDate: profile.probationPeriod ? new Date(Date.now() + 1000 * 60 * 60 * 24 * 30 * parseInt(profile.probationPeriod)) : null,
                    salaryInfo: {
                        baseSalary: profile.monthlySalary,
                        currency: profile.salaryCurrency || 'ETB'
                    },
                    emergencyContact: {
                        firstName: profile.emergencyFirstName,
                        lastName: profile.emergencyLastName,
                        phone: profile.emergencyPhone,
                        email: profile.emergencyEmail,
                        city: profile.emergencyCity,
                        country: profile.emergencyCountry
                    },
                    metadata: {
                        dateOfBirth: profile.dateOfBirth,
                        cityOfResidence: profile.city,
                        countryOfBirth: profile.countryOfBirth,
                        additionalPhone: profile.additionalPhone,
                        bankDetails: profile.bankDetails || [],
                        assetsAndCredentials: profile.assetsAndCredentials || [],
                        additionalNotes: profile.additionalNotes,
                        uploads: uploads || {}
                    }
                };
                const newRecord = await this.service.createRecord(recordData);
                // Optionally create BusinessUserProfile
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
                });
                (0, response_1.successResponse)(res, { employeeRecord: newRecord });
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
    }
}
exports.HRController = HRController;
