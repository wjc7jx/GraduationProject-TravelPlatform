import {
  generateProjectHtmlExport,
  generateProjectPdfExport,
} from '../services/exportService.js';
import { sendSuccess } from '../utils/response.js';

function parseExportOptions(req) {
  const visibilityScope = String(req.query.visibility_scope || 'all');
  const viewerUserId = req.query.viewer_user_id ? Number(req.query.viewer_user_id) : null;
  const includeContentIds = req.query.include_content_ids || '';
  const excludeContentIds = req.query.exclude_content_ids || '';

  return {
    visibilityScope,
    viewerUserId: Number.isFinite(viewerUserId) ? viewerUserId : null,
    includeContentIds,
    excludeContentIds,
  };
}

function setNoCacheHeaders(res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
}

function buildAbsoluteUrl(req, query = {}) {
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.get('host');
  const url = new URL(`${protocol}://${host}${req.baseUrl}${req.path}`);

  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    url.searchParams.set(key, String(value));
  });

  return url.toString();
}

export async function exportProjectHtml(req, res, next) {
  try {
    setNoCacheHeaders(res);
    const { id } = req.params;
    const options = parseExportOptions(req);
    const { html, filename, payload } = await generateProjectHtmlExport(id, req.user.user_id, options);
    const mode = String(req.query.mode || '').toLowerCase();

    if (mode === 'url') {
      const visibilityScope = String(req.query.visibility_scope || 'all');
      const accessToken = req.query.access_token || '';
      const baseQuery = {
        visibility_scope: visibilityScope,
        ...(req.query.viewer_user_id ? { viewer_user_id: req.query.viewer_user_id } : {}),
        ...(req.query.include_content_ids ? { include_content_ids: req.query.include_content_ids } : {}),
        ...(req.query.exclude_content_ids ? { exclude_content_ids: req.query.exclude_content_ids } : {}),
        ...(accessToken ? { access_token: accessToken } : {}),
      };

      const downloadUrl = buildAbsoluteUrl(req, baseQuery);
      const previewUrl = buildAbsoluteUrl(req, { ...baseQuery, mode: 'inline' });

      sendSuccess(
        res,
        {
          filename,
          url: downloadUrl,
          download_url: downloadUrl,
          preview_url: previewUrl,
          stats: { total_count: payload.totalCount },
        },
        '生成网页纪念册链接成功'
      );
      return;
    }
    // TODO:这部分处理逻辑是什么？目前我设想的是直接导出html文件，暂不支持显示为一个网页页面，简化。
    // 兼容旧逻辑: download=0 返回 JSON
    if (mode === 'json' || String(req.query.download || '1') === '0') {
      sendSuccess(res, { filename, html, stats: { total_count: payload.totalCount } }, '生成网页纪念册成功');
      return;
    }

    if (mode === 'inline') {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(filename)}"`);
      res.send(html);
      return;
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    res.send(html);
  } catch (error) {
    next(error);
  }
}

export async function exportProjectPdf(req, res, next) {
  try {
    setNoCacheHeaders(res);
    const { id } = req.params;
    const options = parseExportOptions(req);
    const { buffer, filename, payload } = await generateProjectPdfExport(id, req.user.user_id, options);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    res.setHeader('Content-Length', String(buffer.length));
    res.setHeader('X-Export-Count', String(payload.totalCount));
    res.send(buffer);
  } catch (error) {
    next(error);
  }
}
