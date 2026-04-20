import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { Content, Location } from '../models/index.js';
import { getProjectOrThrow } from './projectService.js';
import { env } from '../config/env.js';
import { renderMemorialHtml as renderMemorialHtmlImpl } from './export/memorialTemplate.js';
import {
  formatCoords,
  formatDateline,
  formatWeekday,
  escapeHtml,
} from './export/memorialComponents.js';
import { sanitizeAndEmbedImages } from './export/htmlSanitizer.js';
import { fetchAsDataUri } from './export/remoteAssets.js';

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

function fmtTime(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

const IMAGE_MIME = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.bmp': 'image/bmp',
  '.svg': 'image/svg+xml',
};

const AUDIO_MIME = {
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.oga': 'audio/ogg',
  '.opus': 'audio/ogg',
  '.flac': 'audio/flac',
  '.amr': 'audio/amr',
  '.silk': 'audio/silk',
};

/**
 * 生成本地资源文件的候选磁盘路径。
 *
 * @param {string} ref 引用，可能是 "/uploads/..."、"uploads/..." 或本地绝对路径
 * @returns {string[]}
 */
function getLocalCandidates(ref) {
  if (!ref || typeof ref !== 'string') return [];

  if (ref.startsWith('/uploads/')) {
    const relative = ref.replace(/^\//, '');
    return [
      path.join(PROJECT_ROOT, relative),
      path.join(WORKSPACE_ROOT, relative),
    ];
  }

  if (ref.startsWith('uploads/')) {
    return [
      path.join(PROJECT_ROOT, ref),
      path.join(WORKSPACE_ROOT, ref),
    ];
  }

  if (path.isAbsolute(ref)) return [ref];
  return [];
}

/**
 * 解析一条资源引用为浏览器可直接使用的 src。
 *
 * - data URI / 非字符串：原样返回（或 null）
 * - 本地 /uploads/... 或绝对路径：读盘后转 data URI
 * - http(s)：默认原样返回；当 opts.fetchRemote=true 时调用 fetchAsDataUri 抓取入内联
 *
 * @param {string} ref
 * @param {object} opts
 * @param {Record<string,string>} opts.mimeMap 扩展名到 MIME 的映射（本地路径用）
 * @param {'image'|'audio'} [opts.kind='image'] 远程资源类型（用于 fetchAsDataUri）
 * @param {boolean} [opts.fetchRemote=false] 是否把远程 URL 也抓成 data URI
 * @param {number} [opts.fetchTimeoutMs]
 * @param {number} [opts.fetchMaxBytes]
 * @returns {Promise<string|null>}
 */
async function resolveAsset(ref, opts) {
  if (!ref || typeof ref !== 'string') return null;
  if (ref.startsWith('data:')) return ref;

  const {
    mimeMap,
    kind = 'image',
    fetchRemote = false,
    fetchTimeoutMs,
    fetchMaxBytes,
  } = opts || {};

  if (/^https?:\/\//i.test(ref)) {
    if (!fetchRemote) return ref;
    const inlined = await fetchAsDataUri(ref, {
      kind,
      timeoutMs: fetchTimeoutMs,
      maxBytes: fetchMaxBytes,
    });
    // 抓取失败时回落到原始 URL，不阻塞主流程
    return inlined || ref;
  }

  const localCandidates = getLocalCandidates(ref);
  if (!localCandidates.length) return ref;

  for (const localPath of localCandidates) {
    const ext = path.extname(localPath).toLowerCase();
    const mime = mimeMap?.[ext];
    if (!mime) continue;

    try {
      const fileBuffer = await fs.readFile(localPath);
      return `data:${mime};base64,${fileBuffer.toString('base64')}`;
    } catch {
      // 尝试下一个候选路径
    }
  }

  return ref;
}

/**
 * 构造一对 (image, audio) 资源解析器，供同一次导出过程里复用。
 * 把 inlineRemote 等开关闭包到 resolver 里，传给 normalizeContentItem 使用。
 */
function createAssetResolvers({ inlineRemote, fetchTimeoutMs, fetchMaxBytes }) {
  const common = {
    fetchRemote: !!inlineRemote,
    fetchTimeoutMs,
    fetchMaxBytes,
  };
  const imageResolver = (ref) => resolveAsset(ref, {
    ...common,
    mimeMap: IMAGE_MIME,
    kind: 'image',
  });
  const audioResolver = (ref) => resolveAsset(ref, {
    ...common,
    mimeMap: AUDIO_MIME,
    kind: 'audio',
  });
  return { imageResolver, audioResolver };
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

async function resolveImages(srcs, imageResolver) {
  const out = [];
  for (const src of srcs) {
    const uri = await imageResolver(src);
    if (uri) out.push(uri);
  }
  return out;
}

async function normalizeContentItem(item, { imageResolver, audioResolver }) {
  const json = typeof item?.toJSON === 'function' ? item.toJSON() : item;
  if (!json || typeof json !== 'object') {
    return { day_key: '', day_dateline: '', day_weekday: '' };
  }

  const contentData = json.content_data || {};
  const recordTime = json.record_time || json.created_at;
  const recordDate = recordTime ? new Date(recordTime) : null;
  const validDate = recordDate && !Number.isNaN(recordDate.getTime());

  const normalized = {
    ...json,
    record_time_text: fmtDateTime(recordTime),
    render_time_text: fmtTime(recordTime),
    day_key: fmtDate(recordTime),
    day_dateline: validDate ? formatDateline(recordDate) : '',
    day_weekday: validDate ? formatWeekday(recordDate) : '',
  };

  // 通用：标题
  normalized.render_title = (contentData.title || '').trim();

  // 通用：地点（优先关联 location 表，回退 content_data.location_text）
  const loc = json.location;
  const locText = contentData.location_text || {};
  const placeName = (loc?.name || locText.name || '').trim();
  const placeAddress = (loc?.address || locText.address || '').trim();
  normalized.render_place_text = [placeName, placeAddress].filter(Boolean).join(' · ');
  normalized.render_coords = loc ? formatCoords(loc.latitude, loc.longitude) : '';

  // 通用：富文本正文 — 关键修复：清洗后保留 HTML，并把内嵌 <img src> 按 resolver 重写
  if (contentData.content && typeof contentData.content === 'string') {
    normalized.render_body_html = await sanitizeAndEmbedImages(
      contentData.content,
      imageResolver
    );
  } else if (contentData.text && typeof contentData.text === 'string') {
    // 兜底：text 字段做最简纯文本 → 段落
    const escaped = escapeHtml(contentData.text)
      .split(/\n{2,}/)
      .map((p) => `<p>${p.replace(/\n/g, '<br />')}</p>`)
      .join('');
    normalized.render_body_html = escaped;
  } else {
    normalized.render_body_html = '';
  }

  // 类型相关
  if (json.content_type === 'photo') {
    const sources = pickPhotoSources(contentData);
    normalized.render_photo_srcs = await resolveImages(sources, imageResolver);
    normalized.render_photo_caption = (contentData.caption || '').trim();
    if (!normalized.render_title && contentData.caption) {
      normalized.render_title = String(contentData.caption).trim();
    }
  } else if (json.content_type === 'note') {
    const noteSources = pickPhotoSources(contentData);
    normalized.render_photo_srcs = await resolveImages(noteSources, imageResolver);
    normalized.render_photo_caption = '';
    if (!normalized.render_title) normalized.render_title = '旅行笔记';
  } else if (json.content_type === 'audio') {
    const audio = contentData.audio || {};
    const audioUrl = audio.url || contentData.url || contentData.file_url || '';
    const resolvedAudio = audioUrl ? await audioResolver(audioUrl) : '';
    normalized.render_audio = audioUrl
      ? {
          url: resolvedAudio,
          name: audio.name || contentData.title || '语音片段',
          duration: audio.duration || contentData.duration || '',
        }
      : null;
    // 音频条目也允许带配图
    const audioImageSources = pickPhotoSources(contentData);
    normalized.render_photo_srcs = await resolveImages(audioImageSources, imageResolver);
    normalized.render_photo_caption = '';
    if (!normalized.render_title) normalized.render_title = '语音片段';
  }

  return normalized;
}

/**
 * 构造导出用的规范化数据。
 *
 * @param {number|string} projectId
 * @param {number|string} userId
 * @param {object} [options]
 * @param {boolean} [options.inlineRemote=false] 是否把远程（对象存储）资源预取为 data URI。
 *   PDF 导出路径强烈建议开启，避免 headless 浏览器渲染时资源未加载完就被截图。
 * @param {number} [options.fetchTimeoutMs] 单个远程资源抓取超时
 * @param {number} [options.fetchMaxBytes] 单个远程资源最大体积
 */
export async function buildExportData(projectId, userId, options = {}) {
  const {
    inlineRemote = false,
    fetchTimeoutMs,
    fetchMaxBytes,
  } = options;

  const { imageResolver, audioResolver } = createAssetResolvers({
    inlineRemote,
    fetchTimeoutMs,
    fetchMaxBytes,
  });

  const project = await getProjectOrThrow(projectId, userId);
  const projectJson = project.toJSON();
  const coverResolved = await imageResolver(projectJson.cover_image || '');

  const contents = await Content.findAll({
    where: { project_id: project.project_id },
    include: [{ model: Location, as: 'location', required: false }],
    order: [
      ['record_time', 'ASC'],
      ['sort_order', 'ASC'],
      ['content_id', 'ASC'],
    ],
  });

  const normalizedContents = [];
  for (const item of contents) {
    // 顺序 await 避免大量并发读盘/请求 CDN 时把服务端打爆
    const normalized = await normalizeContentItem(item, { imageResolver, audioResolver });
    normalizedContents.push(normalized);
  }

  return {
    project: {
      ...projectJson,
      cover_image_resolved: coverResolved,
      // 兼容老调用
      render_cover_image: coverResolved,
      start_date_text: fmtDate(projectJson.start_date),
      end_date_text: fmtDate(projectJson.end_date),
    },
    contents: normalizedContents,
    totalCount: normalizedContents.length,
  };
}

/**
 * 重新导出新模板的 renderMemorialHtml，保持外部调用兼容性。
 */
export const renderMemorialHtml = renderMemorialHtmlImpl;

export async function generateProjectHtmlExport(projectId, userId) {
  // HTML 下载场景：保留远程 URL，文件体积更小；用户浏览器打开时再取。
  const payload = await buildExportData(projectId, userId, { inlineRemote: false });
  const html = renderMemorialHtml(payload);
  const filename = `${slugify(payload.project.title)}-memorial.html`;
  return { html, filename, payload };
}

export async function generateProjectPdfExport(projectId, userId) {
  // PDF 场景：把对象存储资源预取成 data URI，避免 headless Chrome 渲染竞速。
  const payload = await buildExportData(projectId, userId, {
    inlineRemote: env.export.pdfInlineRemote,
    fetchTimeoutMs: env.export.pdfInlineRemoteFetchTimeoutMs,
    fetchMaxBytes: env.export.pdfInlineRemoteMaxBytes,
  });
  const html = renderMemorialHtml(payload);

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
      // 资源已在服务端预取为 data URI，可直接 domcontentloaded 后继续；
      // 页面内再做一层 images + fonts ready 的有限等待做安全网。
      await page.setContent(html, {
        waitUntil: 'domcontentloaded',
        timeout: navigationTimeoutMs,
      });

      if (resourceWaitTimeoutMs > 0) {
        await page.evaluate(async (maxWaitMs) => {
          const waitImages = (async () => {
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

            await Promise.all(images.map(settleImage));
          })();

          // 等 Web Fonts 全部就绪，避免 PDF 里 Fraunces / Cormorant 回退到衬线默认
          const waitFonts = (document.fonts && typeof document.fonts.ready?.then === 'function')
            ? document.fonts.ready
            : Promise.resolve();

          await Promise.race([
            Promise.all([waitImages, waitFonts]),
            new Promise((resolve) => setTimeout(resolve, maxWaitMs)),
          ]);
        }, resourceWaitTimeoutMs);
      }

      const projectTitle = escapeHtml(payload.project.title || '旅行纪念册');
      pdfBytes = await page.pdf({
        format: 'A4',
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: `<div style="font-size:8px;width:100%;padding:0 14mm;display:flex;justify-content:space-between;color:#999;font-family:serif;">
          <span>${projectTitle}</span>
          <span>TripTimeline · Dispatches</span>
        </div>`,
        footerTemplate: `<div style="font-size:8px;width:100%;text-align:center;color:#999;font-family:serif;">
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
