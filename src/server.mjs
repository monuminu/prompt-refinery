import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { readEnv } from './config.mjs';
import { AppError, optimize } from './optimizer.mjs';

const assets = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
  ['/favicon.svg', ['favicon.svg', 'image/svg+xml']],
].map(([route, [name, type]]) => [route, { type, body: readFileSync(new URL(`../public/${name}`, import.meta.url)) }]));

function send(res, status, value) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(value));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let bytes = 0;
    const chunks = [];
    req.on('data', chunk => {
      bytes += chunk.length;
      if (bytes > 262144) { chunks.length = 0; reject(new AppError('Request is too large (maximum 256 KiB).', 413)); }
      else chunks.push(chunk);
    });
    req.on('end', () => {
      if (bytes > 262144) return;
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch { reject(new AppError('Request body must be valid JSON.')); }
    });
    req.on('error', () => reject(new AppError('Request body could not be read.')));
  });
}

export function createApp(config) {
  let busy = false;
  const server = createServer(async (req, res) => {
    res.setHeader('cache-control', 'no-store');
    res.setHeader('x-content-type-options', 'nosniff');
    res.setHeader('x-frame-options', 'DENY');
    res.setHeader('referrer-policy', 'no-referrer');
    res.setHeader('content-security-policy', "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' blob:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
    try {
      const hosts = [`localhost:${req.socket.localPort}`, `127.0.0.1:${req.socket.localPort}`];
      if (!hosts.includes(req.headers.host)) throw new AppError('This app only accepts local requests.', 403);
      if (req.headers.origin && req.headers.origin !== `http://${req.headers.host}`) throw new AppError('Cross-origin requests are not allowed.', 403);
      const path = new URL(req.url, 'http://localhost').pathname;
      if (req.method === 'GET' && assets.has(path)) {
        const asset = assets.get(path);
        res.writeHead(200, { 'content-type': asset.type }); res.end(asset.body); return;
      }
      if (req.method === 'GET' && path === '/api/config') {
        send(res, 200, { configured: Boolean(config.apiKey), model: config.model }); return;
      }
      if (path !== '/api/optimize') throw new AppError('Not found.', 404);
      if (req.method !== 'POST') { res.setHeader('allow', 'POST'); throw new AppError('Use POST for optimization.', 405); }
      if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) throw new AppError('Use application/json.', 415);
      const input = await readBody(req);
      if (busy) throw new AppError('A revision is already running. Wait for it to finish.', 429);
      busy = true;
      try { send(res, 200, await optimize(input, config)); }
      finally { busy = false; }
    } catch (error) {
      const safe = error instanceof AppError ? error : new AppError('An unexpected server error occurred.', 500);
      if (!res.headersSent && !res.destroyed) send(res, safe.status, { error: safe.message });
    }
  });
  server.requestTimeout = 30000;
  server.headersTimeout = 15000;
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const config = readEnv();
    const server = createApp(config);
    server.on('error', error => {
      console.error(error.code === 'EADDRINUSE' ? 'Port is in use. Change PORT in .env.' : 'Could not start the local server.');
      process.exitCode = 1;
    });
    server.listen(config.port, '127.0.0.1', () => {
      console.log(`Prompt Refinery: http://127.0.0.1:${config.port}`);
      console.log(config.apiKey ? `Model: ${config.model}` : 'Add OPENAI_API_KEY to .env, then restart to enable optimization.');
    });
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
