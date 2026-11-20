import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createApp } from '../src/app.js';
import { memoryStore } from '../src/store.js';

async function withServer(fn) {
  const server = http.createServer(createApp({ store: memoryStore(), version: 'test', log: () => {} }));
  await new Promise((resolve) => server.listen(0, resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    await fn(base);
  } finally {
    server.close();
  }
}

test('creates and lists tasks', async () => {
  await withServer(async (base) => {
    const created = await fetch(`${base}/tasks`, { method: 'POST', body: JSON.stringify({ title: 'Write a Dockerfile' }) });
    assert.equal(created.status, 201);
    const list = await (await fetch(`${base}/tasks`)).json();
    assert.deepEqual(list, [{ id: 1, title: 'Write a Dockerfile', done: false }]);
  });
});

test('rejects a task without a title', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/tasks`, { method: 'POST', body: '{}' });
    assert.equal(res.status, 400);
  });
});

test('health endpoint answers ok', async () => {
  await withServer(async (base) => {
    assert.deepEqual(await (await fetch(`${base}/healthz`)).json(), { status: 'ok' });
  });
});
