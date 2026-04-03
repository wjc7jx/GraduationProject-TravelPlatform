// index.ts
import { request } from '../../utils/request'
import api from '../../utils/api'

// 获取应用实例
const app = getApp<IAppOption>()

Component({
  data: {
    projects: [] as any[],
    isLoading: true,
    hasAuth: false,
  },
  lifetimes: {
    attached() {
      this.checkAuthAndLoad()
    }
  },
  pageLifetimes: {
    show() {
      // 页面显示时刷新列表
      if(this.data.hasAuth) {
        this.loadProjects()
      }
    }
  },
  methods: {
    async checkAuthAndLoad() {
      const token = wx.getStorageSync('token')
      if (token) {
        this.setData({ hasAuth: true })
        await this.loadProjects()
      } else {
        this.setData({ isLoading: false, hasAuth: false })
      }
    },
    
    // 手动点击授权/登录
    async onLoginTap() {
      this.setData({ isLoading: true })
      try {
        if (app.doWechatLogin) {
          await app.doWechatLogin()
        }
        this.setData({ hasAuth: true })
        await this.loadProjects()
      } catch (e) {
        wx.showToast({ title: '登录失败，请重试', icon: 'none' })
        this.setData({ isLoading: false })
      }
    },

    // 创建新项目入口
    onCreateProjectTap() {
      wx.navigateTo({
        url: '/pages/project-editor/project-editor',
      })
    },

    async loadProjects() {
      this.setData({ isLoading: true })
      try {
        const res = await request<any[]>({
          url: api.project.list,
          method: 'GET'
        })
        
        // 样式数组，循环赋给项目卡片呈现不对称排版
        const styles = ["card-large", "card-medium right", "card-medium left"]
        
        const projects = res.map((p, i) => {
          return {
            id: p.project_id,
            title: p.title,
            subtitle: p.tags ? p.tags.split(',').join(' ') : '',
            date: `${p.start_date.replace(/-/g, '.')} - ${p.end_date ? p.end_date.replace(/-/g, '.') : '至今'}`,
            label: p.tags ? p.tags.split(',')[0] : '旅行',
            cover: p.cover_image 
              ? (p.cover_image.startsWith('http') ? p.cover_image : `http://localhost:3000${p.cover_image}`) 
              : '',
            locationCount: 0,
            style: styles[i % styles.length]
          }
        })
        
        this.setData({ projects, isLoading: false })
      } catch (err) {
        console.error('加载项目列表失败', err)
        this.setData({ isLoading: false })
      }
    },
    
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
            // 归档 (可后续增加接口调用)
            wx.showToast({ title: '功能开发中', icon: 'none' })
          } else if (res.tapIndex === 2) {
            // 删除
            wx.showModal({
              title: '确认删除',
              content: '删除后无法恢复，确定要删除吗？',
              confirmColor: '#E53935',
              success: async (mRes) => {
                if (mRes.confirm) {
                  try {
                    await request({ url: api.project.delete(id), method: 'DELETE' })
                    wx.showToast({ title: '已删除', icon: 'success' })
                    this.loadProjects() // 删除成功后刷新列表
                  } catch(e) {
                    // utils/request 已自动弹出错误提示
                  }
                }
              }
            })
          }
        }
      })
    }
  }
})
