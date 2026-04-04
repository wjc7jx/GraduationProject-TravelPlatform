import { request, baseUrl } from '../../utils/request';
import api from '../../utils/api';

Page({
  data: {
    projectId: '',
    contentType: 'note',
    date: '',
    time: '',
    location: null as any,
    locationName: '',
    locationAddress: '',
    autoFillHint: '',
    imagePath: '',
    imageUrl: '',
    audioFileName: '',
    audioPath: '',
    audioUrl: '',
    trackFileName: '',
    trackPath: '',
    trackUrl: '',
    trackGeojson: null as any,
    title: '',
    content: ''
  },

  onLoad(options: any) {
    if (options.projectId) {
      this.setData({ projectId: options.projectId });
    }
    const now = new Date();
    const pad = (n: number) => n < 10 ? '0' + n : n.toString();
    this.setData({
      date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
      time: `${pad(now.getHours())}:${pad(now.getMinutes())}`
    });
  },

  bindDateChange(e: any) {
    this.setData({ date: e.detail.value });
  },

  bindTimeChange(e: any) {
    this.setData({ time: e.detail.value });
  },

  onTypeChange(e: any) {
    const type = e.currentTarget.dataset.type;
    if (!type) return;
    this.setData({ contentType: type });
  },

  chooseLocation() {
    wx.chooseLocation({
      success: (res) => {
        this.setData({
          location: {
            name: res.name || res.address,
            address: res.address || '',
            lat: res.latitude,
            lon: res.longitude
          },
          locationName: res.name || res.address || this.data.locationName,
          locationAddress: res.address || this.data.locationAddress
        });
      },
      fail: () => {
        // 用户取消或未授权
      }
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
        this.setData({
          imagePath: path,
          contentType: 'photo'
        });

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
          audioFileName: file.name || 'audio'
        });

        try {
          const uploaded = await this.uploadFile(file.path, api.upload);
          this.setData({ audioUrl: uploaded?.url || '' });
        } catch (error) {
          wx.showToast({ title: '音频上传失败', icon: 'none' });
        }
      }
    });
  },

  chooseTrack() {
    (wx as any).chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['gpx', 'kml'],
      success: async (res: any) => {
        const file = res.tempFiles?.[0];
        if (!file) return;

        this.setData({
          contentType: 'track',
          trackPath: file.path,
          trackFileName: file.name || 'track'
        });

        try {
          const uploaded = await this.uploadFile(file.path, `${api.upload}/trajectory`);
          this.setData({
            trackUrl: uploaded?.url || '',
            trackGeojson: uploaded?.geojson || null
          });
        } catch (error) {
          wx.showToast({ title: '轨迹上传失败', icon: 'none' });
        }
      }
    });
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
        locationName: this.data.locationName || '图片识别定位'
      });
    } else {
      hint = '图片无定位信息，已保留手动填写';
    }

    this.setData({ autoFillHint: hint });
  },

  toDateAndTime(input: string) {
    const dateObj = new Date(input);
    if (Number.isNaN(dateObj.getTime())) {
      return null;
    }
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
        header: {
          Authorization: `Bearer ${wx.getStorageSync('token')}`
        },
        success(res) {
          try {
            resolve(JSON.parse(res.data));
          } catch (error) {
            reject(error);
          }
        },
        fail(err) {
          reject(err);
        }
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
    if (!this.data.title && !this.data.content) {
      wx.showToast({ title: '请至少填写标题或正文', icon: 'none' });
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

    if (this.data.contentType === 'track' && !this.data.trackPath) {
      wx.showToast({ title: '请先导入轨迹', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '保存中...', mask: true });

    try {
      let imageUrl = this.data.imageUrl;
      let audioUrl = this.data.audioUrl;
      let trackUrl = this.data.trackUrl;

      if (this.data.contentType === 'photo' && !imageUrl && this.data.imagePath) {
        const uploaded = await this.uploadPhotoAndParse(this.data.imagePath);
        imageUrl = uploaded?.url || '';
        this.applyExifAutofill(uploaded?.exif || null);
      }

      if (this.data.contentType === 'audio' && !audioUrl && this.data.audioPath) {
        const uploaded = await this.uploadFile(this.data.audioPath, api.upload);
        audioUrl = uploaded?.url || '';
      }

      if (this.data.contentType === 'track' && !trackUrl && this.data.trackPath) {
        const uploaded = await this.uploadFile(this.data.trackPath, `${api.upload}/trajectory`);
        trackUrl = uploaded?.url || '';
        this.setData({ trackGeojson: uploaded?.geojson || null });
      }

      const logTime = `${this.data.date} ${this.data.time}:00`;

      const contentData: any = {
        title: this.data.title,
        content: this.data.content,
        location_text: {
          name: this.data.locationName,
          address: this.data.locationAddress
        }
      };

      if (this.data.contentType === 'photo') {
        contentData.images = imageUrl ? [imageUrl] : [];
      }

      if (this.data.contentType === 'audio') {
        contentData.audio = {
          name: this.data.audioFileName,
          url: audioUrl
        };
      }

      if (this.data.contentType === 'track') {
        contentData.track = {
          file_name: this.data.trackFileName,
          url: trackUrl,
          geojson: this.data.trackGeojson
        };
      }

      await request({
        url: api.content.create(this.data.projectId),
        method: 'POST',
        data: {
          content_type: this.data.contentType,
          content_data: contentData,
          record_time: logTime,
          location: this.data.location && this.data.location.lat && this.data.location.lon ? {
            latitude: this.data.location.lat,
            longitude: this.data.location.lon,
            name: this.data.locationName || this.data.location.name,
            address: this.data.locationAddress || this.data.location.address
          } : null
        }
      });

      wx.hideLoading();
      wx.showToast({ title: '保存成功', icon: 'success' });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);

    } catch (e) {
      wx.hideLoading();
      wx.showToast({ title: '保存失败', icon: 'none' });
    }
  }
});
