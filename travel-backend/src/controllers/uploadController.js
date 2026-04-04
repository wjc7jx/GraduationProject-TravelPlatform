import { parseImageExif, parseTrajectory } from '../utils/parser.js';
import path from 'path';

export function uploadFile(req, res, next) {
  try {
    if (!req.file) {
      const err = new Error('请提供要上传的文件');
      err.status = 400;
      throw err;
    }
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

export async function uploadAndParsePhoto(req, res, next) {
  try {
    if (!req.file) {
      const err = new Error('请提供要上传的相片');
      err.status = 400;
      throw err;
    }
    const fileUrl = `/uploads/${req.file.filename}`;
    const absolutePath = path.resolve(req.file.path);
    
    const exifData = await parseImageExif(absolutePath);

    res.status(201).json({
      url: fileUrl,
      mimetype: req.file.mimetype,
      size: req.file.size,
      exif: exifData || {}
    });
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
    const fileUrl = `/uploads/${req.file.filename}`;
    const absolutePath = path.resolve(req.file.path);
    
    const geojson = await parseTrajectory(absolutePath);

    res.status(201).json({
      url: fileUrl,
      mimetype: req.file.mimetype,
      size: req.file.size,
      geojson: geojson || {}
    });
  } catch (error) {
    next(error);
  }
}