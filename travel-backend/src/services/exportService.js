import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { Content, Location } from '../models/index.js';
import { getProjectOrThrow } from './projectService.js';
import { env } from '../config/env.js';
import {
  getProjectRule,
  getViewerLevel,
  sanitizeLocation,
  shouldKeepByExportScope,
} from './privacyService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../../');
const WORKSPACE_ROOT = path.resolve(PROJECT_ROOT, '..');

function slugify(input) {
  return String(input || 'travel-project')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/gi, '-')
    .replace(/^-+|-+$/g, '') || 'travel-project';
}

function escapeHtml(input) {
  return String(input ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeArrayNumber(input) {
  if (!input) return [];
  if (Array.isArray(input)) {
    return input.map(Number).filter((item) => Number.isFinite(item));
  }
  return String(input)
    .split(',')
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isFinite(item));
}

function fmtDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

function fmtDateTime(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

async function toDataUriIfLocalImage(imageRef) {
  if (!imageRef || typeof imageRef !== 'string') return null;
  if (imageRef.startsWith('data:')) return imageRef;
  if (/^https?:\/\//i.test(imageRef)) return imageRef;

  let localCandidates = [];
  if (imageRef.startsWith('/uploads/')) {
    const relative = imageRef.replace(/^\//, '');
    localCandidates = [
      path.join(PROJECT_ROOT, relative),
      path.join(WORKSPACE_ROOT, relative),
    ];
  } else if (imageRef.startsWith('uploads/')) {
    localCandidates = [
      path.join(PROJECT_ROOT, imageRef),
      path.join(WORKSPACE_ROOT, imageRef),
    ];
  } else if (path.isAbsolute(imageRef)) {
    localCandidates = [imageRef];
  }

  if (!localCandidates.length) return imageRef;

  for (const localPath of localCandidates) {
    const ext = path.extname(localPath).toLowerCase();
    const mimeMap = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
      '.gif': 'image/gif',
    };
    const mime = mimeMap[ext];
    if (!mime) continue;

    try {
      const fileBuffer = await fs.readFile(localPath);
      return `data:${mime};base64,${fileBuffer.toString('base64')}`;
    } catch {
      // 尝试下一个候选路径
    }
  }

  return imageRef;
}

function pickPhotoSources(contentData) {
  if (!contentData || typeof contentData !== 'object') return [];
  if (Array.isArray(contentData.images) && contentData.images.length > 0) {
    return contentData.images.filter(Boolean);
  }
  const single =
    contentData.url
    || contentData.image_url
    || contentData.file_url
    || contentData.src
    || contentData.path
    || '';
  return single ? [single] : [];
}

async function normalizeContentItem(item) {
  const json = typeof item?.toJSON === 'function' ? item.toJSON() : item;
  if (!json || typeof json !== 'object') {
    return {
      record_time_text: '',
      day_key: '',
    };
  }
  const contentData = json.content_data || {};
  const normalized = {
    ...json,
    record_time_text: fmtDateTime(json.record_time || json.created_at),
    day_key: fmtDate(json.record_time || json.created_at),
  };

  if (json.content_type === 'photo') {
    const sources = pickPhotoSources(contentData);
    const resolved = [];
    for (const src of sources) {
      const uri = await toDataUriIfLocalImage(src);
      if (uri) resolved.push(uri);
    }
    normalized.render_photo_srcs = resolved;
    normalized.render_photo_caption = contentData.caption || contentData.title || '';
  }

  if (json.content_type === 'note') {
    normalized.render_note_title = contentData.title || '旅行笔记';
    normalized.render_note_text = contentData.text || contentData.content || '';
    const noteSources = pickPhotoSources(contentData);
    const noteImages = [];
    for (const src of noteSources) {
      const uri = await toDataUriIfLocalImage(src);
      if (uri) noteImages.push(uri);
    }
    normalized.render_note_images = noteImages;
  }

  if (json.content_type === 'audio') {
    normalized.render_audio_title = contentData.title || '语音片段';
    normalized.render_audio_url = contentData.url || contentData.file_url || '';
    normalized.render_audio_duration = contentData.duration || '';
  }

  return normalized;
}

export async function buildExportData(projectId, userId, options = {}) {
  const {
    visibilityScope = 'all',
    viewerUserId = null,
    includeContentIds = [],
    excludeContentIds = [],
  } = options;

  const project = await getProjectOrThrow(projectId, userId);
  const scope = String(visibilityScope || 'all');
  if (!['all', 'public', 'share'].includes(scope)) {
    const err = new Error('visibility_scope 仅支持 all/public/share');
    err.status = 400;
    throw err;
  }
  if (scope === 'all' && Number(project.user_id) !== Number(userId)) {
    const err = new Error('all 范围仅允许项目所有者导出');
    err.status = 403;
    throw err;
  }
  if (scope === 'share' && !Number.isFinite(Number(viewerUserId))) {
    const err = new Error('share 范围必须提供 viewer_user_id');
    err.status = 400;
    throw err;
  }

  const projectJson = project.toJSON();
  const renderCoverImage = await toDataUriIfLocalImage(projectJson.cover_image || '');
  const contents = await Content.findAll({
    where: {
      project_id: project.project_id,
      is_deleted: 0,
    },
    include: [
      {
        model: Location,
        as: 'location',
        required: false,
      },
    ],
    order: [
      ['record_time', 'ASC'],
      ['sort_order', 'ASC'],
      ['content_id', 'ASC'],
    ],
  });

  const includeSet = new Set(normalizeArrayNumber(includeContentIds));
  const excludeSet = new Set(normalizeArrayNumber(excludeContentIds));

  const projectRule = await getProjectRule(project.project_id);
  const normalizedRule = projectRule;

  const filteredRaw = [];
  for (const item of contents) {
    if (includeSet.size > 0 && !includeSet.has(Number(item.content_id))) continue;
    if (excludeSet.has(Number(item.content_id))) continue;

    const shouldKeep = await shouldKeepByExportScope(normalizedRule, {
      visibilityScope: scope,
      requesterUserId: userId,
      ownerUserId: project.user_id,
      viewerUserId,
    });
    if (shouldKeep) {
      filteredRaw.push(item);
    }
  }

  const normalizedContents = [];
  for (const item of filteredRaw) {
    // 顺序 await 避免大量并发读取本地图片导致导出卡顿
    const privacyViewerId = scope === 'all' ? userId : viewerUserId;
    const viewerLevel = await getViewerLevel(normalizedRule, project.user_id, privacyViewerId);
    const normalized = await normalizeContentItem(sanitizeLocation(item, viewerLevel));
    normalizedContents.push(normalized);
  }

  const sections = [];
  const sectionMap = new Map();
  normalizedContents.forEach((item) => {
    const key = item.day_key || '未分组日期';
    if (!sectionMap.has(key)) {
      const block = {
        key,
        title: key,
        items: [],
      };
      sectionMap.set(key, block);
      sections.push(block);
    }
    sectionMap.get(key).items.push(item);
  });

  return {
    project: {
      ...projectJson,
      render_cover_image: renderCoverImage,
    },
    sections,
    totalCount: normalizedContents.length,
    visibilityScope: scope,
  };
}

function renderImageGrid(srcs) {
  if (!srcs || !srcs.length) return '';
  if (srcs.length === 1) {
    return `<div class="img-grid img-grid-1"><img src="${escapeHtml(srcs[0])}" alt="旅行照片" /></div>`;
  }
  if (srcs.length === 2) {
    return `<div class="img-grid img-grid-2">${srcs.map((s) => `<img src="${escapeHtml(s)}" alt="旅行照片" />`).join('')}</div>`;
  }
  return `<div class="img-grid img-grid-n">${srcs.map((s) => `<img src="${escapeHtml(s)}" alt="旅行照片" />`).join('')}</div>`;
}

function renderContentCard(item) {
  const locationText = item.location
    ? `${item.location.name || ''} ${item.location.address || ''}`.trim()
    : '';

  const timePart = item.record_time_text ? `<span class="meta-time">${escapeHtml(item.record_time_text)}</span>` : '';
  const locPart = locationText ? `<span class="meta-loc">${escapeHtml(locationText)}</span>` : '';
  const metaHtml = [timePart, locPart].filter(Boolean).join('<span class="meta-dot"> · </span>');

  if (item.content_type === 'photo') {
    const srcs = item.render_photo_srcs || [];
    return `
      <article class="card photo-card">
        <div class="meta">${metaHtml}</div>
        ${renderImageGrid(srcs)}
        ${item.render_photo_caption ? `<p class="caption">${escapeHtml(item.render_photo_caption)}</p>` : ''}
      </article>`;
  }

  if (item.content_type === 'note') {
    const noteImages = item.render_note_images || [];
    return `
      <article class="card note-card">
        <div class="meta">${metaHtml}</div>
        <h3 class="note-title">${escapeHtml(item.render_note_title || '旅行笔记')}</h3>
        <div class="note-body">${escapeHtml(item.render_note_text || '').replace(/\n/g, '<br />')}</div>
        ${noteImages.length ? renderImageGrid(noteImages) : ''}
      </article>`;
  }

  if (item.content_type === 'audio') {
    return `
      <article class="card audio-card">
        <div class="meta">${metaHtml}</div>
        <h3 class="audio-title">${escapeHtml(item.render_audio_title || '语音片段')}</h3>
        <p class="audio-duration">时长：${escapeHtml(item.render_audio_duration || '未知')}</p>
        ${item.render_audio_url ? `<p class="hint">音频地址：${escapeHtml(item.render_audio_url)}</p>` : ''}
      </article>`;
  }

  return `
    <article class="card">
      <div class="meta">${metaHtml}</div>
      <h3>未识别内容类型</h3>
      <pre>${escapeHtml(JSON.stringify(item.content_data || {}, null, 2))}</pre>
    </article>`;
}

export function renderMemorialHtml(payload) {
  const { project, sections, totalCount, visibilityScope } = payload;
  const coverImage = project.render_cover_image || project.cover_image || '';
  const tags = Array.isArray(project.tags) ? project.tags : [];
  const description = project.description || project.subtitle || '';
  const scopeLabel = { all: '全部', public: '公开', share: '分享' }[visibilityScope] || visibilityScope;
  const generatedAt = new Date().toLocaleString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });

  const toc = sections
    .map((section, index) => `<li><a href="#day-${index + 1}">${escapeHtml(section.title)}<span class="toc-count">（${section.items.length}）</span></a></li>`)
    .join('');

  const sectionsHtml = sections
    .map(
      (section, index) => `
      <section class="day-section" id="day-${index + 1}">
        <div class="day-header">
          <span class="day-dot"></span>
          <h2>${escapeHtml(section.title)}</h2>
          <span class="day-count">${section.items.length} 条记录</span>
        </div>
        <div class="cards">
          ${section.items.map((item) => renderContentCard(item)).join('\n')}
        </div>
      </section>`,
    )
    .join('\n');

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(project.title)} · 旅行纪念册</title>
  <style>
    :root {
      --bg: #f5f2ec;
      --panel: #fffaf3;
      --ink: #1d1b1a;
      --ink-secondary: #3d3832;
      --muted: #6a6259;
      --brand: #0f766e;
      --brand-light: #14b8a6;
      --brand-bg: rgba(15,118,110,0.06);
      --line: #d8cfc4;
      --paper: #fffdf8;
      --shadow-sm: 0 2px 8px rgba(31,27,23,0.06);
      --shadow-md: 0 8px 24px rgba(31,27,23,0.10);
      --shadow-lg: 0 18px 50px rgba(32,43,53,0.18);
      --radius-sm: 8px;
      --radius-md: 14px;
      --radius-lg: 20px;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html { scroll-behavior: smooth; }
    body {
      font-family: "Noto Serif SC", "Source Han Serif SC", "PingFang SC", "Microsoft YaHei", serif;
      color: var(--ink);
      background: var(--bg);
      line-height: 1.8;
      -webkit-font-smoothing: antialiased;
    }

    /* ---- layout ---- */
    .wrap {
      width: min(960px, 90vw);
      margin: 0 auto;
      padding: 32px 0 80px;
    }

    /* ---- cover ---- */
    .cover {
      position: relative;
      border-radius: var(--radius-lg);
      overflow: hidden;
      box-shadow: var(--shadow-lg);
      min-height: 260px;
    }
    .cover-bg {
      position: absolute; inset: 0;
      background: linear-gradient(160deg, #0f766e 0%, #0c546d 50%, #1e3a5f 100%);
    }
    .cover-img {
      position: absolute; inset: 0;
      width: 100%; height: 100%;
      object-fit: cover;
      opacity: 0.35;
    }
    .cover-overlay {
      position: absolute; inset: 0;
      background: linear-gradient(180deg, rgba(0,0,0,0.10) 0%, rgba(0,0,0,0.50) 100%);
    }
    .cover-content {
      position: relative;
      z-index: 1;
      padding: 48px 44px 40px;
      color: #fff;
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
      min-height: 280px;
    }
    .cover h1 {
      font-size: clamp(28px, 5vw, 44px);
      line-height: 1.2;
      font-weight: 700;
      margin-bottom: 10px;
      text-shadow: 0 2px 12px rgba(0,0,0,0.3);
    }
    .cover .subtitle {
      opacity: 0.90;
      font-size: 15px;
      line-height: 1.6;
    }
    .cover .tags {
      margin-top: 14px;
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .cover .tag {
      display: inline-block;
      padding: 3px 12px;
      background: rgba(255,255,255,0.18);
      border: 1px solid rgba(255,255,255,0.25);
      border-radius: 20px;
      font-size: 12px;
      backdrop-filter: blur(4px);
    }
    .cover .stats-row {
      margin-top: 16px;
      font-size: 13px;
      opacity: 0.8;
    }

    /* ---- toc panel ---- */
    .panel {
      margin-top: 24px;
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: var(--radius-md);
      padding: 24px 28px;
      box-shadow: var(--shadow-sm);
    }
    .panel h2 {
      font-size: 18px;
      margin-bottom: 14px;
      color: var(--ink-secondary);
    }
    .toc {
      list-style: none;
      padding: 0;
      columns: 2;
      column-gap: 28px;
    }
    .toc li {
      break-inside: avoid;
      padding: 4px 0;
    }
    .toc a {
      color: var(--brand);
      text-decoration: none;
      font-size: 14px;
      transition: color 0.2s;
    }
    .toc a:hover { color: var(--brand-light); }
    .toc-count {
      color: var(--muted);
      font-size: 12px;
    }

    /* ---- timeline backbone ---- */
    .timeline {
      position: relative;
      margin-top: 36px;
      padding-left: 32px;
    }
    .timeline::before {
      content: "";
      position: absolute;
      left: 9px;
      top: 0;
      bottom: 0;
      width: 2px;
      background: linear-gradient(180deg, var(--brand) 0%, var(--line) 100%);
      border-radius: 2px;
    }

    /* ---- day section ---- */
    .day-section {
      position: relative;
      margin-top: 0;
      padding-top: 28px;
      break-inside: avoid;
    }
    .day-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
      position: relative;
    }
    .day-dot {
      position: absolute;
      left: -32px;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: var(--brand);
      border: 3px solid var(--bg);
      box-shadow: 0 0 0 2px var(--brand);
      flex-shrink: 0;
    }
    .day-header h2 {
      font-size: 22px;
      font-weight: 700;
      color: var(--ink);
    }
    .day-count {
      font-size: 12px;
      color: var(--muted);
      background: var(--brand-bg);
      padding: 2px 10px;
      border-radius: 12px;
    }

    /* ---- cards container ---- */
    .cards {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    /* ---- card base ---- */
    .card {
      background: var(--paper);
      border-radius: var(--radius-md);
      border: 1px solid #e6ddd2;
      padding: 20px;
      box-shadow: var(--shadow-sm);
      break-inside: avoid;
      transition: box-shadow 0.25s, transform 0.25s;
    }
    .card:hover {
      box-shadow: var(--shadow-md);
      transform: translateY(-2px);
    }

    /* ---- meta line ---- */
    .meta {
      color: var(--muted);
      font-size: 13px;
      margin-bottom: 10px;
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 0;
    }
    .meta-time::before {
      content: "\\1F552 ";
      font-size: 12px;
    }
    .meta-loc::before {
      content: "\\1F4CD ";
      font-size: 12px;
    }
    .meta-dot {
      color: #c4b9ad;
      margin: 0 2px;
    }

    /* ---- photo card ---- */
    .photo-card .caption {
      margin: 10px 0 0;
      font-size: 14px;
      color: var(--ink-secondary);
    }

    /* ---- image grid ---- */
    .img-grid { border-radius: var(--radius-sm); overflow: hidden; }
    .img-grid img {
      display: block;
      width: 100%;
      object-fit: cover;
      border-radius: var(--radius-sm);
    }
    .img-grid-1 img {
      max-height: 480px;
    }
    .img-grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px;
    }
    .img-grid-2 img {
      aspect-ratio: 4 / 3;
    }
    .img-grid-n {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 6px;
    }
    .img-grid-n img {
      aspect-ratio: 1;
    }

    /* ---- note card ---- */
    .note-title {
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 8px;
      color: var(--ink);
    }
    .note-body {
      font-size: 15px;
      color: var(--ink-secondary);
      line-height: 1.9;
      border-left: 3px solid var(--brand);
      padding-left: 14px;
    }
    .note-card .img-grid {
      margin-top: 14px;
    }

    /* ---- audio card ---- */
    .audio-title {
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 6px;
    }
    .audio-duration {
      font-size: 14px;
      color: var(--muted);
    }
    .hint {
      margin-top: 6px;
      font-size: 12px;
      color: #6f675d;
      word-break: break-all;
    }

    /* ---- footer ---- */
    .footer {
      margin-top: 48px;
      text-align: center;
      color: var(--muted);
      font-size: 13px;
      padding: 20px 0;
      border-top: 1px solid var(--line);
    }
    .footer-brand {
      color: var(--brand);
      font-weight: 600;
    }

    /* ---- print / PDF ---- */
    .print-head { display: none; }

    @page {
      size: A4;
      margin: 18mm 14mm;
    }
    @media print {
      body { background: #fff; }
      .wrap { width: 100%; padding: 0; }
      .cover { box-shadow: none; border-radius: var(--radius-md); }
      .print-head {
        display: flex;
        justify-content: space-between;
        margin-bottom: 12px;
        color: #5d564e;
        font-size: 11px;
        border-bottom: 1px solid #d9d1c5;
        padding-bottom: 6px;
      }
      .timeline::before { background: var(--line); }
      .card { box-shadow: none; border: 1px solid #e0d8ce; }
      .card:hover { box-shadow: none; transform: none; }
      .toc { columns: 1; }
      .cards { gap: 12px; }
      .day-section { break-inside: avoid; }
      .day-section + .day-section { break-before: auto; }
      .img-grid-1 img { max-height: 360px; }
    }
  </style>
</head>
<body>
  <main class="wrap">
    <div class="print-head">
      <span>${escapeHtml(project.title || '旅行纪念册')}</span>
      <span>${escapeHtml(fmtDate(project.start_date))} - ${escapeHtml(fmtDate(project.end_date) || '进行中')}</span>
    </div>

    <section class="cover">
      <div class="cover-bg"></div>
      ${coverImage ? `<img class="cover-img" src="${escapeHtml(coverImage)}" alt="" />` : ''}
      <div class="cover-overlay"></div>
      <div class="cover-content">
        <h1>${escapeHtml(project.title || '我的旅行项目')}</h1>
        ${description ? `<p class="subtitle">${escapeHtml(description)}</p>` : ''}
        <p class="subtitle">${escapeHtml(fmtDate(project.start_date))} - ${escapeHtml(fmtDate(project.end_date) || '进行中')}</p>
        ${tags.length ? `<div class="tags">${tags.map((t) => `<span class="tag">${escapeHtml(typeof t === 'string' ? t : t.name || '')}</span>`).join('')}</div>` : ''}
        <p class="stats-row">共 ${totalCount} 条记录 · ${sections.length} 天 · ${scopeLabel}导出</p>
      </div>
    </section>

    ${sections.length > 1 ? `
    <section class="panel">
      <h2>目录</h2>
      <ol class="toc">${toc}</ol>
    </section>` : ''}

    <div class="timeline">
      ${sectionsHtml}
    </div>

    <footer class="footer">
      <span class="footer-brand">TripTimeline</span> 旅行纪念册 · 导出于 ${escapeHtml(generatedAt)}
    </footer>
  </main>
</body>
</html>`;
}

export async function generateProjectHtmlExport(projectId, userId, options = {}) {
  const payload = await buildExportData(projectId, userId, options);
  const html = renderMemorialHtml(payload);
  const filename = `${slugify(payload.project.title)}-memorial.html`;
  return { html, filename, payload };
}

export async function generateProjectPdfExport(projectId, userId, options = {}) {
  const { html, payload } = await generateProjectHtmlExport(projectId, userId, options);

  let puppeteer;
  try {
    ({ default: puppeteer } = await import('puppeteer'));
  } catch {
    const err = new Error('PDF 导出依赖未安装，请先执行 npm install puppeteer');
    err.status = 500;
    throw err;
  }

  const launchOptions = {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  };
  if (env.export.puppeteerExecutablePath) {
    launchOptions.executablePath = env.export.puppeteerExecutablePath;
  }

  let browser;
  try {
    browser = await puppeteer.launch(launchOptions);
  } catch {
    const err = new Error('PDF 渲染引擎启动失败，请检查 Chromium 安装或配置 PUPPETEER_EXECUTABLE_PATH');
    err.status = 500;
    throw err;
  }

  try {
    const page = await browser.newPage();
    const navigationTimeoutMs = Math.max(3000, Number(env.export.pdfNavigationTimeoutMs) || 30000);
    const resourceWaitTimeoutMs = Math.max(0, Number(env.export.pdfResourceWaitTimeoutMs) || 12000);

    page.setDefaultNavigationTimeout(navigationTimeoutMs);
    page.setDefaultTimeout(navigationTimeoutMs);

    let pdfBytes;
    try {
      // `networkidle0` 容易被慢速外链图片拖住；改为 DOM 就绪后做有限等待。
      await page.setContent(html, {
        waitUntil: 'domcontentloaded',
        timeout: navigationTimeoutMs,
      });

      if (resourceWaitTimeoutMs > 0) {
        await page.evaluate(async (maxWaitMs) => {
          const images = Array.from(document.images || []);
          if (!images.length) return;

          const settleImage = (img) => {
            if (img.complete) return Promise.resolve();

            return new Promise((resolve) => {
              let done = false;
              const finish = () => {
                if (done) return;
                done = true;
                img.removeEventListener('load', finish);
                img.removeEventListener('error', finish);
                resolve();
              };

              img.addEventListener('load', finish, { once: true });
              img.addEventListener('error', finish, { once: true });

              setTimeout(finish, Math.max(2000, Math.floor(maxWaitMs * 0.5)));
            });
          };

          await Promise.race([
            Promise.all(images.map((img) => settleImage(img))),
            new Promise((resolve) => setTimeout(resolve, maxWaitMs)),
          ]);
        }, resourceWaitTimeoutMs);
      }

      const projectTitle = escapeHtml(payload.project.title || '旅行纪念册');
      pdfBytes = await page.pdf({
        format: 'A4',
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: `<div style="font-size:8px;width:100%;padding:0 14mm;display:flex;justify-content:space-between;color:#999;">
          <span>${projectTitle}</span>
          <span>TripTimeline</span>
        </div>`,
        footerTemplate: `<div style="font-size:8px;width:100%;text-align:center;color:#999;">
          <span class="pageNumber"></span> / <span class="totalPages"></span>
        </div>`,
        margin: {
          top: '18mm',
          right: '14mm',
          bottom: '16mm',
          left: '14mm',
        },
      });
    } catch (error) {
      if (error?.name === 'TimeoutError') {
        const err = new Error('PDF 渲染超时：请检查外链图片可访问性，或提高 PDF_NAVIGATION_TIMEOUT_MS / PDF_RESOURCE_WAIT_TIMEOUT_MS');
        err.status = 504;
        throw err;
      }
      throw error;
    }

    return {
      buffer: Buffer.from(pdfBytes),
      filename: `${slugify(payload.project.title)}-memorial.pdf`,
      payload,
    };
  } finally {
    await browser.close();
  }
}
