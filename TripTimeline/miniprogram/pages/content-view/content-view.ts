import { request, asAbsoluteAssetUrl } from '../../utils/request';
import api from '../../utils/api';
import { fetchProjectArchivedState, guardArchivedWrite } from '../../utils/projectArchive';

Page({
  lastTapAt: 0,

  data: {
    projectId: '',
    contentId: '',
    isProjectArchived: false,
    loading: true,
    typeLabel: '',
    title: '',
    content: '',
    dateText: '',
    timeText: '',
    locationName: '',
    locationAddress: '',
    images: [] as string[],
    audioUrl: ''
  },

  onLoad(options: any) {
    this.setData({
      projectId: options.projectId || '',
      contentId: options.contentId || ''
    });
  },

  async onShow() {
    if (!this.data.projectId || !this.data.contentId) {
      wx.showToast({ title: '参数缺失', icon: 'none' });
      return;
    }
    try {
      const isProjectArchived = await fetchProjectArchivedState(this.data.projectId);
      this.setData({ isProjectArchived });
    } catch (e) {
      this.setData({ isProjectArchived: false });
    }
    this.fetchContent();
  },

  async fetchContent() {
    this.setData({ loading: true });
    try {
      const list = await request<any[]>({
        url: api.content.list(this.data.projectId),
        method: 'GET'
      });
      const target = list.find((item) => `${item.content_id}` === `${this.data.contentId}`);
      if (!target) {
        wx.showToast({ title: '记录不存在', icon: 'none' });
        this.setData({ loading: false });
        return;
      }

      const payload = target.content_data || {};
      const rawContent = payload.content || '';
      const images = this.mergeImages(payload.images, rawContent);
      const sanitizedContent = images.length ? rawContent.replace(/<img[^>]*>/gi, '') : rawContent;
      const recordDate = new Date(target.record_time || target.created_at);
      const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
      const dateText = Number.isNaN(recordDate.getTime())
        ? '--'
        : `${recordDate.getFullYear()}-${pad(recordDate.getMonth() + 1)}-${pad(recordDate.getDate())}`;
      const timeText = Number.isNaN(recordDate.getTime())
        ? '--:--'
        : `${pad(recordDate.getHours())}:${pad(recordDate.getMinutes())}`;

      const location = target.location || {};
      const locationText = payload.location_text || {};
      const typeLabelMap: Record<string, string> = {
        note: '文字',
        photo: '图片',
        audio: '音频'
      };

      this.setData({
        loading: false,
        typeLabel: typeLabelMap[target.content_type] || '记录',
        title: payload.title || '未命名记录',
        content: sanitizedContent,
        dateText,
        timeText,
        locationName: locationText.name || location.name || '',
        locationAddress: locationText.address || location.address || '',
        images,
        audioUrl: payload.audio?.url ? this.asAbsoluteUrl(payload.audio.url) : ''
      });
    } catch (e) {
      this.setData({ loading: false });
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  normalizeImages(input: any): string[] {
    if (Array.isArray(input)) {
      return input.filter(Boolean).map((item) => this.asAbsoluteUrl(String(item)));
    }
    if (typeof input === 'string' && input.trim()) {
      try {
        const parsed = JSON.parse(input);
        if (Array.isArray(parsed)) {
          return parsed.filter(Boolean).map((item: any) => this.asAbsoluteUrl(String(item)));
        }
      } catch (e) {
        return [this.asAbsoluteUrl(input)];
      }
    }
    return [];
  },

  extractImagesFromHtml(html: string): string[] {
    if (!html) return [];
    const urls: string[] = [];
    const re = /<img[^>]+src=(?:"([^">]+)"|'([^'>]+)'|([^>\s]+))/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html))) {
      const src = (m[1] || m[2] || m[3] || '').trim();
      if (src) urls.push(src);
    }
    return urls;
  },

  mergeImages(imagesField: any, html: string): string[] {
    const fromField = this.normalizeImages(imagesField);
    if (fromField.length) return fromField;
    const fromHtml = this.extractImagesFromHtml(html);
    if (!fromHtml.length) return [];
    return fromHtml.map((u) => this.asAbsoluteUrl(u));
  },

  asAbsoluteUrl(url: string) {
    return asAbsoluteAssetUrl(url);
  },

  onRecordTap() {
    if (this.data.isProjectArchived) {
      return;
    }
    const now = Date.now();
    if (now - this.lastTapAt < 280) {
      this.goToEdit();
      this.lastTapAt = 0;
      return;
    }
    this.lastTapAt = now;
  },

  goToEdit() {
    if (!guardArchivedWrite(!!this.data.isProjectArchived)) {
      return;
    }
    wx.navigateTo({
      url: `/pages/editor/editor?projectId=${this.data.projectId}&contentId=${this.data.contentId}`
    });
  }
});
