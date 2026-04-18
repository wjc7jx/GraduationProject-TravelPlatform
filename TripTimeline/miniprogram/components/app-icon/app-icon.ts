type IconKey =
  | 'map'
  | 'edit'
  | 'microphone'
  | 'location'
  | 'camera'
  | 'export'
  | 'link'
  | 'mobile'
  | 'qrcode'
  | 'play'
  | 'pause'
  | 'close'
  | 'delete'
  | 'calendar'
  | 'tag'
  | 'eye'
  | 'visibility'
  | 'clock'
  | 'search'
  | 'backIcon'
  | 'enter'
  | 'plus'
  | 'settings'
  | 'refresh'
  | 'copy'
  | 'world';

const ICON_MAP: Record<IconKey, string> = {
  map: '/assets/img/map.svg',
  edit: '/assets/img/edit.svg',
  microphone: '/assets/img/microphone.svg',
  location: '/assets/img/footprint.svg',
  camera: '/assets/img/image.svg',
  export: '/assets/img/export.svg',
  link: '/assets/img/link.svg',
  mobile: '/assets/img/qrcode.svg',
  qrcode: '/assets/img/qrcode.svg',
  play: '/assets/img/play.svg',
  pause: '/assets/img/pause.svg',
  close: '/assets/img/close.svg',
  delete: '/assets/img/delete.svg',
  calendar: '/assets/img/calendar.svg',
  tag: '/assets/img/label.svg',
  eye: '/assets/img/visibility.svg',
  visibility: '/assets/img/visibility.svg',
  clock: '/assets/img/clock.svg',
  search: '/assets/img/search.svg',
  world: '/assets/img/world.svg',
  backIcon: '/assets/img/back.svg',
  enter: '/assets/img/enter.svg',
  plus: '/assets/img/plus.svg',
  settings: '/assets/img/settings.svg',
  refresh: '/assets/img/refresh.svg',
  copy: '/assets/img/copy.svg'
};

const SIZE_MAP: Record<string, string> = {
  sm: '48rpx',
  md: '64rpx',
  lg: '96rpx'
};

Component({
  properties: {
    name: {
      type: String,
      value: ''
    },
    size: {
      type: String,
      value: 'md'
    },
    color: {
      type: String,
      value: ''
    },
    fallback: {
      type: String,
      value: '/assets/img/no-data.svg'
    },
    customClass: {
      type: String,
      value: ''
    }
  },

  data: {
    src: '/assets/img/no-data.svg',
    resolvedSize: '64rpx'
  },

  observers: {
    'name, size, fallback': function (name: string, size: string, fallback: string) {
      const iconSrc = ICON_MAP[name as IconKey] || fallback || '/assets/img/no-data.svg';
      const resolvedSize = SIZE_MAP[size] || size || '64rpx';
      this.setData({
        src: iconSrc,
        resolvedSize
      });
    }
  }
});
