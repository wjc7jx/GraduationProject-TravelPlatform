import { request, baseUrl } from '../../utils/request';
import api from '../../utils/api';

Page({
  data: {
    projectId: '', // 从路由获取
    date: '',
    time: '',
    location: null as any,
    imagePath: '',
    title: '',
    content: ''
  },

  onLoad(options: any) {
    if (options.projectId) {
      this.setData({ projectId: options.projectId });
    }
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

  async saveEntry() {
    if (!this.data.title) {
      wx.showToast({ title: 'Requires a title', icon: 'none' });
      return;
    }
    
    if (!this.data.projectId) {
      wx.showToast({ title: '未关联项目', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '保存中...', mask: true });

    try {
      // @ts-ignore - options is passed from onLoad to instance, or read from getCurrentPages()
      let isAudio = false; 

      let coverUrl = '';
      if (this.data.imagePath) {
        // 先上传图片
        coverUrl = await new Promise<string>((resolve, reject) => {
          wx.uploadFile({
            url: `${baseUrl}${api.upload}/photo`, // 发送到特殊提取地理信息的通道
            filePath: this.data.imagePath,
            name: 'file',
            header: {
              Authorization: `Bearer ${wx.getStorageSync('token')}`
            },
            success(res) {
              try {
                const data = JSON.parse(res.data);
                // 暂时这里不处理返回的 exif 数据覆盖，直接解析并存图。可以升级这块能力。
                resolve(data.url);
              } catch(e) { reject(e); }
            },
            fail(err) {
              reject(err);
            }
          });
        });
      }

      const logTime = `${this.data.date} ${this.data.time}:00`;
      
      const contentData = {
        title: this.data.title,
        content: this.data.content,
        images: coverUrl ? [coverUrl] : []
      };

      let type = 'note';
      if (coverUrl) type = 'photo';
      
      await request({
        url: api.content.create(this.data.projectId),
        method: 'POST',
        data: {
          content_type: type,
          content_data: contentData,
          record_time: logTime,
          location: this.data.location ? {
            latitude: this.data.location.lat,
            longitude: this.data.location.lon,
            name: this.data.location.name
          } : null
        }
      });
      
      wx.hideLoading();
      wx.showToast({ title: '保存成功', icon: 'success' });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);

    } catch (e) {
      wx.hideLoading();
      wx.showToast({ title: '保存失败', icon: 'none' });
    }
  }
})
