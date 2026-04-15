import { Router } from 'express';
import {
	getProjects,
	getTimelineMapData,
	getProjectDetail,
	addProject,
	editProject,
	pinProject,
	removeProject,
} from '../controllers/projectController.js';
import { exportProjectHtml, exportProjectPdf } from '../controllers/exportController.js';
import { getProjectPrivacyRule, updateProjectPrivacyRule } from '../controllers/privacyController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);
router.get('/', getProjects);
router.get('/timeline-map', getTimelineMapData);
router.get('/:id/exports/html', exportProjectHtml);
router.get('/:id/exports/pdf', exportProjectPdf);
router.get('/:id/privacy', getProjectPrivacyRule);
router.put('/:id/privacy', updateProjectPrivacyRule);
router.get('/:id', getProjectDetail);
router.post('/', addProject);
router.put('/:id', editProject);
router.patch('/:id/pin', pinProject);
router.delete('/:id', removeProject);

export default router;
