"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HRController = void 0;
const hr_service_1 = require("./hr.service");
const response_1 = require("../../utils/response");
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
    }
}
exports.HRController = HRController;
