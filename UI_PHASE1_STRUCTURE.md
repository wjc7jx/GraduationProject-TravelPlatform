# 阶段一：UI 结构还原 — TripTimeline 微信小程序

> 来源：从 `TripTimeline/miniprogram` 源码逆向提取  
> 技术栈：微信小程序（TypeScript + SCSS + WXML）  
> 导航模式：自定义 TabBar（`navigationStyle: custom`）

---

## 一、页面结构层级

### TabBar 页面（2 个）

| Tab | 页面路径 | Tab 文案 |
|-----|---------|---------|
| Tab 1 | `pages/index/index` | 旅途 |
| Tab 2 | `pages/profile/profile` | 我的 |

### 二级页面（6 个）

| 页面路径 | 功能说明 | 入口来源 |
|---------|--------|---------|
| `pages/project-detail/project-detail` | 项目详情卡片 | index 卡片点击 |
| `pages/timeline-map/timeline-map` | 时间轴 + 地图查看 | project-detail 操作卡 |
| `pages/year-review/year-review` | 年度回顾（按年时间轴） | profile 入口 |
| `pages/content-view/content-view` | 内容详情浏览 | 时间轴节点点击 |
| `pages/editor/editor` | 新建/编辑日志记录 | FAB、时间轴 |
| `pages/project-editor/project-editor` | 创建/编辑项目信息 | project-detail 管理 |

### 弹窗 / 浮层（全局）

| 浮层类型 | 触发方式 | 所属页面 |
|---------|---------|---------|
| 项目操作菜单 | 长按项目卡片 | index |
| 高级筛选底部弹层 | 点击筛选触发器 | index（project-filter 组件内） |
| 地点选择折叠面板 | 点击地点行 | editor |
| 图片选择器 | 原生系统 | editor、project-editor |
| 悬浮写日志 FAB | 常驻浮层 | timeline-map、project-detail |

---

## 二、页面 UI 分层（元素级）

---

### 页面 A：首页（pages/index/index）

**Header**
- `navigation-bar` 组件（自定义导航栏，`back="false"`）
- 日期卷标：`text`（如 "April 2026"）
- 大标题：`view.editorial-title`（serif 字体，64rpx）
- 副标题：`view.editorial-subtitle`（斜体，32rpx）

**Content**
- `project-filter` 组件：
  - 搜索框 `input`（左侧）
  - 高级筛选触发器 `view.filter-trigger`（右侧，CSS 漏斗图标）
- **状态 1 — 未授权**：
  - 插画 `image`（`/assets/img/empty-travel.png`）
  - 说明文案 `view.empty-title` + `view.empty-desc`
  - "探索旅程" `button.primary-btn`
- **状态 2 — 已授权但无项目/筛选无结果**：
  - Emoji 图标 `view.empty-icon`（🔎 或 🌍）
  - 说明文案 `view.empty-title` + `view.empty-desc`
  - "创建新项目" `button`（可选显示）
- **状态 3 — 正常列表**：
  - 滚动区 `scroll-view.scrollarea`
  - 项目卡片 `view.project-card`（循环）：
    - 封面 `image.card-image`
    - 置顶按钮 `view.pin-btn`
    - 标签条 `view.card-label`（文案）
    - 归档角标 `view.archived-badge`（条件显示）
    - 元信息行 `view.card-meta`：日期 `text` + 足迹数 `text`（📍）
    - 项目标题 `view.card-title`
    - 项目副标题 `view.card-subtitle`

**Footer / TabBar**
- 无页面内固定底栏
- 全局 `custom-tab-bar` 组件（2 Tab + 中间 `+`）

**Overlay**
- 项目长按操作菜单（`bindlongpress → onProjectLongPress`）

---

### 页面 B：时间轴地图（pages/timeline-map/timeline-map）

**Header**
- `navigation-bar` 组件（`back="true"`）

