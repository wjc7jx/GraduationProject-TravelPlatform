import { request, asAbsoluteAssetUrl } from '../../utils/request';
import api from '../../utils/api';

Page({
  lastTapAt: 0,

  data: {
    projectId: '',
    contentId: '',
    loading: true,
    typeLabel: '',
    title: '',
    content: '',
    dateText: '',
    timeText: '',
    locationName: '',
    locationAddress: '',
    images: [] as string[],
    audioUrl: '',
    trackGeojson: null as any,
    trackPointCount: 0,
    trackPolyline: [] as any[],
    trackMarkers: [] as any[],
    trackCenterLatitude: 39.9042,
    trackCenterLongitude: 116.4074
  },

  onLoad(options: any) {
    this.setData({
      projectId: options.projectId || '',
      contentId: options.contentId || ''
    });
  },

  onShow() {
    if (!this.data.projectId || !this.data.contentId) {
      wx.showToast({ title: '参数缺失', icon: 'none' });
      return;
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
      const images = this.normalizeImages(payload.images);
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
        audio: '音频',
        track: '轨迹'
      };

      const trackGeojson = payload.track?.geojson || null;

      this.setData({
        loading: false,
        typeLabel: typeLabelMap[target.content_type] || '记录',
        title: payload.title || '未命名记录',
        content: payload.content || '',
        dateText,
        timeText,
        locationName: locationText.name || location.name || '',
        locationAddress: locationText.address || location.address || '',
        images,
        audioUrl: payload.audio?.url ? this.asAbsoluteUrl(payload.audio.url) : '',
        trackGeojson
      });

      this.updateTrackPreview(trackGeojson);
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

  asAbsoluteUrl(url: string) {
    return asAbsoluteAssetUrl(url);
  },

  updateTrackPreview(geojson: any) {
    const points = this.extractTrackPoints(geojson);
    if (!points.length) {
      this.setData({
        trackPointCount: 0,
        trackPolyline: [],
        trackMarkers: []
      });
      return;
    }

    const first = points[0];
    const last = points[points.length - 1];

    this.setData({
      trackPointCount: points.length,
      trackCenterLatitude: first.latitude,
      trackCenterLongitude: first.longitude,
      trackPolyline: [
        {
          points,
          color: '#1f7a56',
          width: 6
        }
      ],
      trackMarkers: [
        {
          id: 1,
          latitude: first.latitude,
          longitude: first.longitude,
          title: '起点',
          width: 24,
          height: 24
        },
        {
          id: 2,
          latitude: last.latitude,
          longitude: last.longitude,
          title: '终点',
          width: 24,
          height: 24
        }
      ]
    });
  },

  extractTrackPoints(geojson: any) {
    if (!geojson?.features?.length) return [];
    const points: Array<{ latitude: number; longitude: number }> = [];

    geojson.features.forEach((feature: any) => {
      const geometry = feature?.geometry;
      if (!geometry) return;

      if (geometry.type === 'LineString' && Array.isArray(geometry.coordinates)) {
        geometry.coordinates.forEach((coord: any) => {
          if (Array.isArray(coord) && coord.length >= 2) {
            points.push({ latitude: Number(coord[1]), longitude: Number(coord[0]) });
          }
        });
      }

      if (geometry.type === 'MultiLineString' && Array.isArray(geometry.coordinates)) {
        geometry.coordinates.forEach((line: any) => {
          if (!Array.isArray(line)) return;
          line.forEach((coord: any) => {
            if (Array.isArray(coord) && coord.length >= 2) {
              points.push({ latitude: Number(coord[1]), longitude: Number(coord[0]) });
            }
          });
        });
      }

      if (geometry.type === 'Point' && Array.isArray(geometry.coordinates) && geometry.coordinates.length >= 2) {
        points.push({ latitude: Number(geometry.coordinates[1]), longitude: Number(geometry.coordinates[0]) });
      }
    });

    return points.filter((p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude)).slice(0, 800);
  },

  onRecordTap() {
    const now = Date.now();
    if (now - this.lastTapAt < 280) {
      this.goToEdit();
      this.lastTapAt = 0;
      return;
    }
    this.lastTapAt = now;
  },

  goToEdit() {
    wx.navigateTo({
      url: `/pages/editor/editor?projectId=${this.data.projectId}&contentId=${this.data.contentId}`
    });
  }
});
