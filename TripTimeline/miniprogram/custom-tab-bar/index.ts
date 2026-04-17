Component({
  data: {
    selected: 0,
    list: [
      {
        pagePath: "/pages/index/index",
        text: "旅途",
        iconPath: "/assets/img/map.svg",
        index: 0
      },
      {
        pagePath: "/pages/project-editor/project-editor",
        isCenter: true // 标识这是中间的悬浮新建按钮
      },
      {
        pagePath: "/pages/profile/profile",
        text: "我的",
        iconPath: "/assets/img/profile.svg",
        index: 1
      }
    ]
  },
  pageLifetimes: {
    show() {
      // 页面显示时，根据当前路由自动匹配选中的 Tab
      const pages = getCurrentPages();
      if (pages.length > 0) {
        const currentPage = pages[pages.length - 1];
        const url = `/${currentPage.route}`;
        const item = this.data.list.find(item => item.pagePath === url);
        if (item && item.index !== undefined && this.data.selected !== item.index) {
          this.setData({ selected: item.index });
        }
      }
    }
  },
  methods: {
    switchTab(e: any) {
      const data = e.currentTarget.dataset;
      const url = data.path;

      // 如果点击的是中间新建按钮，使用 wx.navigateTo 跳转（不作为真的 tabBar 页面）
      if (url === '/pages/project-editor/project-editor') {
        wx.navigateTo({
          url
        });
        return;
      }
      
      // 这里的选中状态提前响应，提供更好的点击反馈
      if (data.index !== undefined && this.data.selected !== data.index) {
        this.setData({ selected: data.index });
      }

      // 进行正常的 Tab 切换
      wx.switchTab({
        url
      });
    }
  }
});