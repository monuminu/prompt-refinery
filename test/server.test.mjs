import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer, request } from 'node:http';
import { loadConfig } from '../src/config.mjs';
import { createApp } from '../src/server.mjs';

async function listen(t, server) {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  return `http://127.0.0.1:${server.address().port}`;
}
const post = (body, headers = {}) => ({ method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });

test('config endpoint exposes readiness and model but never credentials or .env', async t => {
  const base = await listen(t, createApp(loadConfig({ OPENAI_API_KEY: 'test-secret-key' })));
  const res = await fetch(`${base}/api/config`);
  assert.equal(res.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await res.json(), { configured: true, model: 'gpt-6-astra' });
  for (const path of ['/.env', '/src/config.mjs', '/knowledge/playbook.md', '/%2e%2e/.env']) {
    assert.equal((await fetch(`${base}${path}`)).status, 404);
  }
});

test('only allowlisted static assets are served with content security headers', async t => {
  const base = await listen(t, createApp(loadConfig({})));
  const res = await fetch(base);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/html/);
  assert.match(res.headers.get('content-security-policy'), /default-src 'self'/);
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.equal((await fetch(`${base}/app.js`)).status, 200);
  assert.equal((await fetch(`${base}/styles.css`)).status, 200);
});

test('foreign origins and rebinding hosts are rejected before optimization', async t => {
  const base = await listen(t, createApp(loadConfig({})));
  assert.equal((await fetch(`${base}/api/optimize`, post({ prompt: 'hello' }, { origin: 'https://evil.example' }))).status, 403);
  const rebound = await new Promise((resolve, reject) => {
    const req = request(`${base}/api/config`, { headers: { host: 'evil.example' } }, res => { res.resume(); resolve(res.statusCode); });
    req.on('error', reject); req.end();
  });
  assert.equal(rebound, 403);
  assert.equal((await fetch(`${base}/api/optimize`, post({ prompt: 'hello' }, { origin: base }))).status, 503);
});

test('invalid content type, malformed JSON, unknown route and oversized bodies are handled', async t => {
  const base = await listen(t, createApp(loadConfig({})));
  const wrongType = await fetch(`${base}/api/optimize`, { method: 'POST', body: 'prompt=hello' });
  assert.equal(wrongType.status, 415);
  const invalid = await fetch(`${base}/api/optimize`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{' });
  assert.equal(invalid.status, 400);
  const huge = await fetch(`${base}/api/optimize`, post({ prompt: 'x'.repeat(270000) }));
  assert.equal(huge.status, 413);
  assert.equal((await fetch(`${base}/api/nope`, post({ prompt: 'hello' }))).status, 404);
  assert.equal((await fetch(`${base}/api/optimize`)).status, 405);
  assert.equal((await fetch(`${base}/api/optimize`, post({ prompt: '' }))).status, 400);
});

test('browser API round trip preserves prompt and returns validated provider output', async t => {
  const expected = { optimizedPrompt: 'Summarize {{doc}} in Hindi.', changes: ['Clarified format.'], assumptions: [], checks: ['Compare with a long document.'] };
  let seenPrompt;
  const provider = await listen(t, createServer(async (req, res) => {
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    seenPrompt = JSON.parse(JSON.parse(Buffer.concat(chunks).toString('utf8')).input[0].content).prompt;
    res.end(JSON.stringify({ status: 'completed', output: [{ type: 'message', role: 'assistant',
      content: [{ type: 'output_text', text: JSON.stringify(expected) }] }] }));
  }));
  const base = await listen(t, createApp(loadConfig({ OPENAI_API_KEY: 'test-secret-key', OPENAI_BASE_URL: `${provider}/v1` })));
  const response = await fetch(`${base}/api/optimize`, post({ prompt: '文'.repeat(30000) }, { origin: base }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), expected);
  assert.equal(seenPrompt.length, 30000);
});

test('one active rewrite prevents accidental simultaneous paid requests', async t => {
  let release;
  const hold = new Promise(resolve => { release = resolve; });
  let entered;
  const ready = new Promise(resolve => { entered = resolve; });
  const provider = await listen(t, createServer(async (req, res) => {
    req.resume(); entered(); await hold;
    res.writeHead(429); res.end();
  }));
  const base = await listen(t, createApp(loadConfig({ OPENAI_API_KEY: 'test-key', OPENAI_BASE_URL: provider })));
  const first = fetch(`${base}/api/optimize`, post({ prompt: 'hello' }));
  await ready;
  try {
    const second = await fetch(`${base}/api/optimize`, post({ prompt: 'hello' }));
    assert.equal(second.status, 429);
  } finally { release(); }
  assert.equal((await first).status, 502);
  // The slot must be released after provider errors.
  assert.equal((await fetch(`${base}/api/optimize`, post({ prompt: 'hello' }))).status, 502);
});
