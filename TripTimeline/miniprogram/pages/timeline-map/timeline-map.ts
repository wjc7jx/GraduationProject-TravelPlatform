// pages/timeline-map/timeline-map.ts
Page({
  data: {
    currentDay: '第 1 天',
    // 喀纳斯初始坐标
    centerLon: 87.0142,
    centerLat: 48.7061,
    mapScale: 14,
    
    activeIndex: 0,
    scrollToId: '',
    
    // 地图点位与连线
    markers: [],
    polylines: [],
    
    // 时间轴日记数据
    timelineData: [
      {
        id: 'n1',
        time: '09:30',
        category: '出发',
        title: '启程与晨雾',
        desc: '沿着盘山公路驶入景区，晨雾还没有散去，喀纳斯河在山谷里若隐若现。像走进了一幅巨大的水墨画。',
        image: 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?q=80&w=1000&auto=format&fit=crop',
        caption: '晨光的折射点',
        lon: 87.0142,
        lat: 48.7061
      },
      {
        id: 'n2',
        time: '12:15',
        category: '探索',
        title: '神仙湾的徒步',
        desc: '在三湾中最为神秘的一个。这里的河水流动缓慢，水面如镜。由于独特的地理形态，这里几乎终年云雾缭绕。',
        image: '',
        lon: 87.0253,
        lat: 48.6942
      },
      {
        id: 'n3',
        time: '15:40',
        category: '休息',
        title: '木屋与热茶',
        desc: '图瓦人的古老村落，木刻楞房屋散落在草原上。我们在一家当地人的木屋里喝了一杯滚烫的奶茶，缓解了刺骨的寒意。',
        image: 'https://images.unsplash.com/photo-1542332213-9b5a5a3fad35?q=80&w=1000&auto=format&fit=crop',
        caption: '原始的栖息感',
        lon: 87.0315,
        lat: 48.6811
      },
      {
        id: 'n4',
        time: '18:50',
        category: '景点',
        title: '月亮湾的晚霞',
        desc: '河床在这里形成两个半月牙边缘，水色随光线变幻。日落时分，周围的白桦林被染成一片金红。',
        image: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=1000&auto=format&fit=crop',
        caption: '最后的光线',
        lon: 87.0392,
        lat: 48.6750
      }
    ]
  },

  onLoad() {
    this.initMapData();
  },

  initMapData() {
    const list = this.data.timelineData;
    // 1. 构建地图标记 (Markers)
    const markers = list.map((item, index) => ({
      id: index,
      latitude: item.lat,
      longitude: item.lon,
      iconPath: index === 0 ? '/assets/img/marker-active.svg' : '/assets/img/marker.svg', // 实际开发可使用本地图片
      width: index === 0 ? 32 : 24,
      height: index === 0 ? 32 : 24,
      callout: {
        content: item.title,
        color: index === 0 ? '#FFFFFF' : '#1C1C1C',
        fontSize: 12,
        borderRadius: 4,
        bgColor: index === 0 ? '#C85A3D' : '#FFFFFF',
        padding: 6,
        display: index === 0 ? 'ALWAYS' : 'BYCLICK'
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
