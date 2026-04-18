import { request } from '../../utils/request'
import api from '../../utils/api'

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
  },

  async onShow() {
    // 修复底部 tabbar 的红点/选中状态
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 })
    }

    await Promise.all([this.loadProfileStats(), this.loadFriends()])
    await this.ensureInviteCode()
    wx.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage'],
    })
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

  async onBeforeShareTap() {
    const token = wx.getStorageSync('token')
    if (!token) {
      wx.showToast({ title: '请先登录后再分享', icon: 'none' })
      return
    }
    if (!this.data.inviteCode) {
      await this.generateInviteCode({ showSuccessToast: false })
    }
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

  onShareAppMessage() {
    if (!this.data.inviteCode) {
      return {
        title: 'TripTimeline 旅行记忆',
        path: '/pages/index/index',
      }
    }

    return {
      title: '输入邀请码，成为我的旅行好友',
      path: `/pages/index/index?inviteCode=${encodeURIComponent(this.data.inviteCode)}`,
      imageUrl: '',
    }
  },
})
