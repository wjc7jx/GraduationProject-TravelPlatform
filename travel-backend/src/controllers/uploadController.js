export function uploadFile(req, res, next) {
  try {
    if (!req.file) {
      const err = new Error('请提供要上传的文件');
      err.status = 400;
      throw err;
    }
    // 返回包含服务器基础路径的访问URL，或者直接返回相对路径，建议返回相对根目录的URL路径
    const fileUrl = `/uploads/${req.file.filename}`;
    res.status(201).json({
      url: fileUrl,
      mimetype: req.file.mimetype,
      size: req.file.size
    });
  } catch (error) {
    next(error);
  }
}