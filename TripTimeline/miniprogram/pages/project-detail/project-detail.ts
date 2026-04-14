import { request, baseUrl, asAbsoluteAssetUrl } from '../../utils/request';
import api from '../../utils/api';

type ExportScope = 'all' | 'public';

/** PDF 由服务端 Puppeteer 生成，耗时长；downloadFile 在开发者工具/localhost 下易出现 ENOENT，故用 request arraybuffer + writeFile */
const EXPORT_BINARY_TIMEOUT_MS = 180000;

function parseErrorMessageFromArrayBuffer(ab: ArrayBuffer): string | null {
  try {
    const bytes = new Uint8Array(ab);
    let txt = '';
    for (let i = 0; i < bytes.length; i++) {
      txt += String.fromCharCode(bytes[i]);
    }
    const j = JSON.parse(txt) as { message?: string; msg?: string };
    return j.message || j.msg || null;
  } catch {
    return null;
  }
}

function saveRemoteBinaryToUserData(
  url: string,
  headers: Record<string, string>,
  ext: 'pdf' | 'html',
  timeoutMs: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    wx.request({
      url,
      method: 'GET',
      header: headers,
      responseType: 'arraybuffer',
      timeout: timeoutMs,
      success(res) {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          const hint = res.data
            ? parseErrorMessageFromArrayBuffer(res.data as ArrayBuffer)
            : null;
          reject(new Error(hint || `请求失败(${res.statusCode})`));
          return;
        }
        const data = res.data as ArrayBuffer;
        if (!data || data.byteLength === 0) {
          reject(new Error('导出文件为空'));
          return;
        }
        const fs = wx.getFileSystemManager();
        const safeExt = ext === 'pdf' ? 'pdf' : 'html';
        const filePath = `${wx.env.USER_DATA_PATH}/export_${Date.now()}.${safeExt}`;
        fs.writeFile({
          filePath,
          data,
          success: () => resolve(filePath),
          fail: (e) => reject(e),
        });
      },
      fail: (e) => reject(e),
    });
  });
}

