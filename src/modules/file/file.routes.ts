
import { Router } from 'express';
import { authRequired } from '../../middlewares/auth';
import { upload } from '../../middlewares/upload';
import { asyncHandler } from '../../utils/asyncHandler';
import { FileController } from './file.controller';

const router = Router();
const controller = new FileController();

// Allow OPTIONS preflight through without auth — CORS headers are set at app level
router.options('*', (req, res) => {
  console.log(`[PREFLIGHT] OPTIONS ${req.path} origin=${req.headers.origin ?? 'none'}`);
  res.sendStatus(204);
});

// Token-based download — no auth header needed, token is in query string.
// This allows direct browser/IDM opens without fetch() interception.
router.get('/:id/download', asyncHandler(controller.download));

router.use(authRequired);

router.get('/', asyncHandler(controller.list));
// Issue a short-lived signed token for a file (requires auth)
router.get('/:id/token', asyncHandler(controller.getDownloadToken));
router.post('/upload', upload.single('file'), asyncHandler(controller.uploadSingle));
router.post('/upload/bulk', upload.array('files', 10), asyncHandler(controller.uploadMultiple));
router.delete('/:id', asyncHandler(controller.remove));

export const fileRoutes = router;
