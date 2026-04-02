export function notFound(req, res, next) {
  res.status(404).json({ message: '资源未找到' });
}