**Content**
- 全屏地图 `map.story-map`（覆盖整页）
- 地图工具浮层 `view.map-tools`（条件显示）：
  - "回到全览" `view.map-tool-btn`（胶囊按钮）
- 分享模式角标 `view.share-badge`（条件显示）

**Bottom Sheet（可拖拽调整高度）**
- 拖拽把手区 `view.drag-handle-wrapper`：
  - 横条视觉把手 `view.drag-handle`（CSS 绘制）
- 时间轴面板 `view.timeline-panel`：
  - 滚动区 `scroll-view.timeline-scroll`
  - 按**日期**分组：
    - 日期组标题 `view.timeline-day-header`（如 "4月17日"）
    - 时间节点 `view.timeline-node`（循环）：
      - 轴线区 `view.node-axis`：圆点 `view.node-dot` + 竖线 `view.node-line`
      - 内容区 `view.node-content`：
        - 折叠标题行 `view.node-header-row`（类型标签 + 标题摘要 + 时间）
        - 展开详情 `view.node-details`（点击后显示）：
          - 标题 `view.node-title`
          - 正文摘要 `view.node-desc`
          - 媒体块 `view.node-media`：`image` + 图注 `view`
  - 顶部导语区 `view.timeline-header`（条件显示）
  - 结束标记 `view.end-mark`（文案）
  - 底部留白 `view`

**Overlay / FAB**
- 右下角悬浮按钮 `view.fab-container`：
  - 圆形触发器 `view.fab-trigger`
  - 图标 `view.fab-cross`（✍ 字符）

---

### 页面 C：年度回顾（pages/year-review/year-review）

**Header**
- `navigation-bar` 组件（`back="true"`）

**Content**
- 全屏地图 `map.story-map`
- 地图工具浮层 `view.map-tools`（同 timeline-map）

**Bottom Sheet（可拖拽）**
- 拖拽把手（同 timeline-map）
- 时间轴面板，按**年度**分组（结构同 timeline-map）：
  - 年度导语区 `view.timeline-header`
  - 年份组标题 `view.timeline-day-header`（如 "2025年"）
  - 时间节点（同 timeline-map，去掉 media_caption 层）

**Overlay / FAB**
- 无 FAB（本页无新建入口）

---

### 页面 D：内容详情（pages/content-view/content-view）

**Header**
- `navigation-bar` 组件（`back="true"`）

**Content**（`scroll-view.detail-scroll`）
- 加载占位文案 `view.loading-text`（条件）
- 提示文案 `view.tip-text`
- 元信息行 `view.meta-row`：
  - 分类芯片 `view.chip`（如 "文字" / "图片"）
  - 时间戳 `view.time-text`
- 标题 `view.title`
- 富文本正文 `rich-text`（条件）
- 地点块 `view.location-box`（条件）：
  - 📍 前缀 + 地点名称 `text`
- 媒体块 `view.media-block`（条件）：
  - 图片组 `image`（循环，支持多图）
- 音频块 `view.audio-block`（条件）：
  - 系统 `audio` 控件
- 编辑入口 `view.edit-btn`（条件，仅所有者）：
  - "编辑当前记录" 文本链接

**Footer**
- 无

**Overlay**
- 无

---

### 页面 E：编辑器（pages/editor/editor）

**Header**
- `navigation-bar` 组件（`back="true"`）
- 页面标题区 `view.page-head`：
  - 主标题 `text`（如 "写新记录" / "编辑记录"）
  - 副标题 `text`（如 "记录当下的故事"）

**Content**（`scroll-view.editor-scroll`）
- **文本卡块** `view.text-section.form-card`：
  - 标题输入框 `input.title-input`（占位符 "给这段记忆起个名字"）
  - 分隔线 `view.text-divider`
  - 小程序富文本编辑器 `editor`（支持加粗、斜体、标题、列表）
- **音频卡块** `view.asset-section`（条件显示）：
  - `audio-recorder` 组件（录音/选文件/播放/删除）
