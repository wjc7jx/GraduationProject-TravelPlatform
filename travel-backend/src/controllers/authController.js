import { loginOrRegister } from '../services/authService.js';

export async function login(req, res, next) {
  try {
    const { openid, nickname, avatar_url } = req.body;
    const result = await loginOrRegister({ openid, nickname, avatar_url });
    res.json({
      user: {
        user_id: result.user.user_id,
        openid: result.user.openid,
        nickname: result.user.nickname,
        avatar_url: result.user.avatar_url,
      },
      token: result.token,
    });
  } catch (error) {
    next(error);
  }
}
