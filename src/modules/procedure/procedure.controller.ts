import type { Request, Response } from 'express';
import { ProcedureService } from './procedure.service';
import { AuditLogService } from '../../services/auditLog.service';

export class ProcedureController {
  private service = new ProcedureService();

  createProcedure = async (req: Request, res: Response) => {
    const procedure = await this.service.createProcedure(req.user!.businessId, req.user!.id, req.body);
    await AuditLogService.log('CREATE_PROCEDURE', 'procedure', String(procedure.id), null, procedure, req);
    res.status(201).json({ procedure });
  };

  listProcedures = async (req: Request, res: Response) => {
    const result = await this.service.listProcedures(req.user!.businessId, req.user!, req.query);
    res.json(result);
  };

  getProcedure = async (req: Request, res: Response) => {
    const procedure = await this.service.getProcedure(req.user!.businessId, req.params.id, req.user!);
    res.json({ procedure });
  };

  updateProcedure = async (req: Request, res: Response) => {
    const { changeSummary, ...data } = req.body;
    const before = await this.service.getProcedure(req.user!.businessId, req.params.id, req.user!);
    const procedure = await this.service.updateProcedure(req.user!.businessId, req.params.id, req.user!, data, changeSummary);
    await AuditLogService.log('UPDATE_PROCEDURE', 'procedure', String(procedure.id), before, { procedure, changeSummary }, req);
    res.json({ procedure });
  };

  deleteProcedure = async (req: Request, res: Response) => {
    const before = await this.service.getProcedure(req.user!.businessId, req.params.id, req.user!);
    const result = await this.service.deleteProcedure(req.user!.businessId, req.params.id, req.user!);
    await AuditLogService.log('DELETE_PROCEDURE', 'procedure', req.params.id, before, null, req);
    res.json(result);
  };

  restoreProcedure = async (req: Request, res: Response) => {
    const procedure = await this.service.restoreProcedure(req.user!.businessId, req.params.id, req.user!);
    await AuditLogService.log('RESTORE_PROCEDURE', 'procedure', String(procedure.id), null, procedure, req);
    res.json({ procedure });
  };

  // ── Workflow Actions ──

  submitForReview = async (req: Request, res: Response) => {
    const before = await this.service.getProcedure(req.user!.businessId, req.params.id, req.user!);
    const procedure = await this.service.submitForReview(req.user!.businessId, req.params.id, req.user!);
    await AuditLogService.log('SUBMIT_PROCEDURE_REVIEW', 'procedure', String(procedure.id), before, procedure, req);
    res.json({ procedure });
  };

  approveProcedure = async (req: Request, res: Response) => {
    const before = await this.service.getProcedure(req.user!.businessId, req.params.id, req.user!);
    const procedure = await this.service.approveProcedure(req.user!.businessId, req.params.id, req.user!);
    await AuditLogService.log('APPROVE_PROCEDURE', 'procedure', String(procedure.id), before, procedure, req);
    res.json({ procedure });
  };

  requestChanges = async (req: Request, res: Response) => {
    const { comment } = req.body;
    const before = await this.service.getProcedure(req.user!.businessId, req.params.id, req.user!);
    const procedure = await this.service.requestChanges(req.user!.businessId, req.params.id, req.user!, comment);
    await AuditLogService.log('REQUEST_PROCEDURE_CHANGES', 'procedure', String(procedure.id), before, { procedure, comment }, req);
    res.json({ procedure });
  };

  publishProcedure = async (req: Request, res: Response) => {
    const before = await this.service.getProcedure(req.user!.businessId, req.params.id, req.user!);
    const procedure = await this.service.publishProcedure(req.user!.businessId, req.params.id, req.user!);
    await AuditLogService.log('PUBLISH_PROCEDURE', 'procedure', String(procedure.id), before, procedure, req);
    res.json({ procedure });
  };

  unpublishProcedure = async (req: Request, res: Response) => {
    const before = await this.service.getProcedure(req.user!.businessId, req.params.id, req.user!);
    const procedure = await this.service.unpublishProcedure(req.user!.businessId, req.params.id, req.user!);
    await AuditLogService.log('UNPUBLISH_PROCEDURE', 'procedure', String(procedure.id), before, procedure, req);
    res.json({ procedure });
  };

  archiveProcedure = async (req: Request, res: Response) => {
    const before = await this.service.getProcedure(req.user!.businessId, req.params.id, req.user!);
    const procedure = await this.service.archiveProcedure(req.user!.businessId, req.params.id, req.user!);
    await AuditLogService.log('ARCHIVE_PROCEDURE', 'procedure', String(procedure.id), before, procedure, req);
    res.json({ procedure });
  };

  // ── Revisions ──

  listRevisions = async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const size = parseInt(req.query.size as string) || 20;
    const result = await this.service.listRevisions(req.user!.businessId, req.params.id, req.user!, page, size);
    res.json(result);
  };

  getRevision = async (req: Request, res: Response) => {
    const revision = await this.service.getRevision(req.user!.businessId, req.params.id, req.params.revisionId, req.user!);
    res.json({ revision });
  };

  restoreRevision = async (req: Request, res: Response) => {
    const procedure = await this.service.restoreRevision(req.user!.businessId, req.params.id, req.params.revisionId, req.user!);
    await AuditLogService.log('RESTORE_PROCEDURE_REVISION', 'procedure', String(procedure.id), null, { procedure, restoredFromRevisionId: req.params.revisionId }, req);
    res.json({ procedure });
  };
}