- **信息卡块** `view.info-card.form-card`：
  - 时间行 `view.info-row.datetime`：
    - 🕐 前缀 + 日期 `picker` + 时间 `picker`
  - 地点行 `view.info-row.location-entry`：
    - 📍 前缀 + 地点名称文案 + 展开箭头（`︿` / `﹀`）
  - 地点面板 `view.location-panel`（条件，点击展开）：
    - 搜索框 `input` + 搜索 `view.search-btn`
    - 搜索建议列表 `view`（循环，`bindtap → selectSuggestion`）
    - 手动输入区：地名 `input` × 2（地点名 / 详细地址）
    - 地图预览 `map`（条件）
    - 坐标显示 `view.coord-text`
- **隐私说明块** `view.privacy-block`：
  - 隐私说明文案 `text`
- **操作区块** `view.action-section`：
  - 保存按钮 `view.save-btn`（三态：保存中 / 已保存 ✓ / 失败）

**Footer**
- 固定工具栏 `view.editor-toolbar`（键盘上方浮动，`bottom = keyboardHeight`）：
  - 加粗 `view.toolbar-item`（文字"B"）
  - 斜体 `view.toolbar-item`（文字"I"）
  - 标题 `view.toolbar-item`（文字"H"）
  - 无序列表 `view.toolbar-item`（文字"ul"）
  - 有序列表 `view.toolbar-item`（文字"ol"）
  - 插入图片 `view.toolbar-item`（📷 字符）
  - 切换音频面板 `view.toolbar-item`（🎙 字符）

**Overlay**
- 系统键盘
- 原生图片选择器

---

### 页面 F：项目编辑（pages/project-editor/project-editor）

**Header**
- `navigation-bar` 组件（`back="true"`）

**Content**
- **封面区块** `view.cover-section`：
  - 计数角标 `view.cover-count-badge`（如 "2/5"，条件显示）
  - 封面轮播 `swiper`：
    - 封面项 `swiper-item`（循环）：
      - 封面图 `image`（`bindtap → chooseCover`）
      - 悬浮操作层 `view.cover-actions`：
        - "设为首图" `view`（⭐️ + 文案，`catchtap → onSelectCover`）
        - "删除" `view`（✕ + 文案，`catchtap → removeCover`）
  - 空封面占位 `view.empty-cover`（无图时，`bindtap → chooseCover`，📷 图标 + 文案）
- **表单卡块** `view.form-card`：
  - 标题区 `view.title-group`：
    - 主标题 `input`（占位符 "旅程名称"）
    - 副标题 `input`（占位符 "一句话描述"）
  - 行程时间行 `view.form-row`：
    - 📅 前缀 + 起始日期 `picker` + "→" + 结束日期 `picker`
  - 标签行 `view.form-row.block-row`（可展开）：
    - 🏷️ 前缀 + 标签容器 `view.tags-container`
    - 已选标签 `view.tag-chip`（循环）：标签文案 + 关闭 `view`（`×`，`bindtap → removeTag`）
    - 预设标签列表 `view.preset-tags`（条件展开）：
      - 预设标签项（循环，`✓` / `+` 前缀，`bindtap → togglePresetTag`）
    - 自定义标签输入 `view.tag-input-wrap`：
      - `input`（`bindconfirm → addTag`）
  - 隐私行 `view.form-row`：
    - 👁️ 前缀 + 隐私 `picker`（公开 / 好友 / 私密）+ `▾`

**Footer**
- 底部操作行 `view.bottom-action-row`：
  - 主操作按钮 `view.btn-complete`（"出发 →" / "保存"，`bindtap → onSubmit`）

**Overlay**
- 原生图片选择器

---

### 页面 G：项目详情（pages/project-detail/project-detail）

