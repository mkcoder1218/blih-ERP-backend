import { Router } from 'express';
import { authRequired } from '../../middlewares/auth';
import { requireActiveModule } from '../../middlewares/module';
import { asyncHandler } from '../../utils/asyncHandler';
import { OKRController } from './okr.controller';

const router = Router();
const controller = new OKRController();

router.use(authRequired, requireActiveModule('okr'));

// Objective routes
router.post('/objectives', asyncHandler(controller.createObjective));
router.get('/objectives', asyncHandler(controller.listObjectives));
router.get('/objectives/:id', asyncHandler(controller.getObjective));
router.patch('/objectives/:id', asyncHandler(controller.updateObjective));
router.delete('/objectives/:id', asyncHandler(controller.deleteObjective));

// Progress Check-In route
router.post('/progress', asyncHandler(controller.logProgressUpdate));

// Metric sync refresh route
router.post('/refresh', asyncHandler(controller.refreshMetrics));

export const okrRoutes = router;
