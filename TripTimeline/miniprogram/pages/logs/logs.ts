import { formatTime } from '../../utils/util'
import { request } from '../../utils/request'
import api from '../../utils/api'

Page({
  data: {
    logs: [] as Array<{ date: string; timeStamp: string }>,
    friends: [] as Array<{ user_id: number; nickname: string; avatar_url: string }>,
    isLoadingFriends: false,
    inviteCode: '',
    inviteCodeExpireAt: '',
    inviteCodeInput: '',
    creatingInviteCode: false,
    applyingInviteCode: false,
  },

  async onShow() {
    this.loadLogs()
    await this.loadFriends()
    await this.ensureInviteCode()
    wx.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage'],
    })
  },

  loadLogs() {
    this.setData({
      logs: (wx.getStorageSync('logs') || []).map((log: string) => {
        return {
          date: formatTime(new Date(log)),
          timeStamp: log,
        }
      }),
    })
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

  async onInviteTap() {
    const token = wx.getStorageSync('token')
    if (!token) {
      wx.showToast({ title: '请先登录后邀请好友', icon: 'none' })
      return
    }

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
