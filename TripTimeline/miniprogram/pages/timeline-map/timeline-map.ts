import { request, asAbsoluteAssetUrl } from '../../utils/request';
import api from '../../utils/api';
import { guardArchivedWrite, normalizeProjectArchived } from '../../utils/projectArchive';

const MARKER_ICON: Record<string, string> = {
  photo: '/assets/img/marker-photo.svg',
  note: '/assets/img/marker-note.svg',
  audio: '/assets/img/marker-audio.svg'
};
const MARKER_ACTIVE_ICON = '/assets/img/marker-active.svg';

// 按天循环使用的轨迹色板（与纸质质感色系一致，加 CC 透明度让它柔和一些）
const DAY_POLYLINE_COLORS = [
  '#C85A3DCC', // 陶土红
  '#2A4B3CCC', // 深林绿
  '#B88A3ECC', // 琥珀棕
  '#6B7A8FCC', // 青灰
  '#8A5B5BCC', // 砖褐
  '#527A6BCC', // 湖松
  '#9B8355CC'  // 卡其
];

const SHEET_SNAP_SMALL = 30;
const SHEET_SNAP_MID = 55;
const SHEET_SNAP_LARGE = 80;

Page({
  _audioContext: null as WechatMiniprogram.InnerAudioContext | null,

  data: {
    projectId: null,
    shareId: '',
    shareVisitMarked: false,
    isShareView: false,
    isProjectArchived: false,
    timelineTitle: '时间地图',
    centerLon: 116.404,
    centerLat: 39.915,
    mapScale: 14,
    defaultMapScale: 14,
    
    // Bottom sheet state
    sheetHeight: 30, // 初始 30vh
    isDragging: false,
    
    activeIndex: 0,
    scrollToId: '',
    showResetViewport: false,
    
    markers: [] as any[],
    polylines: [] as any[],
    allMapPoints: [] as any[],

    // A7/A8: 未定位节点数 & 进度指示
    noLocCount: 0,
    totalCount: 0,
    locatedCount: 0,     // 有定位节点总数（= markers.length，便于 wxml 简化）
    progressCurrent: 0,  // 当前激活节点在"有定位列表"中的序号（1-based，0 = 无）

    projectDetail: null as any,
    timelineData: [] as any[],
    _startY: 0,
    _startHeight: 0,
    
    // Audio Player State
    playingAudioId: null as string | null
  },

  onLoad(options: any) {
    if (options.projectId) {
      this.setData({
        projectId: options.projectId,
      });
    }
    if (options.shareId) {
      this.setData({
        shareId: String(options.shareId),
        isShareView: true,
      })
    }
  },

  onShow() {
    if (this.data.projectId) {
      this.fetchProjectDetail(String(this.data.projectId));
      this.fetchTimelineData(String(this.data.projectId));
      this.markShareVisitedIfNeeded();
    } else {
      wx.showToast({ title: '请从项目进入时间地图', icon: 'none' });
    }
  },

  onHide() {
    this.stopAudio();
  },

  onUnload() {
    if (this._audioContext) {
      this._audioContext.destroy();
      this._audioContext = null;
    }
  },

  stopAudio() {
    if (this._audioContext) {
      this._audioContext.stop();
      this.setData({ playingAudioId: null });
    }
  },

  onToggleAudio(e: any) {
    const { id, url } = e.currentTarget.dataset;
    if (!url) return;

    if (this.data.playingAudioId === id) {
      // 正在播放当前音频则暂停
      if (this._audioContext) {
        this._audioContext.pause();
        this.setData({ playingAudioId: null });
      }
      return;
    }

    // 暂停/停止当前播放的其他音频
    this.stopAudio();

    if (!this._audioContext) {
      this._audioContext = wx.createInnerAudioContext();
      this._audioContext.onEnded(() => {
        this.setData({ playingAudioId: null });
      });
      this._audioContext.onError((err: any) => {
        console.error('Audio play error:', err);
        wx.showToast({ title: '音频播放失败', icon: 'none' });
        this.setData({ playingAudioId: null });
      });
    }

    this._audioContext.src = url;
    this._audioContext.play();
    this.setData({ playingAudioId: id });
  },

  async markShareVisitedIfNeeded() {
    const projectId = this.data.projectId ? String(this.data.projectId) : '';
    const shareId = String(this.data.shareId || '');
    if (!projectId || !shareId || this.data.shareVisitMarked) return;

    try {
      await request({
        url: api.project.shareVisit(projectId, shareId),
        method: 'POST',
        showLoading: false,
      });
      this.setData({ shareVisitMarked: true });
    } catch (error) {
      wx.showToast({ title: '分享已失效', icon: 'none' });
    }
  },

  async fetchProjectDetail(id: string) {
    try {
      const res = await request<any>({
        url: api.project.detail(id),
        method: 'GET',
        data: this.data.shareId ? { share_id: this.data.shareId } : {},
      });
      this.setData({
        projectDetail: res,
        isProjectArchived: normalizeProjectArchived(res?.is_archived),
        timelineTitle: res?.title || '时间地图',
      });
    } catch(e) {}
  },

  async fetchTimelineData(projectId: string) {
    try {
      const res = await request<any[]>({
        url: api.content.list(projectId),
        method: 'GET',
        data: this.data.shareId ? { share_id: this.data.shareId } : {},
      });
      if (res) {
        let globalIndex = 0;
        const mappedData = res.map((item: any) => {
          const payload = item.content_data || {};
          const d = new Date(item.record_time || item.created_at);
          const location = item.location || {};
          const lon = Number(location.longitude);
          const lat = Number(location.latitude);
          const hasLoc = Number.isFinite(lon) && Number.isFinite(lat);
          const imageListRaw = Array.isArray(payload.images)
            ? payload.images
            : (typeof payload.images === 'string' ? (() => {
                try { return JSON.parse(payload.images); } catch (e) { return []; }
              })() : []);
          const imageList = (Array.isArray(imageListRaw) ? imageListRaw : [])
            .filter(Boolean)
            .map((u: any) => asAbsoluteAssetUrl(String(u)));
              
          const audioUrl = payload.audio?.url || payload.audio_url || '';
          const audio = audioUrl ? { url: asAbsoluteAssetUrl(audioUrl), name: payload.audio?.name || '音频' } : null;

          return {
            id: item.content_id,
            type: item.content_type || 'note',
            dateStr: `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`,
            time: d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
            category: item.content_type === 'photo' ? '照片' : (item.content_type === 'note' ? '日记' : '音频'),
            title: payload.title || '无标题',
            desc: (payload.content || '').replace(/<[^>]+>/g, '').trim(),
            richContent: payload.content || '',
            audio,
            images: imageList,
            lon: hasLoc ? lon : 0,
            lat: hasLoc ? lat : 0,
            hasLoc
          };
        });
        
        // images 已在 map 内转为绝对 URL

        // Group by date
        const grouped: any[] = [];
        mappedData.forEach(item => {
          let group = grouped.find(g => g.date === item.dateStr);
          if (!group) {
            group = { date: item.dateStr, items: [] };
            grouped.push(group);
          }
          group.items.push({...item, globalIndex: globalIndex++});
        });

        this.setData({ timelineData: grouped });

        const groupedItems = grouped.reduce((acc: any[], cur: any) => acc.concat(cur.items), []);
        const firstLoc = groupedItems.find(i => i.hasLoc);
        if (firstLoc) {
          this.setData({
            centerLon: firstLoc.lon,
            centerLat: firstLoc.lat,
            activeIndex: firstLoc.globalIndex
          });
        }
      } else {
        this.setData({
          timelineTitle: this.data.projectDetail?.title || '时间地图',
          timelineData: [],
          markers: [],
          polylines: [],
          allMapPoints: [],
          showResetViewport: false
        });
      }
      this.initMapData();
    } catch (e) {
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  initMapData() {
    const flatAll: any[] = this.data.timelineData.reduce((acc: any[], cur: any) => acc.concat(cur.items), []);
    const totalCount = flatAll.length;
    const list = flatAll.filter((item: any) => item.hasLoc);
    const noLocCount = totalCount - list.length;

    // A1：按 content_type 选图标；激活态保持红色描边款
    const activeIdx = this.data.activeIndex;
    const markers = list.map((item: any) => {
      const isActive = item.globalIndex === activeIdx;
      return {
        id: item.globalIndex,
        latitude: item.lat,
        longitude: item.lon,
        iconPath: isActive ? MARKER_ACTIVE_ICON : (MARKER_ICON[item.type] || MARKER_ICON.note),
        width: isActive ? 36 : 26,
        height: isActive ? 36 : 26,
        callout: {
          content: item.title,
          color: isActive ? '#FFFFFF' : '#1C1C1C',
          fontSize: 12,
          borderRadius: 4,
          bgColor: isActive ? '#C85A3D' : '#FFFFFF',
          padding: 6,
          display: isActive ? 'ALWAYS' : 'BYCLICK'
        }
      };
    });

    // A2：按"天"拆分 polyline，每天一色 + 箭头方向
    const polylines: any[] = [];
    this.data.timelineData.forEach((day: any, idx: number) => {
      const dayPts = (day.items || [])
        .filter((i: any) => i.hasLoc)
        .map((i: any) => ({ latitude: i.lat, longitude: i.lon }));
      if (dayPts.length >= 2) {
        polylines.push({
          points: dayPts,
          color: DAY_POLYLINE_COLORS[idx % DAY_POLYLINE_COLORS.length],
          width: 4,
          arrowLine: true,
          borderColor: '#FFFFFF80',
          borderWidth: 1
        });
      }
    });

    const allPoints = list.map((item: any) => ({ latitude: item.lat, longitude: item.lon }));
    const progressCurrent = this.computeProgress(list, activeIdx);

    this.setData({
      markers,
      polylines,
      allMapPoints: allPoints,
      totalCount,
      noLocCount,
      locatedCount: list.length,
      progressCurrent,
      showResetViewport: false
    });

    this.resetMapViewport(true);
  },

  // 计算激活节点在"有定位列表"中的位置（1-based）
  computeProgress(locList: any[], activeIdx: number): number {
    if (!locList || !locList.length) return 0;
    const pos = locList.findIndex((i: any) => i.globalIndex === activeIdx);
    return pos >= 0 ? pos + 1 : 0;
  },

  resetMapViewport(initial = false) {
    const points = this.data.allMapPoints || [];
    if (!points.length) {
      this.setData({
        mapScale: this.data.defaultMapScale,
        showResetViewport: false
      });
      return;
    }
    // A5：padding 按当前抽屉高度动态计算，确保所有 marker 都在抽屉之上
    const paddingBottom = this.calcMapBottomPadding();
    setTimeout(() => {
      const mapCtx = wx.createMapContext('storyMap');
      mapCtx.includePoints({
        points,
        padding: [120, 48, paddingBottom, 48]
      });
    }, initial ? 500 : 80);
    this.setData({ showResetViewport: false });
  },

  // 把 sheetHeight(vh) 换算成 px 再加一点 FAB/安全区余量
  calcMapBottomPadding(): number {
    try {
      const sys = wx.getSystemInfoSync();
      const sheetPx = Math.round((this.data.sheetHeight / 100) * sys.windowHeight);
      return sheetPx + 80;
    } catch (e) {
      return 360;
    }
  },

  onResetViewportTap() {
    this.resetMapViewport(false);
  },

  onMapRegionChange(e: any) {
    // 地图手势结束后显示“回到全览”入口
    if (e.type === 'end') {
      this.setData({ showResetViewport: true });
    }
  },

  // ---- Bottom Sheet 拖拽逻辑 ----
  onTouchStart(e: any) {
    this.setData({ isDragging: true });
    this.data._startY = e.touches[0].clientY;
    this.data._startHeight = this.data.sheetHeight;
  },

  onTouchMove(e: any) {
    const currentY = e.touches[0].clientY;
    const deltaY = currentY - this.data._startY; // 滑动距离，下拉为正，上滑为负
    
    // 转换为 vh (高度相对屏幕比例)
    const sysInfo = wx.getSystemInfoSync();
    const deltaVH = (deltaY / sysInfo.windowHeight) * 100;
    
    // 高度反向：上滑高度增加，下拉高度减少
    let newHeight = this.data._startHeight - deltaVH;
    // 限制拖拽边界
    if (newHeight < 20) newHeight = 20; 
    if (newHeight > 85) newHeight = 85;
    
    this.setData({ sheetHeight: newHeight });
  },

  onTouchEnd() {
    this.setData({ isDragging: false });
    const currentHeight = this.data.sheetHeight;
    const prevHeight = this.data._startHeight;

    // A5：三档吸附（小 30 / 中 55 / 大 80）——用阈值带而非单一中点，交互更顺滑
    let snapHeight: number;
    if (currentHeight >= 68) {
      snapHeight = SHEET_SNAP_LARGE;
    } else if (currentHeight >= 42) {
      snapHeight = SHEET_SNAP_MID;
    } else {
      snapHeight = SHEET_SNAP_SMALL;
    }

    this.setData({ sheetHeight: snapHeight });

    // 抽屉高度显著改变时，若用户正处于"全览态"就重新 fit，一次拿满视野
    if (Math.abs(snapHeight - prevHeight) > 4 && !this.data.showResetViewport && this.data.allMapPoints.length) {
      setTimeout(() => this.resetMapViewport(false), 420);
    }
  },

  onMapTap() {
    // 点地图空白处自动收起抽屉
    if (this.data.sheetHeight > 50) {
      this.setData({ sheetHeight: 30 });
    }
    if (!this.data.showResetViewport) {
      this.setData({ showResetViewport: true });
    }
  },
  // ---- Bottom Sheet 拖拽逻辑 end ----

  // 点击时间轴节点联动地图
  onNodeTap(e: any) {
    const index = e.currentTarget.dataset.index;
    this.focusNode(index);
    const node = this.getNodeByIndex(index);
    if (node?.id) {
      this.setData({ scrollToId: 'node-' + node.id });
    }
  },

  onNodeLongPress(e: any) {
    if (this.data.isShareView) {
      return;
    }

    const index = e.currentTarget.dataset.index;
    const node = this.getNodeByIndex(index);
    const projectId = this.data.projectId ? String(this.data.projectId) : '';
    if (!node || !projectId) {
      return;
    }
    const isProjectArchived = !!this.data.isProjectArchived;
    const isShareView = !!this.data.isShareView;
    const itemList = (isProjectArchived || isShareView) ? ['查看记录'] : ['查看记录', '编辑记录', '删除记录'];
    wx.showActionSheet({
      itemList,
      itemColor: '#1C1C1C',
      success: async (res) => {
        if (res.tapIndex === 0) {
          wx.navigateTo({
            url: `/pages/content-view/content-view?projectId=${projectId}&contentId=${node.id}`
          });
          return;
        }

        if (!isProjectArchived && res.tapIndex === 1) {
          wx.navigateTo({
            url: `/pages/editor/editor?projectId=${projectId}&contentId=${node.id}`
          });
          return;
        }

        if (!isProjectArchived && res.tapIndex === 2) {
          wx.showModal({
            title: '确认删除',
            content: `确定删除「${node.title || '该记录'}」吗？删除后不可恢复。`,
            confirmColor: '#E53935',
            success: async (mRes) => {
              if (!mRes.confirm) return;
              try {
                wx.showLoading({ title: '删除中...', mask: true });
                await request({
                  url: api.content.delete(projectId, node.id),
                  method: 'DELETE'
                });
                wx.hideLoading();
                wx.showToast({ title: '已删除', icon: 'success' });
                this.setData({ activeIndex: 0, scrollToId: '' });
                this.fetchTimelineData(projectId);
              } catch (error) {
                wx.hideLoading();
              }
            }
          });
        }
      }
    });
  },

  // 点击地图标记联动时间轴
  onMarkerTap(e: any) {
    const index = e.detail.markerId;
    this.focusNode(index);
    let targetId = '';
    for (const g of this.data.timelineData) {
      const item = g.items.find((i: any) => i.globalIndex === index);
      if (item) {
        targetId = item.id;
        break;
      }
    }
    if (targetId) {
      this.setData({
        scrollToId: 'node-' + targetId
      });
    }
  },

  focusNode(index: number) {
    const target = this.getNodeByIndex(index);
    if (!target || !target.hasLoc) {
      if (this.data.activeIndex !== index) {
        // A8：即使没有定位也更新一次 progress（将变 0）
        this.setData({ activeIndex: index, progressCurrent: 0 });
      }
      return;
    }
    const prevMarkers = this.data.markers;
    const markers = prevMarkers.map((m: any) => {
      const isActive = m.id === index;
      // A1：非激活态回到节点自身类别图标
      const nodeForMarker = this.getNodeByIndex(m.id);
      const typeIcon = MARKER_ICON[nodeForMarker?.type || 'note'] || MARKER_ICON.note;
      return {
        ...m,
        iconPath: isActive ? MARKER_ACTIVE_ICON : typeIcon,
        width: isActive ? 36 : 26,
        height: isActive ? 36 : 26,
        callout: {
          ...m.callout,
          bgColor: isActive ? '#C85A3D' : '#FFFFFF',
          color: isActive ? '#FFFFFF' : '#1C1C1C',
          display: isActive ? 'ALWAYS' : 'BYCLICK'
        }
      };
    });

    const flatLoc = this.data.timelineData
      .reduce((acc: any[], cur: any) => acc.concat(cur.items), [])
      .filter((i: any) => i.hasLoc);

    this.setData({
      activeIndex: index,
      centerLat: target.lat,
      centerLon: target.lon,
      markers,
      mapScale: 15,
      showResetViewport: true,
      progressCurrent: this.computeProgress(flatLoc, index)
    });

    const mapCtx = wx.createMapContext('storyMap');
    mapCtx.moveToLocation({
      latitude: target.lat,
      longitude: target.lon,
    });
  },

  getNodeByIndex(index: number) {
    const targetItems = this.data.timelineData.reduce((acc: any[], cur: any) => acc.concat(cur.items), []);
    return targetItems.find((i: any) => i.globalIndex === index);
  },

  // A7：点击"N 条未定位"条 → 滚动到第一条未定位节点并展开抽屉
  onNoLocHintTap() {
    const flat = this.data.timelineData.reduce((acc: any[], cur: any) => acc.concat(cur.items), []);
    const first = flat.find((i: any) => !i.hasLoc);
    if (!first) return;
    this.setData({
      activeIndex: first.globalIndex,
      scrollToId: 'node-' + first.id,
      sheetHeight: SHEET_SNAP_LARGE,
      progressCurrent: 0
    });
  },

  goToEditor() {
    if (this.data.isShareView) {
      wx.showToast({ title: '分享模式下不可编辑', icon: 'none' });
      return;
    }
    if (!this.data.projectId) {
      wx.showToast({ title: '请先进入具体项目后再新增记录', icon: 'none' });
      return;
    }
    if (!guardArchivedWrite(!!this.data.isProjectArchived)) {
      return;
    }
    wx.navigateTo({
      url: `/pages/editor/editor?projectId=${this.data.projectId}`,
    })
  }
})
