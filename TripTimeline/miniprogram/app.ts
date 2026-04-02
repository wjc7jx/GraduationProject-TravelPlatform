import { request } from './utils/request'

// app.ts
App<IAppOption>({
  globalData: {},
  onLaunch() {
    // 展示本地存储能力
    const logs = wx.getStorageSync('logs') || []
    logs.unshift(Date.now())
    wx.setStorageSync('logs', logs)

    // 登录，如果本地已有 token 可以不强求每次登录，由后端 401 再触发
    const token = wx.getStorageSync('token')
    if (!token) {
      this.doWechatLogin()
    }
  },

  doWechatLogin() {
    // 登录
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
            }
          } catch (error) {
            console.error('后台微信快速登录请求失败:', error)
          }
        }
      },
    })
  }
})