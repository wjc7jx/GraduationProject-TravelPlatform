import sanitizeHtml from 'sanitize-html';
import { env } from '../config/env.js';

const ALLOWED_TAGS = [
  'p', 'br', 'hr',
  'h1', 'h2', 'h3', 'h4',
  'strong', 'b', 'em', 'i', 'u', 's', 'sub', 'sup',
  'ul', 'ol', 'li',
  'blockquote', 'figure', 'figcaption',
  'a', 'img',
  'span', 'div',
];

const ALLOWED_ATTRS = {
  a: ['href', 'title', 'target', 'rel'],
  img: ['src', 'alt', 'title', 'width', 'height'],
  '*': ['class'],
};

const SANITIZE_OPTIONS = {
  allowedTags: ALLOWED_TAGS,
  allowedAttributes: ALLOWED_ATTRS,
  allowedSchemes: ['http', 'https', 'data'],
  allowedSchemesByTag: { img: ['http', 'https', 'data'] },
  allowProtocolRelative: false,
  transformTags: {
    a: (tagName, attribs) => ({
      tagName: 'a',
      attribs: {
        ...attribs,
        target: '_blank',
        rel: 'noopener noreferrer',
      },
    }),
  },
  exclusiveFilter: (frame) => {
    const t = frame.tag;
    if (t === 'p' || t === 'div' || t === 'span') {
      return !frame.text.trim() && !frame.mediaChildren?.length;
    }
    return false;
  },
};

/**
 * 清洗富文本，删除脚本/事件属性/样式等危险字段。
 *
 * @param {string} rawHtml 来自前端编辑器的原始 HTML
 * @returns {string} 安全的 HTML 字符串
 */
export function sanitizeRichText(rawHtml) {
  if (!rawHtml || typeof rawHtml !== 'string') return '';
  return sanitizeHtml(rawHtml, SANITIZE_OPTIONS);
}

/**
 * 异步把 HTML 中所有 <img src> 通过 resolver 重写为新的引用
 * （通常用于把本地 /uploads/ 路径转成 data URI）。
 *
 * 由于 sanitize-html 是同步的，无法直接在 transformTags 里做异步转换，
 * 因此先清洗、再用 regex 二次处理 src 属性。这里只匹配 sanitize-html 输出格式
 * 的 src="...">（双引号），不做通用 HTML 解析。
 *
 * @param {string} html sanitize 后的 HTML
 * @param {(src: string) => Promise<string|null>} resolver 异步 src 解析器
 * @returns {Promise<string>}
 */
export async function rewriteImageSources(html, resolver) {
  if (!html || typeof html !== 'string') return '';
  if (typeof resolver !== 'function') return html;

  const pattern = /<img\b([^>]*?)\ssrc="([^"]*)"([^>]*)>/g;
  const matches = [];
  let m;
  while ((m = pattern.exec(html)) !== null) {
    matches.push({
      full: m[0],
      pre: m[1],
      src: m[2],
      post: m[3],
    });
  }
  if (!matches.length) return html;

  const replacements = await Promise.all(
    matches.map(async (item) => {
      try {
        const next = await resolver(item.src);
        return next || item.src;
      } catch {
        return item.src;
      }
    })
  );

  let cursor = 0;
  let out = '';
  pattern.lastIndex = 0;
  let i = 0;
  while ((m = pattern.exec(html)) !== null) {
    out += html.slice(cursor, m.index);
    out += `<img${m[1]} src="${replacements[i]}"${m[3]}>`;
    cursor = m.index + m[0].length;
    i += 1;
  }
  out += html.slice(cursor);
  return out;
}

/**
 * 一站式：清洗富文本并把内嵌图片 src 转换为可移植引用。
 *
 * @param {string} rawHtml 原始 HTML
 * @param {(src: string) => Promise<string|null>} imageResolver 异步图片解析器
 * @returns {Promise<string>}
 */
export async function sanitizeAndEmbedImages(rawHtml, imageResolver) {
  const cleaned = sanitizeRichText(rawHtml);
  if (!cleaned) return '';
  return rewriteImageSources(cleaned, imageResolver);
}

/**
 * 把富文本 HTML 抽取为纯文本，供内容安全接口送检使用。
 * 去除所有标签，保留可见文字；连续空白合并为单个空格。
 *
 * @param {string} rawHtml 原始或已清洗的 HTML
 * @returns {string}
 */
