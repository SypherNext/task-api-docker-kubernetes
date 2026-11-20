// Used by the Dockerfile HEALTHCHECK. Exit code 0 = healthy, 1 = unhealthy.
const port = process.env.PORT ?? 3000;
fetch(`http://127.0.0.1:${port}/healthz`, { signal: AbortSignal.timeout(2000) })
  .then((res) => process.exit(res.ok ? 0 : 1))
  .catch(() => process.exit(1));
