import { Router } from 'express';
import {
	getProjects,
	getTimelineMapData,
	getProjectDetail,
	addProject,
	editProject,
	removeProject,
} from '../controllers/projectController.js';
import { exportProjectHtml, exportProjectPdf } from '../controllers/exportController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);
router.get('/', getProjects);
router.get('/timeline-map', getTimelineMapData);
router.get('/:id/exports/html', exportProjectHtml);
router.get('/:id/exports/pdf', exportProjectPdf);
router.get('/:id', getProjectDetail);
router.post('/', addProject);
router.put('/:id', editProject);
router.delete('/:id', removeProject);

export default router;
