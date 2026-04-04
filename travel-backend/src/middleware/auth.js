import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { sendError } from '../utils/response.js';

export function authMiddleware(req, res, next) {
  const header = req.headers['authorization'];
  if (!header || !header.startsWith('Bearer ')) {
    return sendError(res, 'Unauthorized', 401);
  }
  const token = header.slice('Bearer '.length).trim();
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
