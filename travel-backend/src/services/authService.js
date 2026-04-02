import jwt from 'jsonwebtoken';
import { User } from '../models/index.js';
import { env } from '../config/env.js';

/**
 * 微信快速登录（通过 code 获取 openid）
 */
export async function wechatLogin({ code, nickname, avatar_url }) {
  if (!code) {
    throw new Error('微信登录凭证 code 不能为空');
  }

  // 1. 调用微信接口换取 openid
  const { appId, appSecret } = env.wechat;
  if (!appId || !appSecret) {
    throw new Error('服务器未配置微信开发者信息 (appId/appSecret)');
  }

  const wxUrl = `https://api.weixin.qq.com/sns/jscode2session?appid=${appId}&secret=${appSecret}&js_code=${code}&grant_type=authorization_code`;
  
  const wxRes = await fetch(wxUrl);
  const wxData = await wxRes.json();

  if (wxData.errcode) {
    throw new Error(`微信登录验证失败: ${wxData.errmsg}`);
  }

  const openid = wxData.openid;
  if (!openid) {
    throw new Error('无法从微信服务器获取 openid');
  }

  // 2. 根据 openid 查找或创建用户
  const [user] = await User.findOrCreate({
    where: { openid },
    defaults: { nickname: nickname || '旅行者', avatar_url },
  });

  // 3. 如果用户已存在且传了新昵称/头像，可更新基础信息
  let updatedUser = user;
  if ((nickname && nickname !== user.nickname) || (avatar_url && avatar_url !== user.avatar_url)) {
    user.nickname = nickname || user.nickname;
    user.avatar_url = avatar_url || user.avatar_url;
    updatedUser = await user.save();
  }

  // 4. 签发 JWT Token
  const token = jwt.sign({ user_id: updatedUser.user_id, openid: updatedUser.openid }, env.jwt.secret, {
    expiresIn: env.jwt.expiresIn,
  });

  return { user: updatedUser, token };
}