export function extractPlainTextFromHtml(rawHtml) {
  if (!rawHtml || typeof rawHtml !== 'string') return '';
  const stripped = sanitizeHtml(rawHtml, {
    allowedTags: [],
    allowedAttributes: {},
    textFilter: (text) => text,
  });
  return stripped
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ============================================================
// 以下为保存路径（而非导出路径）使用的通用输入净化工具
// ============================================================

/**
 * 去除控制字符并截断长度。
 *
 * @param {unknown} input 任意输入
 * @param {{ maxLength?: number, allowNewline?: boolean }} [options]
 * @returns {string} 处理后的文本；非字符串一律视为空字符串
 */
export function sanitizePlainText(input, options = {}) {
  if (input === null || input === undefined) return '';
  if (typeof input !== 'string') return '';

  const { maxLength, allowNewline = false } = options;

  // 过滤掉不可见控制字符。允许换行时保留 \n\r\t。
  const controlRe = allowNewline
    ? /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g
    : /[\u0000-\u001F\u007F]/g;

  let s = input.replace(controlRe, '');
  s = s.trim();

  if (typeof maxLength === 'number' && maxLength > 0 && s.length > maxLength) {
    s = s.slice(0, maxLength);
  }
  return s;
}

/**
 * 拒绝协议：不允许 javascript:/data:/vbscript:/blob:/file:
 * 协议相对（//example.com/...）也拒绝。
 */
const FORBIDDEN_URL_SCHEMES = /^(javascript|data|vbscript|blob|file):/i;

function getAllowedOrigins() {
  const origins = new Set();
  const base = env?.qiniu?.publicBaseUrl;
  if (base) {
    try {
      origins.add(new URL(base).origin);
    } catch {
      /* ignore */
    }
  }
  const publicBase = env?.publicBaseUrl;
  if (publicBase) {
    try {
      origins.add(new URL(publicBase).origin);
    } catch {
      /* ignore */
    }
  }
  return origins;
}

function makeBadUrlError(url, reason) {
  const err = new Error(`非法资源地址 (${reason}): ${url}`);
  err.status = 400;
  return err;
}

/**
 * 校验资源 URL 是否来自许可来源。
 * - 允许：以 `/uploads/` 开头的相对路径。
 * - 允许：与 `env.qiniu.publicBaseUrl` 或 `env.publicBaseUrl` 同源的绝对 URL。
 * - 拒绝：javascript:/data:/vbscript:/blob:/file: 等危险协议。
 * - 拒绝：协议相对 URL（以 `//` 开头）。
 *
 * @param {unknown} rawUrl 原始 URL
 * @param {{ allowEmpty?: boolean }} [options]
 * @returns {string} 规范化后的 URL；若 allowEmpty 为 true 则可能返回空串
 */
export function sanitizeResourceUrl(rawUrl, options = {}) {
  const { allowEmpty = false } = options;
  const raw = typeof rawUrl === 'string' ? rawUrl.trim() : '';

  if (!raw) {
    if (allowEmpty) return '';
    throw makeBadUrlError('', '空地址');
  }

  if (FORBIDDEN_URL_SCHEMES.test(raw)) {
    throw makeBadUrlError(raw, '禁用协议');
  }

  if (raw.startsWith('//')) {
    throw makeBadUrlError(raw, '协议相对地址');
  }

  // 本地静态资源
  if (raw.startsWith('/uploads/')) {
    // 防止路径穿越
    if (raw.includes('..')) {
      throw makeBadUrlError(raw, '包含路径穿越');
    }
    return raw;
  }

  // 仅允许 http/https 的绝对 URL 且必须同源
  if (/^https?:\/\//i.test(raw)) {
    let origin;
    try {
      origin = new URL(raw).origin;
    } catch {
      throw makeBadUrlError(raw, 'URL 无法解析');
    }
    const allowed = getAllowedOrigins();
    if (!allowed.has(origin)) {
      throw makeBadUrlError(raw, '不在允许来源范围');
    }
    return raw;
  }

  throw makeBadUrlError(raw, '未识别的地址格式');
}

/**
 * 批量校验 URL 列表，去空、去重，并限制最大条数。
 *
 * @param {unknown} list
 * @param {number} [max=9]
 * @returns {string[]}
 */
export function sanitizeResourceUrlList(list, max = 9) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const result = [];
  for (const item of list) {
    const url = sanitizeResourceUrl(item, { allowEmpty: true });
    if (!url) continue;
    if (seen.has(url)) continue;
    seen.add(url);
    result.push(url);
    if (result.length >= max) break;
  }
  return result;
}
