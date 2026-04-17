# TripTimeline 项目 Icon 需求表

> 用于 iconfont.cn 下载相应图标的完整清单

---

## 📋 快速查询

- **总计**：26 个图标位置，其中需要新增 **18 个** iconfont 图标
- **优先级**：高（11 个）> 中（7 个）> 低（7 个，可选或保留现有方案）
- **风格建议**：线性 / Linear 风格（与当前 marker.svg 对齐）
- **颜色**：单色，适用主色 `#2A4B3C`（深林绿）

---

## 🔴 高优先级（必须下载）

这些图标在 UI 中高频使用，且当前以 Emoji 表示，应统一替换。

| 序号 | 图标名称 | 当前 Emoji | 用途 | 出现页面 | 下载关键词 |
|------|---------|---------|------|---------|----------|
| 1 | 地图 | 🗺️ | 故事地图操作入口 | project-detail | map, location, geo |
| 2 | 编辑/笔 | ✍️ | 写日志、编辑入口、FAB | project-detail, timeline-map, project-editor | edit, write, pen, pencil |
| 3 | 麦克风 | 🎙 | 录音按钮、音频记录 | editor, audio-recorder | microphone, record, voice |
| 4 | 定位/足迹 | 📍 | 项目地点数量、地点标记 | index, editor | location, pin, landmark |
| 5 | 相机/图片 | 📷 | 插入图片、选择封面 | editor, project-editor | camera, photo, image |
| 6 | 导出/上传 | 📤 | 导出纪念册、分享 | project-detail | export, share, upload |
| 7 | 链接/分享 | 🔗 | 分享小程序链接 | project-detail | link, share, chain |
| 8 | 手机/二维码 | 📱 | 分享口令、邀请码、二维码 | project-detail, profile | mobile, qrcode, phone |
| 9 | 播放 | ▶ | 音频播放控制 | audio-recorder | play, video |
| 10 | 暂停 | ⏸ | 音频暂停控制 | audio-recorder | pause, stop |
| 11 | 关闭/删除 | ✕ | 删除音频、删除标签 | audio-recorder, project-editor | close, delete, remove, trash |

---

## 🟡 中优先级（建议下载，增强统一性）

这些图标使用频率中等，当前以 Emoji 或 CSS 表示，建议统一为 iconfont 以提升设计一致性。

| 序号 | 图标名称 | 当前 Emoji | 用途 | 出现页面 | 下载关键词 |
|------|---------|---------|------|---------|----------|
| 12 | 日历/日期 | 📅 | 行程时间选择 | project-editor | calendar, date, schedule |
| 13 | 标签 | 🏷️ | 旅行印记标签 | project-editor | tag, label |
| 14 | 可见性/眼睛 | 👁️ | 隐私设置 | project-editor | eye, visibility, view |
| 15 | 时间/时钟 | 🕐 | 时间戳显示 | editor, content-view | clock, time, watch |
| 16 | 文件夹 | 📂 | 选择音频文件 | audio-recorder | folder, file, directory |
| 17 | 搜索 | 🔍 | 搜索功能触发 | index, project-filter | search, magnifier |
| 18 | 世界/地球 | 🌍 | 无项目时的空状态 | index | world, globe, earth |

---

## 🟢 低优先级（可保留现有方案）

这些图标可以保留现有的代码符号或 CSS 实现方案，无需专门下载 iconfont。

| 序号 | 图标名称 | 当前实现 | 用途 | 说明 |
|------|---------|--------|------|------|
| 19 | 关闭 | `×` | 已选标签关闭 | 简单文本符号，CSS 可处理 |
| 20 | 勾选 | `✓` | 保存成功、预设标签选中 | 简单文本符号，语义清晰 |
| 21 | 右箭头 | `→` | 卡片操作指向、流程箭头 | 简单文本符号，装饰用途 |
| 22 | 左箭头 | `←` | 返回按钮 | 与 navigation-bar SVG 保持一致 |
| 23 | 加号 | `+` | Tab 中心按钮、新增标签 | 特殊设计元素，保留原样 |
| 24 | 星号 | `⭐️` | 首图标记 | 装饰用途，可选保留 |
| 25 | 展开/收起 | `︿` / `﹀` | 地点信息折叠 | CSS 可实现或简单符号 |
| 26 | 下拉三角 | `▾` | 隐私设置下拉 | CSS border 或符号即可 |

---

## 📥 iconfont 下载指南

### 推荐方案

**使用 iconfont.cn 字体库**

