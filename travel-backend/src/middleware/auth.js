import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { sendError } from '../utils/response.js';

export function authMiddleware(req, res, next) {
  const header = req.headers['authorization'];
  let token = '';

  if (header && header.startsWith('Bearer ')) {
    token = header.slice('Bearer '.length).trim();
  }

  // 兼容导出链接在浏览器中直接打开（无法自定义请求头）的场景
  if (!token && typeof req.query.access_token === 'string') {
    token = req.query.access_token.trim();
  }

  if (!token) {
    return sendError(res, 'Unauthorized', 401);
  }
  try {
    const payload = jwt.verify(token, env.jwt.secret, { algorithms: ['HS256'] });
    if (!payload || typeof payload !== 'object' || !('user_id' in payload)) {
      return sendError(res, 'Invalid token payload', 401);
    }
    req.user = payload;
    next();
  } catch (error) {
    return sendError(res, 'Invalid or expired token', 401);
  }
}
