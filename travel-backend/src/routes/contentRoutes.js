import { Router } from 'express';
import { getContents, addContent, editContent, removeContent } from '../controllers/contentController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router({ mergeParams: true });

router.use(authMiddleware);
router.get('/:projectId/contents', getContents);
router.post('/:projectId/contents', addContent);
router.put('/:projectId/contents/:contentId', editContent);
router.delete('/:projectId/contents/:contentId', removeContent);

export default router;
