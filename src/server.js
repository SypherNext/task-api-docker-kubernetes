import http from 'node:http';
import { loadConfig } from './config.js';
import { createApp } from './app.js';
import { memoryStore, postgresStore } from './store.js';

const log = (fields) => console.log(JSON.stringify(fields));

let config;
try {
  config = loadConfig();
} catch (err) {
  log({ msg: 'invalid configuration', error: err.message });
  process.exit(1);
}

const store = config.db ? postgresStore(config.db, log) : memoryStore();
try {
  await store.init();
} catch (err) {
  log({ msg: 'could not reach the database, exiting', error: err.message });
  process.exit(1);
}

const server = http.createServer(createApp({ store, version: config.version, log }));
server.listen(config.port, () => {
  log({ msg: 'task-api listening', port: config.port, store: store.kind, version: config.version });
});

// Docker and Kubernetes send SIGTERM before they stop a container.
// Stop accepting connections, finish in-flight requests, close the pool, exit.
function shutdown(signal) {
  log({ msg: 'shutting down', signal });
  server.close(async () => {
    await store.close();
    process.exit(0);
  });
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
