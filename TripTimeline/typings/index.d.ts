/// <reference path="./types/index.d.ts" />

interface IAppOption {
  globalData: {
    userInfo?: WechatMiniprogram.UserInfo,
  }
  userInfoReadyCallback?: WechatMiniprogram.GetUserInfoSuccessCallback,
  doWechatLogin: (profile?: { nickname?: string; avatar_url?: string }) => Promise<any>,
  tryApplyPendingInviteCode: () => Promise<void>,
  captureInviteCodeFromLaunch: (options: WechatMiniprogram.App.LaunchShowOption | undefined) => void,
  parseClipboardShareCommand: (text: string) => { projectId: string; shareId: string } | null,
  tryHandleClipboardShareCommand: () => Promise<void>,
}