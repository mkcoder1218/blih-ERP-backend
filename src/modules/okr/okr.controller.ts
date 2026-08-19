import type { Request, Response } from 'express';
import { okrService } from './okr.service';
import { AuditLogService } from '../../services/auditLog.service';

export class OKRController {

  createObjective = async (req: Request, res: Response) => {
    try {
      const obj = await okrService.createObjective(req.user!.businessId, req.user!.id, req.body);
      await AuditLogService.log('CREATE_OBJECTIVE', 'okr_objective', String(obj.id), null, obj, req);
      res.status(201).json({ objective: obj });
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  };

  updateObjective = async (req: Request, res: Response) => {
    try {
      const obj = await okrService.updateObjective(req.user!.businessId, req.params.id, req.body);
      await AuditLogService.log('UPDATE_OBJECTIVE', 'okr_objective', String(obj.id), null, req.body, req);
      res.json({ objective: obj });
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  };

  getObjective = async (req: Request, res: Response) => {
    const obj = await okrService.getObjective(req.user!.businessId, req.params.id);
    if (!obj) return res.status(404).json({ message: 'Not found' });
    res.json({ objective: obj });
  };

  listObjectives = async (req: Request, res: Response) => {
    try {
      const result = await okrService.listObjectives(req.user!.businessId, req.query);
      res.json(result);
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  };

  deleteObjective = async (req: Request, res: Response) => {
    try {
      await okrService.deleteObjective(req.user!.businessId, req.params.id);
      await AuditLogService.log('DELETE_OBJECTIVE', 'okr_objective', req.params.id, null, null, req);
      res.json({ success: true });
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  };

  logProgressUpdate = async (req: Request, res: Response) => {
    try {
      // currentValue check-in
      const checkIn = await okrService.logCheckIn(req.user!.businessId, req.user!.id, req.body);
      await AuditLogService.log('LOG_OKR_PROGRESS', 'okr_check_in', String(checkIn.id), null, checkIn, req);
      res.status(201).json({ checkIn });
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  };

  refreshMetrics = async (req: Request, res: Response) => {
    try {
      await okrService.refreshAutomaticMetrics(req.user!.businessId, req.body.objectiveId);
      res.json({ success: true });
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  };
}
