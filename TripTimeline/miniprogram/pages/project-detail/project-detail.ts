import { request, baseUrl } from '../../utils/request';
import api from '../../utils/api';

Page({
  data: {
    projectId: null,
    projectDetail: {} as any
  },

  onLoad(options: any) {
    if (options.id) {
      this.setData({ projectId: options.id })
    }
  },

  onShow() {
    if (this.data.projectId) {
      this.fetchProjectDetail(this.data.projectId);
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

      this.setData({
        projectDetail: {
          id: res.id,
          title: res.title || '无标题',
          subtitle: res.description || res.tags || '',
          cover: cover,
          date: dateStr
        }
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
  },

  // 编辑当前项目
  goToProjectEditor() {
    wx.navigateTo({
      url: `/pages/project-editor/project-editor?id=${this.data.projectId}`,
    })
  }
})
