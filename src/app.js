import os from 'node:os';

function send(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(body === undefined ? '' : JSON.stringify(body));
}

async function readJson(req) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 10_000) throw new Error('body too large');
  }
  return raw ? JSON.parse(raw) : {};
}

// Returns the request handler. Every route answers with JSON.
export function createApp({ store, version, log }) {
  return async function handle(req, res) {
    const started = Date.now();
    const url = new URL(req.url, 'http://localhost');
    const match = url.pathname.match(/^\/tasks\/(\d+)$/);
    try {
      if (req.method === 'GET' && url.pathname === '/') {
        send(res, 200, { service: 'task-api', version, host: os.hostname(), store: store.kind });
      } else if (req.method === 'GET' && url.pathname === '/healthz') {
        send(res, 200, { status: 'ok' });
      } else if (req.method === 'GET' && url.pathname === '/readyz') {
        try {
          await store.ping();
          send(res, 200, { status: 'ready' });
        } catch (err) {
          send(res, 503, { status: 'not ready', error: err.message });
        }
      } else if (req.method === 'GET' && url.pathname === '/tasks') {
        const tasks = await store.list();
        const done = url.searchParams.get('done');
        send(res, 200, done === null ? tasks : tasks.filter((t) => String(t.done) === done));
      } else if (req.method === 'POST' && url.pathname === '/tasks') {
        const { title } = await readJson(req);
        if (typeof title !== 'string' || title.trim() === '') {
          send(res, 400, { error: 'title is required' });
        } else {
          send(res, 201, await store.create(title.trim()));
        }
      } else if (req.method === 'PATCH' && match) {
        const { done } = await readJson(req);
        const task = await store.update(Number(match[1]), Boolean(done));
        if (task) send(res, 200, task);
        else send(res, 404, { error: 'not found' });
      } else if (req.method === 'DELETE' && match) {
        if (await store.remove(Number(match[1]))) send(res, 204);
        else send(res, 404, { error: 'not found' });
      } else {
        send(res, 404, { error: 'not found' });
      }
    } catch (err) {
      send(res, 500, { error: 'internal error' });
      log({ msg: 'request failed', error: err.message });
    }
    if (url.pathname !== '/healthz' && url.pathname !== '/readyz') {
      log({ method: req.method, path: url.pathname, status: res.statusCode, ms: Date.now() - started });
    }
  };
}
