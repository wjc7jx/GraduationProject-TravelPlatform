// app.ts
import { request } from './utils/request'

App<IAppOption>({
  globalData: {},
  onLaunch() {
    // 展示本地存储能力
    const logs = wx.getStorageSync('logs') || []
    logs.unshift(Date.now())
    wx.setStorageSync('logs', logs)

    // 默认尝试默默登录，不强制阻断用户UI
    const token = wx.getStorageSync('token')
    if (!token) {
      this.doWechatLogin()
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