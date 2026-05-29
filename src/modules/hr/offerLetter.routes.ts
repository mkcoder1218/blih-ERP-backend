import { Router } from 'express';
import { OfferLetterController } from './offerLetter.controller';
import { authRequired } from '../../middlewares/auth';
import { requireRole } from '../../middlewares/role';
import { asyncHandler } from '../../utils/asyncHandler';

const router = Router();
const controller = new OfferLetterController();

// Template routes
router.get('/templates', authRequired, requireRole('HR_MANAGER', 'BUSINESS_ADMIN'), asyncHandler(controller.getTemplates));
router.post('/templates', authRequired, requireRole('HR_MANAGER', 'BUSINESS_ADMIN'), asyncHandler(controller.createTemplate));
router.patch('/templates/:id', authRequired, requireRole('HR_MANAGER', 'BUSINESS_ADMIN'), asyncHandler(controller.updateTemplate));
router.delete('/templates/:id', authRequired, requireRole('HR_MANAGER', 'BUSINESS_ADMIN'), asyncHandler(controller.deleteTemplate));

// Offer Letter routes
router.get('/', authRequired, requireRole('HR_MANAGER', 'BUSINESS_ADMIN'), asyncHandler(controller.getOfferLetters));
router.post('/preview', authRequired, requireRole('HR_MANAGER', 'BUSINESS_ADMIN'), asyncHandler(controller.previewOfferLetter));
router.post('/', authRequired, requireRole('HR_MANAGER', 'BUSINESS_ADMIN'), asyncHandler(controller.createOfferLetter));
router.get('/:id', authRequired, requireRole('HR_MANAGER', 'BUSINESS_ADMIN'), asyncHandler(controller.getOfferLetter));
router.patch('/:id', authRequired, requireRole('HR_MANAGER', 'BUSINESS_ADMIN'), asyncHandler(controller.updateOfferLetter));
router.delete('/:id', authRequired, requireRole('HR_MANAGER', 'BUSINESS_ADMIN'), asyncHandler(controller.deleteOfferLetter));
router.post('/:id/generate-pdf', authRequired, requireRole('HR_MANAGER', 'BUSINESS_ADMIN'), asyncHandler(controller.generatePdf));
router.post('/:id/send', authRequired, requireRole('HR_MANAGER', 'BUSINESS_ADMIN'), asyncHandler(controller.sendOfferLetter));

export const offerLetterRoutes = router;

// Public routes for candidates
const publicRouter = Router();
publicRouter.get('/:id/accept', asyncHandler(controller.acceptOffer));
publicRouter.get('/:id/reject', asyncHandler(controller.rejectOffer));
export const publicOfferLetterRoutes = publicRouter;
