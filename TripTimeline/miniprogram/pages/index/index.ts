// index.ts
// 获取应用实例
const app = getApp<IAppOption>()

Component({
  data: {
    // 模拟的旅行项目数据
    projects: [
      {
        id: 1,
        title: "喀纳斯",
        subtitle: "寻迹喀纳斯",
        date: "2025.09.12 - 09.18",
        label: "自驾游",
        cover: "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?q=80&w=1000&auto=format&fit=crop", 
        locationCount: 14,
        style: "card-large"
      },
      {
        id: 2,
        title: "京都",
        subtitle: "京都的红叶与枯山水",
        date: "2024.11.02 - 11.08",
        label: "城市漫步",
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
    // 前往项目详情容器
    goToDetail(e: any) {
      const id = e.currentTarget.dataset.id
      wx.navigateTo({
        url: `/pages/project-detail/project-detail?id=${id || 1}`,
      })
    },
    // 长按项目卡片进行管理操作
    onProjectLongPress(e: any) {
      const id = e.currentTarget.dataset.id
      wx.showActionSheet({
        itemList: ['编辑项目', '归档项目', '删除项目'],
        itemColor: '#1C1C1C',
        success: (res) => {
          if (res.tapIndex === 0) {
            // 编辑
            wx.navigateTo({
              url: `/pages/project-editor/project-editor?id=${id}`
            })
          } else if (res.tapIndex === 1) {
            // 归档
            wx.showToast({ title: '项目已归档', icon: 'success' })
          } else if (res.tapIndex === 2) {
            // 删除
            wx.showModal({
              title: '确认删除',
              content: '删除后无法恢复，确定要删除吗？',
              confirmColor: '#E53935',
              success: (mRes) => {
                if (mRes.confirm) {
                  wx.showToast({ title: '已删除', icon: 'success' })
                  // TODO: 调用后端删除接口，并在前端刷新列表
                }
              }
            })
          }
        }
      })
    }
  }
})
