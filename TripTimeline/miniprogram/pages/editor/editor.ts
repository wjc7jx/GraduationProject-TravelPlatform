// pages/editor/editor.ts
Page({
  data: {
    date: '',
    time: '',
    location: null as any,
    imagePath: '',
    title: '',
    content: ''
  },

  onLoad() {
    const now = new Date();
    const pad = (n: number) => n < 10 ? '0' + n : n.toString();
    this.setData({
      date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
      time: `${pad(now.getHours())}:${pad(now.getMinutes())}`
    });
  },

  bindDateChange(e: any) {
    this.setData({ date: e.detail.value });
  },

  bindTimeChange(e: any) {
    this.setData({ time: e.detail.value });
  },

  chooseLocation() {
    wx.chooseLocation({
      success: (res) => {
        this.setData({
          location: {
            name: res.name || res.address,
            lat: res.latitude,
            lon: res.longitude
          }
        });
      },
      fail: () => {
        // 用户取消或未授权
      }
    });
  },

  chooseImage() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        this.setData({
          imagePath: res.tempFiles[0].tempFilePath
        });
        // 【论文亮点提示】：这里之后可以接入 EXIF 解析器
        // 自动提取照片中的 GPS 和时间，反写到 data.location 和 data.time
      }
    });
  },

  removeImage() {
    this.setData({ imagePath: '' });
  },

  onTitleInput(e: any) {
    this.setData({ title: e.detail.value });
  },

  onContentInput(e: any) {
    this.setData({ content: e.detail.value });
  },

  saveEntry() {
    if (!this.data.title) {
      wx.showToast({ title: 'Requires a title', icon: 'none' });
      return;
    }
    
    wx.showLoading({ title: 'Sealing...', mask: true });
    
    // 模拟保存请求延迟
    setTimeout(() => {
      wx.hideLoading();
      wx.showToast({ title: 'Journal Saved', icon: 'success' });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    }, 800);
  }
})
