import { asAbsoluteAssetUrl } from '../../utils/request';
import { uploadFileToQiniu } from '../../utils/qiniuUpload';

type Phase = 'idle' | 'recording' | 'uploading' | 'ready';
type InitPlayerOptions = {
  enterReadyOnPlayable?: boolean;
  onPlayable?: () => void;
  onInvalid?: () => void;
};

function formatTime(seconds: number): string {
  const s = Math.floor(seconds || 0);
  const m = Math.floor(s / 60);
  return `${m}:${(s % 60).toString().padStart(2, '0')}`;
}

Component({
  recorderManager: null as WechatMiniprogram.RecorderManager | null,
  innerAudioContext: null as WechatMiniprogram.InnerAudioContext | null,
  recordTicker: null as any,
  recordStartMs: 0,
  isSeeking: false,

  properties: {
    /** { url: string, name: string } — 编辑模式回填 */
    value: {
      type: Object,
      value: null
    }
  },

  data: {
    phase: 'idle' as Phase,
    // 录音
    recordingSeconds: 0,
    recordingProgress: 0,
    recordingTimeDisplay: '0:00',
    // 上传
    uploadingText: '正在处理音频...',
    // 播放器
    displayName: '',
    previewSrc: '',
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    currentTimeDisplay: '0:00',
    durationDisplay: '--:--'
  },

  observers: {
    'value': function (val: any) {
      if (val?.url && this.data.phase === 'idle') {
        const src = asAbsoluteAssetUrl(val.url);
        this.setData({
          phase: 'ready',
          displayName: val.name || '音频文件',
          previewSrc: src,
          currentTimeDisplay: '0:00',
          durationDisplay: '--:--',
          currentTime: 0,
          duration: 0
        });
        this._initPlayer(src);
      }
    }
  },

  lifetimes: {
    created() {
      this.recorderManager = wx.getRecorderManager();
      this._initRecorderEvents();
    },
    detached() {
      this._cleanup();
    }
  },

  methods: {
    // ─── Recorder Events ───────────────────────────────────────────

    _initRecorderEvents() {
      const rm = this.recorderManager!;

      rm.onStop(async (res: any) => {
        this._stopTicker();
        const filename = `rec-${Date.now()}.mp3`;
        this.setData({
          phase: 'uploading',
          uploadingText: '正在上传录音...',
          displayName: filename
        });

        try {
          const uploaded = await this._uploadFile(res.tempFilePath);
          const url: string = uploaded?.url || '';
          const src = url ? asAbsoluteAssetUrl(url) : res.tempFilePath;
          this.setData({ phase: 'ready', previewSrc: src });
          this._initPlayer(src);
          this.triggerEvent('audiochange', { url, name: filename, path: res.tempFilePath });
          wx.showToast({ title: '录音已保存', icon: 'success' });
        } catch {
          this.setData({ phase: 'idle' });
          wx.showToast({ title: '上传失败，请重试', icon: 'none' });
        }
      });

      rm.onError(() => {
        this._stopTicker();
        this.setData({ phase: 'idle', recordingSeconds: 0, recordingProgress: 0, recordingTimeDisplay: '0:00' });
        wx.showToast({ title: '录音出错', icon: 'none' });
      });
    },

    // ─── Start / Stop Recording ────────────────────────────────────

    async startRecord() {
      try {
        await new Promise<void>((resolve, reject) => {
          wx.authorize({
            scope: 'scope.record',
            success: () => resolve(),
            fail: () => reject(new Error('no auth'))
          });
        });
      } catch {
        wx.showModal({
          title: '需要麦克风权限',
          content: '请在设置中允许录音权限后重试',
          showCancel: true,
          success: (res) => { if (res.confirm) wx.openSetting({}); }
        });
        return;
      }

      this.setData({ phase: 'recording', recordingSeconds: 0, recordingProgress: 0, recordingTimeDisplay: '0:00' });
      this.recordStartMs = Date.now();

      this._stopTicker();
      this.recordTicker = setInterval(() => {
        const secs = Math.floor((Date.now() - this.recordStartMs) / 1000);
        this.setData({
          recordingSeconds: secs,
          recordingTimeDisplay: formatTime(secs),
          recordingProgress: Math.min((secs / 60) * 100, 100)
        });
        if (secs >= 60) this.stopRecord();
      }, 500);

      this.recorderManager!.start({
        duration: 60000,
        sampleRate: 44100,
        numberOfChannels: 1,
        encodeBitRate: 96000,
        format: 'mp3'
      });
    },

    stopRecord() {
      if (this.data.phase !== 'recording' || !this.recorderManager) return;
      this.recorderManager.stop();
    },

    // ─── Choose File ───────────────────────────────────────────────

    chooseFile() {
      (wx as any).chooseMessageFile({
        count: 1,
        type: 'file',
        extension: ['mp3', 'm4a', 'wav', 'aac'],
        success: async (res: any) => {
          const file = res.tempFiles?.[0];
          if (!file) return;

          const allowedSuffixes = ['.mp3', '.m4a', '.wav', '.aac'];
          const lowerName = String(file.name || '').toLowerCase();
          const lowerPath = String(file.path || '').toLowerCase();
          const isAllowed = allowedSuffixes.some((suffix) =>
            lowerName.endsWith(suffix) || lowerPath.endsWith(suffix)
          );
          if (!isAllowed) {
            wx.showToast({ title: '仅支持 MP3/M4A/WAV/AAC', icon: 'none' });
            return;
          }

          this.setData({
            phase: 'uploading',
            uploadingText: '正在上传音频...',
            displayName: file.name || 'audio'
          });

          try {
            const uploaded = await this._uploadFile(file.path);
            const url: string = uploaded?.url || '';
            const src = url ? asAbsoluteAssetUrl(url) : file.path;

            await new Promise<void>((resolve, reject) => {
              let settled = false;
              const timer = setTimeout(() => {
                if (settled) return;
                settled = true;
                reject(new Error('audio parse timeout'));
              }, 3000);

              this._initPlayer(src, {
                enterReadyOnPlayable: true,
                onPlayable: () => {
                  if (settled) return;
                  settled = true;
                  clearTimeout(timer);
                  resolve();
                },
                onInvalid: () => {
                  if (settled) return;
                  settled = true;
                  clearTimeout(timer);
                  reject(new Error('invalid audio file'));
                }
              });
            });

            this.triggerEvent('audiochange', { url, name: file.name || 'audio', path: file.path });
          } catch {
            this.setData({ phase: 'idle' });
            wx.showToast({ title: '文件无效或上传失败，请重试', icon: 'none' });
          }
        }
      });
    },

    // ─── Player ────────────────────────────────────────────────────

    _initPlayer(src: string, options?: InitPlayerOptions) {
      if (this.innerAudioContext) {
        try { this.innerAudioContext.destroy(); } catch {}
        this.innerAudioContext = null;
      }

      const ctx = wx.createInnerAudioContext();
      ctx.src = src;
      ctx.autoplay = false;

      let playableNotified = false;
      const notifyPlayable = () => {
        if (playableNotified) return;
        playableNotified = true;
        if (options?.enterReadyOnPlayable && this.data.phase !== 'ready') {
          this.setData({ phase: 'ready', previewSrc: src });
        }
        options?.onPlayable?.();
      };

      ctx.onCanplay(() => {
        notifyPlayable();
        if (ctx.duration && isFinite(ctx.duration) && ctx.duration > 0) {
          this.setData({ duration: ctx.duration, durationDisplay: formatTime(ctx.duration) });
        }
      });

      ctx.onTimeUpdate(() => {
        if (!this.isSeeking) {
          this.setData({
            currentTime: ctx.currentTime,
            currentTimeDisplay: formatTime(ctx.currentTime)
          });
          // 尝试补全 duration（有时 onCanplay 未触发）
          if (ctx.duration && isFinite(ctx.duration) && ctx.duration > 0 && this.data.duration === 0) {
            this.setData({ duration: ctx.duration, durationDisplay: formatTime(ctx.duration) });
            notifyPlayable();
          }
        }
      });

      ctx.onEnded(() => {
        this.setData({ isPlaying: false, currentTime: 0, currentTimeDisplay: '0:00' });
      });

      ctx.onError(() => {
        this.setData({ isPlaying: false });
        options?.onInvalid?.();
        wx.showToast({ title: '音频加载失败', icon: 'none' });
      });

      this.innerAudioContext = ctx;
    },

    togglePlay() {
      const ctx = this.innerAudioContext;
      if (!ctx) return;
      if (this.data.isPlaying) {
        ctx.pause();
        this.setData({ isPlaying: false });
      } else {
        ctx.play();
        this.setData({ isPlaying: true });
      }
    },

    onSliderChanging(e: any) {
      this.isSeeking = true;
      this.setData({
        currentTime: e.detail.value,
        currentTimeDisplay: formatTime(e.detail.value)
      });
    },

    onSliderChange(e: any) {
      const seekTo = Number(e.detail.value);
      this.isSeeking = false;
      if (this.innerAudioContext) {
        this.innerAudioContext.seek(seekTo);
      }
      this.setData({ currentTime: seekTo, currentTimeDisplay: formatTime(seekTo) });
    },

    // ─── Remove / Change ───────────────────────────────────────────

    removeAudio() {
      wx.showModal({
        title: '移除音频',
        content: '确定要移除当前音频吗？',
        confirmText: '移除',
        confirmColor: '#a1432a',
        success: (res) => {
          if (res.confirm) {
            this._resetToIdle();
            this.triggerEvent('audioremove', {});
          }
        }
      });
    },

    changeAudio() {
      wx.showActionSheet({
        itemList: ['重新录制', '从文件选择'],
        success: (res) => {
          this._resetToIdle();
          this.triggerEvent('audioremove', {});
          if (res.tapIndex === 0) {
            setTimeout(() => this.startRecord(), 150);
          } else {
            setTimeout(() => this.chooseFile(), 150);
          }
        }
      });
    },

    // ─── Helpers ───────────────────────────────────────────────────

    _resetToIdle() {
      if (this.innerAudioContext) {
        try { this.innerAudioContext.stop(); this.innerAudioContext.destroy(); } catch {}
        this.innerAudioContext = null;
      }
      this.setData({
        phase: 'idle',
        isPlaying: false,
        currentTime: 0,
        duration: 0,
        currentTimeDisplay: '0:00',
        durationDisplay: '--:--',
        displayName: '',
        previewSrc: '',
        recordingSeconds: 0,
        recordingProgress: 0,
        recordingTimeDisplay: '0:00'
      });
    },

    _stopTicker() {
      if (this.recordTicker) {
        clearInterval(this.recordTicker);
        this.recordTicker = null;
      }
    },

    _cleanup() {
      this._stopTicker();
      if (this.data.phase === 'recording' && this.recorderManager) {
        try { this.recorderManager.stop(); } catch {}
      }
      if (this.innerAudioContext) {
        try { this.innerAudioContext.destroy(); } catch {}
        this.innerAudioContext = null;
      }
    },

    _uploadFile(filePath: string): Promise<any> {
      const filename = filePath.split('/').pop() || 'audio.mp3';
      return uploadFileToQiniu(filePath, { purpose: 'audio', filename });
    }
  }
});
