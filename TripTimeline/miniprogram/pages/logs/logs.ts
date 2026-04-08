import { formatTime } from '../../utils/util'
import { request } from '../../utils/request'
import api from '../../utils/api'

Page({
  data: {
    logs: [] as Array<{ date: string; timeStamp: string }>,
    friends: [] as Array<{ user_id: number; nickname: string; avatar_url: string }>,
    isLoadingFriends: false,
    inviterUserId: 0,
  },

  onShow() {
    this.setData({ inviterUserId: Number(wx.getStorageSync('userInfo')?.user_id || 0) })
    this.loadLogs()
    this.loadFriends()
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

  goToYearReview() {
    wx.navigateTo({
      url: '/pages/year-review/year-review',
    })
  },

  onInviteTap() {
    if (!this.data.inviterUserId) {
      wx.showToast({ title: '请先登录后邀请好友', icon: 'none' })
    }
  },

  onShareAppMessage() {
    if (!this.data.inviterUserId) {
      return {
        title: 'TripTimeline 旅行记忆',
        path: '/pages/index/index',
      }
    }

    return {
      title: '邀请你成为旅行好友，一起看彼此旅程',
      path: `/pages/index/index?inviter=${this.data.inviterUserId}`,
      imageUrl: '',
    }
  },
})
