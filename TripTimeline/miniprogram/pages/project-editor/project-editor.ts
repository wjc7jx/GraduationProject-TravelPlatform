import { request, baseUrl } from '../../utils/request'
import api from '../../utils/api'

Page({
  data: {
    isEdit: false,
    projectId: null as string | null,
    // 表单数据
    title: '',
    subtitle: '',
    coverImage: '',
    startDate: '',
    endDate: '',
    tags: [] as string[],
    
    // 输入框状态
    tagInput: ''
  },

  onLoad(options: any) {
    if (options.id) {
      // 携带 ID 说明是编辑模式
      this.setData({
        isEdit: true,
        projectId: options.id
      })
      this.loadProjectDetail(options.id)
    } else {
      // 新建模式，初始化默认时间
      const today = new Date().toISOString().split('T')[0]
      this.setData({
        startDate: today,
        endDate: today
      })
    }
  },

  async loadProjectDetail(id: string) {
    try {
      const res = await request<any>({
        url: api.project.detail(id),
        method: 'GET'
      })
      
      this.setData({
        title: res.title || '',
        // 我们的数据库直接拼接到了 tags，为了简便暂不区分，如果是复杂业务 subtitle 也可以存在 tags 里或新建字段
        subtitle: '',
        coverImage: res.cover_image 
          ? (res.cover_image.startsWith('http') ? res.cover_image : `${baseUrl}${res.cover_image}`)
          : '',
        startDate: res.start_date || '',
        endDate: res.end_date || '',
        tags: res.tags ? res.tags.split(',') : []
      })
    } catch(e) {
      // Request util has shown error
    }
  },

  // 选择封面图并上传
  chooseCover() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFilePath = res.tempFiles[0].tempFilePath
        this.uploadImage(tempFilePath)
      }
    })
  },

  // 调用封装后的原生 wx.uploadFile 接口
  uploadImage(filePath: string) {
    wx.showLoading({ title: '上传中...' })
    const token = wx.getStorageSync('token')
    wx.uploadFile({
      url: `${baseUrl}${api.upload}`,
      filePath: filePath,
      name: 'file',
      header: {
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      success: (uploadRes) => {
        wx.hideLoading()
        if (uploadRes.statusCode === 201 || uploadRes.statusCode === 200) {
          const parsed = JSON.parse(uploadRes.data)
          const payload = parsed && typeof parsed === 'object' && parsed.data !== undefined
            ? parsed.data
            : parsed
          if (!payload?.url) {
            wx.showToast({ title: '图片地址解析失败', icon: 'none' })
            return
          }
          this.setData({ coverImage: `${baseUrl}${payload.url}` })
        } else {
          wx.showToast({ title: '图片上传失败', icon: 'error' })
        }
      },
      fail: () => {
        wx.hideLoading()
        wx.showToast({ title: '上传出现网络错误', icon: 'none' })
      }
    })
  },

  // 输入绑定
  onTitleInput(e: any) {
    this.setData({ title: e.detail.value })
  },
  onSubtitleInput(e: any) {
    this.setData({ subtitle: e.detail.value })
  },
  onStartDateChange(e: any) {
    this.setData({ startDate: e.detail.value })
  },
  onEndDateChange(e: any) {
    this.setData({ endDate: e.detail.value })
  },

  // 标签处理
  onTagInput(e: any) {
    this.setData({ tagInput: e.detail.value })
  },
  addTag() {
    const val = this.data.tagInput.trim()
    if (val && this.data.tags.length < 5) {
      this.setData({
        tags: [...this.data.tags, val],
        tagInput: ''
      })
    }
  },
  removeTag(e: any) {
    const index = e.currentTarget.dataset.index
    const newTags = [...this.data.tags]
    newTags.splice(index, 1)
    this.setData({ tags: newTags })
  },

  // 提交保存
  async onSubmit() {
    const { title, subtitle, coverImage, startDate, endDate, tags, isEdit, projectId } = this.data
    if (!title || !startDate) {
      wx.showToast({ title: '必填项(标题/时间)未完成', icon: 'error' })
      return
    }

    // 将绝对路径的图片再替换为相对路径以存入后端
    let finalCover = coverImage
    if (coverImage.startsWith(baseUrl)) {
      finalCover = coverImage.replace(baseUrl, '')
    }

    const payload = {
      title,
      // 后端暂无 subtitle 字段设计，你可以考虑将 subtitle 放进 tags，或加字段
      cover_image: finalCover,
      start_date: startDate,
      end_date: endDate || null,
      tags: tags.length ? tags.join(',') : null
    }

    try {
      if (isEdit && projectId) {
        await request({
          url: api.project.update(projectId),
          method: 'PUT',
          data: payload
        })
      } else {
        await request({
          url: api.project.create,
          method: 'POST',
          data: payload
        })
      }
      
      wx.showToast({ title: '保存成功', icon: 'success' })
      setTimeout(() => {
        wx.navigateBack() // 返回列表页
      }, 1500)
    } catch(e) {
      // 错误由 request 工具统一拦截提示
    }
  }
})