**Header**（自定义顶栏，不使用 navigation-bar）
- 返回按钮 `view.back-btn`（左上角，圆形半透明，"←"）
- 管理按钮 `view.edit-btn`（右上角，条件显示，仅所有者，"编辑"）
- 封面图 `image.cover-image`（全宽背景，带渐变叠加）
- 信息叠加层 `view.overlay`（封面图底部）：
  - 日期范围 `text`
  - 项目标题 `text`（大字号）
  - 归档状态 `view`（条件显示）
  - 项目副标题 `text`

**Content**
- **操作网格** `view.action-grid`：
  - 主卡 `view.action-card.primary`：
    - 🗺️ 图标 + "故事地图" 标题 + "→" 箭头（`bindtap → goToTimelineMap`）
  - 次卡 `view.action-card.secondary`（条件，仅所有者）：
    - ✍️ 图标 + "写新日志" 标题 + `+` 符号（`bindtap → goToEditor`）
  - 三卡 `view.action-card.tertiary`（分栏布局）：
    - 分享列 `button.share-col`（`open-type="share"`）：🔗 + "发给朋友"
    - 分隔线 `view.share-divider`
    - 口令列 `view.share-col`（条件）：📱 + "口令/二维码"（`bindtap → onInternalShareTap`）
    - 分隔线
    - 导出列 `view.share-col`（条件）：📤 + "导出纪念册"（`bindtap → onExportTap`）
- **统计区块** `view.stats-section`：
  - 统计卡片组 `view.stats-cards`：
    - 统计卡 `view.stat-card` × 3（循环）：数字 + 标签（如 "12 条记录"、"48 张图片"、"7 天"）

**Footer / FAB**
- 右下角悬浮 `view.fab-container`（条件显示，仅所有者）：
  - 圆形 `view.fab-trigger`：✍ 图标文案（`bindtap → goToEditor`）

**Overlay**
- 无

---

### 页面 H：用户中心（pages/profile/profile）

**Header**
- `navigation-bar` 组件（`back="false"`）
- 英雄区 `view.profile-hero`：
  - 主标题 `view.hero-title`（如 "我的旅途"）
  - 副标题 `view.hero-subtitle`（如 "记录每一刻"）
  - 分享邀请按钮 `button.invite-btn`（`open-type="share"`）
  - 邀请码卡片 `view.invite-code-card`：
    - 说明文案 `text`
    - 邀请码展示 `text`（或生成中占位）
    - 刷新按钮 `button`（`bindtap → onInviteTap`）
    - 输入邀请码行 `view.invite-input-row`：
      - 文本 `input`（`bindinput → onInviteCodeInput`）
      - 确认 `button`（`bindtap → onApplyInviteCodeTap`）
  - 年度回顾入口 `view.review-entry`（文本链接，`bindtap → goToYearReview`）

**Content**（`scroll-view.scrollarea`）
- **好友区块** `view.friend-section`：
  - 区块标题 `view.section-title`
  - 加载态文案（条件）
  - 空态（条件）
  - 好友列表（循环）：
    - 好友项 `view.friend-item`：
      - 头像 `image` 或占位 `view`
      - 昵称 `text`
      - 统计信息 `text`
- **日志区块** `view.log-section`：
  - 启动日志列表：
    - 日志项 `view.log-item`（循环）：时间 + 事件文案

**Footer**
- 无页面内固定底栏

**Overlay**
- 无

---

## 三、全局组件

### 全局 TabBar（custom-tab-bar）

```
view.tab-bar
├── view.tab-bar-border（顶部 1px 分隔线）
├── view.tab-bar-item（"旅途"）
│   ├── view.tab-text（文案）
│   └── view.active-dot（选中态圆点）
├── view.tab-bar-item.center-btn（中间"+"按钮）
│   └── view.center-icon-wrap > text（"+"）
└── view.tab-bar-item（"我的"）
    ├── view.tab-text（文案）
    └── view.active-dot（选中态圆点）
```

