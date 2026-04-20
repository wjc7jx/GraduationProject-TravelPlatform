import sanitizeHtml from 'sanitize-html';

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
