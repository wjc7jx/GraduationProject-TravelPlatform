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
    timelineMap: '/projects/timeline-map',
    detail: (id: string) => `/projects/${id}`,
    privacy: (id: string) => `/projects/${id}/privacy`,
    exportHtml: (id: string) => `/projects/${id}/exports/html`,
    exportPdf: (id: string) => `/projects/${id}/exports/pdf`,
    update: (id: string) => `/projects/${id}`,
    delete: (id: string) => `/projects/${id}`
  },
  // 节点(内容)模块
  content: {
    list: (projectId: string) => `/projects/${projectId}/contents`,
    create: (projectId: string) => `/projects/${projectId}/contents`,
    privacy: (projectId: string, contentId: string) => `/projects/${projectId}/contents/${contentId}/privacy`,
    update: (projectId: string, contentId: string) => `/projects/${projectId}/contents/${contentId}`,
    delete: (projectId: string, contentId: string) => `/projects/${projectId}/contents/${contentId}`
  }
};
