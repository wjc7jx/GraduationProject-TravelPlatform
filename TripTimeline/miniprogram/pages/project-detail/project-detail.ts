import { request, baseUrl } from '../../utils/request';
import api from '../../utils/api';

Page({
  data: {
    projectId: null as string | null,
    projectDetail: {} as any,
    stats: {
      locations: 0,
      photos: 0,
      days: 0
    },
    showFabMenu: false // 悬浮菜单的开闭状态
  },

  onLoad(options: any) {
    if (options.id) {
      this.setData({ projectId: options.id })
    }
  },

  onShow() {
    if (this.data.projectId) {
      this.fetchProjectDetail(this.data.projectId);
      this.fetchStats(this.data.projectId);
    }
  },

  async fetchStats(id: string) {
    try {
      const res = await request<any[]>({
        url: api.content.list(id),
        method: 'GET'
      });
      
      let locationsCount = 0;
      let photosCount = 0;
      
      res.forEach(item => {
        if (item.content_type === 'track') locationsCount++;
        if (item.content_type === 'photo') {
          photosCount++;
        }
      });
      
      this.setData({
        'stats.locations': locationsCount,
        'stats.photos': photosCount
      });
    } catch(e) {
      console.error('Fetch stats failed', e);
    }
  },

  async fetchProjectDetail(id: string) {
    try {
      const res = await request<any>({
        url: api.project.detail(id),
        method: 'GET'
      });
      
      let dateStr = '未定时间';
      if (res.start_date && res.end_date) {
        dateStr = `${res.start_date.split('T')[0].replace(/-/g, '.')} - ${res.end_date.split('T')[0].replace(/-/g, '.')}`;
      } else if (res.start_date) {
        dateStr = res.start_date.split('T')[0].replace(/-/g, '.');
      }

      const cover = res.cover_image 
        ? (res.cover_image.startsWith('http') ? res.cover_image : `${baseUrl}${res.cover_image}`)
        : 'https://images.unsplash.com/photo-1493976040375-3affeacfcdce';

      let days = 0;
      if (res.start_date) {
        const start = new Date(res.start_date).getTime();
        const end = res.end_date ? new Date(res.end_date).getTime() : Date.now();
        days = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));
      }

      this.setData({
        projectDetail: {
          id: res.project_id,
          title: res.title || '无标题',
          subtitle: res.tags || '',
          cover: cover,
          date: dateStr
        },
        'stats.days': days
      });
      wx.setNavigationBarTitle({ title: this.data.projectDetail.title });
    } catch (err) {
      wx.showToast({ title: '加载失败', icon: 'error' });
    }
  },

  goBack() {
    wx.navigateBack({ 
      delta: 1, 
      fail: () => {
        wx.switchTab({ url: '/pages/index/index' })
      }
    })
  },

  // 跳转到故事地图
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
  },

  // 编辑当前项目
  goToProjectEditor() {
    wx.navigateTo({
      url: `/pages/project-editor/project-editor?id=${this.data.projectId}`,
    })
  },

  // ==== FAB 分类型发布控制逻辑 ====

  toggleFabMenu() {
    this.setData({ showFabMenu: !this.data.showFabMenu })
  },

  onAddPhoto() {
    this.toggleFabMenu(); // 收起菜单
    wx.chooseMedia({
      count: 9,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        // 跳转到图文富文本编辑器，并可将 filePath 作为参数传递给它进行预览及背景上传
        wx.navigateTo({
           url: `/pages/editor/editor?projectId=${this.data.projectId}&mediaType=photo&path=${encodeURIComponent(res.tempFiles[0].tempFilePath)}`
        })
      }
    })
  },

  onAddAudio() {
    this.toggleFabMenu(); // 收起菜单
    // 由于原 editor 可能还未完整支持音频形态，这里引导至同样的 editor 但附带 audio 标识
    wx.navigateTo({
      url: `/pages/editor/editor?projectId=${this.data.projectId}&mediaType=audio`
    })
  },

  onAddTrack() {
    this.toggleFabMenu(); // 收起菜单
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['.gpx', '.kml'],
      success: (res) => {
        wx.showLoading({ title: '解析轨迹中...' });
        const token = wx.getStorageSync('token')
        // 调用我们刚刚部署在 Epic 3 Stage 2 的 /upload/trajectory 接口
        wx.uploadFile({
          url: `${baseUrl}/upload/trajectory`,
          filePath: res.tempFiles[0].path,
          name: 'file',
          header: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          success: async (uploadRes) => {
            wx.hideLoading();
            if (uploadRes.statusCode === 201 || uploadRes.statusCode === 200) {
              // const data = JSON.parse(uploadRes.data);
              // 这里将解析好的轨迹存为 Content 记录...
              wx.showToast({ title: '轨迹提取成功', icon: 'success' });
            } else {
              wx.showToast({ title: '轨迹解析失败', icon: 'error' });
            }
          },
          fail: () => {
            wx.hideLoading();
            wx.showToast({ title: '网络错误', icon: 'none' });
          }
        })
      }
    })
  }

})
