/**
 * 旅行纪念册的 CSS。
 *
 * 美学方向："Dispatches" — 小型旅行通讯社／编辑风纸本
 * - 字体：Fraunces (display) + Cormorant Garamond (body) + JetBrains Mono (meta) + Noto Serif SC (CJK)
 * - 主色：暖米纸 + 墨黑 + 朱砂邮戳红 + 瓶绿
 * - 纹理：极淡 SVG noise 纸纹
 * - 版面：书封开场 + 按日分章 + 编辑风条目（编号/坐标/dateline/drop-cap）
 */
export const MEMORIAL_CSS = String.raw`
@import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;0,9..144,700;1,9..144,400;1,9..144,600;1,9..144,700&family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500;1,600&family=JetBrains+Mono:wght@400;500;600&family=Noto+Serif+SC:wght@400;500;600;700&display=swap');

:root {
  --paper: #f1e8d7;
  --paper-deep: #e8dcc3;
  --paper-soft: #f6efe1;
  --ink: #1a1612;
  --ink-soft: #3a322a;
  --muted: #8a7f71;
  --vermilion: #b43a1f;
  --vermilion-soft: #c8654a;
  --forest: #2d4a3e;
  --forest-soft: #5a7a6a;
  --hairline: #c7b79d;
  --hairline-strong: #a89677;

  --font-display: 'Fraunces', 'Noto Serif SC', 'Source Han Serif SC', 'Songti SC', serif;
  --font-body: 'Cormorant Garamond', 'Noto Serif SC', 'Source Han Serif SC', 'Songti SC', serif;
  --font-mono: 'JetBrains Mono', 'SF Mono', 'Menlo', ui-monospace, monospace;

  --col: min(720px, 88vw);
  --gutter: 28px;
}

* { box-sizing: border-box; margin: 0; padding: 0; }
html { scroll-behavior: smooth; }

body {
  font-family: var(--font-body);
  font-weight: 400;
  font-size: 17px;
  line-height: 1.78;
  color: var(--ink);
  background-color: var(--paper);
  background-image:
    radial-gradient(ellipse at 20% 0%, rgba(180,58,31,0.04) 0%, transparent 60%),
    radial-gradient(ellipse at 80% 100%, rgba(45,74,62,0.05) 0%, transparent 55%),
    url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='280' height='280'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.10  0 0 0 0 0.08  0 0 0 0 0.05  0 0 0 0.07 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>");
  background-attachment: fixed;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}

::selection { background: var(--vermilion); color: var(--paper); }

/* ---------- 文档容器 ---------- */
.dispatch {
  width: var(--col);
  margin: 0 auto;
  padding: 56px 0 96px;
}

/* ---------- 顶 masthead ---------- */
.masthead {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--muted);
  padding-bottom: 18px;
  margin-bottom: 32px;
  border-bottom: 1px solid var(--hairline);
}
.masthead-brand {
  color: var(--vermilion);
  font-weight: 600;
}
.masthead-issue { color: var(--ink-soft); }

/* ---------- 封面（书封） ---------- */
.cover {
  position: relative;
  background: var(--paper-soft);
  border: 1px solid var(--hairline);
  box-shadow:
    0 1px 0 var(--paper-deep) inset,
    0 30px 60px -30px rgba(26,22,18,0.30),
    0 6px 16px -6px rgba(26,22,18,0.18);
  overflow: hidden;
  margin-bottom: 56px;
}
.cover-photo {
  position: relative;
  width: 100%;
  aspect-ratio: 4 / 3;
  background: linear-gradient(160deg, #2d4a3e 0%, #1a2c25 60%, #0e1b16 100%);
  overflow: hidden;
}
.cover-photo img {
  position: absolute; inset: 0;
  width: 100%; height: 100%;
  object-fit: cover;
  filter: contrast(1.02) saturate(1.05);
}
.cover-photo::after {
  content: '';
  position: absolute; inset: 0;
  background:
    linear-gradient(180deg, rgba(0,0,0,0) 30%, rgba(26,22,18,0.55) 100%),
    radial-gradient(ellipse at 50% 100%, rgba(0,0,0,0.25) 0%, transparent 70%);
  pointer-events: none;
}

.cover-plate {
  position: relative;
  padding: 44px 48px 40px;
  border-top: 1px solid var(--hairline);
  background: var(--paper-soft);
}
.cover-plate::before {
  content: '';
  position: absolute;
  top: -1px; left: 48px; right: 48px;
  height: 3px;
  background:
    linear-gradient(to right, var(--vermilion) 0 32px, transparent 32px 100%);
}
.cover-eyebrow {
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.32em;
  text-transform: uppercase;
  color: var(--vermilion);
  margin-bottom: 18px;
}
.cover-title {
  font-family: var(--font-display);
  font-style: italic;
  font-weight: 600;
  font-variation-settings: 'opsz' 144;
  font-size: clamp(40px, 6.4vw, 76px);
  line-height: 1.02;
  letter-spacing: -0.02em;
  color: var(--ink);
  margin-bottom: 18px;
  hyphens: none;
}
.cover-subtitle {
  font-family: var(--font-body);
  font-style: italic;
  font-size: clamp(17px, 1.5vw, 19px);
  line-height: 1.55;
  color: var(--ink-soft);
  max-width: 32em;
  margin-bottom: 22px;
}
.cover-divider {
  height: 1px;
  background: var(--hairline);
  margin: 22px 0 18px;
  width: 64px;
}
.cover-meta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 22px 36px;
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--ink-soft);
}
.cover-meta-row .label {
  display: block;
  color: var(--muted);
  font-size: 10px;
  margin-bottom: 4px;
}
.cover-meta-row .value { color: var(--ink); font-weight: 500; }
.cover-tags {
  margin-top: 24px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.cover-tag {
  display: inline-block;
  padding: 4px 12px;
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--vermilion);
  border: 1px solid var(--vermilion);
  border-radius: 2px;
  background: rgba(180,58,31,0.04);
}
.cover-stamp {
  position: absolute;
  top: -34px;
  right: 36px;
  width: 116px;
  height: 116px;
  color: var(--vermilion);
  opacity: 0.92;
  transform: rotate(-8deg);
  pointer-events: none;
}
.cover-stamp svg { width: 100%; height: 100%; }

/* ---------- 日章节开场 ---------- */
.day-section { margin-top: 56px; }
.day-section:first-child { margin-top: 0; }
.day-opener {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: end;
  column-gap: 24px;
  padding-bottom: 18px;
  border-bottom: 1px solid var(--forest);
  margin-bottom: 36px;
}
.day-weekday {
  font-family: var(--font-display);
  font-style: italic;
  font-weight: 600;
  font-variation-settings: 'opsz' 96;
  font-size: clamp(36px, 4.5vw, 56px);
  line-height: 1;
  color: var(--ink);
  letter-spacing: -0.01em;
}
.day-dateline {
  align-self: end;
  padding-bottom: 6px;
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.28em;
  text-transform: uppercase;
  color: var(--forest);
}
.day-count {
  align-self: end;
  padding-bottom: 6px;
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--muted);
}

/* ---------- 条目通用 ---------- */
.entries { display: flex; flex-direction: column; gap: 56px; }
.entry { position: relative; }
.entry + .entry { padding-top: 56px; border-top: 1px dashed var(--hairline); }

.entry-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 18px;
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--muted);
  margin-bottom: 14px;
}
.entry-meta .meta-num { color: var(--vermilion); font-weight: 600; }
.entry-meta .meta-coords { color: var(--forest); }
.entry-meta .meta-time { color: var(--ink-soft); }
.entry-meta .meta-place {
  color: var(--ink-soft);
  text-transform: none;
  letter-spacing: 0.04em;
  font-family: var(--font-body);
  font-style: italic;
  font-size: 13px;
}

.entry-title {
  font-family: var(--font-display);
  font-style: italic;
  font-weight: 600;
  font-variation-settings: 'opsz' 96;
  font-size: clamp(26px, 3vw, 36px);
  line-height: 1.18;
  letter-spacing: -0.015em;
  color: var(--ink);
  margin-bottom: 22px;
}
.entry-rule {
  width: 48px; height: 2px;
  background: var(--vermilion);
  margin-bottom: 18px;
}

/* ---------- 富文本正文 ---------- */
.entry-body {
  font-family: var(--font-body);
  font-size: 17.5px;
  line-height: 1.82;
  color: var(--ink-soft);
  text-align: justify;
  hanging-punctuation: first last;
  word-break: break-word;
}
.entry-body > p { margin-bottom: 14px; }
.entry-body > p:last-child { margin-bottom: 0; }

.entry-body.has-dropcap > p:first-of-type::first-letter {
  font-family: var(--font-display);
  font-style: italic;
  font-weight: 700;
  font-variation-settings: 'opsz' 144;
  float: left;
  font-size: 4.6em;
  line-height: 0.92;
  padding: 6px 12px 0 0;
  margin-top: 6px;
  color: var(--vermilion);
}

.entry-body h1, .entry-body h2, .entry-body h3, .entry-body h4 {
  font-family: var(--font-display);
  font-style: italic;
  font-weight: 600;
  color: var(--ink);
  margin: 22px 0 10px;
  line-height: 1.25;
}
.entry-body h1 { font-size: 28px; }
.entry-body h2 { font-size: 24px; }
.entry-body h3 { font-size: 20px; }
.entry-body h4 { font-size: 18px; }

.entry-body strong, .entry-body b { font-weight: 600; color: var(--ink); }
.entry-body em, .entry-body i { font-style: italic; }
.entry-body u { text-decoration-color: var(--vermilion); text-underline-offset: 3px; }
.entry-body s { color: var(--muted); }

.entry-body ul, .entry-body ol {
  margin: 12px 0 16px 1.4em;
}
.entry-body li { margin-bottom: 6px; }
.entry-body ul li::marker { color: var(--vermilion); }
.entry-body ol li::marker { color: var(--forest); font-family: var(--font-mono); font-size: 0.92em; }

.entry-body blockquote {
  margin: 22px 0;
  padding: 6px 0 6px 22px;
  border-left: 2px solid var(--vermilion);
  font-style: italic;
  color: var(--ink);
  font-size: 1.05em;
  line-height: 1.7;
}

.entry-body a {
  color: var(--forest);
  text-decoration: underline;
  text-decoration-color: var(--forest-soft);
  text-underline-offset: 2px;
}
.entry-body a:hover { color: var(--vermilion); text-decoration-color: var(--vermilion); }

.entry-body img {
  display: block;
  max-width: 100%;
  height: auto;
  margin: 22px auto;
  border: 1px solid var(--hairline);
  background: var(--paper-soft);
}

.entry-body hr {
  border: none;
  border-top: 1px solid var(--hairline);
  margin: 22px 0;
}

/* ---------- 图片块 ---------- */
.photo-block { margin-top: 24px; }
.photo-grid { display: grid; gap: 10px; }
.photo-grid figure {
  margin: 0;
  background: var(--paper-soft);
  border: 1px solid var(--hairline);
  overflow: hidden;
}
.photo-grid img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.photo-grid.cols-1 { grid-template-columns: 1fr; }
.photo-grid.cols-1 img { aspect-ratio: 3 / 2; max-height: 560px; }
.photo-grid.cols-2 { grid-template-columns: 1fr 1fr; }
.photo-grid.cols-2 img { aspect-ratio: 4 / 5; }
.photo-grid.cols-3 {
  grid-template-columns: 2fr 1fr;
  grid-template-rows: 1fr 1fr;
}
.photo-grid.cols-3 figure:nth-child(1) {
  grid-row: span 2;
}
.photo-grid.cols-3 img { aspect-ratio: 1; }
.photo-grid.cols-3 figure:nth-child(1) img { aspect-ratio: 4 / 5; }
.photo-grid.cols-n {
  grid-template-columns: repeat(3, 1fr);
}
.photo-grid.cols-n img { aspect-ratio: 1; }

.photo-caption {
  font-family: var(--font-body);
  font-style: italic;
  font-size: 14.5px;
  line-height: 1.55;
  color: var(--muted);
  margin-top: 12px;
  padding-left: 14px;
  border-left: 1px solid var(--hairline);
}

/* ---------- 音频块 ---------- */
.audio-block {
  margin-top: 24px;
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 18px 22px;
  background: var(--paper-soft);
  border: 1px solid var(--hairline);
  border-left: 3px solid var(--vermilion);
}
.audio-icon {
  width: 44px; height: 44px;
  flex-shrink: 0;
  color: var(--vermilion);
}
.audio-info { flex: 1; min-width: 0; }
.audio-name {
  font-family: var(--font-display);
  font-style: italic;
  font-weight: 600;
  font-size: 18px;
  color: var(--ink);
  margin-bottom: 4px;
}
.audio-sub {
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--muted);
}
.audio-block audio {
  flex: 1;
  max-width: 360px;
  height: 36px;
}

/* ---------- 末页 ---------- */
.colophon {
  margin-top: 80px;
  padding-top: 32px;
  border-top: 1px solid var(--hairline);
  text-align: center;
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--muted);
  line-height: 2;
}
.colophon-mark {
  display: inline-block;
  width: 16px; height: 16px;
  margin: 0 8px;
  vertical-align: middle;
  color: var(--vermilion);
}
.colophon-brand { color: var(--vermilion); font-weight: 600; }
.colophon-line {
  margin-top: 10px;
  color: var(--ink-soft);
}

/* ---------- 入场动效（屏幕） ---------- */
@media (prefers-reduced-motion: no-preference) {
  .cover, .day-section, .entry {
    animation: rise 0.7s cubic-bezier(0.2, 0.65, 0.25, 1) both;
  }
  .day-section { animation-delay: 0.05s; }
  .entry { animation-delay: 0.1s; }
  @keyframes rise {
    from { opacity: 0; transform: translateY(14px); }
    to   { opacity: 1; transform: translateY(0); }
  }
}

/* ---------- 打印 / PDF ---------- */
@page {
  size: A4;
  margin: 18mm 15mm;
}
@media print {
  html, body {
    background: #fdf8ec !important;
    background-image: none !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .dispatch {
    width: 100%;
    padding: 0;
  }
  .masthead { margin-bottom: 16px; padding-bottom: 8px; }
  .cover {
    box-shadow: none;
    margin-bottom: 24px;
    page-break-after: always;
    break-after: page;
  }
  .cover-photo { aspect-ratio: 3 / 2; }
  .cover-stamp { top: -22px; right: 24px; width: 92px; height: 92px; }
  .day-section { page-break-before: auto; margin-top: 20px; }
  .entries { gap: 28px; }
  .entry { page-break-inside: avoid; break-inside: avoid; }
  .entry + .entry { padding-top: 24px; }
  .entry-body { font-size: 13.5px; line-height: 1.65; text-align: left; }
  .entry-body.has-dropcap > p:first-of-type::first-letter {
    font-size: 3.4em;
    padding-right: 8px;
  }
  .photo-grid img { max-height: 320px; }
  .audio-block audio { display: none; }
  .audio-block { gap: 12px; padding: 12px 16px; }
  .colophon { margin-top: 32px; padding-top: 18px; }
  * { animation: none !important; }
}
`;
