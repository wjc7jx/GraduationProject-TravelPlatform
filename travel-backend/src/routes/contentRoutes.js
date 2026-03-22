import { Router } from 'express';
import { getContents, addContent } from '../controllers/contentController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router({ mergeParams: true });

router.use(authMiddleware);
router.get('/:projectId/contents', getContents);
router.post('/:projectId/contents', addContent);

export default router;
