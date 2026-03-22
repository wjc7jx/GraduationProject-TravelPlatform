import app from './app.js';
import { env } from './config/env.js';
import { sequelize, testConnection } from './models/index.js';

async function bootstrap() {
  await testConnection();
  await sequelize.sync();

  app.listen(env.port, () => {
    console.log(`🚀 Server is running at http://localhost:${env.port}`);
  });
}

bootstrap().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
