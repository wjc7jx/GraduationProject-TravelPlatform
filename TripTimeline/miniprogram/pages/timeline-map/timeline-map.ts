import { request, baseUrl } from '../../utils/request';
import api from '../../utils/api';

Page({
  data: {
    projectId: null,
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
    
    projectDetail: null as any,
    timelineData: [] as any[],
    _startY: 0,
    _startHeight: 0
  },

  onLoad(options: any) {
    if (options.projectId) {
      this.setData({
        projectId: options.projectId,
      });
    }
  },

  onShow() {
    if (this.data.projectId) {
      this.fetchProjectDetail(String(this.data.projectId));
      this.fetchTimelineData(String(this.data.projectId));
    } else {
      wx.showToast({ title: '请从项目进入时间地图', icon: 'none' });
    }
  },

  async fetchProjectDetail(id: string) {
    try {
      const res = await request<any>({
        url: api.project.detail(id),
        method: 'GET'
      });
      this.setData({
        projectDetail: res,
        timelineTitle: res?.title || '时间地图',
      });
    } catch(e) {}
  },

  async fetchTimelineData(projectId: string) {
    try {
      const res = await request<any[]>({
        url: api.content.list(projectId),
        method: 'GET'
      });
      if (res && res.length > 0) {
        let globalIndex = 0;
        const mappedData = res.map((item: any) => {
          const payload = item.content_data || {};
          const d = new Date(item.record_time || item.created_at);
          const location = item.location || {};
          const imageList = Array.isArray(payload.images)
            ? payload.images
            : (typeof payload.images === 'string' ? (() => {
                try { return JSON.parse(payload.images); } catch (e) { return []; }
              })() : []);
          return {
            id: item.content_id,
            dateStr: `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`,
            time: d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
            category: item.content_type === 'track' ? '足迹' : '日记',
            title: payload.title || '无标题',
            desc: payload.content || '',
            image: imageList[0] || '',
            lon: Number(location.longitude) || 0,
            lat: Number(location.latitude) || 0,
            hasLoc: !!(location.longitude && location.latitude)
          };
        });
        
        mappedData.forEach((d: any) => {
          if (d.image && !d.image.startsWith('http')) {
            d.image = `${baseUrl}${d.image}`;
          }
        });

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
    const list = this.data.timelineData.reduce((acc: any[], cur: any) => acc.concat(cur.items), []).filter((item: any) => item.hasLoc);
    const markers = list.map((item: any) => ({
      id: item.globalIndex,
      latitude: item.lat,
      longitude: item.lon,
      iconPath: item.globalIndex === this.data.activeIndex ? '/assets/img/marker-active.svg' : '/assets/img/marker.svg',
      width: item.globalIndex === this.data.activeIndex ? 32 : 24,
      height: item.globalIndex === this.data.activeIndex ? 32 : 24,
      callout: {
        content: item.title,
        color: item.globalIndex === this.data.activeIndex ? '#FFFFFF' : '#1C1C1C',
        fontSize: 12,
        borderRadius: 4,
        bgColor: item.globalIndex === this.data.activeIndex ? '#C85A3D' : '#FFFFFF',
        padding: 6,
        display: item.globalIndex === this.data.activeIndex ? 'ALWAYS' : 'BYCLICK'
      }
    }));

    const points = list.map((item: any) => ({
      latitude: item.lat,
      longitude: item.lon
    }));

    const polylines = points.length ? [{
      points,
      color: '#C85A3D80',
      width: 4,
      dottedLine: true
    }] : [];

    this.setData({
      markers,
      polylines,
      allMapPoints: points,
      showResetViewport: false
    });

    this.resetMapViewport(true);
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
    setTimeout(() => {
      const mapCtx = wx.createMapContext('storyMap');
      mapCtx.includePoints({
        points,
        padding: [60, 48, 360, 48] // 底部给抽屉和按钮留出空间
      });
    }, initial ? 500 : 80);
    this.setData({ showResetViewport: false });
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
    // 吸附逻辑：滑动超过中间值吸附过去
    let snapHeight = 30; // 默认缩起状态
    if (currentHeight > 55) {
      snapHeight = 80; // 展开状态
    } else {
      snapHeight = 30; 
    }
    this.setData({ sheetHeight: snapHeight });
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
    const index = e.currentTarget.dataset.index;
    const node = this.getNodeByIndex(index);
    const projectId = this.data.projectId ? String(this.data.projectId) : '';
    if (!node || !projectId) {
      return;
    }
    wx.showActionSheet({
      itemList: ['查看记录', '编辑记录', '删除记录'],
      itemColor: '#1C1C1C',
      success: async (res) => {
        if (res.tapIndex === 0) {
          wx.navigateTo({
            url: `/pages/content-view/content-view?projectId=${projectId}&contentId=${node.id}`
          });
          return;
        }

        if (res.tapIndex === 1) {
          wx.navigateTo({
            url: `/pages/editor/editor?projectId=${projectId}&contentId=${node.id}`
          });
          return;
        }

        if (res.tapIndex === 2) {
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
        this.setData({ activeIndex: index });
      }
      return; // 没有定位直接返回
    }
    const prevMarkers = this.data.markers;
    const markers = prevMarkers.map((m: any) => {
      const isActive = m.id === index;
      return {
        ...m,
        iconPath: isActive ? '/assets/img/marker-active.svg' : '/assets/img/marker.svg',
        width: isActive ? 32 : 24,
        height: isActive ? 32 : 24,
        callout: {
          ...m.callout,
          bgColor: isActive ? '#C85A3D' : '#FFFFFF',
          color: isActive ? '#FFFFFF' : '#1C1C1C',
          display: isActive ? 'ALWAYS' : 'BYCLICK'
        }
      };
    });

    this.setData({
      activeIndex: index,
      centerLat: target.lat,
      centerLon: target.lon,
      markers,
      mapScale: 15,
      showResetViewport: true
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

  goToEditor() {
    if (!this.data.projectId) {
      wx.showToast({ title: '请先进入具体项目后再新增记录', icon: 'none' });
      return;
    }
    wx.navigateTo({
      url: `/pages/editor/editor?projectId=${this.data.projectId}`,
    })
  }
})
