Component({
  data: {
    selected: 0,
    list: [
      {
        pagePath: "/pages/index/index",
        text: "旅途",
        index: 0
      },
      {
        pagePath: "/pages/editor/editor",
        isCenter: true // 标识这是中间的悬浮新建按钮
      },
      {
        pagePath: "/pages/timeline-map/timeline-map",
        text: "回忆",
        index: 1
      },
      {
        pagePath: "/pages/logs/logs",
        text: "我的",
        index: 2
      }
    ]
  },
  methods: {
    switchTab(e: any) {
      const data = e.currentTarget.dataset;
      const url = data.path;

      // 如果点击的是中间新建按钮，使用 wx.navigateTo 跳转（不作为真的 tabBar 页面）
      if (url === '/pages/editor/editor') {
        wx.navigateTo({
          url
        });
        return;
      }
      
      // 否则进行正常的 Tab 切换
      wx.switchTab({
        url
      });
      // 这里的选中状态会由页面 mixin 或 onShow 来修复一致性
      this.setData({
        selected: data.index
      });
    }
  }
});