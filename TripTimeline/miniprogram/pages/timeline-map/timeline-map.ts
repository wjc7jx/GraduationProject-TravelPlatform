import { request, baseUrl } from '../../utils/request';
import api from '../../utils/api';

Page({
  data: {
    projectId: null,
    currentDay: '全部',
    centerLon: 116.404,
    centerLat: 39.915,
    mapScale: 14,
    
    activeIndex: 0,
    scrollToId: '',
    
    markers: [] as any[],
    polylines: [] as any[],
    
    projectDetail: null as any,
    timelineData: [] as any[],
    showFabMenu: false
  },

  onLoad(options: any) {
    if (options.projectId) {
      this.setData({ projectId: options.projectId });
    }
  },

  onShow() {
    if (this.data.projectId) {
      this.fetchTimelineData(this.data.projectId);
      this.fetchProjectDetail(this.data.projectId);
    }
  },

  async fetchProjectDetail(id: string) {
    try {
      const res = await request<any>({
        url: api.project.detail(id),
        method: 'GET'
      });
      this.setData({ projectDetail: res });
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
          const d = new Date(item.log_time || item.created_at);
          return {
            id: item.content_id,
            dateStr: `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`,
            time: d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
            category: item.type === 'location' ? '足迹' : '日记',
            title: item.title || '无标题',
            desc: item.content || '',
            image: item.images ? JSON.parse(item.images)[0] : '',
            lon: item.longitude || 0,
            lat: item.latitude || 0,
            hasLoc: !!(item.longitude && item.latitude)
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

        const firstLoc = mappedData.find(i => i.hasLoc);
        if (firstLoc) {
          this.setData({
            centerLon: firstLoc.lon,
            centerLat: firstLoc.lat
          });
        }
      } else {
        this.setData({ timelineData: [] });
      }
      this.initMapData();
    } catch (e) {
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  initMapData() {
    // 扁平化数据以创建 Marker，过滤掉无定位的数据
    const list = this.data.timelineData.reduce((acc: any[], cur: any) => acc.concat(cur.items), []).filter((item: any) => item.hasLoc);
    // 1. 构建地图标记 (Markers)
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

    // 2. 构建连线轨迹 (Polyline)
    const points = list.filter((item: any) => item.hasLoc).map((item: any) => ({
      latitude: item.lat,
      longitude: item.lon
    }));
    
    const polylines = points.length ? [{
      points: points,
      color: '#C85A3D80',
      width: 4,
      dottedLine: true
    }] : [];

    this.setData({
      markers,
      polylines
    });
  },

  // 点击时间轴节点联动地图
  onNodeTap(e: any) {
    const index = e.currentTarget.dataset.index;
    this.focusNode(index);
  },

  // 点击地图标记联动时间轴
  onMarkerTap(e: any) {
    const index = e.detail.markerId;
    this.focusNode(index);
    // 找出该 id
    let targetId = '';
    for(let g of this.data.timelineData) {
      const item = g.items.find((i: any) => i.globalIndex === index);
      if(item) { targetId = item.id; break; }
    }
    if(targetId) {
      this.setData({
        scrollToId: 'node-' + targetId
      });
    }
  },

  focusNode(index: number) {
    let targetItems = this.data.timelineData.reduce((acc: any[], cur: any) => acc.concat(cur.items), []);
    const target = targetItems.find(i => i.globalIndex === index);
    if (!target || !target.hasLoc) {
      if (this.data.activeIndex !== index) {
        this.setData({ activeIndex: index });
      }
      return; // 没有定位直接返回
    }
    const prevMarkers = this.data.markers;
    
    // 更新 Markers 样式（高亮当前点）
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
      markers: markers,
      mapScale: 15 // 聚焦时微微放大
    });
    
    const mapCtx = wx.createMapContext('storyMap');
    mapCtx.moveToLocation({
      latitude: target.lat,
      longitude: target.lon,
    });
  },

  // ==== FAB 分类型发布控制逻辑 ====

  toggleFabMenu() {
    this.setData({ showFabMenu: !this.data.showFabMenu })
  },

  onAddPhoto() {
    this.toggleFabMenu();
    wx.chooseMedia({
      count: 9,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        wx.navigateTo({
           url: `/pages/editor/editor?projectId=${this.data.projectId}&mediaType=photo&path=${encodeURIComponent(res.tempFiles[0].tempFilePath)}`
        })
      }
    })
  },

  onAddAudio() {
    this.toggleFabMenu();
    wx.navigateTo({
      url: `/pages/editor/editor?projectId=${this.data.projectId}&mediaType=audio`
    })
  },

  onAddTrack() {
    this.toggleFabMenu();
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['.gpx', '.kml'],
      success: (res) => {
        wx.showLoading({ title: '解析轨迹中...' });
        const token = wx.getStorageSync('token');
        wx.uploadFile({
          url: `${baseUrl}/upload/trajectory`,
          filePath: res.tempFiles[0].path,
          name: 'file',
          header: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          success: async (uploadRes) => {
            wx.hideLoading();
            if (uploadRes.statusCode === 201 || uploadRes.statusCode === 200) {
              wx.showToast({ title: '轨迹提取成功', icon: 'success' });
              this.fetchTimelineData(this.data.projectId); // Refresh list
            } else {
              wx.showToast({ title: '轨迹解析失败', icon: 'error' });
            }
          },
          fail: () => {
            wx.hideLoading();
            wx.showToast({ title: '网络错误', icon: 'none' });
          }
        })
      }
    })
  },
  
  goToEditor() {
    wx.navigateTo({
      url: `/pages/editor/editor?projectId=${this.data.projectId}`,
    })
  }
})
