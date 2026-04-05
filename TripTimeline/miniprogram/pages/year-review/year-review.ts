import { request, baseUrl } from '../../utils/request';
import api from '../../utils/api';

Page({
  data: {
    centerLon: 116.404,
    centerLat: 39.915,
    mapScale: 5,
    defaultMapScale: 5,

    sheetHeight: 30,
    isDragging: false,

    activeIndex: 0,
    scrollToId: '',
    showResetViewport: false,

    markers: [] as any[],
    allMapPoints: [] as any[],
    timelineData: [] as any[],

    _startY: 0,
    _startHeight: 0,
  },

  onShow() {
    this.fetchAllTimelineData();
  },

  async fetchAllTimelineData() {
    try {
      const res = await request<{ projects: any[]; points: any[] }>({
        url: api.project.timelineMap,
        method: 'GET',
      });

      const projects = Array.isArray(res?.projects) ? res.projects : [];
      const points = Array.isArray(res?.points) ? res.points : [];

      const pointsByProject = new Map<string, any[]>();
      points.forEach((point) => {
        const key = String(point.project_id);
        if (!pointsByProject.has(key)) {
          pointsByProject.set(key, []);
        }
        pointsByProject.get(key)!.push({
          latitude: Number(point.latitude),
          longitude: Number(point.longitude),
          contentId: point.content_id,
        });
      });

      let globalIndex = 0;
      const groupedByYearMap = new Map<string, any>();

      projects.forEach((project) => {
        const projectId = String(project.project_id);
        const projectPoints = pointsByProject.get(projectId) || [];
        const startDate = project.start_date ? new Date(project.start_date) : null;
        const endDate = project.end_date ? new Date(project.end_date) : null;
        const year = Number(project.year || (startDate ? startDate.getFullYear() : new Date(project.created_at).getFullYear()));
        const yearLabel = String(year);
        const rangeText = [
          startDate ? `${startDate.getFullYear()}.${String(startDate.getMonth() + 1).padStart(2, '0')}.${String(startDate.getDate()).padStart(2, '0')}` : '未知开始',
          endDate ? `${endDate.getFullYear()}.${String(endDate.getMonth() + 1).padStart(2, '0')}.${String(endDate.getDate()).padStart(2, '0')}` : '进行中',
        ].join(' - ');

        let cover = project.cover_image || '';
        if (cover && !cover.startsWith('http')) {
          cover = `${baseUrl}${cover}`;
        }

        const item = {
          id: `project-${project.project_id}`,
          projectId: project.project_id,
          dateStr: yearLabel,
          time: rangeText,
          category: '项目',
          title: project.title || '未命名项目',
          desc: `共 ${project.content_count || 0} 条记录，${project.point_count || projectPoints.length} 个定位点`,
          image: cover,
          lon: projectPoints[0]?.longitude || 0,
          lat: projectPoints[0]?.latitude || 0,
          hasLoc: projectPoints.length > 0,
          mapPoints: projectPoints,
          globalIndex: globalIndex++,
        };

        if (!groupedByYearMap.has(yearLabel)) {
          groupedByYearMap.set(yearLabel, {
            date: yearLabel,
            items: [],
          });
        }
        groupedByYearMap.get(yearLabel).items.push(item);
      });

      const grouped = Array.from(groupedByYearMap.values()).sort((a: any, b: any) => Number(b.date) - Number(a.date));

      this.setData({ timelineData: grouped });

      const groupedItems = grouped.reduce((acc: any[], cur: any) => acc.concat(cur.items), []);
      const firstLoc = groupedItems.find((i) => i.hasLoc);
      if (firstLoc) {
        this.setData({
          centerLon: firstLoc.lon,
          centerLat: firstLoc.lat,
          activeIndex: firstLoc.globalIndex,
        });
      }

      this.initMapData();
    } catch (e) {
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  initMapData() {
    const list = this.data.timelineData.reduce((acc: any[], cur: any) => acc.concat(cur.items), []);
    const hasLocationList = list.filter((item: any) => item.hasLoc);

    const markers: any[] = [];
    const points: any[] = [];
    let markerId = 1;

    hasLocationList.forEach((item: any) => {
      const itemPoints = Array.isArray(item.mapPoints) ? item.mapPoints : [];
      itemPoints.forEach((pt: any) => {
        markers.push({
          id: markerId++,
          projectIndex: item.globalIndex,
          latitude: Number(pt.latitude),
          longitude: Number(pt.longitude),
          iconPath: item.globalIndex === this.data.activeIndex ? '/assets/img/marker-active.svg' : '/assets/img/marker.svg',
          width: item.globalIndex === this.data.activeIndex ? 30 : 22,
          height: item.globalIndex === this.data.activeIndex ? 30 : 22,
          callout: {
            content: item.title,
            color: item.globalIndex === this.data.activeIndex ? '#FFFFFF' : '#1C1C1C',
            fontSize: 11,
            borderRadius: 4,
            bgColor: item.globalIndex === this.data.activeIndex ? '#C85A3D' : '#FFFFFF',
            padding: 5,
            display: 'BYCLICK',
          },
        });
        points.push({
          latitude: Number(pt.latitude),
          longitude: Number(pt.longitude),
        });
      });
    });

    this.setData({
      markers,
      allMapPoints: points,
      showResetViewport: false,
    });

    this.resetMapViewport(true);
  },

  onNodeTap(e: any) {
    const index = e.currentTarget.dataset.index;
    this.focusNode(index);
    const node = this.getNodeByIndex(index);
    if (node?.id) {
      this.setData({ scrollToId: 'node-' + node.id });
    }
  },

  onNodeLongPress(e: any) {
    const projectId = e.currentTarget.dataset.projectId;
    if (!projectId) {
      return;
    }
    wx.showActionSheet({
      itemList: ['查看项目详情', '打开项目时间地图'],
      itemColor: '#1C1C1C',
      success: (res) => {
        if (res.tapIndex === 0) {
          wx.navigateTo({
            url: `/pages/project-detail/project-detail?projectId=${projectId}`,
          });
          return;
        }
        wx.navigateTo({
          url: `/pages/timeline-map/timeline-map?projectId=${projectId}`,
        });
      },
    });
  },

  onMarkerTap(e: any) {
    const markerId = e.detail.markerId;
    const marker = this.data.markers.find((m: any) => m.id === markerId);
    const index = marker?.projectIndex;
    if (index === undefined) {
      return;
    }
    this.focusNode(index);
    const target = this.getNodeByIndex(index);
    if (target?.id) {
      this.setData({ scrollToId: 'node-' + target.id });
    }
  },

  focusNode(index: number) {
    const target = this.getNodeByIndex(index);
    if (!target || !target.hasLoc) {
      if (this.data.activeIndex !== index) {
        this.setData({ activeIndex: index });
      }
      return;
    }

    const markers = this.data.markers.map((m: any) => {
      const isActive = m.projectIndex === index;
      return {
        ...m,
        iconPath: isActive ? '/assets/img/marker-active.svg' : '/assets/img/marker.svg',
        width: isActive ? 30 : 22,
        height: isActive ? 30 : 22,
        callout: {
          ...m.callout,
          bgColor: isActive ? '#C85A3D' : '#FFFFFF',
          color: isActive ? '#FFFFFF' : '#1C1C1C',
          display: isActive ? 'ALWAYS' : 'BYCLICK',
        },
      };
    });

    this.setData({
      activeIndex: index,
      markers,
      showResetViewport: true,
    });

    const pointList = Array.isArray(target.mapPoints) ? target.mapPoints : [];
    if (pointList.length) {
      const mapCtx = wx.createMapContext('reviewMap');
      mapCtx.includePoints({
        points: pointList,
        padding: [80, 48, 360, 48],
      });
    }
  },

  getNodeByIndex(index: number) {
    const targetItems = this.data.timelineData.reduce((acc: any[], cur: any) => acc.concat(cur.items), []);
    return targetItems.find((i: any) => i.globalIndex === index);
  },

  resetMapViewport(initial = false) {
    const points = this.data.allMapPoints || [];
    if (!points.length) {
      this.setData({
        mapScale: this.data.defaultMapScale,
        showResetViewport: false,
      });
      return;
    }
    setTimeout(() => {
      const mapCtx = wx.createMapContext('reviewMap');
      mapCtx.includePoints({
        points,
        padding: [60, 48, 360, 48],
      });
    }, initial ? 500 : 80);
    this.setData({ showResetViewport: false });
  },

  onResetViewportTap() {
    this.resetMapViewport(false);
  },

  onMapRegionChange(e: any) {
    if (e.type === 'end') {
      this.setData({ showResetViewport: true });
    }
  },

  onTouchStart(e: any) {
    this.setData({ isDragging: true });
    this.data._startY = e.touches[0].clientY;
    this.data._startHeight = this.data.sheetHeight;
  },

  onTouchMove(e: any) {
    const currentY = e.touches[0].clientY;
    const deltaY = currentY - this.data._startY;

    const sysInfo = wx.getSystemInfoSync();
    const deltaVH = (deltaY / sysInfo.windowHeight) * 100;

    let newHeight = this.data._startHeight - deltaVH;
    if (newHeight < 20) newHeight = 20;
    if (newHeight > 85) newHeight = 85;

    this.setData({ sheetHeight: newHeight });
  },

  onTouchEnd() {
    this.setData({ isDragging: false });
    const currentHeight = this.data.sheetHeight;
    let snapHeight = 30;
    if (currentHeight > 55) {
      snapHeight = 80;
    }
    this.setData({ sheetHeight: snapHeight });
  },

  onMapTap() {
    if (this.data.sheetHeight > 50) {
      this.setData({ sheetHeight: 30 });
    }
    if (!this.data.showResetViewport) {
      this.setData({ showResetViewport: true });
    }
  },
});
