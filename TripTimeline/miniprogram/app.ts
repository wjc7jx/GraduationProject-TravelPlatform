// app.ts
import { request } from './utils/request'
import api from './utils/api'

const PENDING_INVITE_CODE_KEY = 'pending_friend_invite_code'
const LAST_HANDLED_SHARE_KEY = 'last_handled_share_command'

App<IAppOption>({
  globalData: {},
  onLaunch(options) {
    this.captureInviteCodeFromLaunch(options)
    // 展示本地存储能力
    const logs = wx.getStorageSync('logs') || []
    logs.unshift(Date.now())
    wx.setStorageSync('logs', logs)

    // 默认尝试默默登录，不强制阻断用户UI
    const token = wx.getStorageSync('token')
    if (!token) {
      this.doWechatLogin()
    } else {
      this.tryApplyPendingInviteCode()
    }
  },

  onShow(options) {
    this.captureInviteCodeFromLaunch(options)
    this.tryApplyPendingInviteCode()
    this.tryHandleClipboardShareCommand()
  },

  captureInviteCodeFromLaunch(options: WechatMiniprogram.App.LaunchShowOption | undefined) {
    const inviteCode = String(options?.query?.inviteCode || '').trim().toUpperCase()
    if (!inviteCode) return
    wx.setStorageSync(PENDING_INVITE_CODE_KEY, inviteCode)
  },

  async tryApplyPendingInviteCode() {
    const token = wx.getStorageSync('token')
    const inviteCode = String(wx.getStorageSync(PENDING_INVITE_CODE_KEY) || '').trim().toUpperCase()

    if (!token) return
    if (!inviteCode) return

    try {
      await request({
        url: api.friend.applyInviteCode,
        method: 'POST',
        data: {
          code: inviteCode,
        },
        showLoading: false,
      })
      wx.removeStorageSync(PENDING_INVITE_CODE_KEY)
      wx.showToast({ title: '已添加好友', icon: 'success' })
    } catch (error) {
      // 保留待处理邀请，等待下次进入时继续尝试
    }
  },

  parseClipboardShareCommand(text: string) {
    const raw = String(text || '').trim()
    if (!raw) return null
    const matched = raw.match(/TripTimeline:\/\/share\?projectId=([^&\s]+)&shareId=([^&\s]+)/i)
    if (!matched) return null

    const projectId = decodeURIComponent(matched[1] || '').trim()
    const shareId = decodeURIComponent(matched[2] || '').trim()
    if (!projectId || !shareId) return null

    return { projectId, shareId }
  },

  async tryHandleClipboardShareCommand() {
    const token = wx.getStorageSync('token')
    if (!token) return

    try {
      const clipboard = await new Promise<string>((resolve, reject) => {
        wx.getClipboardData({
          success: (res) => resolve(String(res.data || '')),
          fail: reject,
        })
      })

      const parsed = this.parseClipboardShareCommand(clipboard)
      if (!parsed) return

      const fingerprint = `${parsed.projectId}|${parsed.shareId}`
      const lastHandled = String(wx.getStorageSync(LAST_HANDLED_SHARE_KEY) || '')
      if (fingerprint === lastHandled) return

      wx.showModal({
        title: '检测到分享口令',
        content: '是否在小程序中打开该旅行项目？',
        confirmText: '立即查看',
        cancelText: '稍后',
        success: (res) => {
          if (!res.confirm) return
          wx.setStorageSync(LAST_HANDLED_SHARE_KEY, fingerprint)
          wx.navigateTo({
            url: `/pages/timeline-map/timeline-map?projectId=${encodeURIComponent(parsed.projectId)}&shareId=${encodeURIComponent(parsed.shareId)}`,
          })
        }
      })
    } catch (error) {
      // 读取剪贴板失败时静默忽略
    }
  },

  doWechatLogin(): Promise<any> {
    return new Promise((resolve, reject) => {
      wx.login({
        success: async (res) => {
          if (res.code) {
            try {
              const data: any = await request({
                url: '/auth/login',
                method: 'POST',
                data: {
                  code: res.code
                }
              })
              if (data.token) {
                wx.setStorageSync('token', data.token)
                wx.setStorageSync('userInfo', data.user)
                this.tryApplyPendingInviteCode()
                console.log('登录成功，Token已保存')
                resolve(data)
              } else {
                reject(new Error('未获取到token'))
              }
            } catch (error) {
              console.error('后台微信快速登录请求失败:', error)
              reject(error)
            }
          } else {
            reject(new Error('wx.login 失败'))
          }
        },
        fail: reject
      })
    })
  }
})