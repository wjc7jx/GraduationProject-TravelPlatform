import { createRequire } from 'module';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { env } from '../config/env.js';

const require = createRequire(import.meta.url);
const qiniu = require('qiniu');

const ZONE_UPLOAD_HOST = {
  z0: 'https://up.qiniup.com',
  z1: 'https://up-z1.qiniup.com',
  z2: 'https://up-z2.qiniup.com',
  na0: 'https://up-na0.qiniup.com',
  as0: 'https://up-as0.qiniup.com',
};

const EXT_BY_PURPOSE = {
  image: ['.jpg', '.jpeg', '.png', '.webp', '.gif'],
  audio: ['.mp3', '.m4a', '.wav', '.aac'],
  trajectory: ['.gpx', '.kml'],
  generic: ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.mp3', '.m4a', '.wav', '.aac'],
};

const FSIZE_BY_PURPOSE = {
  image: 20 * 1024 * 1024,
  audio: 60 * 1024 * 1024,
  trajectory: 15 * 1024 * 1024,
  generic: 30 * 1024 * 1024,
};

export function isQiniuConfigured() {
  const q = env.qiniu;
  return !!(q.accessKey && q.secretKey && q.bucket && q.publicBaseUrl && q.zone);
}

export function getQiniuUploadHost(zone) {
  const z = String(zone || '').toLowerCase();
  return ZONE_UPLOAD_HOST[z] || null;
}

function pickExt(filename, purpose) {
  const ext = path.extname(String(filename || '')).toLowerCase();
  const allowed = EXT_BY_PURPOSE[purpose] || EXT_BY_PURPOSE.generic;
  if (ext && allowed.includes(ext)) return ext;
  return null;
}

/**
 * @param {{ purpose: string, filename: string }} param0
 * @returns {{ uploadUrl: string, token: string, key: string, publicUrl: string } | null}
 */
export function createQiniuUploadParams({ purpose, filename }) {
  if (!isQiniuConfigured()) return null;
  const p = EXT_BY_PURPOSE[purpose] ? purpose : 'generic';
  const ext = pickExt(filename, p);
  if (!ext) return null;

  const key = `uploads/${uuidv4()}${ext}`;
  const bucket = env.qiniu.bucket;
  const mac = new qiniu.auth.digest.Mac(env.qiniu.accessKey, env.qiniu.secretKey);
  const putPolicy = new qiniu.rs.PutPolicy({
    scope: `${bucket}:${key}`,
    expires: 7200,
    fsizeLimit: FSIZE_BY_PURPOSE[p] || FSIZE_BY_PURPOSE.generic,
  });
  const token = putPolicy.uploadToken(mac);
  const uploadUrl = getQiniuUploadHost(env.qiniu.zone);
  if (!uploadUrl) return null;
  const base = env.qiniu.publicBaseUrl.replace(/\/+$/, '');
  const publicUrl = `${base}/${key}`;

  return {
    uploadUrl,
    token,
    key,
    publicUrl,
  };
}
