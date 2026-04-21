export default {
  // 用户权限与认证模块
  auth: {
    login: '/auth/login',
    register: '/auth/register'
  },
  // 上传模块
  upload: '/upload',
  // 项目模块
  project: {
    list: '/projects',
    create: '/projects',
    detail: (id: string) => `/projects/${id}`,
    privacy: (id: string) => `/projects/${id}/privacy`,
    exportHtml: (id: string) => `/projects/${id}/exports/html`,
    exportPdf: (id: string) => `/projects/${id}/exports/pdf`,
    shares: (id: string) => `/projects/${id}/shares`,
    shareQrcode: (id: string, shareId: string) => `/projects/${id}/shares/${shareId}/qrcode`,
    shareVisit: (id: string, shareId: string) => `/projects/${id}/shares/${shareId}/visit`,
    revokeShare: (id: string, shareId: string) => `/projects/${id}/shares/${shareId}/revoke`,
    update: (id: string) => `/projects/${id}`,
    pin: (id: string) => `/projects/${id}/pin`,
    delete: (id: string) => `/projects/${id}`
  },
  // 节点(内容)模块
  content: {
    list: (projectId: string) => `/projects/${projectId}/contents`,
    create: (projectId: string) => `/projects/${projectId}/contents`,
    update: (projectId: string, contentId: string) => `/projects/${projectId}/contents/${contentId}`,
    delete: (projectId: string, contentId: string) => `/projects/${projectId}/contents/${contentId}`
  },
  // 好友模块
  friend: {
    list: '/friends',
    acceptInvite: '/friends/invite/accept',
    createInviteCode: '/friends/invite-code',
    applyInviteCode: '/friends/invite-code/apply',
    remove: (friendId: number | string) => `/friends/${friendId}`,
    updateRemark: (friendId: number | string) => `/friends/${friendId}`,
  }
};
