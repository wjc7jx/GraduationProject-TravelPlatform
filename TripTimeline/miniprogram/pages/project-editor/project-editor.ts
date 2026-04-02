Page({
  data: {
    isEdit: false,
    projectId: null,
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

  onLoad(options) {
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

  loadProjectDetail(id: string) {
    // TODO: 从接口获取旅行详细信息并填充表单
    // Mock data
    this.setData({
      title: '喀纳斯',
      subtitle: '寻迹喀纳斯',
      coverImage: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800',
      startDate: '2025-09-12',
      endDate: '2025-09-18',
      tags: ['自驾游', '新疆']
    })
  },

  // 选择封面图
  chooseCover() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFilePath = res.tempFiles[0].tempFilePath
        this.setData({
          coverImage: tempFilePath
        })
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
  onSubmit() {
    const { title, startDate, endDate } = this.data
    if (!title || !startDate || !endDate) {
      wx.showToast({ title: '必填项未完成', icon: 'error' })
      return
    }

    wx.showLoading({ title: '保存中' })
    // TODO: 调用后端接口提交数据 (POST /projects 或 PUT /projects/:id)
    setTimeout(() => {
      wx.hideLoading()
      wx.showToast({ title: '保存成功', icon: 'success' })
      setTimeout(() => {
        wx.navigateBack() // 返回列表页
      }, 1500)
    }, 1000)
  }
})
