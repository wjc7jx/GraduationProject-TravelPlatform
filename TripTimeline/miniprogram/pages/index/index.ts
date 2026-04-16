// index.ts
import { request, asAbsoluteAssetUrl } from '../../utils/request'
import api from '../../utils/api'

// 获取应用实例
const app = getApp<IAppOption>()

Component({
  data: {
    projects: [] as any[],
    isLoading: true,
    hasAuth: false,
    filterKeyword: '',
    filterTag: '',
    filterStartDate: '',
    filterEndDate: '',
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
    applyCardStyles(projects: any[]) {
      const styles = ['card-large', 'card-medium right', 'card-medium left']
      return projects.map((project, index) => ({
        ...project,
        style: styles[index % styles.length]
      }))
    },

    sortProjectsByPinned(projects: any[]) {
      const pinned: any[] = []
      const normal: any[] = []
      projects.forEach((item) => {
        if (item.isPinned) {
          pinned.push(item)
        } else {
          normal.push(item)
        }
      })
      return [...pinned, ...normal]
    },

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
        const query: Record<string, string> = {}
        if (this.data.filterKeyword) query.keyword = this.data.filterKeyword
        if (this.data.filterTag) query.tag = this.data.filterTag
        if (this.data.filterStartDate) query.startDate = this.data.filterStartDate
        if (this.data.filterEndDate) query.endDate = this.data.filterEndDate

        const res = await request<any[]>({
          url: api.project.list,
          method: 'GET',
          data: query
        })

        const baseProjects = res.map((p) => {
          return {
            id: p.project_id,
            isArchived: Number(p.is_archived) === 1,
            isPinned: Number(p.is_pinned) === 1,
            title: p.title,
            subtitle: p.tags ? p.tags.split(',').join(' ') : '',
            date: `${p.start_date.replace(/-/g, '.')} - ${p.end_date ? p.end_date.replace(/-/g, '.') : '至今'}`,
            label: p.tags ? p.tags.split(',')[0] : '旅行',
            cover: p.cover_image 
                ? asAbsoluteAssetUrl(p.cover_image) 
              : '',
            locationCount: 0,
          }
        })

        const projects = this.applyCardStyles(this.sortProjectsByPinned(baseProjects))
        this.setData({ projects, isLoading: false })
      } catch (err) {
        console.error('加载项目列表失败', err)
        this.setData({ isLoading: false })
      }
    },

    onFilterChange(e: any) {
      const detail = e.detail || {}
      this.setData({
        filterKeyword: detail.keyword || '',
        filterTag: detail.tag || '',
        filterStartDate: detail.startDate || '',
        filterEndDate: detail.endDate || '',
      })
      this.loadProjects()
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
      if (!id) return;
      wx.navigateTo({
        url: `/pages/project-detail/project-detail?id=${id}`,
      })
    },

    async onPinTap(e: any) {
      const id = String(e.currentTarget.dataset.id || '')
      if (!id) return

      const currentPinned = Number(e.currentTarget.dataset.pinned) === 1
      const nextPinned = currentPinned ? 0 : 1
      const previousProjects = this.data.projects

      const updated = previousProjects.map((item: any) => {
        if (String(item.id) !== id) return item
        return {
          ...item,
          isPinned: nextPinned === 1
        }
      })

      this.setData({
        projects: this.applyCardStyles(this.sortProjectsByPinned(updated))
      })

      try {
        await request({
          url: api.project.pin(id),
          method: 'PATCH' as any,
          data: { is_pinned: nextPinned }
        })
        wx.showToast({
          title: nextPinned === 1 ? '已置顶' : '已取消置顶',
          icon: 'success'
        })
      } catch (e) {
        this.setData({ projects: previousProjects })
      }
    },

    // 长按项目卡片进行管理操作
    async onProjectLongPress(e: any) {
      const id = e.currentTarget.dataset.id
      const project = this.data.projects.find((item: any) => String(item.id) === String(id))
      if (!project) return

      const isArchived = !!project.isArchived
      const itemList = isArchived
        ? ['取消归档', '删除项目']
        : ['编辑项目', '归档项目', '删除项目']

      wx.showActionSheet({
        itemList,
        itemColor: '#1C1C1C',
        success: async (res) => {
          if (!isArchived && res.tapIndex === 0) {
            wx.navigateTo({
              url: `/pages/project-editor/project-editor?id=${id}`
            })
            return
          }

          if ((isArchived && res.tapIndex === 0) || (!isArchived && res.tapIndex === 1)) {
            const nextArchived = isArchived ? 0 : 1

            // 仅归档时需要确认提示，取消归档直接执行
            if (!isArchived) {
              wx.showModal({
                title: '确认归档',
                content: '归档后项目将进入只读状态，可稍后再取消归档恢复编辑。',
                confirmColor: '#2A4B3C',
                success: async (mRes) => {
                  if (!mRes.confirm) return
                  await this.updateArchiveStatus(id, nextArchived)
                }
              })
              return
            }

            await this.updateArchiveStatus(id, nextArchived)
            return
          }

          const deleteTapIndex = isArchived ? 1 : 2
          if (res.tapIndex === deleteTapIndex) {
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
    },

    async updateArchiveStatus(id: string, nextArchived: number) {
      try {
        await request({
          url: api.project.update(id),
          method: 'PUT',
          data: { is_archived: nextArchived }
        })
        wx.showToast({
          title: nextArchived === 1 ? '已归档' : '已取消归档',
          icon: 'success'
        })
        await this.loadProjects()
      } catch (e) {
        // utils/request 已自动弹出错误提示
      }
    }
  }
})
