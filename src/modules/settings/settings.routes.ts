import { Router } from 'express';
import { authRequired } from '../../middlewares/auth';
import { requireRole } from '../../middlewares/role';
import { requireAnyPermission } from '../../middlewares/permission';
import { asyncHandler } from '../../utils/asyncHandler';
import { SettingsController } from './settings.controller';

const router = Router();
const controller = new SettingsController();

// ── Super-admin-or-business-admin helper ─────────────────────────────────────
// Platform super admins bypass role checks; business admins use requireRole.
function adminAccess() {
  return (req: any, res: any, next: any) => {
    if (req.user?.isPlatformSuperAdmin) return next();
    return requireRole('BUSINESS_ADMIN')(req, res, next);
  };
}

router.get('/public', asyncHandler(controller.getPublicConfiguration));

router.patch('/branding',      authRequired, adminAccess(), asyncHandler(controller.updateBranding));
router.patch('/localization',  authRequired, adminAccess(), asyncHandler(controller.updateLocalization));
router.get('/',                authRequired, adminAccess(), asyncHandler(controller.listSettings));
router.post('/',               authRequired, adminAccess(), asyncHandler(controller.setSetting));
router.delete('/:key',         authRequired, adminAccess(), asyncHandler(controller.deleteSetting));
router.post('/init',           authRequired, adminAccess(), asyncHandler(controller.initializeDefaults));

export const settingsRoutes = router;