**交互**：每个 `tab-bar-item` → `bindtap → switchTab`

---

## 四、可复用组件抽象

### 4.1 正式组件（已实现）

| 组件名 | 路径 | 构成 | 使用页面 |
|--------|------|------|---------|
| **navigation-bar** | `components/navigation-bar/` | 左：返回/首页按钮（inline SVG mask）；中：标题或 slot；右：slot | 7 个二级页 + 2 个 Tab 页 |
| **project-filter** | `components/project-filter/` | 搜索 `input` + 筛选触发；底部弹层：标签输入 + 日期 `picker` × 2 + 清空/确定按钮 | index |
| **audio-recorder** | `components/audio-recorder/` | 四阶段 UI：idle / recording / uploading / ready；播放 `slider` + 删除 + 更换 | editor |
| **custom-tab-bar** | `custom-tab-bar/` | 双 Tab + 中央加号按钮 + 选中圆点 | 全局 |

### 4.2 UI 模式（未组件化，需提取）

| 模式名 | 视觉结构 | 使用位置 |
|--------|---------|---------|
| **project-card** | 封面图 + 置顶/标签浮层 + 元信息 + 标题 + 副标题 | index |
| **form-card** | 圆角白卡 + 边框阴影 + 分区内容 | editor、project-editor |
| **bottom-sheet** | 圆角顶 + 拖拽把手 + 内容滚动区 | timeline-map、year-review |
| **time-axis-node** | 圆点 + 竖线 + 折叠标题 + 展开详情（图文） | timeline-map、year-review |
| **fab-button** | 圆形浮层 + 图标字符 | timeline-map、project-detail |
| **search-row** | `input` + 右侧操作按钮 | project-filter、editor（地点搜索） |
| **empty-state** | 图标/插画 + 说明文案 + 主操作按钮 | index（两种空态） |
| **stat-card** | 大数字 + 标签文案 | project-detail |
| **chip** | 圆角胶囊 + 文案 | content-view 元信息、project-editor 标签 |

---

## 五、交互点速查表

| 页面 | 点击 | 长按 | 滑动 | 弹出 |
|------|------|------|------|------|
| **index** | 卡片→详情；置顶按钮；创建/登录按钮 | 项目卡片→操作菜单 | 列表上下滑动 | 高级筛选底部弹层 |
| **timeline-map** | 地图标记→展开节点；节点折叠；FAB→编辑器；工具条 | 时间轴节点→操作菜单 | 地图手势；抽屉上下拖拽；时间轴滚动 | — |
| **year-review** | 同 timeline-map（无 FAB） | 同 timeline-map | 同 timeline-map | — |
| **content-view** | 整块→编辑；编辑按钮 | — | 页面纵向滚动 | — |
| **editor** | 展开/收起地点；建议项选择；保存；工具栏格式 | — | 页面纵向滚动 | 键盘；图片选择器 |
| **project-editor** | 选封面；设首图；删除封面；展开标签；预设标签；提交 | — | 封面轮播横划；页面纵向滚动 | 图片选择器 |
| **project-detail** | 故事地图；写日志；原生分享；口令；导出；管理；返回；FAB | — | — | — |
| **profile** | 分享邀请；刷新邀请码；年度回顾；确认邀请码 | — | 页面纵向滚动 | — |

---

## 六、Icon / Emoji 资源清单

### 6.1 静态文件资源

| 文件 | 路径 | 用途 |
|------|------|------|
| `marker.svg` | `/assets/img/marker.svg` | 地图点标记（未选中） |
| `marker-active.svg` | `/assets/img/marker-active.svg` | 地图点标记（选中） |
| `empty-travel.png` | `/assets/img/empty-travel.png` | 首页未授权空状态插画 |

### 6.2 内联 SVG（SCSS 实现）

