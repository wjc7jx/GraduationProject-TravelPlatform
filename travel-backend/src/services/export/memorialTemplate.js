import { MEMORIAL_CSS } from './memorialStyles.js';
import {
  escapeHtml,
  formatEntryNumber,
  renderCover,
  renderDaySection,
  renderEntry,
  renderMasthead,
  renderColophon,
} from './memorialComponents.js';

function nowChinese() {
  return new Date().toLocaleString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
}

/**
 * 按 day_key 顺序分组 contents（依赖外部已按 record_time 升序排序）。
 * 返回 [{ day_key, dateline, weekday, count, items }] 数组。
 */
function groupByDay(contents) {
  const map = new Map();
  for (const item of contents) {
    const key = item.day_key || '未注明日期';
    if (!map.has(key)) {
      map.set(key, {
        day_key: key,
        dateline: item.day_dateline || '',
        weekday: item.day_weekday || '',
        items: [],
      });
    }
    map.get(key).items.push(item);
  }
  const groups = [];
  for (const g of map.values()) {
    groups.push({ ...g, count: g.items.length });
  }
  return groups;
}

/**
 * 渲染纪念册完整 HTML 文档。
 *
 * payload 形如：
 * {
 *   project: { ...projectJson, cover_image_resolved, start_date_text, end_date_text },
 *   contents: [ ...normalizedContent ],
 *   totalCount: number,
 * }
 */
export function renderMemorialHtml(payload) {
  const { project, contents, totalCount } = payload;
  const generatedAt = nowChinese();

  // 全局编号
  let globalIndex = 0;
  for (const item of contents) {
    globalIndex += 1;
    item.render_number = formatEntryNumber(globalIndex);
  }

  const groups = groupByDay(contents);

  const sectionsHtml = groups
    .map((group, idx) => {
      const entriesHtml = group.items.map((entry) => renderEntry(entry)).join('\n');
      return renderDaySection(group, entriesHtml, idx + 1);
    })
    .join('\n');

  const coverHtml = renderCover(project, {
    totalCount,
    dayCount: groups.length,
    generatedAt,
    brandRingText: `TRIPTIMELINE · DISPATCH · ${(project.title || '').toUpperCase()}`,
    stampTop: 'Dispatch',
    stampBottom: project.start_date_text || '',
  });

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(project.title || '旅行纪念册')} · 旅行纪念册</title>
  <style>${MEMORIAL_CSS}</style>
</head>
<body>
  <main class="dispatch">
    ${renderMasthead(project, generatedAt)}
    ${coverHtml}
    ${sectionsHtml}
    ${renderColophon(project, generatedAt)}
  </main>
</body>
</html>`;
}
