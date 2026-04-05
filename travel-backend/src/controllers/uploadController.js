import { parseImageExif, parseTrajectory } from '../utils/parser.js';
import path from 'path';
import { sendSuccess } from '../utils/response.js';
import { buildFileAccessMeta } from '../utils/fileAccess.js';

export function uploadFile(req, res, next) {
  try {
    if (!req.file) {
      const err = new Error('请提供要上传的文件');
      err.status = 400;
      throw err;
    }
    const accessMeta = buildFileAccessMeta(req, req.file);
    sendSuccess(res, {
      ...accessMeta,
      mimetype: req.file.mimetype,
      size: req.file.size
    }, '文件上传成功', 201);
  } catch (error) {
    next(error);
  }
}

export async function uploadAndParsePhoto(req, res, next) {
  try {
    if (!req.file) {
      const err = new Error('请提供要上传的相片');
      err.status = 400;
      throw err;
    }
    const accessMeta = buildFileAccessMeta(req, req.file);
    const absolutePath = path.resolve(req.file.path);
    
    const exifData = await parseImageExif(absolutePath);

    sendSuccess(res, {
      ...accessMeta,
      mimetype: req.file.mimetype,
      size: req.file.size,
      exif: exifData || {}
    }, '图片上传并解析成功', 201);
  } catch (error) {
    next(error);
  }
}

export async function uploadAndParseTrajectory(req, res, next) {
  try {
    if (!req.file) {
      const err = new Error('请提供合法的轨迹文件 (GPX/KML)');
      err.status = 400;
      throw err;
    }
    const accessMeta = buildFileAccessMeta(req, req.file);
    const absolutePath = path.resolve(req.file.path);
    
    const geojson = await parseTrajectory(absolutePath);

    sendSuccess(res, {
      ...accessMeta,
      mimetype: req.file.mimetype,
      size: req.file.size,
      geojson: geojson || {}
    }, '轨迹上传并解析成功', 201);
  } catch (error) {
    next(error);
  }
}