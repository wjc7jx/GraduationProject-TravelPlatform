import path from 'path';
import { env } from '../config/env.js';

function trimTrailingSlash(input) {
  return (input || '').replace(/\/+$/, '');
}

function inferBaseUrl(req) {
  if (env.publicBaseUrl) {
    return trimTrailingSlash(env.publicBaseUrl);
  }

  const host = req.get('host');
  if (!host) return '';
  return `${req.protocol}://${host}`;
}

export function buildFileAccessMeta(req, file) {
  const relativeUrl = `/uploads/${file.filename}`;
  const baseUrl = inferBaseUrl(req);

  return {
    url: baseUrl ? `${baseUrl}${relativeUrl}` : relativeUrl,
    relativeUrl,
    localPath: path.resolve(file.path)
  };
}

/** 对象存储等外链资源的访问元数据（无本地路径） */
export function buildRemoteFileAccessMeta(fileUrl) {
  let pathname = fileUrl;
  try {
    pathname = new URL(fileUrl).pathname || '/';
  } catch {
    pathname = '/';
  }
  return {
    url: fileUrl,
    relativeUrl: pathname.startsWith('/') ? pathname : `/${pathname}`,
    localPath: null,
  };
}
