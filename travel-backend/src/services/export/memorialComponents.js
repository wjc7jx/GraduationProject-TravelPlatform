/**
 * 旅行纪念册 HTML 组件构建器。
 * 全部为纯函数，输入已规范化的数据，返回 HTML 字符串。
 */

export function escapeHtml(input) {
  return String(input ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const WEEKDAY_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const NUMBER_WORDS = [
  'Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen',
  'Eighteen', 'Nineteen',
];
const TENS = ['', '', 'Twenty', 'Thirty'];

function dayInWords(day) {
  if (day < 20) return NUMBER_WORDS[day] || String(day);
  const t = Math.floor(day / 10);
  const r = day % 10;
  if (r === 0) return TENS[t] || String(day);
  return `${TENS[t]}-${NUMBER_WORDS[r]}`;
}

/**
 * 把 Date 转成编辑风的 dateline，例如：MARCH · FOURTEEN · 2025
 */
export function formatDateline(date) {
  if (!date || Number.isNaN(date.getTime?.())) return '';
  const m = MONTH_EN[date.getMonth()].toUpperCase();
  const d = dayInWords(date.getDate()).toUpperCase();
  const y = date.getFullYear();
  return `${m} · ${d} · ${y}`;
}

export function formatWeekday(date) {
  if (!date || Number.isNaN(date.getTime?.())) return '';
  return WEEKDAY_EN[date.getDay()];
}

/**
 * 经纬度转为 31°13′28″N · 121°28′05″E 形式
 */
export function formatCoords(lat, lng) {
  const fmt = (val, posLabel, negLabel) => {
    if (val === null || val === undefined || val === '') return '';
    const num = Number(val);
    if (!Number.isFinite(num)) return '';
    const label = num >= 0 ? posLabel : negLabel;
    const abs = Math.abs(num);
    const deg = Math.floor(abs);
    const minF = (abs - deg) * 60;
    const min = Math.floor(minF);
    const sec = Math.round((minF - min) * 60);
    const pad = (n) => String(n).padStart(2, '0');
    return `${deg}°${pad(min)}′${pad(sec)}″${label}`;
  };
  const a = fmt(lat, 'N', 'S');
  const b = fmt(lng, 'E', 'W');
  if (!a && !b) return '';
  return [a, b].filter(Boolean).join(' · ');
}

/**
 * 编号格式："01" / "12" / "120"
 */
export function formatEntryNumber(n) {
  if (!Number.isFinite(n)) return '';
  return String(n).padStart(2, '0');
}

/**
 * 朱砂色环形邮戳 SVG。
 * 周边环形文字使用 textPath 沿圆环绘制；中心两行内容。
 */
export function renderStampSvg({ ringText = '', centerTop = '', centerBottom = '' } = {}) {
  const safeRing = escapeHtml(ringText.toUpperCase());
  const safeTop = escapeHtml(centerTop.toUpperCase());
  const safeBottom = escapeHtml(centerBottom.toUpperCase());
  return `
<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <path id="stampRing" d="M 60,60 m -46,0 a 46,46 0 1,1 92,0 a 46,46 0 1,1 -92,0" fill="none"/>
  </defs>
  <circle cx="60" cy="60" r="54" fill="none" stroke="currentColor" stroke-width="1.4"/>
  <circle cx="60" cy="60" r="49" fill="none" stroke="currentColor" stroke-width="0.6"/>
  <circle cx="60" cy="60" r="28" fill="none" stroke="currentColor" stroke-width="0.6"/>
  <text font-family="JetBrains Mono, monospace" font-size="7.2" fill="currentColor" letter-spacing="2.6">
    <textPath href="#stampRing" startOffset="0">${safeRing}</textPath>
  </text>
  <text x="60" y="58" text-anchor="middle" font-family="Fraunces, serif" font-style="italic" font-weight="700" font-size="13" fill="currentColor">${safeTop}</text>
  <text x="60" y="74" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="7" fill="currentColor" letter-spacing="2">${safeBottom}</text>
</svg>`;
}

/**
 * 简单的 colophon 装饰小标
 */
export function renderColophonMark() {
  return `
<svg class="colophon-mark" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <circle cx="8" cy="8" r="6.4" fill="none" stroke="currentColor" stroke-width="1"/>
  <circle cx="8" cy="8" r="1.6" fill="currentColor"/>
</svg>`;
}

/**
 * 音频喇叭图标 SVG
 */
function renderAudioIcon() {
  return `
<svg class="audio-icon" viewBox="0 0 44 44" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <circle cx="22" cy="22" r="20" fill="none" stroke="currentColor" stroke-width="1.4"/>
  <path d="M16 14 L16 30 M19 11 L19 33 M22 8 L22 36 M25 13 L25 31 M28 16 L28 28 M31 19 L31 25"
    stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
</svg>`;
}

/**
 * 渲染封面（书封感）。
 * project: 含 title / subtitle / description / start_date / end_date / tags / cover_image (data URI)
 * meta: { totalCount, dayCount, generatedAt, brandRingText }
 */
export function renderCover(project, meta) {
  const { totalCount = 0, dayCount = 0, brandRingText = 'TRIPTIMELINE · DISPATCH · ARCHIVE', stampTop = '邮戳', stampBottom = '' } = meta;
  const tags = Array.isArray(project.tags) ? project.tags : [];
  const description = project.description || project.subtitle || '';
  const cover = project.cover_image_resolved || project.cover_image || '';

  const start = project.start_date_text || '';
  const end = project.end_date_text || '进行中';

  const tagsHtml = tags.length
    ? `<div class="cover-tags">${tags
        .map((t) => `<span class="cover-tag">${escapeHtml(typeof t === 'string' ? t : (t?.name || ''))}</span>`)
        .join('')}</div>`
    : '';

  const stamp = renderStampSvg({
    ringText: brandRingText,
    centerTop: stampTop,
    centerBottom: stampBottom,
  });

  return `
<section class="cover" aria-label="cover">
  <div class="cover-photo">
    ${cover ? `<img src="${escapeHtml(cover)}" alt="" />` : ''}
  </div>
  <div class="cover-plate">
    <div class="cover-stamp">${stamp}</div>
    <p class="cover-eyebrow">A Travelogue · Dispatch No. ${escapeHtml(String(project.project_id || '—'))}</p>
    <h1 class="cover-title">${escapeHtml(project.title || '我的旅行')}</h1>
    ${description ? `<p class="cover-subtitle">${escapeHtml(description)}</p>` : ''}
    <div class="cover-divider"></div>
    <div class="cover-meta-row">
      <div>
        <span class="label">Itinerary</span>
        <span class="value">${escapeHtml(start)} — ${escapeHtml(end)}</span>
      </div>
      <div>
        <span class="label">Entries</span>
        <span class="value">${escapeHtml(String(totalCount).padStart(2, '0'))}</span>
      </div>
      <div>
        <span class="label">Days</span>
        <span class="value">${escapeHtml(String(dayCount).padStart(2, '0'))}</span>
      </div>
    </div>
    ${tagsHtml}
  </div>
</section>`;
}

/**
 * 渲染日章节开场。
 * group: { date, weekday, dateline, count }
 */
export function renderDaySection(group, entriesHtml, dayIndex) {
  return `
<section class="day-section">
  <header class="day-opener">
    <div class="day-weekday">${escapeHtml(group.weekday || '—')}</div>
    <div class="day-dateline">${escapeHtml(group.dateline || '')}</div>
    <div class="day-count">Day ${escapeHtml(String(dayIndex).padStart(2, '0'))} · ${escapeHtml(String(group.count))} 条</div>
  </header>
  <div class="entries">
    ${entriesHtml}
  </div>
</section>`;
}

/**
 * 渲染照片块。
 * srcs: 已解析的图片 src 数组
 */
export function renderPhotoBlock(srcs, caption) {
  if (!srcs || !srcs.length) return '';
  const count = srcs.length;
  const colsClass =
    count === 1 ? 'cols-1'
      : count === 2 ? 'cols-2'
        : count === 3 ? 'cols-3'
          : 'cols-n';
  const figs = srcs
    .map((s) => `<figure><img src="${escapeHtml(s)}" alt="旅行照片" loading="lazy" /></figure>`)
    .join('');
  const cap = caption
    ? `<p class="photo-caption">${escapeHtml(caption)}</p>`
    : '';
  return `
<div class="photo-block">
  <div class="photo-grid ${colsClass}">${figs}</div>
  ${cap}
</div>`;
}

/**
 * 渲染音频块。
 * audio: { url, name, duration }
 */
export function renderAudioBlock(audio) {
  if (!audio || !audio.url) return '';
  const name = audio.name || '语音片段';
  const sub = audio.duration ? `时长 ${audio.duration}` : 'AUDIO MEMO';
  return `
<div class="audio-block">
  ${renderAudioIcon()}
  <div class="audio-info">
    <div class="audio-name">${escapeHtml(name)}</div>
    <div class="audio-sub">${escapeHtml(sub)}</div>
  </div>
  <audio controls preload="metadata" src="${escapeHtml(audio.url)}"></audio>
</div>`;
}

/**
 * 渲染单条条目（编辑风：编号 / 坐标 / 时间 / 地点 → 标题 → 朱砂细线 → 正文 → 图片 → 音频）。
 *
 * entry: 由 normalizeContentItem 增强后的对象，应包含：
 *   render_number, render_coords, render_time_text, render_place_text,
 *   render_title, render_body_html (已 sanitize), render_photo_srcs, render_audio
 */
export function renderEntry(entry) {
  const numHtml = entry.render_number
    ? `<span class="meta-num">N° ${escapeHtml(entry.render_number)}</span>`
    : '';
  const coordsHtml = entry.render_coords
    ? `<span class="meta-coords">${escapeHtml(entry.render_coords)}</span>`
    : '';
  const timeHtml = entry.render_time_text
    ? `<span class="meta-time">${escapeHtml(entry.render_time_text)}</span>`
    : '';
  const placeHtml = entry.render_place_text
    ? `<span class="meta-place">${escapeHtml(entry.render_place_text)}</span>`
    : '';
  const meta = [numHtml, coordsHtml, timeHtml, placeHtml].filter(Boolean).join('');

  const titleHtml = entry.render_title
    ? `<h2 class="entry-title">${escapeHtml(entry.render_title)}</h2>`
    : '';

  const body = entry.render_body_html || '';
  const dropcapClass = body && body.length > 80 ? ' has-dropcap' : '';
  const bodyHtml = body
    ? `<div class="entry-body${dropcapClass}">${body}</div>`
    : '';

  const photosHtml = renderPhotoBlock(entry.render_photo_srcs || [], entry.render_photo_caption || '');
  const audioHtml = renderAudioBlock(entry.render_audio || null);

  return `
<article class="entry" data-content-type="${escapeHtml(entry.content_type || '')}">
  <div class="entry-meta">${meta}</div>
  ${titleHtml}
  <div class="entry-rule" aria-hidden="true"></div>
  ${bodyHtml}
  ${photosHtml}
  ${audioHtml}
</article>`;
}

/**
 * 顶部 masthead 与底部 colophon
 */
export function renderMasthead(project, generatedAt) {
  return `
<header class="masthead">
  <span class="masthead-brand">TripTimeline · Dispatches</span>
  <span class="masthead-issue">Issue ${escapeHtml(String(project.project_id || '—'))} · 导出于 ${escapeHtml(generatedAt)}</span>
</header>`;
}

export function renderColophon(project, generatedAt) {
  return `
<footer class="colophon">
  ${renderColophonMark()}
  <div><span class="colophon-brand">TripTimeline</span> · A Field Dispatch</div>
  <div class="colophon-line">${escapeHtml(project.title || '旅行纪念册')} · 印于 ${escapeHtml(generatedAt)}</div>
</footer>`;
}
