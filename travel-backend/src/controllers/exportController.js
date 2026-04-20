import {
  generateProjectHtmlExport,
  generateProjectPdfExport,
} from '../services/exportService.js';

function setNoCacheHeaders(res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
}

export async function exportProjectHtml(req, res, next) {
  try {
    setNoCacheHeaders(res);
    const { html, filename, payload } = await generateProjectHtmlExport(req.params.id, req.user.user_id);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    res.setHeader('X-Export-Count', String(payload.totalCount));
    res.send(html);
  } catch (error) {
    next(error);
  }
}

export async function exportProjectPdf(req, res, next) {
  try {
    setNoCacheHeaders(res);
    const { buffer, filename, payload } = await generateProjectPdfExport(req.params.id, req.user.user_id);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    res.setHeader('Content-Length', String(buffer.length));
    res.setHeader('X-Export-Count', String(payload.totalCount));
    res.send(buffer);
  } catch (error) {
    next(error);
  }
}
