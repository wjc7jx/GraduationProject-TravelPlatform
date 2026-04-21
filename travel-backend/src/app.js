import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import routes from './routes/index.js';
import { notFound } from './middleware/notFound.js';
import { errorHandler } from './middleware/errorHandler.js';
import { env } from './config/env.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOAD_DIR = path.resolve(__dirname, '../../uploads');

const app = express();

// 导出接口需要每次返回完整内容，关闭 ETag 以避免 304 导致前端拿不到 body
app.set('etag', false);

// 基础安全头：关闭 CSP（接口是 JSON + 导出 HTML 另行约束，避免影响 Puppeteer），
// 打开 nosniff、Referrer-Policy、X-DNS-Prefetch-Control 等默认项，
// 保持 /uploads 可被小程序与导出页跨域引用。
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  crossOriginEmbedderPolicy: false,
}));

app.use(cors({ origin: env.cors.origin, credentials: true }));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));

// 提供封面和内容的静态图片访问
app.use('/uploads', express.static(UPLOAD_DIR, {
  dotfiles: 'deny',
  etag: true,
  setHeaders: (res) => {
    // 上传目录可能混入 .html / .svg 等带脚本能力的文件，
    // 强制 nosniff + inline 避免浏览器把资源当脚本宿主执行或强制下载。
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', 'inline');
  },
}));

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api', routes);

app.use(notFound);
app.use(errorHandler);

export default app;
