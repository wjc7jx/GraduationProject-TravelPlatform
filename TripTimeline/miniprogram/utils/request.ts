export const baseUrl = 'http://localhost:3000/api'; // 请根据实际情况修改

export interface RequestOptions extends Omit<WechatMiniprogram.RequestOption, 'url'> {
  url: string;
}

export const request = <T = any>(options: RequestOptions): Promise<T> => {
  return new Promise((resolve, reject) => {
    const token = wx.getStorageSync('token');
    wx.request({
      url: options.url.startsWith('http') ? options.url : `${baseUrl}${options.url}`,
      method: options.method || 'GET',
      data: options.data,
      header: {
        'content-type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.header,
      },
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data as T);
        } else {
          if (res.statusCode === 401) {
            // Token 过期或未授权，可以触发重新登录
            wx.removeStorageSync('token');
          }
          reject(new Error(`请求失败: ${res.statusCode} ${res.data?.message || ''}`));
        }
      },
      fail: (err) => {
        reject(err);
      }
    });
  });
};
