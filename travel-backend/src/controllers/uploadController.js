import { parseImageExif, parseImageExifFromBuffer, parseTrajectory, parseTrajectoryFromString } from '../utils/parser.js';
import path from 'path';
import { sendSuccess } from '../utils/response.js';
import { buildFileAccessMeta, buildRemoteFileAccessMeta, normalizeExternalMediaUrl } from '../utils/fileAccess.js';
import { env } from '../config/env.js';
import { createQiniuUploadParams, isQiniuConfigured } from '../services/qiniuUploadToken.js';

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

const PURPOSE_SET = new Set(['image', 'audio', 'trajectory', 'generic']);

export function issueQiniuToken(req, res, next) {
  try {
    if (!isQiniuConfigured()) {
      const err = new Error('对象存储未配置，请设置 QINIU_* 环境变量');
      err.status = 503;
      throw err;
    }
    const purpose = String(req.body?.purpose || 'generic');
    const filename = String(req.body?.filename || '');
    if (!PURPOSE_SET.has(purpose)) {
      const err = new Error('无效的 purpose');
      err.status = 400;
      throw err;
    }
    const params = createQiniuUploadParams({ purpose, filename });
    if (!params) {
      const err = new Error('文件名后缀与用途不匹配');
      err.status = 400;
      throw err;
    }
    sendSuccess(res, params, 'ok', 200);
  } catch (error) {
    next(error);
  }
}

function assertFileUrlAllowedForParse(fileUrl) {
  const base = env.qiniu.publicBaseUrl;
  if (!base) {
    const err = new Error('对象存储未配置');
    err.status = 503;
    throw err;
  }
  const canonical = normalizeExternalMediaUrl(fileUrl);
  let allowedOrigin;
  let actualOrigin;
  try {
    allowedOrigin = new URL(base).origin;
    actualOrigin = new URL(canonical).origin;
  } catch {
    const err = new Error('无效的 fileUrl');
    err.status = 400;
    throw err;
  }
  if (actualOrigin !== allowedOrigin) {
    const err = new Error('fileUrl 必须与 QINIU_PUBLIC_BASE_URL 同源');
    err.status = 400;
    throw err;
  }
}

async function fetchUrlBuffer(fileUrl) {
  const res = await fetch(fileUrl, { redirect: 'follow' });
  if (!res.ok) {
    const err = new Error(`拉取文件失败: ${res.status}`);
    err.status = 502;
    throw err;
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get('content-type') || '';
  return { buffer, contentType, size: buffer.length };
}

export async function parsePhotoFromUrl(req, res, next) {
  try {
    if (!isQiniuConfigured()) {
      const err = new Error('对象存储未配置');
      err.status = 503;
      throw err;
    }
    const fileUrl = normalizeExternalMediaUrl(String(req.body?.fileUrl || '').trim());
    if (!fileUrl) {
      const err = new Error('请提供 fileUrl');
      err.status = 400;
      throw err;
    }
    assertFileUrlAllowedForParse(fileUrl);

    const { buffer, contentType, size } = await fetchUrlBuffer(fileUrl);
    const exifData = await parseImageExifFromBuffer(buffer);
    const accessMeta = buildRemoteFileAccessMeta(fileUrl);

    sendSuccess(res, {
      ...accessMeta,
      mimetype: contentType || 'application/octet-stream',
      size,
      exif: exifData || {}
    }, '图片解析成功', 200);
  } catch (error) {
    next(error);
  }
}

export async function parseTrajectoryFromUrl(req, res, next) {
  try {
    if (!isQiniuConfigured()) {
      const err = new Error('对象存储未配置');
      err.status = 503;
      throw err;
    }
    const fileUrl = normalizeExternalMediaUrl(String(req.body?.fileUrl || '').trim());
    if (!fileUrl) {
      const err = new Error('请提供 fileUrl');
      err.status = 400;
      throw err;
    }
    assertFileUrlAllowedForParse(fileUrl);

    const { buffer, contentType, size } = await fetchUrlBuffer(fileUrl);
    const ext = path.extname(new URL(fileUrl).pathname).toLowerCase();
    const text = buffer.toString('utf-8');
    const geojson = await parseTrajectoryFromString(text, ext);

    const accessMeta = buildRemoteFileAccessMeta(fileUrl);

    sendSuccess(res, {
      ...accessMeta,
      mimetype: contentType || 'application/xml',
      size,
      geojson: geojson || {}
    }, '轨迹解析成功', 200);
  } catch (error) {
    next(error);
  }
}
