import { Router } from 'express';
import { evaluationController } from './evaluation.controller';
import { authRequired } from '../../middlewares/auth';
import { requireActiveModule } from '../../middlewares/module';

const router = Router();

router.use(authRequired, requireActiveModule('okr'));

router.get('/templates', evaluationController.listTemplates);
router.post('/templates', evaluationController.createTemplate);
router.get('/templates/:id', evaluationController.getTemplate);
router.patch('/templates/:id', evaluationController.updateTemplate);
router.delete('/templates/:id', evaluationController.deleteTemplate);
router.post('/templates/:id/duplicate', evaluationController.duplicateTemplate);
router.get('/templates/:id/schema', evaluationController.downloadSchema);
router.get('/templates/:id/stats', evaluationController.templateStats);

router.get('/assignments', evaluationController.listUserAssignments);
router.post('/assignments', evaluationController.assignTemplate);
router.get('/assignments/:id', evaluationController.getAssignment);
router.post('/assignments/submit', evaluationController.submitAssignmentResponse);
router.get('/assignments/:assignmentId/response', evaluationController.getResponse);

export default router;
