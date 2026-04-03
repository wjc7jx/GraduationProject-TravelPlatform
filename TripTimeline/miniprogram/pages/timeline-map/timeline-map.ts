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
    
    markers: [],
    polylines: [],
    
    timelineData: [] as any[]
  },

  onLoad(options: any) {
    if (options.projectId) {
      this.setData({ projectId: options.projectId });
    }
  },

  onShow() {
    if (this.data.projectId) {
      this.fetchTimelineData(this.data.projectId);
    }
  },

  async fetchTimelineData(projectId: string) {
    try {
      const res = await request<any[]>({
        url: api.content.list(projectId),
        method: 'GET'
      });
      if (res && res.length > 0) {
        const mappedData = res.map((item: any) => ({
          id: item.content_id,
          time: new Date(item.log_time || item.created_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
          category: item.type === 'location' ? '足迹' : '日记',
          title: item.title || '无标题',
          desc: item.content || '',
          image: item.images ? JSON.parse(item.images)[0] : '', // parse JSON or use as string based on your DB
          lon: item.longitude || 0,
          lat: item.latitude || 0
        })).filter(item => item.lon && item.lat);
        
        mappedData.forEach((d: any) => {
          if (d.image && !d.image.startsWith('http')) {
            d.image = `${baseUrl}${d.image}`;
          }
        });

        this.setData({ timelineData: mappedData });

        if (mappedData.length > 0) {
          this.setData({
            centerLon: mappedData[0].lon,
            centerLat: mappedData[0].lat
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
    const list = this.data.timelineData;
    // 1. 构建地图标记 (Markers)
    const markers = list.map((item: any, index: number) => ({
      id: index,
      latitude: item.lat,
      longitude: item.lon,
      iconPath: index === this.data.activeIndex ? '/assets/img/marker-active.svg' : '/assets/img/marker.svg',
      width: index === this.data.activeIndex ? 32 : 24,
      height: index === this.data.activeIndex ? 32 : 24,
      callout: {
        content: item.title,
        color: index === this.data.activeIndex ? '#FFFFFF' : '#1C1C1C',
        fontSize: 12,
        borderRadius: 4,
        bgColor: index === this.data.activeIndex ? '#C85A3D' : '#FFFFFF',
        padding: 6,
        display: index === this.data.activeIndex ? 'ALWAYS' : 'BYCLICK'
      }
    }));

    // 2. 构建连线轨迹 (Polyline)
    const points = list.map(item => ({
      latitude: item.lat,
      longitude: item.lon
    }));
    
    const polylines = [{
      points: points,
      color: '#C85A3D80',
      width: 4,
      dottedLine: true
    }];

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
    // 滚动列表到视窗
    this.setData({
      scrollToId: 'node-' + this.data.timelineData[index].id
    });
  },

  focusNode(index: number) {
    const target = this.data.timelineData[index];
    const prevMarkers = this.data.markers;
    
    // 更新 Markers 样式（高亮当前点）
    const markers = prevMarkers.map((m: any, i: number) => {
      const isActive = i === index;
      return {
        ...m,
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
    
    // 实际项目中由于获取不到真实的地图实例图标变化，可以使用 wx.createMapContext 平滑移动
    const mapCtx = wx.createMapContext('storyMap');
    mapCtx.moveToLocation({
      latitude: target.lat,
      longitude: target.lon,
    });
  }
})
