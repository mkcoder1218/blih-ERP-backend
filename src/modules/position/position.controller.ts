
import type { Request, Response, NextFunction } from 'express';
import { PositionService } from './position.service';
import { AuditLogService } from '../../services/auditLog.service';
import { ok } from '../../utils/apiResponse';
import { db } from '../../models';
export class PositionController {
  private service = new PositionService();
  
  private deriveBusinessId(req: Request) {
    return req.user!.isPlatformSuperAdmin && req.query.businessId
      ? req.query.businessId as string
      : req.user!.businessId;
  }

  list = async (req: Request, res: Response) => {
    const businessId = this.deriveBusinessId(req);
    const search = (req.query.search as string) || "";
    const departmentId = req.query.departmentId as string | undefined;
    const page = parseInt(req.query.page as string) || 1;
    const size = parseInt(req.query.size as string) || 20;

    const { rows: positions, count } = await this.service.list(businessId, search, page, size, departmentId);
    return ok(res, { positions, count }, 'Positions list');
  };
  
  get = async (req: Request, res: Response, next: NextFunction) => {
    const businessId = this.deriveBusinessId(req);
    const pos = await this.service.getById(req.params.id, businessId);
    if (!pos) return next({ statusCode: 404, message: 'Not found' });
    return ok(res, { position: pos }, 'Position details');
  };

  create = async (req: Request, res: Response) => {
    const businessId = this.deriveBusinessId(req);
    const pos = await this.service.create(businessId, req.body);
    await AuditLogService.log('CREATE', 'position', pos.id, null, pos, req);
    return ok(res, { position: pos }, 'Position created', 201);
  };
  
  update = async (req: Request, res: Response, next: NextFunction) => {
    const businessId = this.deriveBusinessId(req);
    const beforeData = await this.service.getById(req.params.id, businessId);
    const pos = await this.service.update(req.params.id, businessId, req.body);
    if (!pos) return next({ statusCode: 404, message: 'Not found' });
    await AuditLogService.log('UPDATE', 'position', pos.id, beforeData, pos, req);
    return ok(res, { position: pos }, 'Position updated');
  };
  
  remove = async (req: Request, res: Response, next: NextFunction) => {
    const businessId = this.deriveBusinessId(req);
    const beforeData = await this.service.getById(req.params.id, businessId);
    if (!beforeData) return next({ statusCode: 404, message: 'Not found' });
    const replacementPositionId = (req.body?.replacementPositionId || req.query.replacementPositionId || '') as string;
    const employeeReassignments = Array.isArray(req.body?.employeeReassignments) ? req.body.employeeReassignments : [];
    if (replacementPositionId === req.params.id) return next({ statusCode: 400, message: 'Choose a different replacement position' });

    const assignedCount = await db.EmployeeRecord.count({ where: { businessId, positionId: req.params.id } });
    if (assignedCount > 0) {
      if (!replacementPositionId && employeeReassignments.length === 0) {
        const employees = await db.EmployeeRecord.findAll({
          where: { businessId, positionId: req.params.id },
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
          message: 'Position has assigned employees. Choose a replacement position before deleting.',
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
          where: { businessId, positionId: req.params.id },
          attributes: ['id', 'userId'],
        });
        const assignedIds = new Set(assignedEmployees.map((employee: any) => String(employee.id)));
        const assignmentById = new Map(employeeReassignments.map((row: any) => [String(row.employeeRecordId), String(row.positionId || '')]));
        const missing = Array.from(assignedIds).filter((id) => !assignmentById.get(id));
        if (missing.length > 0) return next({ statusCode: 400, message: 'Choose a replacement position for every affected employee' });

        const replacementIds = Array.from(new Set(Array.from(assignmentById.values())));
        if (replacementIds.includes(req.params.id)) return next({ statusCode: 400, message: 'Choose a different replacement position' });
        const replacements = await db.Position.findAll({ where: { id: replacementIds, businessId }, attributes: ['id', 'departmentId'] });
        if (replacements.length !== replacementIds.length) return next({ statusCode: 400, message: 'One or more replacement positions were not found' });
        const replacementById = new Map(replacements.map((position: any) => [String(position.id), position]));

        for (const employee of assignedEmployees as any[]) {
          const nextPositionId = assignmentById.get(String(employee.id));
          const replacement = replacementById.get(String(nextPositionId)) as any;
          const payload = { positionId: nextPositionId, departmentId: replacement?.departmentId || undefined };
          await db.EmployeeRecord.update(payload, { where: { id: employee.id, businessId } });
          await db.BusinessUserProfile.update(payload, { where: { userId: employee.userId, businessId } });
        }
      } else {
        const replacement = await this.service.getById(replacementPositionId, businessId);
        if (!replacement) return next({ statusCode: 400, message: 'Replacement position not found' });
        await db.EmployeeRecord.update(
          { positionId: replacementPositionId, departmentId: replacement.departmentId || undefined },
          { where: { businessId, positionId: req.params.id } }
        );
        await db.BusinessUserProfile.update(
          { positionId: replacementPositionId, departmentId: replacement.departmentId || undefined },
          { where: { businessId, positionId: req.params.id } }
        );
      }
    }

    const okFlag = await this.service.softDelete(req.params.id, businessId);
    if (!okFlag) return next({ statusCode: 404, message: 'Not found' });
    await AuditLogService.log('DELETE', 'position', req.params.id, beforeData, { reassignedEmployees: assignedCount, replacementPositionId: replacementPositionId || null, perEmployeeReassignments: employeeReassignments.length }, req);
    return ok(res, { ok: true, reassignedEmployees: assignedCount }, 'Position removed');
  };
}
