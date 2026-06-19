"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PositionController = void 0;
const position_service_1 = require("./position.service");
const auditLog_service_1 = require("../../services/auditLog.service");
const apiResponse_1 = require("../../utils/apiResponse");
const models_1 = require("../../models");
class PositionController {
    constructor() {
        this.service = new position_service_1.PositionService();
        this.list = async (req, res) => {
            const businessId = this.deriveBusinessId(req);
            const search = req.query.search || "";
            const departmentId = req.query.departmentId;
            const page = parseInt(req.query.page) || 1;
            const size = parseInt(req.query.size) || 20;
            const { rows: positions, count } = await this.service.list(businessId, search, page, size, departmentId);
            return (0, apiResponse_1.ok)(res, { positions, count }, 'Positions list');
        };
        this.get = async (req, res, next) => {
            const businessId = this.deriveBusinessId(req);
            const pos = await this.service.getById(req.params.id, businessId);
            if (!pos)
                return next({ statusCode: 404, message: 'Not found' });
            return (0, apiResponse_1.ok)(res, { position: pos }, 'Position details');
        };
        this.create = async (req, res) => {
            const businessId = this.deriveBusinessId(req);
            const pos = await this.service.create(businessId, req.body);
            await auditLog_service_1.AuditLogService.log('CREATE', 'position', pos.id, null, pos, req);
            return (0, apiResponse_1.ok)(res, { position: pos }, 'Position created', 201);
        };
        this.update = async (req, res, next) => {
            const businessId = this.deriveBusinessId(req);
            const beforeData = await this.service.getById(req.params.id, businessId);
            const pos = await this.service.update(req.params.id, businessId, req.body);
            if (!pos)
                return next({ statusCode: 404, message: 'Not found' });
            await auditLog_service_1.AuditLogService.log('UPDATE', 'position', pos.id, beforeData, pos, req);
            return (0, apiResponse_1.ok)(res, { position: pos }, 'Position updated');
        };
        this.remove = async (req, res, next) => {
            const businessId = this.deriveBusinessId(req);
            const beforeData = await this.service.getById(req.params.id, businessId);
            if (!beforeData)
                return next({ statusCode: 404, message: 'Not found' });
            const replacementPositionId = (req.body?.replacementPositionId || req.query.replacementPositionId || '');
            const employeeReassignments = Array.isArray(req.body?.employeeReassignments) ? req.body.employeeReassignments : [];
            if (replacementPositionId === req.params.id)
                return next({ statusCode: 400, message: 'Choose a different replacement position' });
            const assignedCount = await models_1.db.EmployeeRecord.count({ where: { businessId, positionId: req.params.id } });
            if (assignedCount > 0) {
                if (!replacementPositionId && employeeReassignments.length === 0) {
                    const employees = await models_1.db.EmployeeRecord.findAll({
                        where: { businessId, positionId: req.params.id },
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
                        message: 'Position has assigned employees. Choose a replacement position before deleting.',
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
                        where: { businessId, positionId: req.params.id },
                        attributes: ['id', 'userId'],
                    });
                    const assignedIds = new Set(assignedEmployees.map((employee) => String(employee.id)));
                    const assignmentById = new Map(employeeReassignments.map((row) => [String(row.employeeRecordId), String(row.positionId || '')]));
                    const missing = Array.from(assignedIds).filter((id) => !assignmentById.get(id));
                    if (missing.length > 0)
                        return next({ statusCode: 400, message: 'Choose a replacement position for every affected employee' });
                    const replacementIds = Array.from(new Set(Array.from(assignmentById.values())));
                    if (replacementIds.includes(req.params.id))
                        return next({ statusCode: 400, message: 'Choose a different replacement position' });
                    const replacements = await models_1.db.Position.findAll({ where: { id: replacementIds, businessId }, attributes: ['id', 'departmentId'] });
                    if (replacements.length !== replacementIds.length)
                        return next({ statusCode: 400, message: 'One or more replacement positions were not found' });
                    const replacementById = new Map(replacements.map((position) => [String(position.id), position]));
                    for (const employee of assignedEmployees) {
                        const nextPositionId = assignmentById.get(String(employee.id));
                        const replacement = replacementById.get(String(nextPositionId));
                        const payload = { positionId: nextPositionId, departmentId: replacement?.departmentId || undefined };
                        await models_1.db.EmployeeRecord.update(payload, { where: { id: employee.id, businessId } });
                        await models_1.db.BusinessUserProfile.update(payload, { where: { userId: employee.userId, businessId } });
                    }
                }
                else {
                    const replacement = await this.service.getById(replacementPositionId, businessId);
                    if (!replacement)
                        return next({ statusCode: 400, message: 'Replacement position not found' });
                    await models_1.db.EmployeeRecord.update({ positionId: replacementPositionId, departmentId: replacement.departmentId || undefined }, { where: { businessId, positionId: req.params.id } });
                    await models_1.db.BusinessUserProfile.update({ positionId: replacementPositionId, departmentId: replacement.departmentId || undefined }, { where: { businessId, positionId: req.params.id } });
                }
            }
            const okFlag = await this.service.softDelete(req.params.id, businessId);
            if (!okFlag)
                return next({ statusCode: 404, message: 'Not found' });
            await auditLog_service_1.AuditLogService.log('DELETE', 'position', req.params.id, beforeData, { reassignedEmployees: assignedCount, replacementPositionId: replacementPositionId || null, perEmployeeReassignments: employeeReassignments.length }, req);
            return (0, apiResponse_1.ok)(res, { ok: true, reassignedEmployees: assignedCount }, 'Position removed');
        };
    }
    deriveBusinessId(req) {
        return req.user.isPlatformSuperAdmin && req.query.businessId
            ? req.query.businessId
            : req.user.businessId;
    }
}
exports.PositionController = PositionController;
