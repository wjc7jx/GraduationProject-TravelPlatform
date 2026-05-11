import { request, baseUrl, asAbsoluteAssetUrl } from '../../utils/request';
import api from '../../utils/api';

const VISIBILITY_PRIVATE = 1;

/** PDF 由服务端 Puppeteer 生成，耗时长；downloadFile 在开发者工具/localhost 下易出现 ENOENT，故用 request arraybuffer + writeFile */
const EXPORT_BINARY_TIMEOUT_MS = 180000;

function parseErrorPayloadFromArrayBuffer(ab: ArrayBuffer): { message: string | null; code: string | null } {
  try {
    const bytes = new Uint8Array(ab);
    let txt = '';
    for (let i = 0; i < bytes.length; i++) {
      txt += String.fromCharCode(bytes[i]);
    }
    const j = JSON.parse(txt) as { message?: string; msg?: string; data?: { code?: string } | null; code?: string | number };
    return {
      message: j.message || j.msg || null,
      code: (j?.data?.code || (typeof j?.code === 'string' ? j.code : null)) || null,
    };
  } catch {
    return { message: null, code: null };
  }
}

function parseErrorMessageFromArrayBuffer(ab: ArrayBuffer): string | null {
  return parseErrorPayloadFromArrayBuffer(ab).message;
}

function showReviewBlockedModal(action: '导出' | '分享') {
  wx.showModal({
    title: `${action}被合规检测拦截`,
    content: '该项目存在被判定为违规的内容，请先进入有提示的记录修改并重新保存，系统会自动重新检测。',
    showCancel: false,
    confirmText: '我知道了',
    confirmColor: '#C0360C'
  });
}

function showReviewPendingModal(action: '导出' | '分享') {
  wx.showModal({
    title: `${action}暂不可用`,
    content: '内容安全审核尚未完成，请稍候片刻后再试。',
    showCancel: false,
    confirmText: '我知道了',
    confirmColor: '#2A4B3C'
  });
}

