Page({
  data: {
    projectId: null,
    projectDetail: {} as any
  },

  onLoad(options) {
    if (options.id) {
      this.setData({ projectId: options.id })
      this.fetchProjectDetail(options.id)
    }
  },

  fetchProjectDetail(id: string) {
    // TODO: 从后端获取旅行项目详情 (包含基本的封面和标题，后续加载timeline数据)
    this.setData({
      projectDetail: {
        id: id,
        title: "Kyoto",
        subtitle: "京都的红叶与枯山水",
        cover: "https://images.unsplash.com/photo-1493976040375-3affeacfcdce",
        date: "2024.11.02 - 11.08"
      }
    })
    wx.setNavigationBarTitle({ title: this.data.projectDetail.title })
  },

  // 跳转到故事地图（即现有的 timeline-map）
  goToTimelineMap() {
    wx.navigateTo({
      url: `/pages/timeline-map/timeline-map?projectId=${this.data.projectId}`,
    })
  },

  // 新建日记/足迹 (即现有的 editor)
  goToEditor() {
    wx.navigateTo({
      url: `/pages/editor/editor?projectId=${this.data.projectId}`,
    })
  }
})
