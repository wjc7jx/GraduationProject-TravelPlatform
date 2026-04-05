export interface TencentMapSuggestion {
  id: string;
  title: string;
  address: string;
  latitude: number;
  longitude: number;
}

interface SearchSuggestionParams {
  key: string;
  keyword: string;
  region: string;
  latitude?: number;
  longitude?: number;
  pageSize?: number;
}

const SUGGESTION_API = 'https://apis.map.qq.com/ws/place/v1/suggestion';

export const searchTencentMapSuggestions = (params: SearchSuggestionParams): Promise<TencentMapSuggestion[]> => {
  const { key, keyword, region, latitude, longitude } = params;
  const pageSize = Math.min(20, Math.max(1, params.pageSize || 12));
  const hasLocation = Number.isFinite(latitude) && Number.isFinite(longitude);

  return new Promise((resolve, reject) => {
    wx.request({
      url: SUGGESTION_API,
      method: 'GET',
      data: {
        key,
        keyword,
        region,
        region_fix: 0,
        page_size: pageSize,
        ...(hasLocation ? { location: `${latitude},${longitude}` } : {})
      },
      success: (res) => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`status ${res.statusCode}`));
          return;
        }

        const body = res.data as any;
        if (body?.status !== 0) {
          reject(new Error(body?.message || '腾讯地点搜索失败'));
          return;
        }

        const rows = Array.isArray(body?.data) ? body.data : [];
        const suggestions = rows
          .map((item: any, index: number) => ({
            id: `${item.id || index}`,
            title: item.title || keyword,
            address: item.address || '',
            latitude: Number(item.location?.lat),
            longitude: Number(item.location?.lng)
          }))
          .filter((item: TencentMapSuggestion) => Number.isFinite(item.latitude) && Number.isFinite(item.longitude));

        resolve(suggestions);
      },
      fail: (err) => reject(err)
    });
  });
};
