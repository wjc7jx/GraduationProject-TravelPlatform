import { sendError } from '../utils/response.js';

export function errorHandler(err, req, res, next) {
  console.error('全局错误拦截:', err);
  const status = err.status || 500;
  sendError(res, err.message || '内部服务器错误', status);
}
