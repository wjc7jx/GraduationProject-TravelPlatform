import { Op } from 'sequelize';
import { Friendship, User, sequelize } from '../models/index.js';

function toUserBrief(user) {
  const raw = typeof user?.toJSON === 'function' ? user.toJSON() : user;
  return {
    user_id: Number(raw?.user_id),
    nickname: raw?.nickname || '旅行者',
    avatar_url: raw?.avatar_url || '',
  };
}

export async function areFriends(userId, friendId) {
  const uid = Number(userId);
  const fid = Number(friendId);
  if (!Number.isFinite(uid) || !Number.isFinite(fid) || uid <= 0 || fid <= 0) return false;
  if (uid === fid) return false;

  const row = await Friendship.findOne({
    where: {
      user_id: uid,
      friend_id: fid,
    },
  });

  return Boolean(row);
}

export async function listFriends(userId) {
  const uid = Number(userId);
  if (!Number.isFinite(uid) || uid <= 0) {
    const err = new Error('用户ID无效');
    err.status = 400;
    throw err;
  }

  const links = await Friendship.findAll({
    where: { user_id: uid },
    order: [['created_at', 'DESC']],
  });

  const friendIds = Array.from(new Set(
    links
      .map((item) => Number(item.friend_id))
      .filter((item) => Number.isFinite(item) && item > 0)
  ));

  if (!friendIds.length) return [];

  const users = await User.findAll({
    where: {
      user_id: {
        [Op.in]: friendIds,
      },
      status: 1,
    },
    attributes: ['user_id', 'nickname', 'avatar_url'],
  });

  const userMap = new Map(users.map((item) => [Number(item.user_id), toUserBrief(item)]));
  return friendIds.map((id) => userMap.get(id)).filter(Boolean);
}

export async function acceptInvite(inviterUserId, currentUserId) {
  const inviterId = Number(inviterUserId);
  const currentId = Number(currentUserId);

  if (!Number.isFinite(inviterId) || inviterId <= 0) {
    const err = new Error('邀请人ID无效');
    err.status = 400;
    throw err;
  }
  if (!Number.isFinite(currentId) || currentId <= 0) {
    const err = new Error('当前用户ID无效');
    err.status = 400;
    throw err;
  }
  if (inviterId === currentId) {
    const err = new Error('不能添加自己为好友');
    err.status = 400;
    throw err;
  }

  const users = await User.findAll({
    where: {
      user_id: {
        [Op.in]: [inviterId, currentId],
      },
      status: 1,
    },
    attributes: ['user_id', 'nickname', 'avatar_url'],
  });

  if (users.length < 2) {
    const err = new Error('邀请人不存在或不可用');
    err.status = 404;
    throw err;
  }

  await sequelize.transaction(async (transaction) => {
    await Friendship.findOrCreate({
      where: {
        user_id: inviterId,
        friend_id: currentId,
      },
      defaults: {
        user_id: inviterId,
        friend_id: currentId,
      },
      transaction,
    });

    await Friendship.findOrCreate({
      where: {
        user_id: currentId,
        friend_id: inviterId,
      },
      defaults: {
        user_id: currentId,
        friend_id: inviterId,
      },
      transaction,
    });
  });

  const inviter = users.find((item) => Number(item.user_id) === inviterId);
  return {
    inviter: toUserBrief(inviter),
    added: true,
  };
}
