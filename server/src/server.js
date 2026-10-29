import app from './app.js';
import mongoose from 'mongoose';
import { connectToDatabase, getDatabaseConnectionError } from './config/database.js';
import { env } from './config/env.js';
import { registerGracefulShutdown, startDatabaseConnection } from './serverLifecycle.js';

const server = app.listen(env.PORT, '0.0.0.0', () => {
  console.log(`StaySwipe API listening on port ${env.PORT}`);
});

server.on('error', (error) => {
  console.error({ event: 'http_server_listen_failed', name: error?.name ?? 'Error' });
  process.exitCode = 1;
});

const databaseConnection = startDatabaseConnection({
  connect: connectToDatabase,
  onConnected() {
    console.log('MongoDB connection established.');
  },
  onError(error) {
    console.error(getDatabaseConnectionError(error));
  },
});

const shutdown = registerGracefulShutdown({
  server,
  disconnect: async () => {
    await databaseConnection.stop();
    await mongoose.disconnect();
  },
});
