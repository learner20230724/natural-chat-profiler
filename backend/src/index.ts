import { createContainer } from './app/container';
import { createApp } from './app/createApp';
import { config } from './config';
import { verifyDatabaseConnection } from './infrastructure/db/mysql';

async function start() {
  const container = createContainer();

  try {
    await verifyDatabaseConnection(container.db.pool);
    const schemaResult = await container.db.initializeSchema();

    if (schemaResult.appliedSteps.length > 0) {
      console.log(
        `[schema] applied steps: ${schemaResult.appliedSteps
          .map((step) => `v${step.version} ${step.name}`)
          .join(', ')}`
      );
    } else {
      console.log(`[schema] schema already up to date at v${schemaResult.currentVersion}`);
    }

    const app = createApp(container);
    const server = app.listen(config.port, () => {
      console.log(`Server running on port ${config.port}`);
      console.log(`API available at http://localhost:${config.port}/api`);
    });

    const shutdown = async () => {
      server.close(() => {
        void (async () => {
          try {
            await container.db.pool.end();
            process.exit(0);
          } catch (error) {
            console.error('Error during shutdown:', error);
            process.exit(1);
          }
        })();
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
