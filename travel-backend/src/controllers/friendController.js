import { acceptInvite, listFriends } from '../services/friendService.js';
import { sendSuccess } from '../utils/response.js';

export async function getFriends(req, res, next) {
  try {
    const data = await listFriends(req.user.user_id);
    sendSuccess(res, data, '获取好友列表成功');
  } catch (error) {
    next(error);
  }
}

export async function acceptFriendInvite(req, res, next) {
  try {
    const inviterUserId = Number(req.body?.inviter_user_id);
    const data = await acceptInvite(inviterUserId, req.user.user_id);
    sendSuccess(res, data, '已建立好友关系');
  } catch (error) {
    next(error);
  }
}
