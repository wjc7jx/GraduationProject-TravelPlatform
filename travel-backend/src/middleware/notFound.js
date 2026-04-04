import { sendError } from '../utils/response.js';

export function notFound(req, res, next) {
  sendError(res, '资源未找到', 404);
}
