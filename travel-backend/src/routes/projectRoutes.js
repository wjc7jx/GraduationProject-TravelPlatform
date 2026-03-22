import { Router } from 'express';
import { getProjects, addProject } from '../controllers/projectController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);
router.get('/', getProjects);
router.post('/', addProject);

export default router;