| 文件 | 元素 | 说明 |
|------|------|------|
| `navigation-bar.scss` | `.weui-navigation-bar__btn_goback` | 返回箭头，CSS mask 技术 |
| `navigation-bar.scss` | `.weui-loading` | 导航栏加载转圈，background SVG |
| `project-filter.scss` | `.filter-icon` | 筛选漏斗，CSS border 三角形绘制 |

### 6.3 当前全部 Emoji / Unicode 使用情况

| 符号 | Unicode | 使用位置 | 语义 |
|------|---------|---------|------|
| 🗺️ | U+1F5FA | project-detail 主操作卡 | 故事地图 |
| ✍️ | U+270D | project-detail 次操作卡、FAB | 写日志/编辑 |
| ✍ | U+270D | timeline-map FAB | 写记录 |
| → | U+2192 | project-detail 卡片箭头、project-editor 日期间 | 方向/继续 |
| + | U+002B | custom-tab-bar 中心按钮、project-editor 标签 | 新建/添加 |
| 🔗 | U+1F517 | project-detail 分享-分享给朋友 | 链接/分享 |
| 📱 | U+1F4F1 | project-detail 分享-口令二维码 | 手机/扫码 |
| 📤 | U+1F4E4 | project-detail 分享-导出 | 导出/上传 |
| 📍 | U+1F4CD | index 卡片地点数、editor 地点行 | 定位/足迹 |
| 🔎 | U+1F50E | index 空状态（筛选无结果） | 搜索 |
| 🌍 | U+1F30D | index 空状态（无项目） | 地球/旅行 |
| 🎙 | U+1F3A9 | editor 音频区块标题、audio-recorder 录音 | 麦克风/录音 |
| 📷 | U+1F4F7 | editor 工具栏、project-editor 无封面占位 | 相机/图片 |
| 📅 | U+1F4C5 | project-editor 行程时间行 | 日历/日期 |
| 🏷️ | U+1F3F7 | project-editor 标签行 | 标签 |
| 👁️ | U+1F441 | project-editor 隐私行 | 可见性/眼睛 |
| 🕐 | U+1F550 | editor 时间行 | 时间/时钟 |
| ▶ | U+25B6 | audio-recorder 播放按钮 | 播放 |
| ⏸ | U+23F8 | audio-recorder 暂停按钮 | 暂停 |
| ✕ | U+2715 | audio-recorder 删除音频 | 删除/关闭 |
| × | U+00D7 | project-editor 已选标签删除 | 删除 |
| ✓ | U+2713 | editor / project-editor 保存成功 | 成功/确认 |
| ⭐️ | U+2B50 | project-editor 首图标记 | 星标/置顶 |
| ︿ / ﹀ | U+FE3F / FE40 | editor 地点行展开/收起 | 展开折叠 |
| ▾ | U+25BE | project-editor 隐私下拉 | 下拉箭头 |
| 📂 | U+1F4C2 | audio-recorder 选择文件 | 文件夹/选取 |
| ← | U+2190 | project-detail 返回按钮 | 返回 |

### 6.4 需要从 iconfont 下载的图标（汇总）

> 建议统一风格：**线性 / Linear（描边）**，线宽 1.5-2px，单色，32px 标准尺寸

#### 🔴 高优先级（必须）—— 11 个

| 序号 | 图标语义 | 当前 Emoji | 使用页面 | iconfont 搜索关键词 |
|------|---------|---------|---------|-----------------|
| 1 | 地图 | 🗺️ | project-detail | `map` `world-map` |
| 2 | 编辑/笔 | ✍️ | project-detail, timeline-map FAB | `edit` `write` `pen` `pencil` |
| 3 | 麦克风 | 🎙 | editor, audio-recorder | `microphone` `mic` `record` |
| 4 | 定位/地点 | 📍 | index, editor | `location` `pin` `landmark` |
| 5 | 相机/图片 | 📷 | editor, project-editor | `camera` `photo` `image` |
| 6 | 导出/上传 | 📤 | project-detail | `export` `upload` `share-out` |
| 7 | 链接/分享 | 🔗 | project-detail | `link` `share` `chain` |
| 8 | 手机/二维码 | 📱 | project-detail, profile | `mobile` `qrcode` `phone` |
| 9 | 播放 | ▶ | audio-recorder | `play` `play-circle` |
| 10 | 暂停 | ⏸ | audio-recorder | `pause` `pause-circle` |
| 11 | 关闭/删除 | ✕ × | audio-recorder, project-editor | `close` `delete` `remove` `trash` |

