import { wechatLogin } from '../services/authService.js';
import { sendSuccess } from '../utils/response.js';

export async function login(req, res, next) {
  try {
    const { code, nickname, avatar_url } = req.body;
    // 调用完善后的微信登录服务（基于 code）
    const result = await wechatLogin({ code, nickname, avatar_url });
    sendSuccess(res, {
      user: {
        user_id: result.user.user_id,
        openid: result.user.openid,
        nickname: result.user.nickname,
        avatar_url: result.user.avatar_url,
      },
      token: result.token,
    }, '登录成功');
  } catch (error) {
    next(error);
  }
}
