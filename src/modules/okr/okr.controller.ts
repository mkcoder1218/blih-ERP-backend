
import type { Request, Response } from 'express';
import { OKRService } from './okr.service';
import { AuditLogService } from '../../services/auditLog.service';

export class OKRController {
  private service = new OKRService();

  createObjective = async (req: Request, res: Response) => {
    try {
      const obj = await this.service.createObjective(req.user!.businessId, req.user!.id, req.body);
      await AuditLogService.log('CREATE_OBJECTIVE', 'okr_objective', String(obj.id), null, obj, req);
      res.status(201).json({ objective: obj });
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  };

  updateObjective = async (req: Request, res: Response) => {
    try {
      const obj = await this.service.updateObjective(req.user!.businessId, req.params.id, req.body);
      await AuditLogService.log('UPDATE_OBJECTIVE', 'okr_objective', String(obj.id), null, req.body, req);
      res.json({ objective: obj });
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  };

  getObjective = async (req: Request, res: Response) => {
    const obj = await this.service.getObjective(req.user!.businessId, req.params.id);
    if (!obj) return res.status(404).json({ message: 'Not found' });
    res.json({ objective: obj });
  };

  listObjectives = async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const size = parseInt(req.query.size as string) || 20;
    res.json(await this.service.listObjectives(req.user!.businessId, req.query, page, size));
  };

  createKeyResult = async (req: Request, res: Response) => {
    try {
      const kr = await this.service.createKeyResult(req.user!.businessId, req.body.objectiveId, req.body);
      await AuditLogService.log('CREATE_KEY_RESULT', 'okr_key_result', String(kr.id), null, kr, req);
      res.status(201).json({ keyResult: kr });
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  };

  updateKeyResult = async (req: Request, res: Response) => {
    try {
      const kr = await this.service.updateKeyResult(req.user!.businessId, req.params.id, req.body);
      await AuditLogService.log('UPDATE_KEY_RESULT', 'okr_key_result', String(kr.id), null, req.body, req);
      res.json({ keyResult: kr });
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  };

  logProgressUpdate = async (req: Request, res: Response) => {
    try {
      const update = await this.service.logProgressUpdate(req.user!.businessId, req.user!.id, req.body);
      await AuditLogService.log('LOG_OKR_PROGRESS', 'okr_progress_update', String(update.id), null, update, req);
      res.status(201).json({ progressUpdate: update });
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  };

  evaluateObjective = async (req: Request, res: Response) => {
    try {
      const evaluation = await this.service.evaluateObjective(req.user!.businessId, req.user!.id, req.body);
      await AuditLogService.log('EVALUATE_OBJECTIVE', 'okr_evaluation', String(evaluation.id), null, evaluation, req);
      res.status(201).json({ evaluation });
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  };
}