function saveRemoteBinaryToUserData(
  url: string,
  headers: Record<string, string>,
  ext: 'pdf' | 'html' | 'png',
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
          const payload = res.data
            ? parseErrorPayloadFromArrayBuffer(res.data as ArrayBuffer)
            : { message: null, code: null };
          const err: any = new Error(payload.message || `请求失败(${res.statusCode})`);
          err.statusCode = res.statusCode;
          err.code = payload.code;
          reject(err);
          return;
        }
        const data = res.data as ArrayBuffer;
        if (!data || data.byteLength === 0) {
          reject(new Error('导出文件为空'));
          return;
        }
        const fs = wx.getFileSystemManager();
        const safeExt = ext === 'pdf' ? 'pdf' : ext === 'png' ? 'png' : 'html';
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
    shareId: '' as string,
    activeShareId: '' as string,
    shareVisitMarked: false,
    isOwner: false,
    projectVisibility: VISIBILITY_PRIVATE,
    projectDetail: {} as any,
    stats: {
      locations: 0,
      photos: 0,
      days: 0
    },
    reviewFlagged: false,
    reviewReason: '',
    reviewScope: '' as '' | 'project' | 'content',
    flaggedContentCount: 0,
    projectReviewPending: false,
    reviewPending: false,
    reviewPendingScope: '' as '' | 'project' | 'content',
    pendingContentCount: 0
  },

  onLoad(options: any) {
    if (options.id && options.shareId) {
      const nextUrl = `/pages/timeline-map/timeline-map?projectId=${encodeURIComponent(String(options.id))}&shareId=${encodeURIComponent(String(options.shareId))}`
      wx.redirectTo({ url: nextUrl })
      return
    }

    if (options.id) {
      this.setData({ projectId: options.id })
    }
    if (options.shareId) {
      this.setData({ shareId: String(options.shareId), activeShareId: String(options.shareId) })
    }
  },

  async onShow() {
    if (this.data.projectId) {
      const loaded = await this.fetchProjectDetail(this.data.projectId);
      if (!loaded) return;
      await this.markShareVisitedIfNeeded();
      await this.fetchStats(this.data.projectId);
    }
  },

  getShareQueryData() {
    const shareId = this.data.shareId || ''
    if (!shareId) return {}
    return { share_id: shareId }
  },

  async markShareVisitedIfNeeded() {
    const projectId = this.data.projectId as string | null
    const shareId = this.data.shareId
    if (!projectId || !shareId || this.data.shareVisitMarked) return

    try {
      await request({
        url: api.project.shareVisit(projectId, shareId),
        method: 'POST',
        showLoading: false,
      })
      this.setData({ shareVisitMarked: true })
    } catch (error) {
      wx.showToast({ title: '分享已失效', icon: 'none' })
    }
  },

  async ensureShareLinkReady(project: any) {
    const currentUserId = Number(wx.getStorageSync('userInfo')?.user_id || 0)
    const ownerUserId = Number(project?.user_id || 0)
    if (!currentUserId || !ownerUserId || currentUserId !== ownerUserId) return ''
    if (this.data.activeShareId) return this.data.activeShareId

    try {
      const share = await request<any>({
        url: api.project.shares(String(project.project_id)),
        method: 'POST',
        data: { expires_in_hours: 24 * 7 },
        showLoading: false,
      })
      const shareId = String(share?.share_id || '')
      if (shareId) {
        this.setData({ activeShareId: shareId })
        return shareId
      }
    } catch (error) {
      // 仅影响分享卡片，不影响页面渲染
    }

    return ''
  },

  async fetchProjectVisibility(projectId: string) {
    if (!this.data.isOwner) return
    try {
      const privacy = await request<any>({
        url: api.project.privacy(projectId),
        method: 'GET',
        showLoading: false,
      })
      this.setData({
        projectVisibility: Number(privacy?.visibility || VISIBILITY_PRIVATE),
      })
    } catch (error) {
      this.setData({ projectVisibility: VISIBILITY_PRIVATE })
    }
  },

  buildMiniProgramShareCommand(projectId: string, shareId: string) {
    return `TripTimeline://share?projectId=${encodeURIComponent(projectId)}&shareId=${encodeURIComponent(shareId)}`
  },

  async createShareOrThrow(projectId: string) {
    const existing = this.data.activeShareId
    if (existing) return existing

    const share = await request<any>({
      url: api.project.shares(projectId),
      method: 'POST',
      data: { expires_in_hours: 24 * 7 },
      showLoading: false,
    })
    const shareId = String(share?.share_id || '')
    if (!shareId) {
      throw new Error('创建分享失败')
    }
    this.setData({ activeShareId: shareId })
    return shareId
  },

  async copyInternalShareCommand() {
    const projectId = String(this.data.projectId || '')
    if (!projectId) return

    if (Number(this.data.projectVisibility) === VISIBILITY_PRIVATE) {
      wx.showToast({ title: '私密项目不可分享', icon: 'none' })
      return
    }

    try {
      const shareId = await this.createShareOrThrow(projectId)
      const command = this.buildMiniProgramShareCommand(projectId, shareId)
      wx.setClipboardData({
        data: command,
        success: () => wx.showToast({ title: '口令已复制', icon: 'success' }),
      })
    } catch (error) {
      if (error && typeof error === 'object' && (error as any).code === 'CONTENT_REVIEW_BLOCKED') {
        showReviewBlockedModal('分享')
        await this.fetchProjectDetail(projectId)
        await this.fetchStats(projectId)
        return
      }
      if (error && typeof error === 'object' && (error as any).code === 'CONTENT_REVIEW_PENDING') {
        showReviewPendingModal('分享')
        await this.fetchProjectDetail(projectId)
        await this.fetchStats(projectId)
        return
      }
      const message = error && typeof error === 'object' && 'message' in error
        ? String((error as Error).message)
        : '生成分享口令失败'
      wx.showToast({ title: message.length <= 18 ? message : '生成分享口令失败', icon: 'none' })
    }
  },

  async previewInternalShareQrcode() {
    const projectId = String(this.data.projectId || '')
    if (!projectId) return

    if (Number(this.data.projectVisibility) === VISIBILITY_PRIVATE) {
      wx.showToast({ title: '私密项目不可分享', icon: 'none' })
      return
    }

    try {
      const shareId = await this.createShareOrThrow(projectId)
      const token = wx.getStorageSync('token')
      const qrcodeUrl = `${baseUrl}${api.project.shareQrcode(projectId, shareId)}?access_token=${encodeURIComponent(token || '')}`
      wx.showLoading({ title: '生成二维码中...', mask: true })
      const localPath = await saveRemoteBinaryToUserData(
        qrcodeUrl,
        this.getAuthHeader(),
        'png',
        30000
      )
      wx.hideLoading()
      wx.previewImage({ current: localPath, urls: [localPath] })
    } catch (error) {
      wx.hideLoading()
      if (error && typeof error === 'object' && (error as any).code === 'CONTENT_REVIEW_BLOCKED') {
        showReviewBlockedModal('分享')
        await this.fetchProjectDetail(projectId)
        await this.fetchStats(projectId)
        return
      }
      if (error && typeof error === 'object' && (error as any).code === 'CONTENT_REVIEW_PENDING') {
        showReviewPendingModal('分享')
        await this.fetchProjectDetail(projectId)
        await this.fetchStats(projectId)
        return
      }
      const message = error && typeof error === 'object' && 'message' in error
        ? String((error as Error).message)
        : '二维码生成失败'
      wx.showToast({ title: message.length <= 18 ? message : '二维码生成失败', icon: 'none' })
    }
  },

  onInternalShareTap() {
    if (!this.data.isOwner) {
      wx.showToast({ title: '仅项目创建者可分享', icon: 'none' })
      return
    }

    wx.showActionSheet({
      itemList: ['复制小程序口令链接', '预览分享二维码'],
      success: async (res) => {
        if (res.tapIndex === 0) {
          await this.copyInternalShareCommand()
          return
        }
        if (res.tapIndex === 1) {
          await this.previewInternalShareQrcode()
        }
      }
    })
  },

  async fetchStats(id: string) {
    try {
      const res = await request<any[]>({
        url: api.content.list(id),
        method: 'GET',
        data: this.getShareQueryData(),
      });
      
      let locationsCount = 0;
      let photosCount = 0;
      let flaggedCount = 0;
      let pendingCount = 0;

      res.forEach(item => {
        if (item.location || item.location_id) locationsCount++;
        if (item.content_type === 'photo') {
          photosCount++;
        }
        if (String(item.review_status || '') === 'flagged') flaggedCount++;
        if (String(item.review_status || '') === 'pending') pendingCount++;
      });

      const prevFlagged = this.data.reviewFlagged;
      const prevScope = this.data.reviewScope;
      const prevProjectPending = this.data.projectReviewPending;
      // 合并项目级 flag 与内容级 flag
      const nextFlagged = prevFlagged || flaggedCount > 0;
      const nextScope = prevScope === 'project' ? 'project' : (flaggedCount > 0 ? 'content' : prevScope);
      const nextPending =
        !nextFlagged && (prevProjectPending || pendingCount > 0);
      const pendingScope = nextFlagged
        ? ''
        : (prevProjectPending ? 'project' : (pendingCount > 0 ? 'content' : ''));

      this.setData({
        'stats.locations': locationsCount,
        'stats.photos': photosCount,
        flaggedContentCount: flaggedCount,
        pendingContentCount: pendingCount,
        reviewFlagged: nextFlagged,
        reviewScope: nextScope,
        reviewPending: nextPending,
        reviewPendingScope: pendingScope as '' | 'project' | 'content'
      });
    } catch(e) {
      console.error('Fetch stats failed', e);
    }
  },

  async fetchProjectDetail(id: string) {
    try {
      const res = await request<any>({
        url: api.project.detail(id),
        method: 'GET',
        data: this.getShareQueryData(),
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

      const projectFlagged = String(res.review_status || '') === 'flagged';
      const projectPending = String(res.review_status || '') === 'pending';
      this.setData({
        isOwner: Number(wx.getStorageSync('userInfo')?.user_id || 0) === Number(res.user_id || 0),
        projectDetail: {
          id: res.project_id,
          title: res.title || '无标题',
          subtitle: res.subtitle || res.tags || '',
          cover: cover,
          date: dateStr,
          isArchived: Number(res.is_archived) === 1
        },
        'stats.days': days,
        reviewFlagged: projectFlagged,
        reviewReason: String(res.review_reason || ''),
        reviewScope: projectFlagged ? 'project' : '',
        projectReviewPending: projectPending,
        reviewPending: !projectFlagged && projectPending,
        reviewPendingScope: !projectFlagged && projectPending ? 'project' : ''
      });
      await this.fetchProjectVisibility(id)
      await this.ensureShareLinkReady(res)
      wx.setNavigationBarTitle({ title: this.data.projectDetail.title });
      return true;
    } catch (err) {
      wx.showToast({ title: '加载失败', icon: 'error' });
      return false;
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
    const queryShare = this.data.shareId ? `&shareId=${encodeURIComponent(this.data.shareId)}` : ''
    wx.navigateTo({
      url: `/pages/timeline-map/timeline-map?projectId=${this.data.projectId}${queryShare}`,
    })
  },

  // 新建日记/足迹 (即现有的 editor)
  goToEditor() {
    if (!this.data.isOwner) {
      wx.showToast({ title: '仅项目创建者可编辑', icon: 'none' });
      return;
    }
    if (this.data.projectDetail?.isArchived) {
      wx.showToast({ title: '项目已归档，请先取消归档', icon: 'none' });
      return;
    }
    wx.navigateTo({
      url: `/pages/editor/editor?projectId=${this.data.projectId}`,
    })
  },

  // 编辑当前项目
  goToProjectEditor() {
    if (!this.data.isOwner) {
      wx.showToast({ title: '仅项目创建者可编辑', icon: 'none' });
      return;
    }
    if (this.data.projectDetail?.isArchived) {
      wx.showToast({ title: '项目已归档，请先取消归档', icon: 'none' });
      return;
    }
    wx.navigateTo({
      url: `/pages/project-editor/project-editor?id=${this.data.projectId}`,
    })
  },

  onManageProjectTap() {
    if (!this.data.isOwner) {
      wx.showToast({ title: '仅项目创建者可管理', icon: 'none' });
      return;
    }
    const isArchived = !!this.data.projectDetail?.isArchived;
    const itemList = isArchived
      ? ['取消归档', '分享管理', '删除项目']
      : ['编辑项目', '归档项目', '分享管理', '删除项目'];

    wx.showActionSheet({
      itemList,
      itemColor: '#1C1C1C',
      success: async (res) => {
        if (!isArchived && res.tapIndex === 0) {
          this.goToProjectEditor();
          return;
        }

        if ((isArchived && res.tapIndex === 0) || (!isArchived && res.tapIndex === 1)) {
          const nextArchived = isArchived ? 0 : 1;

          // 仅归档时需要确认提示，取消归档直接执行
          if (!isArchived) {
            wx.showModal({
              title: '确认归档',
              content: '归档后项目将进入只读状态，可稍后再取消归档恢复编辑。',
              confirmColor: '#2A4B3C',
              success: async (mRes) => {
                if (!mRes.confirm) return;
                await this.updateArchiveStatus(nextArchived);
              }
            });
            return;
          }

          await this.updateArchiveStatus(nextArchived);
          return;
        }

        const shareManageTapIndex = isArchived ? 1 : 2;
        if (res.tapIndex === shareManageTapIndex) {
          await this.openShareManagement();
          return;
        }

        const deleteTapIndex = isArchived ? 2 : 3;
        if (res.tapIndex === deleteTapIndex) {
          wx.showModal({
            title: '确认删除',
            content: '删除后无法恢复，确定要删除吗？',
            confirmColor: '#E53935',
            success: async (mRes) => {
              if (!mRes.confirm) return;
              await this.deleteCurrentProject();
            }
          });
        }
      }
    });
  },

  formatShareRow(share: any) {
    const created = share?.created_at
      ? new Date(share.created_at).toLocaleDateString('zh-CN')
      : '未知时间';
    const revoked = Number(share?.is_revoked) === 1;
    return `${created} | 访问${Number(share?.view_count || 0)}次 | ${revoked ? '已撤销' : '有效'}`;
  },

  async openShareManagement() {
    const projectId = String(this.data.projectId || '');
    if (!projectId) return;

    try {
      const shares = await request<any[]>({
        url: api.project.shares(projectId),
        method: 'GET',
        showLoading: false,
      });

      if (!shares || shares.length === 0) {
        wx.showToast({ title: '暂无分享记录', icon: 'none' });
        return;
      }

      wx.showActionSheet({
        itemList: shares.slice(0, 6).map((item) => this.formatShareRow(item)),
        success: async (res) => {
          const target = shares[res.tapIndex];
          if (!target) return;

          if (Number(target.is_revoked) === 1) {
            wx.showToast({ title: '该分享已撤销', icon: 'none' });
            return;
          }

          wx.showModal({
            title: '撤销分享',
            content: '撤销后该分享链接将立即失效，是否继续？',
            confirmColor: '#E53935',
            success: async (modalRes) => {
              if (!modalRes.confirm) return;
              await request({
                url: api.project.revokeShare(projectId, String(target.share_id)),
                method: 'PATCH' as any,
              });
              wx.showToast({ title: '已撤销', icon: 'success' });
            }
          });
        }
      });
    } catch (error) {
      wx.showToast({ title: '分享记录加载失败', icon: 'none' });
    }
  },

  async updateArchiveStatus(nextArchived: number) {
    const projectId = this.data.projectId as string;
    try {
      await request({
        url: api.project.update(projectId),
        method: 'PUT',
        data: { is_archived: nextArchived }
      });
      wx.showToast({ title: nextArchived === 1 ? '已归档' : '已取消归档', icon: 'success' });
      await this.fetchProjectDetail(projectId);
    } catch (e) {
      // utils/request 已自动弹出错误提示
    }
  },

  async deleteCurrentProject() {
    const projectId = this.data.projectId as string;
    try {
      await request({
        url: api.project.delete(projectId),
        method: 'DELETE'
      });
      wx.showToast({ title: '已删除', icon: 'success' });
      setTimeout(() => {
        wx.switchTab({ url: '/pages/index/index' });
      }, 300);
    } catch (e) {
      // utils/request 已自动弹出错误提示
    }
  },

  showMoreActions() {
    const itemList = this.data.isOwner 
      ? ['口令/二维码分享', '导出 PDF', '导出 HTML']
      : ['导出 PDF', '导出 HTML'];

    wx.showActionSheet({
      itemList,
      success: async (res) => {
        const tapIndex = res.tapIndex;
        if (this.data.isOwner) {
          if (tapIndex === 0) {
            this.onInternalShareTap();
            return;
          }
          if (tapIndex === 1) {
            await this.exportPdf();
            return;
          }
          if (tapIndex === 2) {
            await this.exportHtml();
          }
        } else {
          if (tapIndex === 0) {
            await this.exportPdf();
            return;
          }
          if (tapIndex === 1) {
            await this.exportHtml();
          }
        }
      }
    });
  },

  buildExportUrl(format: 'pdf' | 'html') {
    const projectId = this.data.projectId as string;
    const path = format === 'pdf' ? api.project.exportPdf(projectId) : api.project.exportHtml(projectId);
    return `${baseUrl}${path}`;
  },

  getAuthHeader(): Record<string, string> {
    const token = wx.getStorageSync('token');
    if (!token) return {};
    return { Authorization: `Bearer ${token}` };
  },

  async exportPdf() {
    const url = this.buildExportUrl('pdf');
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
      if (err && typeof err === 'object' && (err as any).code === 'CONTENT_REVIEW_BLOCKED') {
        showReviewBlockedModal('导出');
        await this.fetchProjectDetail(this.data.projectId as string);
        await this.fetchStats(this.data.projectId as string);
        return;
      }
      if (err && typeof err === 'object' && (err as any).code === 'CONTENT_REVIEW_PENDING') {
        showReviewPendingModal('导出');
        await this.fetchProjectDetail(this.data.projectId as string);
        await this.fetchStats(this.data.projectId as string);
        return;
      }
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

  async exportHtml() {
    const url = this.buildExportUrl('html');
    wx.showLoading({ title: '正在生成 HTML…', mask: true });

    try {
      const filePath = await saveRemoteBinaryToUserData(
        url,
        this.getAuthHeader(),
        'html',
        EXPORT_BINARY_TIMEOUT_MS
      );

      wx.hideLoading();
      wx.showModal({
        title: 'HTML导出成功',
        content: '文件已保存，是否立即打开预览？',
        confirmText: '打开',
        cancelText: '稍后',
        success: (modalRes) => {
          if (!modalRes.confirm) return;
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
      if (err && typeof err === 'object' && (err as any).code === 'CONTENT_REVIEW_BLOCKED') {
        showReviewBlockedModal('导出');
        await this.fetchProjectDetail(this.data.projectId as string);
        await this.fetchStats(this.data.projectId as string);
        return;
      }
      if (err && typeof err === 'object' && (err as any).code === 'CONTENT_REVIEW_PENDING') {
        showReviewPendingModal('导出');
        await this.fetchProjectDetail(this.data.projectId as string);
        await this.fetchStats(this.data.projectId as string);
        return;
      }
      const msg = err && typeof err === 'object' && 'message' in err
        ? String((err as Error).message)
        : '';
      wx.showToast({
        title: msg && msg.length < 20 ? msg : 'HTML导出失败',
        icon: 'none',
        duration: 2500
      });
      console.error('HTML export failed:', err);
    }
  }

})