Page({
  data: {
    projectId: null as string | null,
    projectDetail: {} as any,
    stats: {
      locations: 0,
      photos: 0,
      days: 0
    }
  },

  onLoad(options: any) {
    if (options.id) {
      this.setData({ projectId: options.id })
    }
  },

  onShow() {
    if (this.data.projectId) {
      this.fetchProjectDetail(this.data.projectId);
      this.fetchStats(this.data.projectId);
    }
  },

  async fetchStats(id: string) {
    try {
      const res = await request<any[]>({
        url: api.content.list(id),
        method: 'GET'
      });
      
      let locationsCount = 0;
      let photosCount = 0;
      
      res.forEach(item => {
        if (item.content_type === 'track') locationsCount++;
        if (item.content_type === 'photo') {
          photosCount++;
        }
      });
      
      this.setData({
        'stats.locations': locationsCount,
        'stats.photos': photosCount
      });
    } catch(e) {
      console.error('Fetch stats failed', e);
    }
  },

  async fetchProjectDetail(id: string) {
    try {
      const res = await request<any>({
        url: api.project.detail(id),
        method: 'GET'
      });
      
      let dateStr = '未定时间';
      if (res.start_date && res.end_date) {
        dateStr = `${res.start_date.split('T')[0].replace(/-/g, '.')} - ${res.end_date.split('T')[0].replace(/-/g, '.')}`;
      } else if (res.start_date) {
        dateStr = res.start_date.split('T')[0].replace(/-/g, '.');
      }

        const cover = res.cover_image 
          ? asAbsoluteAssetUrl(res.cover_image)
          : 'https://images.unsplash.com/photo-1493976040375-3affeacfcdce';

      let days = 0;
      if (res.start_date) {
        const start = new Date(res.start_date).getTime();
        const end = res.end_date ? new Date(res.end_date).getTime() : Date.now();
        days = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));
      }

      this.setData({
        projectDetail: {
          id: res.project_id,
          title: res.title || '无标题',
          subtitle: res.subtitle || res.tags || '',
          cover: cover,
          date: dateStr
        },
        'stats.days': days
      });
      wx.setNavigationBarTitle({ title: this.data.projectDetail.title });
    } catch (err) {
      wx.showToast({ title: '加载失败', icon: 'error' });
    }
  },

  goBack() {
    wx.navigateBack({ 
      delta: 1, 
      fail: () => {
        wx.switchTab({ url: '/pages/index/index' })
      }
    })
  },

  // 跳转到故事地图
  goToTimelineMap() {
    wx.navigateTo({
      url: `/pages/timeline-map/timeline-map?projectId=${this.data.projectId}`,
    })
  },

  // 新建日记/足迹 (即现有的 editor)
  goToEditor() {
    wx.navigateTo({
      url: `/pages/editor/editor?projectId=${this.data.projectId}`,
    })
  },

  // 编辑当前项目
  goToProjectEditor() {
    wx.navigateTo({
      url: `/pages/project-editor/project-editor?id=${this.data.projectId}`,
    })
  },

  onExportTap() {
    const scopeText = ['导出 PDF（全部内容）', '导出 PDF（仅公开）', '导出 HTML（全部内容）', '导出 HTML（仅公开）'];
    wx.showActionSheet({
      itemList: scopeText,
      success: async (res) => {
        const index = res.tapIndex;
        if (index === 0) {
          await this.exportPdf('all');
          return;
        }
        if (index === 1) {
          await this.exportPdf('public');
          return;
        }
        if (index === 2) {
          await this.exportHtml('all');
          return;
        }
        if (index === 3) {
          await this.exportHtml('public');
        }
      }
    });
  },

  buildExportUrl(format: 'pdf' | 'html', scope: ExportScope) {
    const projectId = this.data.projectId as string;
    const path = format === 'pdf' ? api.project.exportPdf(projectId) : api.project.exportHtml(projectId);
    return `${baseUrl}${path}?visibility_scope=${scope}`;
  },

  buildHtmlShareUrl(scope: ExportScope) {
    const token = wx.getStorageSync('token');
    const base = `${this.buildExportUrl('html', scope)}&mode=inline`;
    if (!token) return base;
    return `${base}&access_token=${encodeURIComponent(token)}`;
  },

  getAuthHeader(): Record<string, string> {
    const token = wx.getStorageSync('token');
    if (!token) return {};
    return { Authorization: `Bearer ${token}` };
  },

  async exportPdf(scope: ExportScope) {
    const url = this.buildExportUrl('pdf', scope);
    wx.showLoading({ title: '正在生成 PDF，请稍候…', mask: true });

    try {
      const filePath = await saveRemoteBinaryToUserData(
        url,
        this.getAuthHeader(),
        'pdf',
        EXPORT_BINARY_TIMEOUT_MS
      );

      wx.hideLoading();
      wx.showModal({
        title: 'PDF导出成功',
        content: '文件已保存，是否立即打开预览？',
        confirmText: '打开',
        cancelText: '稍后',
        success: (modalRes) => {
          if (!modalRes.confirm) return;
          wx.openDocument({
            filePath,
            fileType: 'pdf',
            showMenu: true,
            fail: () => {
              wx.showToast({ title: '打开失败，可在文件列表中查看', icon: 'none' });
            }
          });
        }
      });
    } catch (err) {
      wx.hideLoading();
      const msg = err && typeof err === 'object' && 'message' in err
        ? String((err as Error).message)
        : '';
      wx.showToast({
        title: msg && msg.length < 20 ? msg : 'PDF导出失败',
        icon: 'none',
        duration: 2500
      });
      console.error('PDF export failed:', err);
    }
  },

  async exportHtml(scope: ExportScope) {
    const projectId = this.data.projectId as string;
    wx.showLoading({ title: '正在生成HTML...', mask: true });
    try {
      const token = wx.getStorageSync('token');
      const payload = await request<any>({
        url: api.project.exportHtml(projectId),
        method: 'GET',
        data: {
          visibility_scope: scope,
          mode: 'url',
          access_token: token || ''
        },
        showLoading: false
      });

      const filename = payload?.filename || `memorial-${Date.now()}.html`;
      const downloadUrl = payload?.download_url || payload?.url;
      const previewUrl = payload?.preview_url || this.buildHtmlShareUrl(scope);

      if (!downloadUrl) {
        throw new Error('未获取到下载地址');
      }

      const filePath = await saveRemoteBinaryToUserData(
        downloadUrl,
        this.getAuthHeader(),
        'html',
        EXPORT_BINARY_TIMEOUT_MS
      );

      wx.hideLoading();
      wx.showModal({
        title: 'HTML导出成功',
        content: `HTML文件已保存：${filename}。可复制在线预览链接在浏览器打开。`,
        confirmText: '复制预览链接',
        cancelText: '打开文件',
        success: (res) => {
          if (res.confirm) {
            wx.setClipboardData({
              data: previewUrl,
              success: () => wx.showToast({ title: '链接已复制', icon: 'success' })
            });
            return;
          }

          wx.openDocument({
            filePath,
            showMenu: true,
            fail: () => {
              wx.showToast({ title: '打开失败，可在文件列表查看', icon: 'none' });
            }
          });
        }
      });
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: 'HTML导出失败', icon: 'none' });
      console.error('HTML export failed:', err);
    }
  }

})
