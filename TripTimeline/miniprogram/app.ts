// app.ts
import { request } from './utils/request'
import api from './utils/api'

const PENDING_INVITER_KEY = 'pending_inviter_user_id'

App<IAppOption>({
  globalData: {},
  onLaunch(options) {
    this.captureInviterFromLaunch(options)
    // 展示本地存储能力
    const logs = wx.getStorageSync('logs') || []
    logs.unshift(Date.now())
    wx.setStorageSync('logs', logs)

    // 默认尝试默默登录，不强制阻断用户UI
    const token = wx.getStorageSync('token')
    if (!token) {
      this.doWechatLogin()
    } else {
      this.tryAcceptPendingInvite()
    }
  },

  onShow(options) {
    this.captureInviterFromLaunch(options)
    this.tryAcceptPendingInvite()
  },

  captureInviterFromLaunch(options: WechatMiniprogram.App.LaunchShowOption | undefined) {
    const inviter = Number(options?.query?.inviter)
    if (!Number.isFinite(inviter) || inviter <= 0) return

    const currentUser = wx.getStorageSync('userInfo')
    if (Number(currentUser?.user_id) === inviter) return
    wx.setStorageSync(PENDING_INVITER_KEY, inviter)
  },

  async tryAcceptPendingInvite() {
    const token = wx.getStorageSync('token')
    const inviter = Number(wx.getStorageSync(PENDING_INVITER_KEY))
    const currentUser = wx.getStorageSync('userInfo')

    if (!token) return
    if (!Number.isFinite(inviter) || inviter <= 0) return
    if (Number(currentUser?.user_id) === inviter) {
      wx.removeStorageSync(PENDING_INVITER_KEY)
      return
    }

    try {
      await request({
        url: api.friend.acceptInvite,
        method: 'POST',
        data: {
          inviter_user_id: inviter,
        },
        showLoading: false,
      })
      wx.removeStorageSync(PENDING_INVITER_KEY)
      wx.showToast({ title: '已添加好友', icon: 'success' })
    } catch (error) {
      // 保留待处理邀请，等待下次进入时继续尝试
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
                this.tryAcceptPendingInvite()
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