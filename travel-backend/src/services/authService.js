import jwt from 'jsonwebtoken';
import { User } from '../models/index.js';
import { env } from '../config/env.js';

export async function loginOrRegister({ openid, nickname, avatar_url }) {
  if (!openid) {
    throw new Error('openid is required');
  }
  const [user] = await User.findOrCreate({
    where: { openid },
    defaults: { nickname: nickname || '旅行者', avatar_url },
  });

  // 如果用户已存在且传了新昵称/头像，可轻量更新
  let updatedUser = user;
  if ((nickname && nickname !== user.nickname) || (avatar_url && avatar_url !== user.avatar_url)) {
    user.nickname = nickname || user.nickname;
    user.avatar_url = avatar_url || user.avatar_url;
    updatedUser = await user.save();
  }

  const token = jwt.sign({ user_id: updatedUser.user_id, openid: updatedUser.openid }, env.jwt.secret, {
    expiresIn: env.jwt.expiresIn,
  });

  return { user: updatedUser, token };
}
