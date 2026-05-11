import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

/** 裸域名补协议：可用 QINIU_PUBLIC_SCHEME=http|https（默认 https），或直接写完整 QINIU_PUBLIC_BASE_URL=http://... */
function normalizeQiniuPublicBaseUrl(raw, schemeForBareHost) {
  let s = String(raw || '').trim().replace(/\/+$/, '');
  if (!s) return '';
  if (!/^https?:\/\//i.test(s)) {
    const sc = schemeForBareHost === 'http' ? 'http' : 'https';
    s = `${sc}://${s}`;
  }
  return s;
}

function inferQiniuPublicUrlScheme(publicBaseUrl) {
  if (!publicBaseUrl) return 'https';
  if (/^http:\/\//i.test(publicBaseUrl)) return 'http';
  return 'https';
}

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: process.env.PORT || 3000,
  publicBaseUrl: process.env.PUBLIC_BASE_URL || '',
  export: {
    puppeteerExecutablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '',
    pdfNavigationTimeoutMs: Number(process.env.PDF_NAVIGATION_TIMEOUT_MS) || 30000,
    pdfResourceWaitTimeoutMs: Number(process.env.PDF_RESOURCE_WAIT_TIMEOUT_MS) || 12000,
    /** PDF 导出时是否把远程（对象存储）资源预取为 data URI。默认开启。 */
    pdfInlineRemote: String(process.env.PDF_INLINE_REMOTE ?? 'true').toLowerCase() !== 'false',
    /** 单个远程资源抓取超时（毫秒） */
    pdfInlineRemoteFetchTimeoutMs: Number(process.env.PDF_INLINE_REMOTE_FETCH_TIMEOUT_MS) || 15000,
    /** 单个远程资源最大体积（字节，默认 15MB） */
    pdfInlineRemoteMaxBytes: Number(process.env.PDF_INLINE_REMOTE_MAX_BYTES) || 15 * 1024 * 1024,
  },
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    name: process.env.DB_NAME || 'travel_db',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'dev_secret',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  wechat: {
    appId: process.env.WX_APP_ID || '',        // 请在 .env 文件中填写真实的 APPID
    appSecret: process.env.WX_APP_SECRET || '' // 请在 .env 文件中填写真实的 APPSECRET
  },
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
  },
  /** local：经服务器 multer 上传；qiniu：仅走对象存储直传（需小程序已改造） */
  storageDriver: (process.env.STORAGE_DRIVER || 'local').toLowerCase(),
  qiniu: (() => {
    const bareScheme =
      String(process.env.QINIU_PUBLIC_SCHEME || 'https').toLowerCase() === 'http'
        ? 'http'
        : 'https';
    const publicBaseUrl = normalizeQiniuPublicBaseUrl(
      process.env.QINIU_PUBLIC_BASE_URL || '',
      bareScheme
    );
    return {
      accessKey: process.env.QINIU_ACCESS_KEY || '',
      secretKey: process.env.QINIU_SECRET_KEY || '',
      bucket: process.env.QINIU_BUCKET || '',
      zone: (process.env.QINIU_ZONE || 'z0').toLowerCase(),
      publicBaseUrl,
      /** 与外链 URL 协议一致，供裸域名 URL 规范化 */
      publicUrlScheme: inferQiniuPublicUrlScheme(publicBaseUrl),
    };
  })(),
};
