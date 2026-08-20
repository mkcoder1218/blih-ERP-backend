import { Router } from 'express';
import { kpiController } from './kpi.controller';
import { authRequired } from '../../middlewares/auth';
import { requireActiveModule } from '../../middlewares/module';

const router = Router();

router.use(authRequired, requireActiveModule('okr'));

router.get('/', kpiController.list);
router.post('/', kpiController.create);
router.get('/dashboard', kpiController.dashboardSummary);
router.post('/sync', kpiController.syncAutomatic);

router.get('/:id', kpiController.get);
router.patch('/:id', kpiController.update);
router.delete('/:id', kpiController.delete);
router.post('/:id/check-in', kpiController.manualCheckIn);
router.get('/:id/trend', kpiController.trendHistory);

export default router;
