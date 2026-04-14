import app from './app.js';
import { env } from './config/env.js';
import { sequelize, testConnection } from './models/index.js';

async function bootstrap() {
  await testConnection();
  await sequelize.sync();

  app.listen(env.port, () => {
    console.log(`🚀 服务正在运行于 http://10.238.184.74:${env.port}`);      
  });
}

bootstrap().catch((err) => {
  console.error('服务器启动失败:', err);
});
