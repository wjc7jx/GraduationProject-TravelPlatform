import { request, baseUrl, assetBaseUrl, asAbsoluteAssetUrl } from '../../utils/request';
import api from '../../utils/api';
import config from '../../utils/config';
import { searchTencentMapSuggestions, TencentMapSuggestion } from '../../utils/tencentMap';

type VisibilityValue = 1 | 2 | 3;
type PrivacyMode = 'inherit' | 'custom';

function normalizeVisibility(value: any): VisibilityValue {
  const visibility = Number(value);
  if (visibility === 2 || visibility === 3) {
    return visibility;
  }
  return 1;
}

function visibilityLabel(visibility: VisibilityValue) {
  if (visibility === 2) return '好友可见';
  if (visibility === 3) return '公开';
  return '私密';
}

Page({
  recorderManager: null as any,
  recordTicker: 0 as any,
  recordStartMs: 0,

  data: {
    projectId: '',
    contentId: '',
    isEditMode: false,
    existingLocationId: null as number | null,
    pageTitle: '新建记录',
    pageSubtitle: '手动填写为主，系统仅在识别到信息时自动填入表单',

    // 提交按钮状态
    submitStatus: 'idle' as 'idle' | 'loading' | 'success' | 'error',

    // 内容类型：note（纯文字）/ photo / audio
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

    // 图片
    imagePath: '',
    imageUrl: '',

    // 音频
    audioFileName: '',
    audioPath: '',
    audioUrl: '',
    audioPreviewSrc: '',
    isRecording: false,
    recordingSeconds: 0,

    // 文字内容
    title: '',
    content: '',

    // 隐私配置
    privacyMode: 'inherit' as PrivacyMode,
    visibilityOptions: ['私密（仅自己可见）', '好友可见（自动基于好友关系）', '公开（登录用户可见）'],
    privacyVisibility: 1 as VisibilityValue,
    privacyVisibilityIndex: 0,
    privacySummary: '当前继承项目策略：私密'
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

    this.initRecorder();

    if (this.data.isEditMode && this.data.projectId && this.data.contentId) {
      this.loadExistingContent(this.data.projectId, this.data.contentId);
      this.loadContentPrivacy(this.data.projectId, this.data.contentId);
    } else if (this.data.projectId) {
      this.loadProjectPrivacy(this.data.projectId);
    }
  },

  buildPrivacySummary(mode: PrivacyMode, visibility: VisibilityValue, inheritedLabel?: string) {
    if (mode === 'inherit') {
      const label = inheritedLabel || visibilityLabel(visibility);
      return `当前继承项目策略：${label}`;
    }
    return `当前单独设置：${visibilityLabel(visibility)}`;
  },

  async loadProjectPrivacy(projectId: string) {
    try {
      const rule = await request<any>({
        url: api.project.privacy(projectId),
        method: 'GET',
        showLoading: false
      });
      const visibility = normalizeVisibility(rule?.visibility);
      this.setData({
        privacyMode: 'inherit',
        privacyVisibility: visibility,
        privacyVisibilityIndex: visibility - 1,
        privacySummary: this.buildPrivacySummary('inherit', visibility)
      });
    } catch (error) {
      this.setData({ privacySummary: this.buildPrivacySummary('inherit', 1) });
    }
  },

  async loadContentPrivacy(projectId: string, contentId: string) {
    try {
      const privacy = await request<any>({
        url: api.content.privacy(projectId, contentId),
        method: 'GET',
        showLoading: false
      });

      const inherited = Boolean(privacy?.inherited);
      const effectiveRule = privacy?.effective_rule || {};
      const projectRule = privacy?.project_rule || {};
      const visibility = normalizeVisibility(effectiveRule.visibility);
      const inheritedVisibility = normalizeVisibility(projectRule.visibility || visibility);

      this.setData({
        privacyMode: inherited ? 'inherit' : 'custom',
        privacyVisibility: visibility,
        privacyVisibilityIndex: visibility - 1,
        privacySummary: this.buildPrivacySummary(
          inherited ? 'inherit' : 'custom',
          inherited ? inheritedVisibility : visibility,
          visibilityLabel(inheritedVisibility)
        )
      });
    } catch (error) {
      this.loadProjectPrivacy(projectId);
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

      const imageUrl = Array.isArray(payload.images) ? (payload.images[0] || '') : '';
      const audioUrl = payload.audio?.url || '';

      // 确定 contentType（忽略已废弃的 track 类型）
      let contentType = target.content_type || 'note';
      if (contentType === 'track') contentType = 'note';

      this.setData({
        contentType,
        title: payload.title || '',
        content: payload.content || '',
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
        imageUrl,
        imagePath: imageUrl ? this.asAbsoluteUrl(imageUrl) : '',
        audioUrl,
        audioPath: audioUrl ? this.asAbsoluteUrl(audioUrl) : '',
        audioFileName: payload.audio?.name || '',
        audioPreviewSrc: audioUrl ? this.asAbsoluteUrl(audioUrl) : ''
      });

      this.syncLocationMarker(this.data.location);
      wx.hideLoading();
    } catch (error) {
      wx.hideLoading();
      wx.showToast({ title: '加载记录失败', icon: 'none' });
    }
  },

  onUnload() {
    if (this.recordTicker) {
      clearInterval(this.recordTicker);
      this.recordTicker = 0;
    }
    if (this.data.isRecording && this.recorderManager) {
      this.recorderManager.stop();
    }
  },

  initRecorder() {
    this.recorderManager = wx.getRecorderManager();

    this.recorderManager.onStop(async (res: any) => {
      if (this.recordTicker) {
        clearInterval(this.recordTicker);
        this.recordTicker = 0;
      }

      const filename = `record-${Date.now()}.mp3`;
      this.setData({
        isRecording: false,
        audioPath: res.tempFilePath,
        audioFileName: filename,
        audioPreviewSrc: res.tempFilePath
      });

      try {
        wx.showLoading({ title: '上传音频中...', mask: true });
        const uploaded = await this.uploadFile(res.tempFilePath, api.upload);
        wx.hideLoading();
        this.setData({
          audioUrl: uploaded?.url || '',
          audioPreviewSrc: uploaded?.url ? this.asAbsoluteUrl(uploaded.url) : res.tempFilePath
        });
        wx.showToast({ title: '录音已保存', icon: 'success' });
      } catch (error) {
        wx.hideLoading();
        wx.showToast({ title: '上传失败，保存时重试', icon: 'none' });
      }
    });

    this.recorderManager.onError(() => {
      if (this.recordTicker) {
        clearInterval(this.recordTicker);
        this.recordTicker = 0;
      }
      this.setData({ isRecording: false });
      wx.showToast({ title: '录音失败', icon: 'none' });
    });
  },

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

  onPrivacyModeChange(e: WechatMiniprogram.BaseEvent) {
    const mode = e.currentTarget.dataset.mode as PrivacyMode;
    if (mode !== 'inherit' && mode !== 'custom') return;
    this.setData({
      privacyMode: mode,
      privacySummary: this.buildPrivacySummary(mode, this.data.privacyVisibility)
    });
  },

  onPrivacyVisibilityChange(e: any) {
    const index = Number(e.detail.value);
    const visibility = normalizeVisibility(index + 1);
    this.setData({
      privacyVisibility: visibility,
      privacyVisibilityIndex: visibility - 1,
      privacySummary: this.buildPrivacySummary(this.data.privacyMode, visibility)
    });
  },

  chooseLocation() {
    wx.chooseLocation({
      success: (res) => {
        const nextLocation = {
          name: res.name || res.address,
          address: res.address || '',
          lat: res.latitude,
          lon: res.longitude
        };
        this.setData({
          location: nextLocation,
          locationName: res.name || res.address || this.data.locationName,
          locationAddress: res.address || this.data.locationAddress,
          locationSearchKeyword: res.name || res.address || this.data.locationSearchKeyword,
          locationSuggestions: []
        });
        this.syncLocationMarker(nextLocation);
      },
      fail: () => {}
    });
  },

  onLocationSearchInput(e: WechatMiniprogram.Input) {
    this.setData({
      locationSearchKeyword: e.detail.value,
      locationSuggestions: []
    });
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
      locationSuggestions: []
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

  chooseImage() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sizeType: ['original'],
      sourceType: ['album', 'camera'],
      success: async (res) => {
        const path = res.tempFiles[0].tempFilePath;
        this.setData({ imagePath: path, contentType: 'photo' });

        try {
          const parsed = await this.uploadPhotoAndParse(path);
          this.applyExifAutofill(parsed?.exif || null);
        } catch (error) {
          wx.showToast({ title: '图片上传失败', icon: 'none' });
        }
      }
    });
  },

  chooseAudio() {
    (wx as any).chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['mp3', 'm4a', 'wav', 'aac'],
      success: async (res: any) => {
        const file = res.tempFiles?.[0];
        if (!file) return;

        this.setData({
          contentType: 'audio',
          audioPath: file.path,
          audioFileName: file.name || 'audio',
          audioPreviewSrc: file.path
        });

        try {
          const uploaded = await this.uploadFile(file.path, api.upload);
          this.setData({
            audioUrl: uploaded?.url || '',
            audioPreviewSrc: uploaded?.url ? this.asAbsoluteUrl(uploaded.url) : file.path
          });
        } catch (error) {
          wx.showToast({ title: '音频上传失败', icon: 'none' });
        }
      }
    });
  },

  async startRecordAudio() {
    if (this.data.isRecording) return;

    try {
      await new Promise<void>((resolve, reject) => {
        wx.authorize({
          scope: 'scope.record',
          success: () => resolve(),
          fail: () => reject(new Error('no auth'))
        });
      });
    } catch (error) {
      wx.showModal({
        title: '需要麦克风权限',
        content: '请在设置中允许录音权限后重试',
        showCancel: true,
        success: (res) => {
          if (res.confirm) wx.openSetting({});
        }
      });
      return;
    }

    this.setData({ contentType: 'audio', isRecording: true, recordingSeconds: 0 });
    this.recordStartMs = Date.now();

    if (this.recordTicker) clearInterval(this.recordTicker);

    this.recordTicker = setInterval(() => {
      const passed = Math.floor((Date.now() - this.recordStartMs) / 1000);
      this.setData({ recordingSeconds: passed });
      if (passed >= 60) this.stopRecordAudio();
    }, 500);

    this.recorderManager.start({
      duration: 60000,
      sampleRate: 44100,
      numberOfChannels: 1,
      encodeBitRate: 96000,
      format: 'mp3'
    });
  },

  stopRecordAudio() {
    if (!this.data.isRecording || !this.recorderManager) return;
    this.recorderManager.stop();
  },

  asAbsoluteUrl(url: string) {
    return asAbsoluteAssetUrl(url);
  },

  onLocationNameInput(e: any) {
    this.setData({ locationName: e.detail.value });
  },

  onLocationAddressInput(e: any) {
    this.setData({ locationAddress: e.detail.value });
  },

  applyExifAutofill(exif: any) {
    if (!exif) return;
    let hint = '已识别图片信息并填入，可手动修改';

    if (exif.datetimeOriginal) {
      const parsed = this.toDateAndTime(exif.datetimeOriginal);
      if (parsed) {
        this.setData({ date: parsed.date, time: parsed.time });
      }
    }

    if (exif.latitude && exif.longitude) {
      this.setData({
        location: {
          name: this.data.locationName || '图片识别定位',
          address: this.data.locationAddress || '',
          lat: exif.latitude,
          lon: exif.longitude
        },
        locationName: this.data.locationName || '图片识别定位',
        locationSearchKeyword: this.data.locationName || '图片识别定位',
        locationExpanded: true
      });
      this.syncLocationMarker({
        name: this.data.locationName || '图片识别定位',
        address: this.data.locationAddress || '',
        lat: exif.latitude,
        lon: exif.longitude
      });
    } else {
      hint = '图片无定位信息，已保留手动填写';
    }

    this.setData({ autoFillHint: hint });
  },

  toDateAndTime(input: string) {
    const dateObj = new Date(input);
    if (Number.isNaN(dateObj.getTime())) return null;
    const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
    return {
      date: `${dateObj.getFullYear()}-${pad(dateObj.getMonth() + 1)}-${pad(dateObj.getDate())}`,
      time: `${pad(dateObj.getHours())}:${pad(dateObj.getMinutes())}`
    };
  },

  uploadFile(filePath: string, path: string): Promise<any> {
    return new Promise((resolve, reject) => {
      wx.uploadFile({
        url: `${baseUrl}${path}`,
        filePath,
        name: 'file',
        header: { Authorization: `Bearer ${wx.getStorageSync('token')}` },
        success(res) {
          try {
            if (res.statusCode < 200 || res.statusCode >= 300) {
              reject(new Error(`上传失败: ${res.statusCode}`));
              return;
            }
            const parsed = JSON.parse(res.data);
            const payload = parsed && typeof parsed === 'object' && parsed.data !== undefined
              ? parsed.data
              : parsed;
            resolve(payload);
          } catch (error) {
            reject(error);
          }
        },
        fail(err) { reject(err); }
      });
    });
  },

  async uploadPhotoAndParse(filePath: string) {
    const data = await this.uploadFile(filePath, `${api.upload}/photo`);
    this.setData({ imageUrl: data?.url || '' });
    return data;
  },

  removeImage() {
    this.setData({ imagePath: '', imageUrl: '', autoFillHint: '' });
  },

  onTitleInput(e: any) {
    this.setData({ title: e.detail.value });
  },

  onContentInput(e: any) {
    this.setData({ content: e.detail.value });
  },

  async saveEntry() {
    if (this.data.submitStatus === 'loading') return;

    if (!this.data.title && !this.data.content) {
      wx.vibrateShort({ type: 'medium' });
      wx.showToast({ title: '请至少写下一点感受', icon: 'none' });
      return;
    }

    if (!this.data.projectId) {
      wx.showToast({ title: '未关联项目', icon: 'none' });
      return;
    }

    if (this.data.contentType === 'photo' && !this.data.imagePath) {
      wx.showToast({ title: '请先选择图片', icon: 'none' });
      return;
    }

    if (this.data.contentType === 'audio' && !this.data.audioPath) {
      wx.showToast({ title: '请先选择音频', icon: 'none' });
      return;
    }

    this.setData({ submitStatus: 'loading' });

    try {
      let imageUrl = this.data.imageUrl;
      let audioUrl = this.data.audioUrl;

      if (this.data.contentType === 'photo' && !imageUrl && this.data.imagePath) {
        const uploaded = await this.uploadPhotoAndParse(this.data.imagePath);
        imageUrl = uploaded?.url || '';
        this.applyExifAutofill(uploaded?.exif || null);
      }

      if (this.data.contentType === 'audio' && !audioUrl && this.data.audioPath) {
        const uploaded = await this.uploadFile(this.data.audioPath, api.upload);
        audioUrl = uploaded?.url || '';
        this.setData({ audioPreviewSrc: audioUrl ? this.asAbsoluteUrl(audioUrl) : this.data.audioPath });
      }

      const logTime = `${this.data.date} ${this.data.time}:00`;

      const stripAssetUrl = (u: string) => {
        if (!u) return '';
        return u.startsWith(assetBaseUrl) ? u.replace(assetBaseUrl, '') : u;
      };

      const contentData: any = {
        title: this.data.title,
        content: this.data.content,
        location_text: {
          name: this.data.locationName,
          address: this.data.locationAddress
        }
      };

      if (this.data.contentType === 'photo') {
        contentData.images = imageUrl ? [stripAssetUrl(imageUrl)] : [];
      }

      if (this.data.contentType === 'audio') {
        contentData.audio = {
          name: this.data.audioFileName,
          url: stripAssetUrl(audioUrl)
        };
      }

      const requestData: any = {
        content_type: this.data.contentType,
        content_data: contentData,
        record_time: logTime
      };

      if (!this.data.isEditMode) {
        requestData.location = this.data.location && this.data.location.lat && this.data.location.lon ? {
          latitude: this.data.location.lat,
          longitude: this.data.location.lon,
          name: this.data.locationName || this.data.location.name,
          address: this.data.locationAddress || this.data.location.address
        } : null;
      } else {
        requestData.location_id = this.data.existingLocationId;
      }

      const saved = await request<any>({
        url: this.data.isEditMode
          ? api.content.update(this.data.projectId, this.data.contentId)
          : api.content.create(this.data.projectId),
        method: this.data.isEditMode ? 'PUT' : 'POST',
        data: requestData
      });

      const targetContentId = this.data.isEditMode
        ? this.data.contentId
        : `${saved?.content_id || ''}`;

      if (!targetContentId) throw new Error('内容ID缺失，无法保存隐私配置');

      if (this.data.privacyMode === 'custom') {
        await request({
          url: api.content.privacy(this.data.projectId, targetContentId),
          method: 'PUT',
          data: { visibility: this.data.privacyVisibility, white_list: [] },
          showLoading: false
        });
      } else if (this.data.isEditMode) {
        await request({
          url: api.content.privacy(this.data.projectId, targetContentId),
          method: 'DELETE',
          showLoading: false
        });
      }

      this.setData({ submitStatus: 'success' });
      setTimeout(() => wx.navigateBack(), 1500);

    } catch (e) {
      this.setData({ submitStatus: 'error' });
      wx.vibrateShort({ type: 'medium' });
      setTimeout(() => this.setData({ submitStatus: 'idle' }), 2000);
    }
  }
});
