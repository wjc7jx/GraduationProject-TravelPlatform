import { Router } from 'express';
import {
	deleteFriend,
	acceptFriendInvite,
	applyFriendInviteCode,
	generateFriendInviteCode,
	getFriends,
	patchFriendRemark,
} from '../controllers/friendController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);
router.get('/', getFriends);
router.post('/invite/accept', acceptFriendInvite);
router.post('/invite-code', generateFriendInviteCode);
router.post('/invite-code/apply', applyFriendInviteCode);
router.delete('/:friendId', deleteFriend);
router.patch('/:friendId', patchFriendRemark);

export default router;
