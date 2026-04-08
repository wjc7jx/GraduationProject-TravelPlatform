/// <reference path="./types/index.d.ts" />

interface IAppOption {
  globalData: {
    userInfo?: WechatMiniprogram.UserInfo,
  }
  userInfoReadyCallback?: WechatMiniprogram.GetUserInfoSuccessCallback,
  doWechatLogin?: () => Promise<any>,
  tryAcceptPendingInvite?: () => Promise<void>,
  captureInviterFromLaunch?: (options: WechatMiniprogram.App.LaunchShowOption | undefined) => void,
}