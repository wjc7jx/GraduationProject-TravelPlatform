export interface TencentMapSuggestion {
  id: string;
  title: string;
  address: string;
  latitude: number;
  longitude: number;
}

export interface TencentMapReverseGeocodeResult {
  title: string;
  address: string;
  latitude: number;
  longitude: number;
  province: string;
  city: string;
  district: string;
  street: string;
  adcode: string;
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
const REVERSE_GEOCODER_API = 'https://apis.map.qq.com/ws/geocoder/v1';

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

export const reverseGeocodeTencentMap = (params: {
  key: string;
  latitude: number;
  longitude: number;
}): Promise<TencentMapReverseGeocodeResult | null> => {
  const { key, latitude, longitude } = params;

  return new Promise((resolve, reject) => {
    wx.request({
      url: REVERSE_GEOCODER_API,
      method: 'GET',
      data: {
        key,
        location: `${latitude},${longitude}`,
        get_poi: 1
      },
      success: (res) => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`status ${res.statusCode}`));
          return;
        }

        const body = res.data as any;
        if (body?.status !== 0) {
          reject(new Error(body?.message || '腾讯逆地理编码失败'));
          return;
        }

        const result = body?.result || {};
        const component = result?.address_component || {};
        const pois = Array.isArray(result?.pois) ? result.pois : [];
        const poiTitle = pois[0]?.title || '';

        const lat = Number(result?.location?.lat);
        const lng = Number(result?.location?.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
          resolve(null);
          return;
        }

        resolve({
          title: poiTitle || result?.formatted_addresses?.recommend || result?.address || '',
          address: result?.address || '',
          latitude: lat,
          longitude: lng,
          province: component?.province || '',
          city: component?.city || '',
          district: component?.district || '',
          street: component?.street || '',
          adcode: component?.adcode || ''
        });
      },
      fail: (err) => reject(err)
    });
  });
};
