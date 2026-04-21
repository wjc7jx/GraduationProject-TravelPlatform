import { sendError } from '../utils/response.js';

export function errorHandler(err, req, res, next) {
  console.error('全局错误拦截:', err);
  const status = err.status || 500;
  // err.code / err.details：业务错误自定义字段，前端可据 code 区分处理
  const payload = (err.code || err.details)
    ? { code: err.code || null, details: err.details || null }
    : null;
  sendError(res, err.message || '内部服务器错误', status, payload);
}
