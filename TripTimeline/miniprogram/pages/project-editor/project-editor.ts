import { request, baseUrl, assetBaseUrl, asAbsoluteAssetUrl } from '../../utils/request'
import api from '../../utils/api'

type VisibilityValue = 1 | 2 | 3

const VISIBILITY_OPTIONS = ['私密（仅自己可见）', '好友可见（自动基于好友关系）', '公开（登录用户可见）']

function normalizeVisibility(value: any): VisibilityValue {
  const visibility = Number(value)
  if (visibility === 2 || visibility === 3) {
    return visibility
  }
  return 1
}

function visibilityLabel(visibility: VisibilityValue) {
  if (visibility === 2) return '好友可见（自动基于好友关系）'
  if (visibility === 3) return '公开（登录用户可见）'
  return '私密（仅自己可见）'
}

Page({
  data: {
    isEdit: false,
    submitting: false,
    submitStatus: 'idle' as 'idle' | 'loading' | 'success' | 'error',
    projectId: null as string | null,
    // 表单数据
    title: '',
    subtitle: '',
    coverImages: [] as string[],
    selectedCoverIndex: 0,
    startDate: '',
    endDate: '',
    tags: [] as string[],

    // 项目默认隐私
    visibilityOptions: VISIBILITY_OPTIONS,
    privacyVisibility: 1 as VisibilityValue,
    privacyVisibilityIndex: 0,
    privacyHint: '当前为私密：仅你自己可见',
    
    // 输入框状态
    tagInput: '',
    presetTags: ['🏕️ 露营', '🏖️ 看海', '☕️ 城市漫游', '📸 扫街', '⛰️ 特种兵', '🚗 自驾'],
    showTagSelector: false
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
      const [res, privacyRule] = await Promise.all([
        request<any>({
          url: api.project.detail(id),
          method: 'GET'
        }),
        request<any>({
          url: api.project.privacy(id),
          method: 'GET',
          showLoading: false
        }).catch(() => null)
      ])
      
      this.setData({
        title: res.title || '',
        subtitle: res.subtitle || '',
        coverImages: res.cover_image
          ? [asAbsoluteAssetUrl(res.cover_image)]
          : [],
        selectedCoverIndex: 0,
        startDate: res.start_date || '',
        endDate: res.end_date || '',
        tags: res.tags ? res.tags.split(',') : []
      })

      if (privacyRule) {
        const visibility = normalizeVisibility(privacyRule.visibility)
        this.setData({
          privacyVisibility: visibility,
          privacyVisibilityIndex: visibility - 1,
          privacyHint: `当前为${visibilityLabel(visibility)}`
        })
      }
    } catch(e) {
      // Request util has shown error
    }
  },

  // 选择封面图并上传
  chooseCover() {
    const leftCount = 3 - this.data.coverImages.length
    if (leftCount <= 0) {
      wx.showToast({ title: '最多上传3张封面图', icon: 'none' })
      return
    }

    wx.chooseMedia({
      count: leftCount,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: async (res) => {
        const tempFilePaths = res.tempFiles.map((item) => item.tempFilePath)
        await this.uploadImages(tempFilePaths)
      }
    })
  },

  async uploadImages(filePaths: string[]) {
    if (!filePaths.length) return

    wx.showLoading({ title: '上传中...' })
    try {
      const uploaded = await Promise.all(filePaths.map((path) => this.uploadSingleImage(path)))
      const nextImages = [...this.data.coverImages, ...uploaded].slice(0, 3)
      this.setData({
        coverImages: nextImages,
        selectedCoverIndex: Math.min(this.data.selectedCoverIndex, Math.max(nextImages.length - 1, 0))
      })
    } catch (error) {
      wx.showToast({ title: '图片上传失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  // 调用封装后的原生 wx.uploadFile 接口
  uploadSingleImage(filePath: string): Promise<string> {
    const token = wx.getStorageSync('token')
    return new Promise((resolve, reject) => {
      wx.uploadFile({
        url: `${baseUrl}${api.upload}`,
        filePath,
        name: 'file',
        header: {
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        success: (uploadRes) => {
          if (uploadRes.statusCode === 201 || uploadRes.statusCode === 200) {
            const parsed = JSON.parse(uploadRes.data)
            const payload = parsed && typeof parsed === 'object' && parsed.data !== undefined
              ? parsed.data
              : parsed
            if (!payload?.url) {
              reject(new Error('图片地址解析失败'))
              return
            }
            resolve(asAbsoluteAssetUrl(payload.url))
            return
          }
          reject(new Error(`图片上传失败(${uploadRes.statusCode})`))
        },
        fail: () => reject(new Error('上传出现网络错误'))
      })
    })
  },

  onSelectCover(e: any) {
    const index = Number(e.currentTarget.dataset.index)
    if (Number.isNaN(index)) return
    this.setData({ selectedCoverIndex: index })
  },

  removeCover(e: any) {
    const index = Number(e.currentTarget.dataset.index)
    if (Number.isNaN(index)) return

    const nextImages = [...this.data.coverImages]
    nextImages.splice(index, 1)

    let nextSelected = this.data.selectedCoverIndex
    if (nextSelected > index) nextSelected -= 1
    if (nextSelected >= nextImages.length) nextSelected = Math.max(nextImages.length - 1, 0)

    this.setData({
      coverImages: nextImages,
      selectedCoverIndex: nextSelected
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

  onPrivacyVisibilityChange(e: any) {
    const index = Number(e.detail.value)
    const visibility = normalizeVisibility(index + 1)
    this.setData({
      privacyVisibility: visibility,
      privacyVisibilityIndex: visibility - 1,
      privacyHint: `当前为${visibilityLabel(visibility)}`
    })
  },

  // 标签处理
  onTagInput(e: any) {
    this.setData({ tagInput: e.detail.value })
  },
  toggleTagSelector() {
    this.setData({ showTagSelector: !this.data.showTagSelector })
  },
  togglePresetTag(e: any) {
    const tag = e.currentTarget.dataset.tag
    if (!tag) return
    const tags = [...this.data.tags]
    const idx = tags.indexOf(tag)
    if (idx !== -1) {
      tags.splice(idx, 1)
      this.setData({ tags })
    } else if (tags.length < 5) {
      const nextTags = [...tags, tag]
      this.setData({
        tags: nextTags,
        showTagSelector: nextTags.length >= 5 ? false : this.data.showTagSelector
      })
    }
  },
  addTag() {
    const val = this.data.tagInput.trim()
    if (val && this.data.tags.length < 5) {
      const nextTags = [...this.data.tags, val]
      this.setData({
        tags: nextTags,
        tagInput: '',
        showTagSelector: nextTags.length >= 5 ? false : this.data.showTagSelector
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
    const {
      title,
      subtitle,
      coverImages,
      selectedCoverIndex,
      startDate,
      endDate,
      tags,
      isEdit,
      submitting,
      projectId,
      privacyVisibility
    } = this.data

    if (submitting) return

    if (!title || !startDate) {
      wx.vibrateShort({ type: 'medium' })
      wx.showToast({ title: '请填写标题和出发日哦', icon: 'none' })
      return
    }

    if (!isEdit && !coverImages.length) {
      wx.vibrateShort({ type: 'medium' })
      wx.showToast({ title: '点亮旅程，请至少添1张封面', icon: 'none' })
      return
    }

    const pickedCover = coverImages[selectedCoverIndex] || coverImages[0] || ''

    // 将绝对路径的图片再替换为相对路径以存入后端
    let finalCover = pickedCover
    if (pickedCover && pickedCover.startsWith(assetBaseUrl)) {
      finalCover = pickedCover.replace(assetBaseUrl, '')
    }

    const payload = {
      title,
      subtitle: subtitle ? subtitle.trim() : null,
      cover_image: finalCover,
      start_date: startDate,
      end_date: endDate || null,
      tags: tags.length ? tags.join(',') : null
    }

    try {
      this.setData({ submitting: true, submitStatus: 'loading' })
      let targetProjectId = projectId

      if (isEdit && projectId) {
        const updated = await request<any>({
          url: api.project.update(projectId),
          method: 'PUT',
          data: payload
        })
        targetProjectId = `${updated?.project_id || projectId}`
      } else {
        const created = await request<any>({
          url: api.project.create,
          method: 'POST',
          data: payload
        })
        targetProjectId = `${created?.project_id || ''}`
      }

      if (!targetProjectId) {
        throw new Error('项目ID缺失，无法保存隐私规则')
      }

      await request({
        url: api.project.privacy(targetProjectId),
        method: 'PUT',
        data: {
          visibility: privacyVisibility,
          white_list: []
        },
        showLoading: false
      })
      
      this.setData({ submitStatus: 'success' })
      wx.showToast({ title: isEdit ? '旅程已更新' : '旅程已开启', icon: 'success' })
      setTimeout(() => wx.navigateBack(), 1500)
    } catch(e) {
      this.setData({ submitStatus: 'error' })
      setTimeout(() => this.setData({ submitStatus: 'idle' }), 2000)
    } finally {
      this.setData({ submitting: false })
    }
  }
})
