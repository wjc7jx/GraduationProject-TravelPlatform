// index.ts
// 获取应用实例
const app = getApp<IAppOption>()

Component({
  data: {
    // 模拟的旅行项目数据
    projects: [
      {
        id: 1,
        title: "Kanas",
        subtitle: "寻迹喀纳斯",
        date: "2025.09.12 - 09.18",
        label: "ROAD TRIP",
        cover: "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?q=80&w=1000&auto=format&fit=crop", 
        locationCount: 14,
        style: "card-large"
      },
      {
        id: 2,
        title: "Kyoto",
        subtitle: "京都的红叶与枯山水",
        date: "2024.11.02 - 11.08",
        label: "CITY WALK",
        cover: "https://images.unsplash.com/photo-1493976040375-3affeacfcdce?q=80&w=1000&auto=format&fit=crop",
        locationCount: 8,
        style: "card-medium right"
      },
      {
        id: 3,
        title: "Iceland",
        subtitle: "雪与火之歌",
        date: "2024.02.14 - 02.21",
        label: "EXPEDITION",
        cover: "https://images.unsplash.com/photo-1521336575822-6da63fb45455?q=80&w=1000&auto=format&fit=crop",
        locationCount: 22,
        style: "card-medium left"
      }
    ]
  },
  methods: {
    // 事件处理函数
    bindViewTap() {
      wx.navigateTo({
        url: '../logs/logs',
      })
    },
    goToDetail(e: any) {
      // TODO: 跳转到 timeline 页
      wx.showToast({ title: '即将开发: 故事地图', icon: 'none' })
    }
  }
})
