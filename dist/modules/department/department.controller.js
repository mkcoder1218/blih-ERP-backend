"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DepartmentController = void 0;
const department_service_1 = require("./department.service");
const auditLog_service_1 = require("../../services/auditLog.service");
const apiResponse_1 = require("../../utils/apiResponse");
const models_1 = require("../../models");
class DepartmentController {
    constructor() {
        this.service = new department_service_1.DepartmentService();
        this.list = async (req, res) => {
            const businessId = this.deriveBusinessId(req);
            const search = req.query.search || "";
            const page = parseInt(req.query.page) || 1;
            const size = parseInt(req.query.size) || 20;
            // Head can view own dept - simplified to assume they can view the directory of departments to run standard ERP.
            // Tenant isolation strictly blocks out-of-tenant data. 
            const { rows: departments, count } = await this.service.list(businessId, search, page, size);
            return (0, apiResponse_1.ok)(res, { departments, count }, 'Departments list');
        };
        this.get = async (req, res, next) => {
            const businessId = this.deriveBusinessId(req);
            const dep = await this.service.getById(req.params.id, businessId);
            if (!dep)
                return next({ statusCode: 404, message: 'Not found' });
            return (0, apiResponse_1.ok)(res, { department: dep }, 'Department details');
        };
        this.create = async (req, res) => {
            const businessId = this.deriveBusinessId(req);
            const dep = await this.service.create(businessId, req.body);
            await auditLog_service_1.AuditLogService.log('CREATE', 'department', dep.id, null, dep, req);
            return (0, apiResponse_1.ok)(res, { department: dep }, 'Department created', 201);
        };
        this.update = async (req, res, next) => {
            const businessId = this.deriveBusinessId(req);
            const beforeData = await this.service.getById(req.params.id, businessId);
            const dep = await this.service.update(req.params.id, businessId, req.body);
            if (!dep)
                return next({ statusCode: 404, message: 'Not found' });
            await auditLog_service_1.AuditLogService.log('UPDATE', 'department', dep.id, beforeData, dep, req);
            return (0, apiResponse_1.ok)(res, { department: dep }, 'Department updated');
        };
        this.remove = async (req, res, next) => {
            const businessId = this.deriveBusinessId(req);
            const beforeData = await this.service.getById(req.params.id, businessId);
            if (!beforeData)
                return next({ statusCode: 404, message: 'Not found' });
            const replacementDepartmentId = (req.body?.replacementDepartmentId || req.query.replacementDepartmentId || '');
            const employeeReassignments = Array.isArray(req.body?.employeeReassignments) ? req.body.employeeReassignments : [];
            if (replacementDepartmentId === req.params.id)
                return next({ statusCode: 400, message: 'Choose a different replacement department' });
            const assignedCount = await models_1.db.EmployeeRecord.count({ where: { businessId, departmentId: req.params.id } });
            if (assignedCount > 0) {
                if (!replacementDepartmentId && employeeReassignments.length === 0) {
                    const employees = await models_1.db.EmployeeRecord.findAll({
                        where: { businessId, departmentId: req.params.id },
                        attributes: ['id', 'userId', 'employeeCode', 'departmentId', 'positionId'],
                        include: [
                            { model: models_1.db.User, as: 'user', attributes: ['id', 'fullName', 'email'] },
                            { model: models_1.db.Department, as: 'department', attributes: ['id', 'name'] },
                            { model: models_1.db.Position, as: 'position', attributes: ['id', 'title'] },
                        ],
                        order: [[{ model: models_1.db.User, as: 'user' }, 'fullName', 'ASC']],
                        limit: 200,
                    });
                    return next({
                        statusCode: 409,
                        message: 'Department has assigned employees. Choose a replacement department before deleting.',
                        details: {
                            code: 'REASSIGN_REQUIRED',
                            assignedCount,
                            employees: employees.map((employee) => ({
                                id: employee.id,
                                userId: employee.userId,
                                employeeCode: employee.employeeCode,
                                fullName: employee.user?.fullName || 'Employee',
                                email: employee.user?.email || '',
                                department: employee.department ? { id: employee.department.id, name: employee.department.name } : null,
                                position: employee.position ? { id: employee.position.id, title: employee.position.title } : null,
                            })),
                        },
                    });
                }
                if (employeeReassignments.length > 0) {
                    const assignedEmployees = await models_1.db.EmployeeRecord.findAll({
                        where: { businessId, departmentId: req.params.id },
                        attributes: ['id', 'userId'],
                    });
                    const assignedIds = new Set(assignedEmployees.map((employee) => String(employee.id)));
                    const assignmentById = new Map(employeeReassignments.map((row) => [String(row.employeeRecordId), String(row.departmentId || '')]));
                    const missing = Array.from(assignedIds).filter((id) => !assignmentById.get(id));
                    if (missing.length > 0)
                        return next({ statusCode: 400, message: 'Choose a replacement department for every affected employee' });
                    const replacementIds = Array.from(new Set(Array.from(assignmentById.values())));
                    if (replacementIds.includes(req.params.id))
                        return next({ statusCode: 400, message: 'Choose a different replacement department' });
                    const replacements = await models_1.db.Department.findAll({ where: { id: replacementIds, businessId }, attributes: ['id'] });
                    if (replacements.length !== replacementIds.length)
                        return next({ statusCode: 400, message: 'One or more replacement departments were not found' });
                    for (const employee of assignedEmployees) {
                        const nextDepartmentId = assignmentById.get(String(employee.id));
                        await models_1.db.EmployeeRecord.update({ departmentId: nextDepartmentId }, { where: { id: employee.id, businessId } });
                        await models_1.db.BusinessUserProfile.update({ departmentId: nextDepartmentId }, { where: { userId: employee.userId, businessId } });
                    }
                }
                else {
                    const replacement = await this.service.getById(replacementDepartmentId, businessId);
                    if (!replacement)
                        return next({ statusCode: 400, message: 'Replacement department not found' });
                    await models_1.db.EmployeeRecord.update({ departmentId: replacementDepartmentId }, { where: { businessId, departmentId: req.params.id } });
                    await models_1.db.BusinessUserProfile.update({ departmentId: replacementDepartmentId }, { where: { businessId, departmentId: req.params.id } });
                }
            }
            const okFlag = await this.service.softDelete(req.params.id, businessId);
            if (!okFlag)
                return next({ statusCode: 404, message: 'Not found' });
            await auditLog_service_1.AuditLogService.log('DELETE', 'department', req.params.id, beforeData, { reassignedEmployees: assignedCount, replacementDepartmentId: replacementDepartmentId || null, perEmployeeReassignments: employeeReassignments.length }, req);
            return (0, apiResponse_1.ok)(res, { ok: true, reassignedEmployees: assignedCount }, 'Department removed');
        };
    }
    deriveBusinessId(req) {
        return req.user.isPlatformSuperAdmin && req.query.businessId
            ? req.query.businessId
            : req.user.businessId;
    }
}
exports.DepartmentController = DepartmentController;
