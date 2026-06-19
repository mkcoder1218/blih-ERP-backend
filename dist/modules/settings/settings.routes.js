"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.settingsRoutes = void 0;
const express_1 = require("express");
const auth_1 = require("../../middlewares/auth");
const role_1 = require("../../middlewares/role");
const asyncHandler_1 = require("../../utils/asyncHandler");
const settings_controller_1 = require("./settings.controller");
const router = (0, express_1.Router)();
const controller = new settings_controller_1.SettingsController();
// ── Super-admin-or-business-admin helper ─────────────────────────────────────
// Platform super admins bypass role checks; business admins use requireRole.
function adminAccess() {
    return (req, res, next) => {
        if (req.user?.isPlatformSuperAdmin)
            return next();
        return (0, role_1.requireRole)('BUSINESS_ADMIN')(req, res, next);
    };
}
router.get('/public', (0, asyncHandler_1.asyncHandler)(controller.getPublicConfiguration));
router.patch('/branding', auth_1.authRequired, adminAccess(), (0, asyncHandler_1.asyncHandler)(controller.updateBranding));
router.patch('/localization', auth_1.authRequired, adminAccess(), (0, asyncHandler_1.asyncHandler)(controller.updateLocalization));
router.get('/', auth_1.authRequired, adminAccess(), (0, asyncHandler_1.asyncHandler)(controller.listSettings));
router.post('/', auth_1.authRequired, adminAccess(), (0, asyncHandler_1.asyncHandler)(controller.setSetting));
router.delete('/:key', auth_1.authRequired, adminAccess(), (0, asyncHandler_1.asyncHandler)(controller.deleteSetting));
router.post('/init', auth_1.authRequired, adminAccess(), (0, asyncHandler_1.asyncHandler)(controller.initializeDefaults));
exports.settingsRoutes = router;
