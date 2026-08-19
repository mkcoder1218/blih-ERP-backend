import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { authRequired } from '../../middlewares/auth';
import { asyncHandler } from '../../utils/asyncHandler';
import { ContentTranslationController } from './contentTranslation.controller';

const router = Router();
const controller = new ContentTranslationController();

function translationManagerAccess(req: Request, _res: Response, next: NextFunction) {
  const user = req.user as any;
  const roles: string[] = user?.roles ?? [];
  if (user?.isPlatformSuperAdmin || roles.includes('BUSINESS_ADMIN') || roles.includes('HR_MANAGER')) {
    return next();
  }
  return next({ statusCode: 403, message: 'Insufficient permissions' });
}

router.use(authRequired);
router.get('/:entityType/:entityId', asyncHandler(controller.list));
router.put(
  '/:entityType/:entityId/:field',
  translationManagerAccess,
  asyncHandler(controller.saveField),
);
router.delete(
  '/:entityType/:entityId/:field',
  translationManagerAccess,
  asyncHandler(controller.removeField),
);

export const contentTranslationRoutes = router;
