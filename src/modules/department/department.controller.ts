
import type { Request, Response, NextFunction } from 'express';
import { DepartmentService } from './department.service';
import { AuditLogService } from '../../services/auditLog.service';
import { ok } from '../../utils/apiResponse';
import { db } from '../../models';
export class DepartmentController {
  private service = new DepartmentService();
  
  private deriveBusinessId(req: Request) {
    return req.user!.isPlatformSuperAdmin && req.query.businessId
      ? req.query.businessId as string
      : req.user!.businessId;
  }

  list = async (req: Request, res: Response) => {
    const businessId = this.deriveBusinessId(req);
    const search = (req.query.search as string) || "";
    const page = parseInt(req.query.page as string) || 1;
    const size = parseInt(req.query.size as string) || 20;

    // Head can view own dept - simplified to assume they can view the directory of departments to run standard ERP.
    // Tenant isolation strictly blocks out-of-tenant data. 

    const { rows: departments, count } = await this.service.list(businessId, search, page, size);
    return ok(res, { departments, count }, 'Departments list');
  };
  
  get = async (req: Request, res: Response, next: NextFunction) => {
    const businessId = this.deriveBusinessId(req);
    const dep = await this.service.getById(req.params.id, businessId);
    if (!dep) return next({ statusCode: 404, message: 'Not found' });
    return ok(res, { department: dep }, 'Department details');
  };

  create = async (req: Request, res: Response) => {
    const businessId = this.deriveBusinessId(req);
    const dep = await this.service.create(businessId, req.body);
    await AuditLogService.log('CREATE', 'department', dep.id, null, dep, req);
    return ok(res, { department: dep }, 'Department created', 201);
  };
  
  update = async (req: Request, res: Response, next: NextFunction) => {
    const businessId = this.deriveBusinessId(req);
    const beforeData = await this.service.getById(req.params.id, businessId);
    const dep = await this.service.update(req.params.id, businessId, req.body);
    if (!dep) return next({ statusCode: 404, message: 'Not found' });
    await AuditLogService.log('UPDATE', 'department', dep.id, beforeData, dep, req);
    return ok(res, { department: dep }, 'Department updated');
  };
  
  remove = async (req: Request, res: Response, next: NextFunction) => {
    const businessId = this.deriveBusinessId(req);
    const beforeData = await this.service.getById(req.params.id, businessId);
    if (!beforeData) return next({ statusCode: 404, message: 'Not found' });
    const replacementDepartmentId = (req.body?.replacementDepartmentId || req.query.replacementDepartmentId || '') as string;
    const employeeReassignments = Array.isArray(req.body?.employeeReassignments) ? req.body.employeeReassignments : [];
    if (replacementDepartmentId === req.params.id) return next({ statusCode: 400, message: 'Choose a different replacement department' });

    const assignedCount = await db.EmployeeRecord.count({ where: { businessId, departmentId: req.params.id } });
    if (assignedCount > 0) {
      if (!replacementDepartmentId && employeeReassignments.length === 0) {
        const employees = await db.EmployeeRecord.findAll({
          where: { businessId, departmentId: req.params.id },
          attributes: ['id', 'userId', 'employeeCode', 'departmentId', 'positionId'],
          include: [
            { model: db.User, as: 'user', attributes: ['id', 'fullName', 'email'] },
            { model: db.Department, as: 'department', attributes: ['id', 'name'] },
            { model: db.Position, as: 'position', attributes: ['id', 'title'] },
          ],
          order: [[{ model: db.User, as: 'user' } as any, 'fullName', 'ASC']],
          limit: 200,
        });
        return next({
          statusCode: 409,
          message: 'Department has assigned employees. Choose a replacement department before deleting.',
          details: {
            code: 'REASSIGN_REQUIRED',
            assignedCount,
            employees: employees.map((employee: any) => ({
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
        const assignedEmployees = await db.EmployeeRecord.findAll({
          where: { businessId, departmentId: req.params.id },
          attributes: ['id', 'userId'],
        });
        const assignedIds = new Set(assignedEmployees.map((employee: any) => String(employee.id)));
        const assignmentById = new Map(employeeReassignments.map((row: any) => [String(row.employeeRecordId), String(row.departmentId || '')]));
        const missing = Array.from(assignedIds).filter((id) => !assignmentById.get(id));
        if (missing.length > 0) return next({ statusCode: 400, message: 'Choose a replacement department for every affected employee' });

        const replacementIds = Array.from(new Set(Array.from(assignmentById.values())));
        if (replacementIds.includes(req.params.id)) return next({ statusCode: 400, message: 'Choose a different replacement department' });
        const replacements = await db.Department.findAll({ where: { id: replacementIds, businessId }, attributes: ['id'] });
        if (replacements.length !== replacementIds.length) return next({ statusCode: 400, message: 'One or more replacement departments were not found' });

        for (const employee of assignedEmployees as any[]) {
          const nextDepartmentId = assignmentById.get(String(employee.id));
          await db.EmployeeRecord.update({ departmentId: nextDepartmentId }, { where: { id: employee.id, businessId } });
          await db.BusinessUserProfile.update({ departmentId: nextDepartmentId }, { where: { userId: employee.userId, businessId } });
        }
      } else {
        const replacement = await this.service.getById(replacementDepartmentId, businessId);
        if (!replacement) return next({ statusCode: 400, message: 'Replacement department not found' });
        await db.EmployeeRecord.update({ departmentId: replacementDepartmentId }, { where: { businessId, departmentId: req.params.id } });
        await db.BusinessUserProfile.update({ departmentId: replacementDepartmentId }, { where: { businessId, departmentId: req.params.id } });
      }
    }

    const okFlag = await this.service.softDelete(req.params.id, businessId);
    if (!okFlag) return next({ statusCode: 404, message: 'Not found' });
    await AuditLogService.log('DELETE', 'department', req.params.id, beforeData, { reassignedEmployees: assignedCount, replacementDepartmentId: replacementDepartmentId || null, perEmployeeReassignments: employeeReassignments.length }, req);
    return ok(res, { ok: true, reassignedEmployees: assignedCount }, 'Department removed');
  };
}
