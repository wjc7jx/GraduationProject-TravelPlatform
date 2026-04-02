export function errorHandler(err, req, res, next) {
  console.error('全局错误拦截:', err);
  const status = err.status || 500;
  res.status(status).json({
    message: err.message || '内部服务器错误',
  });
}
