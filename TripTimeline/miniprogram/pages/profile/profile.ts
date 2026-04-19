import { request } from '../../utils/request'
import api from '../../utils/api'
import { asAbsoluteAssetUrl } from '../../utils/request'
import { loginWithWechat } from '../../utils/wechatAuth'
import { uploadFileToQiniu } from '../../utils/qiniuUpload'

const NICKNAME_MAX = 50

Page({
  data: {
    friends: [] as Array<{ user_id: number; nickname: string; avatar_url: string }>,
    isLoadingFriends: false,
    inviteCode: '',
    inviteCodeExpireAt: '',
    inviteCodeInput: '',
    creatingInviteCode: false,
    applyingInviteCode: false,
    greetingTitle: '嗨，旅行者',
    heroStatLine: '已记录 0 次旅行',
    reviewYearTitle: '',
    reviewSummaryLine: '在地图中按年份回顾足迹',
    hasToken: false,
    profileNickname: '',
    avatarDisplaySrc: '',
    avatarUrlForApi: '',
    savingProfile: false,
    choosingAvatar: false,
  },

  hydrateUserProfile() {
    const token = wx.getStorageSync('token')
    const userInfo = wx.getStorageSync('userInfo') as
      | { nickname?: string; nickName?: string; avatar_url?: string }
      | undefined
    const rawNick = userInfo?.nickname || userInfo?.nickName || ''
    const rawAvatar = String(userInfo?.avatar_url || '').trim()
    this.setData({
      hasToken: !!token,
      profileNickname: rawNick,
      avatarUrlForApi: rawAvatar,
      avatarDisplaySrc: rawAvatar ? asAbsoluteAssetUrl(rawAvatar) : '',
    })
  },

  async onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 })
    }

    this.hydrateUserProfile()
    await Promise.all([this.loadProfileStats(), this.loadFriends()])
    await this.ensureInviteCode()
  },

  async loadProfileStats() {
    const token = wx.getStorageSync('token')
    const year = new Date().getFullYear()
    if (!token) {
      this.setData({
        greetingTitle: '嗨，旅行者',
        heroStatLine: '已记录 0 次旅行',
        reviewYearTitle: `${year} 年度回顾`,
        reviewSummaryLine: '登录后查看足迹汇总',
      })
      return
    }

    const userInfo = wx.getStorageSync('userInfo') as { nickname?: string; nickName?: string } | undefined
    const nick = userInfo?.nickname || userInfo?.nickName
    const greetingTitle = nick ? `嗨，${nick}` : '嗨，旅行者'

    try {
      const list = await request<any[]>({
        url: api.project.list,
        method: 'GET',
        showLoading: false,
      })
      const projects = list || []
      const tripCount = projects.length
      const totalFootprints = projects.reduce(
        (sum, p) => sum + (Number(p.locationCount) || 0),
        0
      )
      this.setData({
        greetingTitle,
        heroStatLine: `已记录 ${tripCount} 次旅行`,
        reviewYearTitle: `${year} 年度回顾`,
        reviewSummaryLine: `${totalFootprints} 个足迹 · ${tripCount} 次旅行`,
      })
    } catch {
      this.setData({
        greetingTitle,
        heroStatLine: '已记录 0 次旅行',
        reviewYearTitle: `${year} 年度回顾`,
        reviewSummaryLine: '按年份汇总旅程与地图足迹',
      })
    }
  },

  async loadFriends() {
    const token = wx.getStorageSync('token')
    if (!token) {
      this.setData({ friends: [] })
      return
    }

    this.setData({ isLoadingFriends: true })
    try {
      const friends = await request<Array<{ user_id: number; nickname: string; avatar_url: string }>>({
        url: api.friend.list,
        method: 'GET',
        showLoading: false,
      })
      this.setData({ friends: friends || [] })
    } catch (error) {
      this.setData({ friends: [] })
    } finally {
      this.setData({ isLoadingFriends: false })
    }
  },

  async ensureInviteCode() {
    const token = wx.getStorageSync('token')
    if (!token) {
      this.setData({ inviteCode: '', inviteCodeExpireAt: '' })
      return
    }
    if (this.data.inviteCode) return

    await this.generateInviteCode({ showSuccessToast: false })
  },

  async generateInviteCode(options: { showSuccessToast?: boolean } = {}) {
    if (this.data.creatingInviteCode) return
    this.setData({ creatingInviteCode: true })
    try {
      const result = await request<any>({
        url: api.friend.createInviteCode,
        method: 'POST',
        data: {
          max_uses: 10,
          expires_in_hours: 24,
        },
        showLoading: false,
      })

      const expiresAt = result?.expires_at
        ? new Date(result.expires_at).toLocaleString('zh-CN', { hour12: false })
        : ''

      this.setData({
        inviteCode: String(result?.code || ''),
        inviteCodeExpireAt: expiresAt,
      })

      if (options.showSuccessToast !== false) {
        wx.showToast({ title: '邀请码已刷新', icon: 'success' })
      }
    } catch (error) {
      this.setData({ inviteCode: '', inviteCodeExpireAt: '' })
    } finally {
      this.setData({ creatingInviteCode: false })
    }
  },

  onInviteCodeInput(e: WechatMiniprogram.CustomEvent) {
    const value = String(e.detail?.value || '').replace(/\s+/g, '').toUpperCase()
    this.setData({ inviteCodeInput: value })
  },

  onProfileNicknameBlur(e: WechatMiniprogram.Input) {
    // type=nickname 常在失焦/微信昵称面板确认后才给出最终值，仅 bindinput 可能拿不到
    const v = String(e.detail?.value || '').slice(0, NICKNAME_MAX)
    this.setData({ profileNickname: v })
  },

  async onChooseAvatar(e: WechatMiniprogram.CustomEvent) {
    const token = wx.getStorageSync('token')
    if (!token) {
      wx.showToast({ title: '请先登录', icon: 'none' })
      return
    }
    const avatarPath = (e.detail as { avatarUrl?: string })?.avatarUrl
    if (!avatarPath) return
    if (this.data.choosingAvatar) return
    this.setData({ choosingAvatar: true })
    wx.showLoading({ title: '上传头像...', mask: true })
    try {
      const uploaded = await uploadFileToQiniu(avatarPath, {
        purpose: 'image',
        filename: 'avatar.jpg',
      })
      const url = String(uploaded?.url || '').trim()
      if (!url) {
        throw new Error('empty url')
      }
      this.setData({
        avatarUrlForApi: url,
        avatarDisplaySrc: asAbsoluteAssetUrl(url),
      })
      wx.showToast({ title: '头像已选好，请保存', icon: 'none' })
    } catch {
      wx.showToast({ title: '头像上传失败', icon: 'none' })
    } finally {
      wx.hideLoading()
      this.setData({ choosingAvatar: false })
    }
  },

  onChooseAvatarTap() {
    const token = wx.getStorageSync('token')
    if (!token) {
      wx.showToast({ title: '请先登录', icon: 'none' })
      return
    }
    if (this.data.choosingAvatar) return

    // Prefer programmatic API if available to avoid native button chrome
    if (typeof wx.chooseAvatar === 'function') {
      wx.chooseAvatar({
        success: (res: any) => {
          // res may contain avatarUrl
          const avatarUrl = res?.avatarUrl || res?.avatarUrlList?.[0]
          if (avatarUrl) {
            // reuse existing upload handler signature
            // @ts-ignore - synthesize event
            this.onChooseAvatar({ detail: { avatarUrl } } as any)
          }
        },
      })
      return
    }

    // Fallback to chooseImage when chooseAvatar is not supported
    wx.chooseImage({ count: 1, sizeType: ['compressed'], sourceType: ['album', 'camera'], success: (res) => {
      const path = res.tempFilePaths && res.tempFilePaths[0]
      if (path) {
        // @ts-ignore
        this.onChooseAvatar({ detail: { avatarUrl: path } } as any)
      }
    } })
  },

  async onSaveProfileTap() {
    const token = wx.getStorageSync('token')
    if (!token) {
      wx.showToast({ title: '请先登录', icon: 'none' })
      return
    }
    if (this.data.savingProfile) return

    // 与 model:value 对齐：避免用户未失焦就点保存时仍读到旧昵称
    const nickFromData = (this.data.profileNickname || '').trim().slice(0, NICKNAME_MAX)
    const nick = nickFromData || '旅行者'
    const avatar_url = this.data.avatarUrlForApi || undefined

    this.setData({ savingProfile: true, profileNickname: nick })
    try {
      await loginWithWechat({ nickname: nick, avatar_url })
      wx.showToast({ title: '已保存', icon: 'success' })
      this.hydrateUserProfile()
      await Promise.all([this.loadProfileStats(), this.loadFriends()])
    } catch {
      // 错误提示由 request 统一处理
    } finally {
      this.setData({ savingProfile: false })
    }
  },

  async onApplyInviteCodeTap() {
    const code = this.data.inviteCodeInput.trim().toUpperCase()
    if (!code) {
      wx.showToast({ title: '请输入邀请码', icon: 'none' })
      return
    }
    if (this.data.applyingInviteCode) return

    this.setData({ applyingInviteCode: true })
    try {
      await request({
        url: api.friend.applyInviteCode,
        method: 'POST',
        data: { code },
        showLoading: false,
      })
      wx.showToast({ title: '添加好友成功', icon: 'success' })
      this.setData({ inviteCodeInput: '' })
      await this.loadFriends()
    } catch (error) {
      // 错误提示已由请求层处理
    } finally {
      this.setData({ applyingInviteCode: false })
    }
  },

  goToYearReview() {
    wx.navigateTo({
      url: '/pages/year-review/year-review',
    })
  },

  onCopyInviteCode() {
    const code = String(this.data.inviteCode || '').trim()
    if (!code) {
      wx.showToast({ title: '暂无邀请码，请先刷新', icon: 'none' })
      return
    }
    wx.setClipboardData({
      data: code,
      success: () => wx.showToast({ title: '已复制', icon: 'success' }),
    })
  },

  async onRefreshInviteTap() {
    const token = wx.getStorageSync('token')
    if (!token) {
      wx.showToast({ title: '请先登录', icon: 'none' })
      return
    }
    if (this.data.creatingInviteCode) return
    await this.generateInviteCode({ showSuccessToast: true })
  },
})
