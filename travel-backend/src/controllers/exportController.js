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

export async function exportProjectHtml(req, res, next) {
  try {
    const { id } = req.params;
    const options = parseExportOptions(req);
    const { html, filename, payload } = await generateProjectHtmlExport(id, req.user.user_id, options);

    if (String(req.query.download || '1') === '1') {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
      res.send(html);
      return;
    }

    sendSuccess(res, { filename, html, stats: { total_count: payload.totalCount } }, '生成网页纪念册成功');
  } catch (error) {
    next(error);
  }
}

export async function exportProjectPdf(req, res, next) {
  try {
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
