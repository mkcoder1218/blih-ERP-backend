import { Router } from 'express';
import { authRequired } from '../../middlewares/auth';
import { requirePermission, requireAnyPermission } from '../../middlewares/permission';
import { requireActiveModule } from '../../middlewares/module';
import { asyncHandler } from '../../utils/asyncHandler';
import { validate } from '../../middlewares/validate';
import { ProcedureController } from './procedure.controller';
import {
  createProcedureSchema,
  updateProcedureSchema,
  procedureIdParamSchema,
  listProceduresQuerySchema,
  revisionIdParamSchema,
  reviewDecisionSchema
} from './procedure.validation';

const router = Router();
const controller = new ProcedureController();

// Mandatory module guard and base permission check
router.use(authRequired, requireActiveModule('procedures'), requirePermission('procedures.access'));

// ── Procedures CRUDR ──
router.post(
  '/',
  requirePermission('procedures.procedure.create'),
  validate(createProcedureSchema, 'body'),
  asyncHandler(controller.createProcedure)
);

router.get(
  '/',
  requirePermission('procedures.procedure.view'),
  validate(listProceduresQuerySchema, 'query'),
  asyncHandler(controller.listProcedures)
);

router.get(
  '/:id',
  requirePermission('procedures.procedure.view'),
  validate(procedureIdParamSchema, 'params'),
  asyncHandler(controller.getProcedure)
);

router.patch(
  '/:id',
  requireAnyPermission('procedures.procedure.update_own', 'procedures.procedure.update_any'),
  validate(procedureIdParamSchema, 'params'),
  validate(updateProcedureSchema, 'body'),
  asyncHandler(controller.updateProcedure)
);

router.delete(
  '/:id',
  requirePermission('procedures.procedure.delete'),
  validate(procedureIdParamSchema, 'params'),
  asyncHandler(controller.deleteProcedure)
);

router.patch(
  '/:id/restore',
  requirePermission('procedures.procedure.restore'),
  validate(procedureIdParamSchema, 'params'),
  asyncHandler(controller.restoreProcedure)
);

// ── Workflow Actions ──
router.post(
  '/:id/submit-review',
  requirePermission('procedures.procedure.submit_review'),
  validate(procedureIdParamSchema, 'params'),
  asyncHandler(controller.submitForReview)
);

router.post(
  '/:id/approve',
  requirePermission('procedures.procedure.review'),
  validate(procedureIdParamSchema, 'params'),
  asyncHandler(controller.approveProcedure)
);

router.post(
  '/:id/request-changes',
  requirePermission('procedures.procedure.review'),
  validate(procedureIdParamSchema, 'params'),
  validate(reviewDecisionSchema, 'body'),
  asyncHandler(controller.requestChanges)
);

router.post(
  '/:id/publish',
  requirePermission('procedures.procedure.publish'),
  validate(procedureIdParamSchema, 'params'),
  asyncHandler(controller.publishProcedure)
);

router.post(
  '/:id/unpublish',
  requirePermission('procedures.procedure.publish'),
  validate(procedureIdParamSchema, 'params'),
  asyncHandler(controller.unpublishProcedure)
);

router.post(
  '/:id/archive',
  requirePermission('procedures.procedure.archive'),
  validate(procedureIdParamSchema, 'params'),
  asyncHandler(controller.archiveProcedure)
);

// ── Revisions ──
router.get(
  '/:id/revisions',
  requirePermission('procedures.procedure.view_revisions'),
  validate(procedureIdParamSchema, 'params'),
  asyncHandler(controller.listRevisions)
);

router.get(
  '/:id/revisions/:revisionId',
  requirePermission('procedures.procedure.view_revisions'),
  validate(revisionIdParamSchema, 'params'),
  asyncHandler(controller.getRevision)
);

router.post(
  '/:id/revisions/:revisionId/restore',
  requirePermission('procedures.procedure.restore_revision'),
  validate(revisionIdParamSchema, 'params'),
  asyncHandler(controller.restoreRevision)
);

export const procedureRoutes = router;
