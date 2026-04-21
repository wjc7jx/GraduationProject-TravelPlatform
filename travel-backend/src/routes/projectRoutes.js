import { Router } from 'express';
import {
	getProjects,
	getProjectDetail,
	addProject,
	editProject,
	pinProject,
	createShare,
	getShares,
	getShareQrcode,
	markShareVisited,
	removeProject,
	revokeShare,
} from '../controllers/projectController.js';
import { exportProjectHtml, exportProjectPdf } from '../controllers/exportController.js';
import { getProjectPrivacyRule, updateProjectPrivacyRule } from '../controllers/privacyController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);
router.get('/', getProjects);
router.get('/:id/exports/html', exportProjectHtml);
router.get('/:id/exports/pdf', exportProjectPdf);
router.get('/:id/privacy', getProjectPrivacyRule);
router.put('/:id/privacy', updateProjectPrivacyRule);
router.get('/:id/shares', getShares);
router.post('/:id/shares', createShare);
router.get('/:id/shares/:shareId/qrcode', getShareQrcode);
router.post('/:id/shares/:shareId/visit', markShareVisited);
router.patch('/:id/shares/:shareId/revoke', revokeShare);
router.get('/:id', getProjectDetail);
router.post('/', addProject);
router.put('/:id', editProject);
router.patch('/:id/pin', pinProject);
router.delete('/:id', removeProject);

export default router;