#### 🟡 中优先级（建议）—— 7 个

| 序号 | 图标语义 | 当前 Emoji | 使用页面 | iconfont 搜索关键词 |
|------|---------|---------|---------|-----------------|
| 12 | 日历/日期 | 📅 | project-editor | `calendar` `date` `schedule` |
| 13 | 标签 | 🏷️ | project-editor | `tag` `label` `price-tag` |
| 14 | 可见性/眼睛 | 👁️ | project-editor | `eye` `visibility` `view` |
| 15 | 时间/时钟 | 🕐 | editor | `clock` `time` `watch` |
| 16 | 文件夹 | 📂 | audio-recorder | `folder` `file` `open-folder` |
| 17 | 搜索 | 🔎 | index, project-filter | `search` `magnifier` `find` |
| 18 | 地球/世界 | 🌍 | index 空状态 | `globe` `world` `earth` |

#### 🟢 可保留现有方案 —— 无需下载

| 符号 | 原因 |
|------|------|
| `→` `←` 箭头 | 文本符号，装饰用途，可继续使用 |
| `+` 加号 | custom-tab-bar 特殊设计元素 |
| `✓` 勾选 | 状态文案符号，语义清晰，无需图标 |
| `⭐️` 星号 | 装饰用途，可选保留 |
| `×` 关闭 | 同 ✕，可用 HTML entity 统一处理 |
| `︿` `﹀` `▾` 折叠箭头 | CSS 或符号即可实现 |

---

## 七、设计 Token（当前系统值）

### 颜色

| 角色 | CSS 变量 | 值 |
|------|---------|-----|
| 主背景 | `--bg-base` | `#F7F5F0`（羊皮纸） |
| 卡片背景 | `--bg-surface` | `#E8E5DF` |
| 主色 | `--color-primary` | `#2A4B3C`（深林绿） |
| 强调色 | `--color-accent` | `#C85A3D`（陶土红） |
| 主文字 | `--color-text-main` | `#1C1C1C` |
| 次要文字 | `--color-text-sub` | `#8A877E` |
| 边框 | `--color-border` | `#DCD8D0` |

### 间距

| 变量 | 值 |
|------|-----|
| `--spacing-xs` | 8rpx |
| `--spacing-sm` | 16rpx |
| `--spacing-md` | 24rpx |
| `--spacing-lg` | 32rpx |
| `--spacing-xl` | 48rpx |
| `--spacing-xxl` | 80rpx |

### 圆角

| 变量 | 值 | 常见用途 |
|------|-----|--------|
| `--radius-sm` | 8rpx | 卡片封面图 |
| `--radius-md` | 16rpx | 内容块 |
| `--radius-lg` | 24rpx | 大卡片 |
| — | 999rpx | 胶囊按钮、筛选 Tag |
| — | 40rpx | 底部抽屉顶角 |

### 字体

| 角色 | 变量 | 大小 |
|------|------|------|
| 页面基础 | `--font-sans` | 28rpx / line-height 1.6 |
| 杂志大标题 | `--font-serif` | 64rpx / bold |
| 副标题 | `--font-serif` | 32rpx / italic |
| 导航栏标题 | — | 17px（绝对值） |

---

> **文档版本**：阶段一完整版  
> **生成日期**：2026-04-17  
> **下一步**：阶段二 UI 重设计（基于本文档结构优化视觉表现）
