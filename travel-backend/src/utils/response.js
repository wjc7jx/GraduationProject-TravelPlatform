export function sendSuccess(res, data = null, message = 'ok', httpStatus = 200) {
  return res.status(httpStatus).json({
    code: httpStatus,
    message,
    data,
  });
}

export function sendError(res, message = '内部服务器错误', httpStatus = 500, data = null) {
  return res.status(httpStatus).json({
    code: httpStatus,
    message,
    data,
  });
}
