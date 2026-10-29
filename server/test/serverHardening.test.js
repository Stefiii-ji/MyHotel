import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createServer } from 'node:http';
import test from 'node:test';
import express from 'express';
import {
  createHealthHandler,
  createReadinessHandler,
} from '../src/controllers/healthController.js';
import { errorHandler } from '../src/middleware/errorHandler.js';
import { createRateLimit } from '../src/middleware/rateLimit.js';
import { createHealthRouter } from '../src/routes/healthRoutes.js';
import { httpError } from '../src/utils/httpError.js';
import {
  registerGracefulShutdown,
  startDatabaseConnection,
} from '../src/serverLifecycle.js';

function createResponse() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

test('exposes only deliberate client-safe errors and keeps parser/internal details private', () => {
  const response = createResponse();
  errorHandler(new Error('database connection string and filesystem path'), {}, response, assert.fail);
  assert.equal(response.statusCode, 500);
  assert.equal(response.body.message, 'An unexpected server error occurred');

  const parseErrorResponse = createResponse();
  errorHandler(
    Object.assign(new Error('unexpected token near private request content'), { status: 400 }),
    {},
    parseErrorResponse,
    assert.fail,
  );
  assert.equal(parseErrorResponse.body.message, 'Invalid request');

  const knownValidationError = createResponse();
  errorHandler(httpError(400, 'Invalid group details'), {}, knownValidationError, assert.fail);
  assert.equal(knownValidationError.body.message, 'Invalid group details');
});

test('health endpoint reports liveness and database readiness without infrastructure details', () => {
  let ready = false;
  const health = createHealthHandler({ isDatabaseReady: () => ready });
  const response = createResponse();
  health({}, response);
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.status, 'ok');
  assert.equal(response.body.database, 'unavailable');
  assert.equal('connectionString' in response.body, false);

  ready = true;
  health({}, response);
  assert.equal(response.body.database, 'ready');
});

test('readiness endpoint returns 503 until the database is ready', () => {
  let ready = false;
  const readiness = createReadinessHandler({ isDatabaseReady: () => ready });
  const response = createResponse();

  readiness({}, response);
  assert.equal(response.statusCode, 503);
  assert.deepEqual(response.body, { status: 'unavailable', database: 'unavailable' });

  ready = true;
  readiness({}, response);
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, { status: 'ready', database: 'ready' });
});

test('mounts a non-cacheable HTTP readiness endpoint', async () => {
  const app = express();
  app.use('/api/health', createHealthRouter({ isDatabaseReady: () => false }));
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/health/ready`);
    assert.equal(response.status, 503);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await response.json(), {
      status: 'unavailable',
      database: 'unavailable',
    });
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
});

test('rate limit permits normal swiping then blocks excess requests for the member', () => {
  let now = 1000;
  const rateLimit = createRateLimit({
    limit: 2,
    intervalMs: 1000,
    keyForRequest: (request) => request.memberId,
    now: () => now,
  });
  function call(memberId) {
    let error;
    rateLimit({ memberId }, {}, (nextError) => { error = nextError; });
    return error;
  }
  assert.equal(call('member-a'), undefined);
  assert.equal(call('member-a'), undefined);
  assert.equal(call('member-a').statusCode, 429);
  assert.equal(call('member-b'), undefined);
  now += 1000;
  assert.equal(call('member-a'), undefined);
});

test('database startup retries failures with backoff and cancels retry on shutdown', async () => {
  let attempts = 0;
  let scheduled;
  const errors = [];
  let connected = 0;
  const lifecycle = startDatabaseConnection({
    async connect() {
      attempts += 1;
      if (attempts === 1) throw new Error('redacted failure');
    },
    onConnected() { connected += 1; },
    onError(error) { errors.push(error.message); },
    initialRetryMs: 10,
    maximumRetryMs: 20,
    setTimer(callback, delay) {
      scheduled = { callback, delay };
      return { unref() {} };
    },
    clearTimer() { scheduled = null; },
  });

  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(attempts, 1);
  assert.equal(errors.length, 1);
  assert.equal(scheduled.delay, 10);
  scheduled.callback();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(attempts, 2);
  assert.equal(connected, 1);
  await lifecycle.stop();
});

test('shutdown stops accepting requests and disconnects the database once', async () => {
  const server = createServer((_request, response) => response.end('ok'));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const signalSource = new EventEmitter();
  const logEntries = [];
  let disconnectCount = 0;
  const shutdown = registerGracefulShutdown({
    server,
    signalSource,
    disconnect: async () => { disconnectCount += 1; },
    logger: {
      info(message) { logEntries.push(message); },
      error(entry) { logEntries.push(entry); },
    },
  });

  await shutdown.shutdown('SIGTERM');
  await shutdown.shutdown('SIGTERM');
  assert.equal(disconnectCount, 1);
  assert.equal(logEntries.length, 1);
  assert.equal(signalSource.listenerCount('SIGINT'), 1);
  shutdown.removeSignalHandlers();
  assert.equal(signalSource.listenerCount('SIGINT'), 0);
});
