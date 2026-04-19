import config from './config';

export const baseUrl = config.baseUrl; // 兼容老代码的导出
export const assetBaseUrl = config.baseUrl.replace(/\/api\/?$/, '') || config.baseUrl;

export function asAbsoluteAssetUrl(url: string) {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  // 历史或配置错误：裸域名 CDN，如 xxx.clouddn.com/uploads/xxx.jpg（无协议）
  if (!url.startsWith('/') && /^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}\//i.test(url)) {
    const sch = config.qiniuCdnScheme === 'http' ? 'http' : 'https';
    return `${sch}://${url}`;
  }
  return `${assetBaseUrl}${url.startsWith('/') ? url : `/${url}`}`;
}

export interface RequestOptions extends Omit<WechatMiniprogram.RequestOption, 'url'> {
  url: string;
  method?: WechatMiniprogram.RequestOption['method'] | 'PATCH';
  showLoading?: boolean;
  loadingText?: string;
  data?: any;
}

export const request = <T = any>(options: RequestOptions): Promise<T> => {
  return new Promise((resolve, reject) => {
    const showLoading = options.showLoading !== false;
    if (showLoading) {
      wx.showLoading({
        title: options.loadingText || '加载中...',
        mask: true
      });
    }

    const token = wx.getStorageSync('token');
    let url = options.url.startsWith('http') ? options.url : `${config.baseUrl}${options.url}`;
    
    // 自动追加GET参数
    if ((!options.method || options.method === 'GET') && options.data) {
      const queryParams = Object.keys(options.data)
        .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(options.data[key])}`)
        .join('&');
      if (queryParams) {
        url += (url.includes('?') ? '&' : '?') + queryParams;
      }
    }

    wx.request({
      url,
      method: options.method || 'GET',
      data: options.method !== 'GET' ? options.data : {},
      header: {
        'content-type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.header,
      },
      timeout: options.timeout || config.timeout,
      success: (res) => {
        if (showLoading) wx.hideLoading();

        // 验证HTTP状态码 2xx
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const data = res.data as any;
          // 若后端包含通用业务状态码如 code，处理业务错误
          if (data && typeof data === 'object' && 'code' in data) {
            if (data.code === 0 || (typeof data.code === 'number' && data.code >= 200 && data.code < 300)) {
              // 兼容: 若希望全局取 data.data 可在这里拆解，现为了不破坏已有的功能，直接原样返回或取标准data字段
              resolve((data.data !== undefined ? data.data : data) as T);
            } else {
              if (data.code === 401) {
                wx.removeStorageSync('token');
                wx.removeStorageSync('userInfo');
                wx.redirectTo({ url: '/pages/index/index' }); // 没有login先跳index重配
              }
              wx.showToast({
                title: data.msg || data.message || '业务请求失败',
                icon: 'none',
                duration: 2000
              });
              reject(data);
            }
          } else {
            // 没有标准code格式，说明原来业务就是直接拿 data 格式，直接返回
            resolve(data as T);
          }
        } else {
          // 处理 401 和其他非 2xx HTTP 错误状态码
          if (res.statusCode === 401) {
            wx.removeStorageSync('token');
            wx.removeStorageSync('userInfo');
          }
          const errorMessage = (res.data as any)?.message || `请求失败: ${res.statusCode}`;
          wx.showToast({
            title: errorMessage,
            icon: 'none',
            duration: 2000
          });
          reject(new Error(errorMessage));
        }
      },
      fail: (err) => {
        if (showLoading) wx.hideLoading();
        wx.showToast({
          title: '网络连接失败',
          icon: 'none',
          duration: 2000
        });
        reject(err);
      }
    });
  });
};
