/**
 * 七牛表单直传（经服务端签发 token，文件字节不经业务服务器）。
 *
 * 【微信小程序后台 — 服务器域名】请配置：
 * - uploadFile 合法域名：与 QINIU_ZONE 对应的上传域名，例如华东 z0 填 https://up.qiniup.com ；
 *   z1: https://up-z1.qiniup.com ，z2: https://up-z2.qiniup.com ，na0: https://up-na0.qiniup.com ，as0: https://up-as0.qiniup.com
 * - downloadFile 合法域名：与 QINIU_PUBLIC_BASE_URL 协议一致（http 或 https），填 CDN 主机名
 * - request 合法域名：原有业务 API 域名不变
 */
import { request } from './request';
import api from './api';

export type QiniuPurpose = 'image' | 'audio' | 'trajectory' | 'generic';

function guessFilename(filePath: string, purpose: QiniuPurpose) {
  const parts = String(filePath || '').split('/');
  const last = parts[parts.length - 1] || '';
  if (last.includes('.')) return last;
  if (purpose === 'audio') return 'audio.mp3';
  if (purpose === 'trajectory') return 'track.gpx';
  return 'image.jpg';
}

export interface QiniuUploadResult {
  url: string;
  relativeUrl: string;
  mimetype?: string;
  size?: number;
  key?: string;
}

/**
 * 申请 token 并 wx.uploadFile 直传七牛，返回与旧版 /upload 类似的 { url, relativeUrl }。
 */
export function uploadFileToQiniu(
  filePath: string,
  opts: { purpose: QiniuPurpose; filename?: string }
): Promise<QiniuUploadResult> {
  const filename = opts.filename || guessFilename(filePath, opts.purpose);
  const tokenReq = request<{
    uploadUrl: string;
    token: string;
    key: string;
    publicUrl: string;
  }>({
    url: `${api.upload}/qiniu-token`,
    method: 'POST',
    data: { purpose: opts.purpose, filename },
    showLoading: false,
  });

  return tokenReq.then(
    (meta) =>
      new Promise<QiniuUploadResult>((resolve, reject) => {
        if (!meta?.uploadUrl || !meta.token || !meta.publicUrl) {
          reject(new Error('上传凭证无效'));
          return;
        }
        wx.uploadFile({
          url: meta.uploadUrl,
          filePath,
          name: 'file',
          formData: {
            token: meta.token,
            key: meta.key,
          },
          success(res) {
            if (res.statusCode < 200 || res.statusCode >= 300) {
              reject(new Error(`七牛上传失败: ${res.statusCode}`));
              return;
            }
            resolve({
              url: meta.publicUrl,
              relativeUrl: meta.publicUrl,
              key: meta.key,
            });
          },
          fail(err) {
            reject(err);
          },
        });
      })
  );
}

/** 相片已传七牛后，请求服务端按 URL 解析 EXIF（与 /upload/photo 返回 data 形状一致） */
export function parsePhotoExifAfterQiniu(fileUrl: string): Promise<any> {
  return request({
    url: `${api.upload}/photo-parse`,
    method: 'POST',
    data: { fileUrl },
    showLoading: false,
  });
}
