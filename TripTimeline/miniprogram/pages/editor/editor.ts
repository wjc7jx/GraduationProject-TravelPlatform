import { request, assetBaseUrl, asAbsoluteAssetUrl } from '../../utils/request';
import api from '../../utils/api';
import config from '../../utils/config';
import {
  searchTencentMapSuggestions,
  reverseGeocodeTencentMap,
  TencentMapSuggestion
} from '../../utils/tencentMap';
import { readAndParseExif } from '../../utils/exif';
import { uploadFileToQiniu } from '../../utils/qiniuUpload';
import { fetchProjectArchivedState, guardArchivedWrite } from '../../utils/projectArchive';

const MAX_BODY_TEXT_LENGTH = 2500;
const BODY_LIMIT_TOAST_INTERVAL = 1500;

Page({

  hasValidLocation(location: any) {
    const lat = Number(location?.lat);
    const lon = Number(location?.lon);
    return Boolean(
      location
      && Number.isFinite(lat)
      && Number.isFinite(lon)
      && Math.abs(lat) <= 90
      && Math.abs(lon) <= 180
      && !(lat === 0 && lon === 0)
    );
  },

  // 富文本编辑器上下文（由 onEditorReady 初始化）
  editorCtx: null as any,
  lastValidDelta: null as any,
  lastValidHtml: '',
  lastValidTextCount: 0,
  lastLimitToastAt: 0,
  isRestoringEditor: false,

  data: {
    projectId: '',
    contentId: '',
    isProjectArchived: false,
    isEditMode: false,
    existingLocationId: null as number | null,
    pageTitle: '新建记录',
    pageSubtitle: '手动填写为主，系统仅在识别到信息时自动填入表单',

    // 提交按钮状态
    submitStatus: 'idle' as 'idle' | 'loading' | 'success' | 'error',

    // 格式化状态
    formats: {} as any,
    htmlContent: '',
    bodyCount: 0,
    bodyLimit: MAX_BODY_TEXT_LENGTH,
    showAudioPanel: false,
    keyboardHeight: 0,

    // 默认媒体类型
    contentType: 'note',

    // 日期时间
    date: '',
    time: '',

    // 地点
    location: null as any,
    locationName: '',
    locationAddress: '',
    locationSearchKeyword: '',
    locationSuggestions: [] as TencentMapSuggestion[],
    isLocationSearching: false,
    locationMarker: [] as any[],
    autoFillHint: '',
    locationExpanded: false,
    locationEditedByUser: false,

    // 图片
    images: [] as string[], // 相对路径数组（用于提交，顺序即展示顺序）
    imagePreviews: [] as string[], // 绝对 URL 数组（用于展示/预览）
    isImageUploading: false,
    activeImageIndex: -1,
    isDraggingImage: false,

    // 音频
    audioFileName: '',
    audioUrl: '',
    audioValue: { url: '', name: '' } as { url: string; name: string },

    // 文字内容
    title: '',
    content: '',

    // 合规审核状态（仅编辑态有值）
    reviewFlagged: false,
    reviewReason: ''
  },

  onLoad(options: any) {
    if (options.projectId) {
      this.setData({ projectId: options.projectId });
    }
    if (options.contentId) {
      this.setData({
        contentId: options.contentId,
        isEditMode: true,
        pageTitle: '编辑记录',
        pageSubtitle: '修改当前记录后保存'
      });
    }
    const now = new Date();
    const pad = (n: number) => n < 10 ? '0' + n : n.toString();
    this.setData({
      date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
      time: `${pad(now.getHours())}:${pad(now.getMinutes())}`
    });

    if (this.data.isEditMode && this.data.projectId && this.data.contentId) {
      this.loadExistingContent(this.data.projectId, this.data.contentId);
    }

    wx.onKeyboardHeightChange((res) => {
      this.setData({ keyboardHeight: Math.max(0, res.height - 10) }); // Leave a little offset
    });
  },

  onEditorReady() {
    wx.createSelectorQuery().select('#editor').context((res) => {
      this.editorCtx = res.context;
      if (this.data.isEditMode && this.data.htmlContent) {
        this.editorCtx.setContents({
          html: this.data.htmlContent,
          success: () => {
            this.syncBodyCountFromEditor();
          }
        });
      } else {
        this.syncBodyCountFromEditor();
      }
    }).exec();
  },

  syncBodyCountFromEditor() {
    if (!this.editorCtx) return;
    this.editorCtx.getContents({
      success: (res: any) => {
        const text = res?.text || '';
        const html = res?.html || '';
        this.lastValidDelta = res?.delta || this.lastValidDelta;
        this.lastValidHtml = html;
        this.lastValidTextCount = text.length;
        this.setData({
          htmlContent: html,
          bodyCount: text.length
        });
      },
      fail: () => {}
    });
  },

  format(e: any) {
    if (!this.editorCtx) return;
    const { name, value } = e.target.dataset;
    this.editorCtx.format(name, value);
  },

  onEditorInput(e: any) {
    if (this.isRestoringEditor) {
      this.isRestoringEditor = false;
      return;
    }
    const html = e.detail?.html || '';
    const text = e.detail?.text || '';
    const textCount = text.length;
    if (textCount > MAX_BODY_TEXT_LENGTH) {
      const now = Date.now();
      if (now - this.lastLimitToastAt > BODY_LIMIT_TOAST_INTERVAL) {
        this.lastLimitToastAt = now;
        wx.showToast({ title: '正文已达到最大字数', icon: 'none' });
      }

      const safeDelta = this.lastValidDelta;
      const safeHtml = this.lastValidHtml;
      const safeCount = this.lastValidTextCount;
      if (this.editorCtx) {
        this.isRestoringEditor = true;
        if (safeDelta) {
          this.editorCtx.setContents({
            delta: safeDelta,
            success: () => {
              this.setData({ htmlContent: safeHtml, bodyCount: safeCount });
            }
          });
        } else {
          this.editorCtx.setContents({
            html: safeHtml,
            success: () => {
              this.setData({ htmlContent: safeHtml, bodyCount: safeCount });
            }
          });
        }
      } else {
        this.setData({ htmlContent: safeHtml, bodyCount: safeCount });
      }
      return;
    }

    this.lastValidDelta = e.detail?.delta || this.lastValidDelta;
    this.lastValidHtml = html;
    this.lastValidTextCount = textCount;
    this.setData({
      htmlContent: html,
      bodyCount: textCount
    });
  },

  onStatusChange(e: any) {
    const formats = e.detail;
    this.setData({ formats });
  },

  async onShow() {
    if (!this.data.projectId) return;
    try {
      const isProjectArchived = await fetchProjectArchivedState(this.data.projectId);
      this.setData({ isProjectArchived });
      if (isProjectArchived) {
        wx.showToast({ title: '项目已归档，请先取消归档', icon: 'none' });
        setTimeout(() => {
          wx.navigateBack({
            delta: 1,
            fail: () => {
              wx.switchTab({ url: '/pages/index/index' });
            }
          });
        }, 250);
      }
    } catch (error) {
      this.setData({ isProjectArchived: false });
    }
  },

  async loadExistingContent(projectId: string, contentId: string) {
    try {
      wx.showLoading({ title: '加载记录中...', mask: true });
      const list = await request<any[]>({
        url: api.content.list(projectId),
        method: 'GET'
      });
      const target = list.find((item) => `${item.content_id}` === `${contentId}`);
      if (!target) {
        wx.hideLoading();
        wx.showToast({ title: '记录不存在', icon: 'none' });
        return;
      }

      const payload = target.content_data || {};
      const location = target.location || null;
      const recordTime = new Date(target.record_time || target.created_at);
      const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);

      const audioUrl = payload.audio?.url || '';
      const rawHtml = payload.content || '';
      const normalizedFromField = this.normalizeImages(payload.images);
      const images = normalizedFromField.map((item) => item.rel);
      const imagePreviews = normalizedFromField.map((item) => item.abs);

      this.setData({
        title: payload.title || '',
        htmlContent: rawHtml,
        showAudioPanel: Boolean(audioUrl),
        date: Number.isNaN(recordTime.getTime()) ? this.data.date : `${recordTime.getFullYear()}-${pad(recordTime.getMonth() + 1)}-${pad(recordTime.getDate())}`,
        time: Number.isNaN(recordTime.getTime()) ? this.data.time : `${pad(recordTime.getHours())}:${pad(recordTime.getMinutes())}`,
        locationName: payload.location_text?.name || location?.name || '',
        locationAddress: payload.location_text?.address || location?.address || '',
        locationSearchKeyword: payload.location_text?.name || location?.name || '',
        location: location ? {
          name: location.name || '',
          address: location.address || '',
          lat: Number(location.latitude),
          lon: Number(location.longitude)
        } : null,
        existingLocationId: target.location_id || null,
        images,
        imagePreviews,
        audioUrl,
        audioFileName: payload.audio?.name || '',
        audioValue: audioUrl
          ? { url: audioUrl, name: payload.audio?.name || '音频文件' }
          : { url: '', name: '' },
        reviewFlagged: String(target.review_status || '') === 'flagged',
        reviewReason: String(target.review_reason || '')
      });

      // 初始化如果编辑器已 ready
      if (this.editorCtx && this.data.htmlContent) {
        this.editorCtx.setContents({
          html: this.data.htmlContent,
          success: () => {
            this.syncBodyCountFromEditor();
          }
        });
      }

      this.syncLocationMarker(this.data.location);
      wx.hideLoading();
    } catch (error) {
      wx.hideLoading();
      wx.showToast({ title: '加载记录失败', icon: 'none' });
    }
  },

  onUnload() {},

  bindDateChange(e: any) {
    this.setData({ date: e.detail.value });
  },

  bindTimeChange(e: any) {
    this.setData({ time: e.detail.value });
  },

  // 媒体类型 toggle：再次点击已选中项则取消（回到 note）
  onTypeToggle(e: any) {
    const type = e.currentTarget.dataset.type;
    if (!type) return;
    this.setData({ contentType: this.data.contentType === type ? 'note' : type });
  },

  toggleLocation() {
    this.setData({ locationExpanded: !this.data.locationExpanded });
  },

  onLocationSearchInput(e: WechatMiniprogram.Input) {
    this.setData({
      locationSearchKeyword: e.detail.value,
      locationSuggestions: [],
      locationEditedByUser: true
    });
  },

  onLocationNameInput(e: any) {
    const name = e.detail.value;
    const hasLocation = this.hasValidLocation(this.data.location);
    const nextLocation = hasLocation
      ? {
        ...this.data.location,
        name
      }
      : this.data.location;

    this.setData({
      locationName: name,
      location: nextLocation,
      locationEditedByUser: true
    });

    if (hasLocation) {
      this.syncLocationMarker(nextLocation);
    }
  },

  inferSuggestionRegion() {
    const text = `${this.data.locationAddress || ''} ${this.data.locationName || ''}`.trim();
    if (!text) return '全国';
    const cityMatch = text.match(/([^\s]+?(?:市|自治州|地区|盟))/);
    if (cityMatch?.[1]) return cityMatch[1];
    const provinceMatch = text.match(/([^\s]+?(?:省|自治区))/);
    return provinceMatch?.[1] || '全国';
  },

  async searchLocationByKeyword() {
    const keyword = (this.data.locationSearchKeyword || '').trim();
    if (!keyword) {
      wx.showToast({ title: '请输入地点名称', icon: 'none' });
      return;
    }

    const key = config.map?.tencentKey;
    if (!key) {
      wx.showToast({ title: '请先配置腾讯地图Key', icon: 'none' });
      return;
    }

    this.setData({ isLocationSearching: true });

    try {
      const current = this.data.location;
      const suggestions = await searchTencentMapSuggestions({
        key,
        keyword,
        region: this.inferSuggestionRegion(),
        latitude: Number(current?.lat),
        longitude: Number(current?.lon),
        pageSize: 12
      });

      this.setData({ locationSuggestions: suggestions });
      if (!suggestions.length) {
        wx.showToast({ title: '未找到匹配地点', icon: 'none' });
      }
    } catch (error) {
      wx.showToast({ title: '地点搜索失败', icon: 'none' });
    } finally {
      this.setData({ isLocationSearching: false });
    }
  },

  selectSuggestion(e: WechatMiniprogram.BaseEvent) {
    const index = Number(e.currentTarget.dataset.index);
    if (!Number.isFinite(index) || index < 0 || index >= this.data.locationSuggestions.length) return;

    const selected = this.data.locationSuggestions[index];
    const nextLocation = {
      name: selected.title,
      address: selected.address,
      lat: selected.latitude,
      lon: selected.longitude
    };

    this.setData({
      location: nextLocation,
      locationName: selected.title,
      locationAddress: selected.address,
      locationSearchKeyword: selected.title,
      autoFillHint: '已通过地点搜索填入坐标',
      locationSuggestions: [],
      locationEditedByUser: true
    });
    this.syncLocationMarker(nextLocation);
  },

  syncLocationMarker(location: any) {
    if (!location || !Number.isFinite(Number(location.lat)) || !Number.isFinite(Number(location.lon))) {
      this.setData({ locationMarker: [] });
      return;
    }

    this.setData({
      locationMarker: [{
        id: 1,
        latitude: Number(location.lat),
        longitude: Number(location.lon),
        title: location.name || this.data.locationName || '选中位置',
        width: 24,
        height: 24
      }]
    });
  },

  normalizeImages(input: any): Array<{ rel: string; abs: string }> {
    const strip = (u: string) => {
      if (!u) return '';
      return u.startsWith(assetBaseUrl) ? u.replace(assetBaseUrl, '') : u;
    };

    const toPair = (u: any) => {
      const rel = strip(String(u || '').trim());
      return rel ? { rel, abs: asAbsoluteAssetUrl(rel) } : null;
    };

    if (Array.isArray(input)) {
      return input.map(toPair).filter(Boolean) as any;
    }
    if (typeof input === 'string' && input.trim()) {
      try {
        const parsed = JSON.parse(input);
        if (Array.isArray(parsed)) {
          return parsed.map(toPair).filter(Boolean) as any;
        }
      } catch (e) {
        const single = toPair(input);
        return single ? [single] : [];
      }
    }
    return [];
  },

  async chooseImages() {
    if (this.data.isImageUploading) return;
    const remaining = 9 - (this.data.images?.length || 0);
    if (remaining <= 0) {
      wx.showToast({ title: '最多添加 9 张图片', icon: 'none' });
      return;
    }

    wx.chooseMedia({
      count: remaining,
      mediaType: ['image'],
      sizeType: ['original'],
      sourceType: ['album', 'camera'],
      success: async (res) => {
        const files = (res.tempFiles || []).map((f: any) => f.tempFilePath).filter(Boolean);
        if (!files.length) return;

        this.setData({ isImageUploading: true });
        try {
          wx.showLoading({ title: `上传中 0/${files.length}`, mask: true });
          const nextRels = [...(this.data.images || [])];
          const nextAbs = [...(this.data.imagePreviews || [])];

          for (let i = 0; i < files.length; i++) {
            wx.showLoading({ title: `上传中 ${i + 1}/${files.length}`, mask: true });
            const uploaded = await this.uploadPhoto(files[i]);
            const url = uploaded?.url || '';
            if (!url) continue;

            // 保存相对路径（提交用）与绝对 URL（预览用）
            const rel = url.startsWith(assetBaseUrl) ? url.replace(assetBaseUrl, '') : url;
            nextRels.push(rel);
            nextAbs.push(this.asAbsoluteUrl(rel));

            // 首张图尝试识别 EXIF 自动填充（不强制）
            if (i === 0) {
              try {
                const exif = await readAndParseExif(files[i]);
                await this.applyExifAutofill(exif);
              } catch (error) {
                // ignore
              }
            }
          }

          this.setData({
            images: nextRels.slice(0, 9),
            imagePreviews: nextAbs.slice(0, 9)
          });
        } catch (error) {
          wx.showToast({ title: '图片上传失败，请重试', icon: 'none' });
        } finally {
          wx.hideLoading();
          this.setData({ isImageUploading: false });
        }
      }
    });
  },

  removeImage(e: any) {
    const index = Number(e.currentTarget.dataset.index);
    if (!Number.isFinite(index)) return;
    const nextRels = [...(this.data.images || [])];
    const nextAbs = [...(this.data.imagePreviews || [])];
    if (index < 0 || index >= nextRels.length) return;
    nextRels.splice(index, 1);
    nextAbs.splice(index, 1);
    const nextActive = this.data.activeImageIndex === index ? -1 : this.data.activeImageIndex;
    this.setData({ images: nextRels, imagePreviews: nextAbs, activeImageIndex: nextActive });
  },

  swapImage(a: number, b: number) {
    const nextRels = [...(this.data.images || [])];
    const nextAbs = [...(this.data.imagePreviews || [])];
    if (a < 0 || b < 0 || a >= nextRels.length || b >= nextRels.length) return;
    [nextRels[a], nextRels[b]] = [nextRels[b], nextRels[a]];
    [nextAbs[a], nextAbs[b]] = [nextAbs[b], nextAbs[a]];
    this.setData({ images: nextRels, imagePreviews: nextAbs });
  },

  clearActiveImage() {
    if (this.data.activeImageIndex !== -1) {
      this.setData({ activeImageIndex: -1 });
    }
  },

  onImageItemTap(e: any) {
    const index = Number(e.currentTarget.dataset.index);
    if (!Number.isFinite(index)) return;
    this.setData({ activeImageIndex: index });
  },

  // --- Drag sort (3 columns grid) ---
  _imgDrag: {
    rects: [] as Array<{ left: number; right: number; top: number; bottom: number }>,
    currentIndex: -1,
    lastRectsAt: 0
  } as any,
  _isRefreshingImageRects: false,

  async refreshImageRects() {
    if (this._isRefreshingImageRects) return;
    this._isRefreshingImageRects = true;
    try {
      const rects = await new Promise<any[]>((resolve) => {
        wx.createSelectorQuery()
          .selectAll('.image-thumb-wrap')
          .boundingClientRect()
          .exec((res) => resolve(res?.[0] || []));
      });
      if (Array.isArray(rects) && rects.length) {
        this._imgDrag.rects = rects.map((r: any) => ({
          left: Number(r.left) || 0,
          right: Number(r.right) || 0,
          top: Number(r.top) || 0,
          bottom: Number(r.bottom) || 0
        }));
        this._imgDrag.lastRectsAt = Date.now();
      }
    } finally {
      this._isRefreshingImageRects = false;
    }
  },

  hitTestImageIndex(x: number, y: number) {
    const rects = this._imgDrag?.rects || [];
    for (let i = 0; i < rects.length; i++) {
      const r = rects[i];
      if (!r) continue;
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
        return i;
      }
    }
    return -1;
  },

  async onImageItemLongPress(e: any) {
    const index = Number(e.currentTarget.dataset.index);
    if (!Number.isFinite(index)) return;
    if ((this.data.images || []).length <= 1) return;

    this.setData({ activeImageIndex: index, isDraggingImage: true });

    await this.refreshImageRects();
    if (!Array.isArray(this._imgDrag?.rects) || this._imgDrag.rects.length <= 0) {
      this.setData({ isDraggingImage: false });
      return;
    }
    this._imgDrag.currentIndex = index;
    this._imgDrag.lastRectsAt = Date.now();
  },

  onImageItemTouchMove(e: any) {
    if (!this.data.isDraggingImage) return;
    const touch = e.touches?.[0];
    if (!touch) return;
    const len = (this.data.images || []).length;
    if (len <= 1) return;

    const cur = this._imgDrag.currentIndex;
    if (!Number.isFinite(cur) || cur < 0 || cur >= len) return;

    // rects 可能因为滚动/交换而过期，拖动中轻量刷新一次（最多 9 张，成本可控）
    if (Date.now() - (this._imgDrag?.lastRectsAt || 0) > 180) {
      this.refreshImageRects();
    }

    const hitIndex = this.hitTestImageIndex(touch.clientX, touch.clientY);
    if (hitIndex < 0 || hitIndex >= len) return; // 手指在 gap 上则不触发交换
    if (hitIndex === cur) return;

    this.swapImage(cur, hitIndex);
    this._imgDrag.currentIndex = hitIndex;
    this.setData({ activeImageIndex: hitIndex });
    setTimeout(() => this.refreshImageRects(), 0);
  },

  onImageItemTouchEnd() {
    if (!this.data.isDraggingImage) return;
    this.setData({ isDraggingImage: false });
  },

  toggleAudioPanel() {
    this.setData({ showAudioPanel: !this.data.showAudioPanel });
  },

  onAudioChange(e: any) {
    const { url, name } = e.detail as { url: string; name: string };
    this.setData({
      audioUrl: url,
      audioFileName: name,
      audioValue: { url, name }
    });
  },

  onAudioRemove() {
    this.setData({
      audioUrl: '',
      audioFileName: '',
      audioValue: { url: '', name: '' }
    });
  },

  asAbsoluteUrl(url: string) {
    return asAbsoluteAssetUrl(url);
  },

  onLocationAddressInput(e: any) {
    const address = e.detail.value;
    const hasLocation = this.hasValidLocation(this.data.location);
    this.setData({
      locationAddress: address,
      locationEditedByUser: true,
      location: hasLocation
        ? {
          ...this.data.location,
          address
        }
        : this.data.location
    });
  },

  async applyExifAutofill(exif: any) {
    if (!exif) return;
    let hint = '已识别图片信息并填入，可手动修改';

    if (exif.datetimeOriginal) {
      const parsed = this.toDateAndTime(exif.datetimeOriginal);
      if (parsed) {
        this.setData({ date: parsed.date, time: parsed.time });
      }
    }

    if (this.hasValidLocation({ lat: exif.latitude, lon: exif.longitude })) {
      const lat = Number(exif.latitude);
      const lon = Number(exif.longitude);
      const fallbackName = '图片识别定位';
      const fallbackAddress = `纬度 ${lat.toFixed(6)}，经度 ${lon.toFixed(6)}`;

      this.setData({
        location: {
          name: fallbackName,
          address: fallbackAddress,
          lat,
          lon
        },
        locationName: fallbackName,
        locationAddress: fallbackAddress,
        locationSearchKeyword: fallbackName,
        locationEditedByUser: false,
        locationExpanded: true
      });
      this.syncLocationMarker({
        name: fallbackName,
        address: fallbackAddress,
        lat,
        lon
      });

      try {
        const key = config.map?.tencentKey;
        if (!key) {
          this.setData({ autoFillHint: '已识别图片坐标，未配置腾讯地图Key，已使用坐标覆盖地点信息' });
          return;
        }

        const geocode = await reverseGeocodeTencentMap({
          key,
          latitude: lat,
          longitude: lon
        });

        if (!geocode) {
          this.setData({ autoFillHint: '已识别图片坐标，但未查到具体地点，已使用坐标覆盖地点信息' });
          return;
        }

        const locationName = geocode.title || fallbackName;
        const locationAddress = geocode.address || fallbackAddress;
        const nextLocation = {
          name: locationName,
          address: locationAddress,
          lat: geocode.latitude,
          lon: geocode.longitude
        };

        this.setData({
          location: nextLocation,
          locationName,
          locationAddress,
          locationSearchKeyword: locationName,
          autoFillHint: '已根据图片定位自动匹配地点，可手动调整'
        });
        this.syncLocationMarker(nextLocation);
        return;
      } catch (error) {
        this.setData({ autoFillHint: '已识别图片坐标，地点解析失败，已使用坐标覆盖地点信息' });
        return;
      }
    } else {
      hint = '图片无定位信息，已保留手动填写';
      this.setData({ autoFillHint: hint });
      return;
    }

    this.setData({ autoFillHint: hint });
  },

  toDateAndTime(input: string) {
    if (!input) return null;
    const normalized = input
      .replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3')
      .replace('T', ' ')
      .replace(/\.\d+Z?$/, '')
      .trim();
    const dateObj = new Date(normalized);
    if (Number.isNaN(dateObj.getTime())) return null;
    const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
    return {
      date: `${dateObj.getFullYear()}-${pad(dateObj.getMonth() + 1)}-${pad(dateObj.getDate())}`,
      time: `${pad(dateObj.getHours())}:${pad(dateObj.getMinutes())}`
    };
  },

  async uploadPhoto(filePath: string) {
    const filename = filePath.split('/').pop() || 'photo.jpg';
    return uploadFileToQiniu(filePath, { purpose: 'image', filename });
  },

  onTitleInput(e: any) {
    this.setData({ title: e.detail.value });
  },

  onContentInput(e: any) {
    this.setData({ content: e.detail.value });
  },

  async saveEntry() {
    if (this.data.submitStatus === 'loading') return;

    if (!guardArchivedWrite(!!this.data.isProjectArchived)) {
      return;
    }

    if (!this.data.title && !this.data.htmlContent && (!this.editorCtx) && !(this.data.images || []).length && !(this.data.showAudioPanel && this.data.audioUrl)) {
      wx.vibrateShort({ type: 'medium' });
      wx.showToast({ title: '请至少写下一点感受', icon: 'none' });
      return;
    }

    if (!this.data.projectId) {
      wx.showToast({ title: '未关联项目', icon: 'none' });
      return;
    }

    this.setData({ submitStatus: 'loading' });

    try {
      // 确保从组件中获取到最新的 html 内容
      let finalHtml = this.data.htmlContent || '';
      let textContent = '';
      if (this.editorCtx) {
        const contents = await new Promise<any>((resolve) => {
          this.editorCtx.getContents({
            success: (res: any) => resolve(res),
            fail: () => resolve({ html: this.data.htmlContent, text: '' })
          });
        });
        finalHtml = contents.html;
        textContent = contents.text || '';
      }

      const hasImages = (this.data.images || []).length > 0;
      const hasAudio = this.data.showAudioPanel && !!this.data.audioUrl;
      if (!this.data.title && !textContent.trim() && !hasImages && !hasAudio) {
        wx.vibrateShort({ type: 'medium' });
        wx.showToast({ title: '请至少写下一点感受或添加图片/音频', icon: 'none' });
        this.setData({ submitStatus: 'idle' });
        return;
      }

      const audioUrl = this.data.audioUrl;

      const logTime = `${this.data.date} ${this.data.time}:00`;

      const stripAssetUrl = (u: string) => {
        if (!u) return '';
        return u.startsWith(assetBaseUrl) ? u.replace(assetBaseUrl, '') : u;
      };

      const contentData: any = {
        title: this.data.title,
        content: finalHtml,
        location_text: {
          name: this.data.locationName,
          address: this.data.locationAddress
        }
      };

      const images = (this.data.images || []).map(stripAssetUrl).filter(Boolean).slice(0, 9);
      if (images.length) contentData.images = images;

      if (this.data.showAudioPanel && audioUrl) {
        contentData.audio = {
          name: this.data.audioFileName,
          url: stripAssetUrl(audioUrl)
        };
      }

      let inferredContentType = this.data.contentType;
      if (this.data.showAudioPanel && audioUrl) inferredContentType = 'audio';
      else if (images.length) inferredContentType = 'photo';
      else inferredContentType = 'note';

      const requestData: any = {
        content_type: inferredContentType,
        content_data: contentData,
        record_time: logTime
      };

      if (!this.data.isEditMode) {
        requestData.location = this.hasValidLocation(this.data.location) ? {
          latitude: this.data.location.lat,
          longitude: this.data.location.lon,
          name: this.data.locationName || this.data.location.name,
          address: this.data.locationAddress || this.data.location.address
        } : null;
      } else {
        // 编辑模式下也允许补充/更新坐标，否则 timeline-map 无法获得 location.latitude/longitude
        const hasLoc = this.hasValidLocation(this.data.location);
        const shouldSendLocation = hasLoc && (this.data.locationEditedByUser || !this.data.existingLocationId);
        if (shouldSendLocation) {
          requestData.location = {
            latitude: this.data.location.lat,
            longitude: this.data.location.lon,
            name: this.data.locationName || this.data.location.name,
            address: this.data.locationAddress || this.data.location.address
          };
        } else {
          requestData.location_id = this.data.existingLocationId;
        }
      }

      await request<any>({
        url: this.data.isEditMode
          ? api.content.update(this.data.projectId, this.data.contentId)
          : api.content.create(this.data.projectId),
        method: this.data.isEditMode ? 'PUT' : 'POST',
        data: requestData
      });

      this.setData({ submitStatus: 'success' });
      setTimeout(() => wx.navigateBack(), 1500);
    } catch (e) {
      this.setData({ submitStatus: 'error' });
      wx.vibrateShort({ type: 'medium' });
      setTimeout(() => this.setData({ submitStatus: 'idle' }), 2000);
    }
  }
});
