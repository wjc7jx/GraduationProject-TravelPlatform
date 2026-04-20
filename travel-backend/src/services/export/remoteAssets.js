/**
 * 远程资源下载为 data URI。
 *
 * 主要用在 PDF 导出路径：预先把对象存储的图片/音频抓成 base64 内联到 HTML，
 * 避免 headless Chrome 渲染时资源还没从 CDN 加载完就被截图。
 *
 * 设计要点：
 * - 使用 Node 全局 fetch（Node ≥ 18），配合 AbortController 强制超时
 * - 读取阶段边读边累加，超过 maxBytes 立即 abort，防止内存放大
 * - MIME 优先采用响应头的 Content-Type；缺失或不合法时回退到 URL 扩展名推断
 * - 任何失败都返回 null，调用方应把原始 URL 原样保留
 */

const EXT_MIME_IMAGE = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.bmp': 'image/bmp',
  '.svg': 'image/svg+xml',
  '.heic': 'image/heic',
  '.heif': 'image/heif',
};

const EXT_MIME_AUDIO = {
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

function extOf(url) {
  try {
    const u = new URL(url);
    const i = u.pathname.lastIndexOf('.');
    if (i < 0) return '';
    return u.pathname.slice(i).toLowerCase();
  } catch {
    return '';
  }
}

function inferMimeFromUrl(url, kind) {
  const ext = extOf(url);
  if (!ext) return '';
  const table = kind === 'audio' ? EXT_MIME_AUDIO : EXT_MIME_IMAGE;
  return table[ext] || '';
}

function normalizeMime(raw, kind, url) {
  const clean = String(raw || '').split(';')[0].trim().toLowerCase();
  const expectedPrefix = kind === 'audio' ? 'audio/' : 'image/';
  if (clean.startsWith(expectedPrefix)) return clean;
  return inferMimeFromUrl(url, kind);
}

/**
 * 把一个 http(s) 资源下载为 data URI。
 *
 * @param {string} url 远程资源 URL
 * @param {object} opts
 * @param {'image'|'audio'} [opts.kind='image'] 资源类型，用于 MIME 回退推断
 * @param {number} [opts.timeoutMs=15000] 单次请求超时
 * @param {number} [opts.maxBytes=15728640] 单个资源最大字节数（默认 15 MB）
 * @returns {Promise<string|null>} 成功返回 data URI；失败/超时/超尺寸返回 null
 */
export async function fetchAsDataUri(url, opts = {}) {
  if (!url || typeof url !== 'string') return null;
  if (!/^https?:\/\//i.test(url)) return null;

  const {
    kind = 'image',
    timeoutMs = 15000,
    maxBytes = 15 * 1024 * 1024,
  } = opts;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(1000, timeoutMs));

  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        // 某些 CDN 会对裸 UA 降级，给一个通用 UA
        'user-agent': 'TripTimeline-Exporter/1.0 (+pdf)',
        accept: kind === 'audio' ? 'audio/*,*/*;q=0.8' : 'image/*,*/*;q=0.8',
      },
    });

    if (!res.ok || !res.body) return null;

    const declaredLen = Number(res.headers.get('content-length'));
    if (Number.isFinite(declaredLen) && declaredLen > maxBytes) return null;

    const mime = normalizeMime(res.headers.get('content-type'), kind, url);
    if (!mime) return null;

    const chunks = [];
    let total = 0;
    // 使用 Web ReadableStream reader 做有限 size 的流读取，超限立即 abort
    const reader = res.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        try { await reader.cancel(); } catch { /* ignore */ }
        controller.abort();
        return null;
      }
      chunks.push(value);
    }

    const buf = Buffer.concat(chunks.map((c) => Buffer.from(c)), total);
    return `data:${mime};base64,${buf.toString('base64')}`;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
