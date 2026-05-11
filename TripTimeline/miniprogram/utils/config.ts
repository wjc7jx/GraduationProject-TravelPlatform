export default {
  baseUrl: 'http://localhost:3000/api', // 改为真实的后台接口地址
  /** 与后端 QINIU_PUBLIC_SCHEME、外链协议一致；七牛只能用 http 时改为 'http' */
  qiniuCdnScheme: 'https' as 'http' | 'https',
  timeout: 10000,
  map: {
    tencentKey: 'EWHBZ-AYRE7-I5VXF-PUBI6-LV7ZQ-C6BAN' // 腾讯位置服务 Key（用于地点搜索）
  }
  // appId: 'wx-app-id'
};
