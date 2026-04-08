import { Router } from 'express';
import { acceptFriendInvite, getFriends } from '../controllers/friendController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);
router.get('/', getFriends);
router.post('/invite/accept', acceptFriendInvite);

export default router;
