import { Router } from 'express';
import {
	acceptFriendInvite,
	applyFriendInviteCode,
	generateFriendInviteCode,
	getFriends,
} from '../controllers/friendController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);
router.get('/', getFriends);
router.post('/invite/accept', acceptFriendInvite);
router.post('/invite-code', generateFriendInviteCode);
router.post('/invite-code/apply', applyFriendInviteCode);

export default router;