1. 访问 [iconfont.cn](https://www.iconfont.cn)

2. **搜索并添加到购物车**：将下列关键词逐个搜索，选择最匹配的 **线性 / Linear** 风格图标
   - 地图 → `map`
   - 编辑 → `edit` 或 `write`
   - 麦克风 → `microphone`
   - 定位 → `location` 或 `pin`
   - 相机 → `camera`
   - 导出 → `export` 或 `upload`
   - 链接 → `link`
   - 手机/二维码 → `mobile` 或 `qrcode`
   - 播放 → `play`
   - 暂停 → `pause`
   - 关闭/删除 → `close` 或 `delete`
   - 日历 → `calendar`
   - 标签 → `tag`
   - 眼睛 → `eye`
   - 时钟 → `clock`
   - 文件夹 → `folder`
   - 搜索 → `search`
   - 地球 → `globe`

3. **生成项目**
   - 将选中的图标加入项目
   - 推荐使用 **SVG 多色** 或 **单色字体** 格式
   - 下载到本地

4. **集成到项目**
   - 若下载字体：将 `.ttf` / `.woff` 放入 `assets/fonts/`
   - 若下载 SVG：将所有 SVG 文件放入 `assets/icons/`
   - 在 `app.scss` 中配置字体引用或 SVG 路径

### 快速替换清单

下载完成后，依照以下路径进行替换：

| 旧 Emoji | 新 iconfont 引用 | 文件位置 |
|---------|-----------------|--------|
| 🗺️ | `<icon-map>` 或 `<image src="/assets/icons/map.svg">` | project-detail.wxml |
| ✍️ | `<icon-edit>` 或相应引用 | project-detail.wxml, timeline-map.wxml, FAB |
| 🎙 | `<icon-microphone>` | editor.wxml, audio-recorder.wxml |
| 📍 | `<icon-location>` | index.wxml, editor.wxml |
| 📷 | `<icon-camera>` | editor.wxml, project-editor.wxml |
| 📤 | `<icon-export>` | project-detail.wxml |
| 🔗 | `<icon-link>` | project-detail.wxml |
| 📱 | `<icon-mobile>` | project-detail.wxml, profile.wxml |
| ▶ | `<icon-play>` | audio-recorder.wxml |
| ⏸ | `<icon-pause>` | audio-recorder.wxml |
| ✕ | `<icon-close>` | audio-recorder.wxml, project-editor.wxml |
| 📅 | `<icon-calendar>` | project-editor.wxml |
| 🏷️ | `<icon-tag>` | project-editor.wxml |
| 👁️ | `<icon-eye>` | project-editor.wxml |
| 🕐 | `<icon-clock>` | editor.wxml |
| 📂 | `<icon-folder>` | audio-recorder.wxml |
| 🔍 | `<icon-search>` | index.wxml, project-filter.wxml |
| 🌍 | `<icon-globe>` | index.wxml |

---

## 🎨 设计规范

### 尺寸标准
- **24px**：工具栏、Tab、小操作按钮（导出、删除、关闭）
- **32px**：主操作卡片图标（地图、编辑、链接等）
- **48px**：大型界面元素（FAB、空状态图标）

### 颜色
- **主色**：`#2A4B3C`（深林绿）
- **强调色**：`#C85A3D`（陶土红）
- **次要色**：`#8A877E`（灰棕）

### 线宽（Stroke Width）
- 建议统一为 **1.5px - 2px** 线宽，与当前 marker.svg 保持一致

### 风格一致性
- ✅ 选择 **线性 / Linear** 风格（不要填充或带边框）
- ✅ 确保所有图标笔触圆角一致（rounded）
- ✅ 禁止选择 **粗体 / Bold** 或 **填充 / Filled** 版本

---

## ✅ 下载清单（打印用）

高优先级（必须）：
- [ ] 地图 (map)
- [ ] 编辑/笔 (edit, write)
- [ ] 麦克风 (microphone)
- [ ] 定位 (location, pin)
- [ ] 相机 (camera)
- [ ] 导出 (export)
- [ ] 链接 (link)
- [ ] 手机 (mobile)
- [ ] 播放 (play)
- [ ] 暂停 (pause)
- [ ] 关闭/删除 (close, delete)

中优先级（建议）：
- [ ] 日历 (calendar)
- [ ] 标签 (tag)
- [ ] 眼睛 (eye)
- [ ] 时钟 (clock)
- [ ] 文件夹 (folder)
- [ ] 搜索 (search)
- [ ] 地球 (globe)

---

## 📝 备注

- 如无特殊设计，建议一次下载所有 18 个高+中优先级图标，确保项目中的图标风格统一
- 下载前务必确认是 **线性 / Linear** 风格（不要选填充风格）
- 保存下载的图标时，建议按功能分组（如 `location-group`、`media-group` 等）
- 已下载的图标应纳入版本控制（Git），确保整个团队使用相同版本

---

**最后更新**：2026-04-17  
**项目**：TripTimeline（个人旅行记忆数字化与故事地图平台）  
**小程序版本**：WeChat Mini App
