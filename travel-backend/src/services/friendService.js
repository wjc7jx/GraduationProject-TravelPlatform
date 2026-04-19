import { Op } from 'sequelize';
import { Friendship, InvitationCode, User, sequelize } from '../models/index.js';

const INVITE_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const DEFAULT_MAX_USES = 3;
const DEFAULT_EXPIRES_HOURS = 24;
const MAX_EXPIRES_HOURS = 30 * 24;

function toUserBrief(user) {
  const raw = typeof user?.toJSON === 'function' ? user.toJSON() : user;
  return {
    user_id: Number(raw?.user_id),
    nickname: raw?.nickname || '旅行者',
    avatar_url: raw?.avatar_url || '',
  };
}

function randomInviteCode(length = 8) {
  let code = '';
  for (let i = 0; i < length; i += 1) {
    const index = Math.floor(Math.random() * INVITE_CODE_ALPHABET.length);
    code += INVITE_CODE_ALPHABET[index];
  }
  return code;
}

function toInviteCodePayload(row) {
  const raw = typeof row?.toJSON === 'function' ? row.toJSON() : row;
  return {
    code: raw.code,
    max_uses: Number(raw.max_uses),
    used_count: Number(raw.used_count),
    expires_at: raw.expires_at,
    status: Number(raw.status),
    created_at: raw.created_at,
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

  const friendLinkRows = links
    .map((item) => {
      const raw = typeof item?.toJSON === 'function' ? item.toJSON() : item;
      return {
        friend_id: Number(raw?.friend_id),
        remark: raw?.remark == null ? null : String(raw.remark),
      };
    })
    .filter((item) => Number.isFinite(item.friend_id) && item.friend_id > 0);

  const friendIds = Array.from(new Set(friendLinkRows.map((item) => item.friend_id)));

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
  const remarkMap = new Map(friendLinkRows.map((item) => [item.friend_id, item.remark]));
  return friendIds
    .map((id) => {
      const brief = userMap.get(id);
      if (!brief) return null;
      return {
        ...brief,
        remark: remarkMap.get(id) || '',
      };
    })
    .filter(Boolean);
}

export async function updateFriendRemark(currentUserId, friendId, remarkInput) {
  const uid = Number(currentUserId);
  const fid = Number(friendId);
  if (!Number.isFinite(uid) || uid <= 0) {
    const err = new Error('当前用户ID无效');
    err.status = 400;
    throw err;
  }
  if (!Number.isFinite(fid) || fid <= 0) {
    const err = new Error('好友ID无效');
    err.status = 400;
    throw err;
  }
  if (uid === fid) {
    const err = new Error('不能备注自己');
    err.status = 400;
    throw err;
  }

  const remark = String(remarkInput ?? '').trim();
  if (remark.length > 50) {
    const err = new Error('备注长度不能超过 50');
    err.status = 400;
    throw err;
  }

  const link = await Friendship.findOne({
    where: { user_id: uid, friend_id: fid },
  });
  if (!link) {
    const err = new Error('不是好友关系，无法设置备注');
    err.status = 404;
    throw err;
  }

  await link.update({ remark: remark ? remark : null });
  return { friend_id: fid, remark };
}

export async function removeFriend(currentUserId, friendId) {
  const uid = Number(currentUserId);
  const fid = Number(friendId);
  if (!Number.isFinite(uid) || uid <= 0) {
    const err = new Error('当前用户ID无效');
    err.status = 400;
    throw err;
  }
  if (!Number.isFinite(fid) || fid <= 0) {
    const err = new Error('好友ID无效');
    err.status = 400;
    throw err;
  }
  if (uid === fid) {
    const err = new Error('不能删除自己');
    err.status = 400;
    throw err;
  }

  return await sequelize.transaction(async (transaction) => {
    const aToB = await Friendship.destroy({
      where: { user_id: uid, friend_id: fid },
      transaction,
    });
    const bToA = await Friendship.destroy({
      where: { user_id: fid, friend_id: uid },
      transaction,
    });

    if (!aToB && !bToA) {
      const err = new Error('不是好友关系');
      err.status = 404;
      throw err;
    }

    return { removed: true };
  });
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

export async function createInviteCode(creatorUserId, payload = {}) {
  const creatorId = Number(creatorUserId);
  if (!Number.isFinite(creatorId) || creatorId <= 0) {
    const err = new Error('用户ID无效');
    err.status = 400;
    throw err;
  }

  const maxUses = Number(payload.max_uses ?? DEFAULT_MAX_USES);
  const expiresInHours = Number(payload.expires_in_hours ?? DEFAULT_EXPIRES_HOURS);

  if (!Number.isInteger(maxUses) || maxUses <= 0 || maxUses > 100) {
    const err = new Error('max_uses 必须是 1-100 的整数');
    err.status = 400;
    throw err;
  }
  if (!Number.isInteger(expiresInHours) || expiresInHours <= 0 || expiresInHours > MAX_EXPIRES_HOURS) {
    const err = new Error(`expires_in_hours 必须是 1-${MAX_EXPIRES_HOURS} 的整数`);
    err.status = 400;
    throw err;
  }

  const user = await User.findOne({
    where: { user_id: creatorId, status: 1 },
    attributes: ['user_id'],
  });
  if (!user) {
    const err = new Error('用户不存在或不可用');
    err.status = 404;
    throw err;
  }

  const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);

  let created = null;
  for (let i = 0; i < 8; i += 1) {
    const code = randomInviteCode(8);
    try {
      created = await InvitationCode.create({
        code,
        creator_user_id: creatorId,
        max_uses: maxUses,
        used_count: 0,
        expires_at: expiresAt,
        status: 1,
      });
      break;
    } catch (error) {
      if (error?.name !== 'SequelizeUniqueConstraintError') {
        throw error;
      }
    }
  }

  if (!created) {
    const err = new Error('邀请码生成失败，请重试');
    err.status = 500;
    throw err;
  }

  return toInviteCodePayload(created);
}

export async function applyInviteCode(codeInput, currentUserId) {
  const code = String(codeInput || '').trim().toUpperCase();
  const currentId = Number(currentUserId);

  if (!code) {
    const err = new Error('邀请码不能为空');
    err.status = 400;
    throw err;
  }
  if (!Number.isFinite(currentId) || currentId <= 0) {
    const err = new Error('当前用户ID无效');
    err.status = 400;
    throw err;
  }

  const currentUser = await User.findOne({
    where: { user_id: currentId, status: 1 },
    attributes: ['user_id'],
  });
  if (!currentUser) {
    const err = new Error('当前用户不存在或不可用');
    err.status = 404;
    throw err;
  }

  let inviterBrief = null;

  await sequelize.transaction(async (transaction) => {
    const invite = await InvitationCode.findOne({
      where: { code },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!invite) {
      const err = new Error('邀请码不存在');
      err.status = 404;
      throw err;
    }

    const inviteRaw = invite.toJSON();
    const inviterId = Number(inviteRaw.creator_user_id);

    if (inviterId === currentId) {
      const err = new Error('不能使用自己的邀请码');
      err.status = 400;
      throw err;
    }

    if (Number(inviteRaw.status) !== 1) {
      const err = new Error('邀请码已失效');
      err.status = 400;
      throw err;
    }

    if (inviteRaw.expires_at && new Date(inviteRaw.expires_at).getTime() < Date.now()) {
      const err = new Error('邀请码已过期');
      err.status = 400;
      throw err;
    }

    if (Number(inviteRaw.used_count) >= Number(inviteRaw.max_uses)) {
      const err = new Error('邀请码使用次数已达上限');
      err.status = 400;
      throw err;
    }

    const inviter = await User.findOne({
      where: { user_id: inviterId, status: 1 },
      attributes: ['user_id', 'nickname', 'avatar_url'],
      transaction,
    });
    if (!inviter) {
      const err = new Error('邀请码创建者不存在或不可用');
      err.status = 404;
      throw err;
    }

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

    await invite.update(
      {
        used_count: Number(inviteRaw.used_count) + 1,
      },
      { transaction }
    );

    inviterBrief = toUserBrief(inviter);
  });

  return {
    inviter: inviterBrief,
    added: true,
  };
}
