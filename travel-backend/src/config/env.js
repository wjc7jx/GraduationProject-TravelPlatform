import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: process.env.PORT || 3000,
  publicBaseUrl: process.env.PUBLIC_BASE_URL || '',
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
};
