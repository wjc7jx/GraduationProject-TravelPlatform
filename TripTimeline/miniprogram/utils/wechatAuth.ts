import { request } from './request'

export type WechatLoginProfile = {
  nickname?: string
  avatar_url?: string
}

/**
 * wx.login 换取 code，POST /auth/login；成功后写入 token、userInfo，并触发 App 的待处理邀请逻辑。
 */
export function loginWithWechat(profile?: WechatLoginProfile): Promise<{ token: string; user: any }> {
  return new Promise((resolve, reject) => {
    wx.login({
      success: async (res) => {
        if (!res.code) {
          reject(new Error('wx.login 失败'))
          return
        }
        try {
          const body: Record<string, string> = { code: res.code }
          if (profile?.nickname) {
            body.nickname = profile.nickname
          }
          if (profile?.avatar_url) {
            body.avatar_url = profile.avatar_url
          }

          const data: any = await request({
            url: '/auth/login',
            method: 'POST',
            data: body,
          })

          if (data?.token) {
            wx.setStorageSync('token', data.token)
            wx.setStorageSync('userInfo', data.user)
            try {
              const app = getApp<IAppOption>()
              if (app && typeof app.tryApplyPendingInviteCode === 'function') {
                await app.tryApplyPendingInviteCode()
              }
            } catch {
              // getApp 在极早时机可能不可用，忽略
            }
            resolve(data)
          } else {
            reject(new Error('未获取到token'))
          }
        } catch (error) {
          console.error('微信登录请求失败:', error)
          reject(error)
        }
      },
      fail: reject,
    })
  })
}
