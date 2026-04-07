import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { Content, Location } from '../models/index.js';
import { getProjectOrThrow } from './projectService.js';
import { env } from '../config/env.js';
import {
  getContentRules,
  getProjectRule,
  getViewerLevel,
  resolveContentRule,
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

function pickPhotoSource(contentData) {
  if (!contentData || typeof contentData !== 'object') return '';
  return (
    contentData.url
    || contentData.image_url
    || contentData.file_url
    || contentData.src
    || contentData.path
    || ''
  );
}

async function normalizeContentItem(item) {
  const json = item.toJSON();
  const contentData = json.content_data || {};
  const normalized = {
    ...json,
    record_time_text: fmtDateTime(json.record_time || json.created_at),
    day_key: fmtDate(json.record_time || json.created_at),
  };

  if (json.content_type === 'photo') {
    const source = pickPhotoSource(contentData);
    normalized.render_photo_src = await toDataUriIfLocalImage(source);
    normalized.render_photo_caption = contentData.caption || contentData.title || '';
  }

  if (json.content_type === 'note') {
    normalized.render_note_title = contentData.title || '旅行笔记';
    normalized.render_note_text = contentData.text || contentData.content || '';
  }

  if (json.content_type === 'audio') {
    normalized.render_audio_title = contentData.title || '语音片段';
    normalized.render_audio_url = contentData.url || contentData.file_url || '';
    normalized.render_audio_duration = contentData.duration || '';
  }

  if (json.content_type === 'track') {
    normalized.render_track_title = contentData.title || '轨迹记录';
    normalized.render_track_distance = contentData.distance || '';
    normalized.render_track_url = contentData.url || contentData.file_url || '';
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

  const contentIds = contents.map((item) => item.content_id);
  const projectRule = await getProjectRule(project.project_id);
  const contentRulesMap = await getContentRules(contentIds);

  const filteredRaw = contents.filter((item) => {
    if (includeSet.size > 0 && !includeSet.has(Number(item.content_id))) return false;
    if (excludeSet.has(Number(item.content_id))) return false;

    const rule = resolveContentRule(item, { projectRule, contentRulesMap });
    return shouldKeepByExportScope(rule, {
      visibilityScope: scope,
      requesterUserId: userId,
      ownerUserId: project.user_id,
      viewerUserId,
    });
  });

  const normalizedContents = [];
  for (const item of filteredRaw) {
    // 顺序 await 避免大量并发读取本地图片导致导出卡顿
    const rule = resolveContentRule(item, { projectRule, contentRulesMap });
    const privacyViewerId = scope === 'all' ? userId : viewerUserId;
    const viewerLevel = getViewerLevel(rule, project.user_id, privacyViewerId);
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

function renderContentCard(item) {
  const locationText = item.location
    ? `${item.location.name || ''} ${item.location.address || ''}`.trim()
    : '';

  const metaLine = [item.record_time_text, locationText].filter(Boolean).join(' · ');

  if (item.content_type === 'photo') {
    return `
      <article class="card photo-card">
        <div class="meta">${escapeHtml(metaLine)}</div>
        ${item.render_photo_src ? `<img src="${escapeHtml(item.render_photo_src)}" alt="旅行照片" class="photo" />` : ''}
        ${item.render_photo_caption ? `<p class="caption">${escapeHtml(item.render_photo_caption)}</p>` : ''}
      </article>
    `;
  }

  if (item.content_type === 'note') {
    return `
      <article class="card note-card">
        <div class="meta">${escapeHtml(metaLine)}</div>
        <h3>${escapeHtml(item.render_note_title || '旅行笔记')}</h3>
        <p>${escapeHtml(item.render_note_text || '').replace(/\n/g, '<br />')}</p>
      </article>
    `;
  }

  if (item.content_type === 'audio') {
    return `
      <article class="card audio-card">
        <div class="meta">${escapeHtml(metaLine)}</div>
        <h3>${escapeHtml(item.render_audio_title || '语音片段')}</h3>
        <p>时长：${escapeHtml(item.render_audio_duration || '未知')}</p>
        ${item.render_audio_url ? `<p class="hint">音频地址：${escapeHtml(item.render_audio_url)}</p>` : ''}
      </article>
    `;
  }

  if (item.content_type === 'track') {
    return `
      <article class="card track-card">
        <div class="meta">${escapeHtml(metaLine)}</div>
        <h3>${escapeHtml(item.render_track_title || '轨迹记录')}</h3>
        <p>里程：${escapeHtml(item.render_track_distance || '未知')}</p>
        ${item.render_track_url ? `<p class="hint">轨迹文件：${escapeHtml(item.render_track_url)}</p>` : ''}
      </article>
    `;
  }

  return `
    <article class="card">
      <div class="meta">${escapeHtml(metaLine)}</div>
      <h3>未识别内容类型</h3>
      <pre>${escapeHtml(JSON.stringify(item.content_data || {}, null, 2))}</pre>
    </article>
  `;
}

export function renderMemorialHtml(payload) {
  const { project, sections, totalCount, visibilityScope } = payload;
  const coverImage = project.render_cover_image || project.cover_image || '';
  const toc = sections
    .map((section, index) => `<li><a href="#day-${index + 1}">${escapeHtml(section.title)}（${section.items.length}）</a></li>`)
    .join('');

  const sectionsHtml = sections
    .map(
      (section, index) => `
      <section class="day-section" id="day-${index + 1}">
        <h2>${escapeHtml(section.title)}</h2>
        <div class="cards">
          ${section.items.map((item) => renderContentCard(item)).join('\n')}
        </div>
      </section>
    `,
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
        --bg: #f4f1ea;
        --panel: #fffaf3;
        --ink: #1d1b1a;
        --muted: #6a6259;
        --brand: #0f766e;
        --line: #d8cfc4;
        --paper: #fffdf8;
      }
      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; }
      body {
        font-family: "Noto Serif SC", "Source Han Serif SC", serif;
        color: var(--ink);
        background: radial-gradient(circle at 20% 20%, #fff8ed 0%, var(--bg) 55%, #ece4d8 100%);
        line-height: 1.7;
      }
      .wrap {
        width: min(1040px, 92vw);
        margin: 24px auto 80px;
      }
      .print-head {
        display: none;
      }
      .cover {
        background: linear-gradient(160deg, rgba(15,118,110,0.92), rgba(12,84,109,0.92));
        color: #fff;
        border-radius: 18px;
        overflow: hidden;
        box-shadow: 0 18px 50px rgba(32, 43, 53, 0.22);
      }
      .cover-inner {
        padding: 40px 38px;
        position: relative;
      }
      .cover-inner::after {
        content: "";
        position: absolute;
        right: -120px;
        top: -120px;
        width: 280px;
        height: 280px;
        border-radius: 999px;
        background: radial-gradient(circle, rgba(255,255,255,0.35), rgba(255,255,255,0));
      }
      .cover h1 {
        margin: 0 0 8px;
        font-size: clamp(30px, 5vw, 48px);
        line-height: 1.15;
      }
      .cover .subtitle {
        opacity: 0.92;
      }
      .cover img {
        display: block;
        width: 100%;
        max-height: 380px;
        object-fit: cover;
      }
      .panel {
        margin-top: 20px;
        background: var(--panel);
        border: 1px solid var(--line);
        border-radius: 14px;
        padding: 22px 24px;
      }
      .panel h2 {
        margin: 0 0 12px;
      }
      .toc {
        margin: 0;
        padding-left: 20px;
      }
      .toc a {
        color: var(--brand);
        text-decoration: none;
      }
      .day-section {
        margin-top: 34px;
        page-break-inside: avoid;
        page-break-before: auto;
      }
      .day-section h2 {
        margin: 0 0 14px;
        font-size: 26px;
        border-left: 4px solid var(--brand);
        padding-left: 10px;
      }
      .cards {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
        gap: 14px;
      }
      .card {
        background: var(--paper);
        border-radius: 12px;
        border: 1px solid #e6ddd2;
        padding: 14px;
        box-shadow: 0 6px 18px rgba(31, 27, 23, 0.08);
        break-inside: avoid;
      }
      .meta {
        color: var(--muted);
        font-size: 13px;
        margin-bottom: 8px;
      }
      .photo {
        width: 100%;
        aspect-ratio: 4 / 3;
        object-fit: cover;
        border-radius: 10px;
      }
      .caption { margin: 8px 0 0; }
      .hint {
        margin: 6px 0 0;
        font-size: 12px;
        color: #6f675d;
        word-break: break-all;
      }
      .footer {
        margin-top: 30px;
        text-align: center;
        color: #7a7168;
      }

      @page {
        size: A4;
        margin: 16mm;
      }
      @media print {
        .print-head {
          display: block;
          margin-bottom: 10px;
          color: #5d564e;
          font-size: 12px;
          border-bottom: 1px solid #d9d1c5;
          padding-bottom: 5px;
        }
        .print-head .sep {
          padding: 0 8px;
          color: #a09588;
        }
        body {
          background: white;
        }
        .wrap {
          width: 100%;
          margin: 0;
        }
        .cover {
          box-shadow: none;
          border-radius: 10px;
        }
        .day-section {
          page-break-inside: avoid;
        }
        .day-section + .day-section {
          page-break-before: always;
        }
      }
    </style>
  </head>
  <body>
    <main class="wrap">
      <div class="print-head">
        <span>${escapeHtml(project.title || '旅行纪念册')}</span>
        <span class="sep">|</span>
        <span>${escapeHtml(fmtDate(project.start_date))} - ${escapeHtml(fmtDate(project.end_date) || '进行中')}</span>
      </div>
      <section class="cover">
        <div class="cover-inner">
          <h1>${escapeHtml(project.title || '我的旅行项目')}</h1>
          <p class="subtitle">${escapeHtml(fmtDate(project.start_date))} - ${escapeHtml(fmtDate(project.end_date) || '进行中')}</p>
          <p class="subtitle">共导出 ${totalCount} 条内容 · 范围：${escapeHtml(visibilityScope)}</p>
        </div>
        ${coverImage ? `<img src="${escapeHtml(coverImage)}" alt="封面" />` : ''}
      </section>

      <section class="panel">
        <h2>目录</h2>
        <ol class="toc">${toc}</ol>
      </section>

      ${sectionsHtml}

      <p class="footer">Generated by TripTimeline Export Module</p>
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
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfBytes = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '12mm',
        right: '12mm',
        bottom: '14mm',
        left: '12mm',
      },
    });

    return {
      buffer: Buffer.from(pdfBytes),
      filename: `${slugify(payload.project.title)}-memorial.pdf`,
      payload,
    };
  } finally {
    await browser.close();
  }
}
