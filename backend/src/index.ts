import { createContainer } from './app/container';
import { createApp } from './app/createApp';
import { config } from './config';
import { verifyDatabaseConnection } from './infrastructure/db/mysql';

async function start() {
  const container = createContainer();

  try {
    await verifyDatabaseConnection(container.db.pool);
    await container.db.initializeSchema();

    const app = createApp(container);
    const server = app.listen(config.port, () => {
      console.log(`Server running on port ${config.port}`);
      console.log(`API available at http://localhost:${config.port}/api`);
    });

    const shutdown = async () => {
      server.close(async () => {
        await container.db.pool.end();
        process.exit(0);
      });
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } catch (error) {
    console.error('Failed to start server:', error);
    await container.db.pool.end();
    process.exit(1);
  }
}

start();
